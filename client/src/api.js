// Tiny fetch wrapper used by every page.
// All requests go through Vite's proxy (see vite.config.js -> /api -> http://127.0.0.1:5000).

const BASE = ""; // relative URL so the Vite proxy handles it

export function setSession(token, user) { sessionStorage.setItem("palmpay_user", JSON.stringify(user)); }
export function clearSession() { sessionStorage.removeItem("palmpay_user"); sessionStorage.removeItem("palmpay_payment_result"); sessionStorage.removeItem("palmpay_payment_key"); }
export function getStoredUser() { try { return JSON.parse(sessionStorage.getItem("palmpay_user") || "null"); } catch { return null; } }

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// AUTH
export const api = {
  register: (payload) => request("POST", "/api/auth/register", payload),
  login:    (payload) => request("POST", "/api/auth/login", payload),
  me:       ()        => request("GET",  "/api/auth/me"),
  logout:   ()        => request("POST", "/api/auth/logout"),

  // PALM
  palmEnroll: ()              => request("POST", "/api/palm/enroll"),
  palmDelete: () => request("DELETE", "/api/palm/enroll"),
  palmScan:   ()              => request("POST", "/api/palm/scan"),
  palmVerify: (payload)       => request("POST", "/api/palm/verify", payload),

  // WALLET
  walletBalance: ()           => request("GET",  "/api/wallet/balance"),
  walletTopup:   (payload)    => request("POST", "/api/wallet/topup", payload),

  // TRANSACTIONS
  transactions: ()           => request("GET",  "/api/transactions"),

  // BILLS
  billsCreate: (payload)      => request("POST", "/api/bills", payload),
  billsList:   ()             => request("GET",  "/api/bills"),

  // PAYMENTS
  paymentsProcess: (payload)  => request("POST", "/api/payments/process", payload),
  demoCustomers: () => request("GET", "/api/payments/demo-customers"),
  paymentStatus: (id) => request("GET", `/api/payments/${id}`),
  confirmPayment: (id, code) => request("POST", `/api/payments/${id}/confirm`, {code}),
  pendingPayments: () => request("GET", "/api/payments/pending"),
  recentPayments: () => request("GET", "/api/payments/customer-recent"),
  verifyPaymentPin: (id, pin) => request("POST", `/api/payments/${id}/verify-pin`, {pin}),
  merchantBalance: () => request("GET", "/api/merchant/balance"),
  merchantPayout: payload => request("POST", "/api/merchant/payout", payload),
  refund: id => request("POST", `/api/merchant/refunds/${id}`),
  cancelBill: id => request("POST", `/api/bills/${id}/cancel`),
  adminSettings: () => request("GET", "/api/admin/settings"),
  saveAdminSettings: x => request("POST", "/api/admin/settings", x),
  resetDemo: () => request("POST", "/api/admin/reset-demo", {confirm:"RESET DEMO"}),
  scanAlerts: () => request("GET", "/api/admin/scan-alerts"),
  unlock: id => request("POST", `/api/admin/users/${id}/unlock`),
  analytics: (start,end) => request("GET", `/api/admin/analytics?start=${start}&end=${end}`),
  declinePayment: (id) => request("POST", `/api/payments/${id}/decline`),
  approveMerchant: (id) => request("POST", `/api/admin/users/${id}/approve`),

  // ADMIN
  adminUsers:      ()         => request("GET", "/api/admin/users"),
  adminDeleteUser: (id)       => request("DELETE", `/api/admin/users/${id}`),
  adminBiometric:  ()         => request("GET", "/api/admin/biometric"),
  adminReports:    ()         => request("GET", "/api/admin/reports"),
};
