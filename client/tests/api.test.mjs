// Unit tests for the API wrapper; no browser, live server, or real data required.
// Run from client/: node --test tests/api.test.mjs
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, setSession, getStoredUser, clearSession } from '../src/api.js';

let store;
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.sessionStorage;
beforeEach(() => {
  store = new Map();
  globalThis.sessionStorage = {
    setItem: (k, v) => store.set(k, String(v)),
    getItem: k => store.has(k) ? store.get(k) : null,
    removeItem: k => store.delete(k),
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = originalStorage;
});

test('session storage saves and returns the user, not the token', () => {
  const user = { id: 3, role: 'customer' };
  setSession('secret-token', user);
  assert.deepEqual(getStoredUser(), user);
  assert.equal([...store.values()].some(x => x.includes('secret-token')), false);
});

test('invalid stored user data is handled safely', () => {
  sessionStorage.setItem('palmpay_user', '{bad json');
  assert.equal(getStoredUser(), null);
});

test('clearing a session removes user and payment state', () => {
  for (const key of ['palmpay_user', 'palmpay_payment_result', 'palmpay_payment_key']) sessionStorage.setItem(key, 'x');
  clearSession();
  assert.equal(store.size, 0);
});

test('login sends JSON with same-origin credentials', async () => {
  let call;
  globalThis.fetch = async (...args) => {
    call = args;
    return { ok: true, json: async () => ({ user: { id: 1 } }) };
  };
  const result = await api.login({ email: 'demo@example.org', password: 'synthetic' });
  assert.deepEqual(result, { user: { id: 1 } });
  assert.equal(call[0], '/api/auth/login');
  assert.equal(call[1].method, 'POST');
  assert.equal(call[1].credentials, 'same-origin');
  assert.equal(call[1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(call[1].body), { email: 'demo@example.org', password: 'synthetic' });
});

test('payment confirmation sends request ID and code', async () => {
  let call;
  globalThis.fetch = async (...args) => { call = args; return { ok: true, json: async () => ({ status: 'success' }) }; };
  await api.confirmPayment(42, '123456');
  assert.equal(call[0], '/api/payments/42/confirm');
  assert.deepEqual(JSON.parse(call[1].body), { code: '123456' });
});

test('API errors expose server message and HTTP status', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: 'Invalid amount' }) });
  await assert.rejects(api.walletTopup({ amount: -1 }), e => e.message === 'Invalid amount' && e.status === 400);
});

test('non-JSON errors get a useful fallback message', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => { throw new Error('not JSON'); } });
  await assert.rejects(api.walletBalance(), e => e.message === 'Request failed (503)' && e.status === 503);
});

test('network errors propagate to the caller', async () => {
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(api.me(), /Network unavailable/);
});

test('verification preference uses authenticated GET and boolean PUT', async () => {
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return {ok: true, json: async () => ({enabled: false})}; };
  await api.verificationSetting();
  await api.setVerification(false);
  assert.equal(calls[0][0], '/api/customer/verification');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[1][1].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1][1].body), {enabled: false});
  assert.equal(calls[1][1].credentials, 'same-origin');
});
