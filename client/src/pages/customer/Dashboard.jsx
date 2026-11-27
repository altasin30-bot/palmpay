import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Fingerprint, Receipt, PlusCircle, ShieldCheck } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import StatCard from "../../components/StatCard.jsx";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [balance, setBalance]     = useState(0);
  const [txs, setTxs]              = useState([]);
  const [loading, setLoading]     = useState(true);
  const [verification, setVerification] = useState(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const verificationRequest = useRef(0);

  useEffect(() => {
    let active = true;
    const load = () => { const request = ++verificationRequest.current; api.verificationSetting().then(x => { if (active && request === verificationRequest.current) setVerification(x.enabled); }).catch(() => { if (active && request === verificationRequest.current) { setVerification(null); setVerificationMessage('Could not load verification setting. Refresh the page to retry.'); } }); };
    load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, []);

  async function changeVerification() {
    const next = !verification;
    if (!next && !window.confirm('Turn verification off? New demo payments can complete without a customer approval code. This is less safe.')) return;
    ++verificationRequest.current;
    setVerificationBusy(true);
    setVerificationMessage('');
    try {
      const result = await api.setVerification(next);
      setVerification(result.enabled);
      setVerificationMessage(`Verification is ${result.enabled ? 'On' : 'Off'} for new payments.`);
    } catch (err) {
      setVerificationMessage(`Could not save setting: ${err.message}`);
      try { const current = await api.verificationSetting(); setVerification(current.enabled); }
      catch { setVerification(null); }
    } finally { setVerificationBusy(false); }
  }

  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all([api.walletBalance(), api.transactions()])
      .then(([b, t]) => {
        if (!active) return;
        setBalance(b.balance);
        setTxs(t.transactions || []);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const lastTx = txs.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Wallet}     label="Wallet Balance"  value={`৳${balance.toLocaleString()}`} accent="brand" />
        <StatCard icon={Receipt}    label="Total Transactions" value={txs.length}  accent="blue" />
        <StatCard icon={ShieldCheck} label="PIN fallback" value={user.pin_set ? "Set" : "Not set"} accent={user.pin_set ? "brand" : "amber"} />
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-6" aria-labelledby="verification-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 id="verification-title" className="font-semibold text-slate-800">Payment verification</h2>
            <p className="text-sm text-slate-600 mt-1">On: a six-digit approval code is required for every new demo payment. Off: no approval code is required. PIN fallback still requires your PIN.</p>
            <p className="text-sm text-amber-800 mt-2">Turning verification off reduces protection. Changes do not affect requests already pending. Demo only — never use real money or biometrics.</p>
          </div>
          <button type="button" role="switch" aria-checked={verification === true} aria-label="Payment verification" disabled={verification === null || verificationBusy} onClick={changeVerification} className={`min-w-32 rounded-lg px-4 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-600 disabled:opacity-50 ${verification ? 'bg-emerald-700' : 'bg-slate-600'}`}>
            Verification {verification === null ? '…' : verification ? 'On' : 'Off'}
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-slate-700 mt-2">{verificationMessage}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/customer/topup" className="flex flex-col items-center gap-2 p-4 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition">
              <PlusCircle className="w-7 h-7" />
              <span className="text-sm font-medium">Top Up</span>
            </Link>
            <Link to="/customer/enroll" className="flex flex-col items-center gap-2 p-4 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition">
              <Fingerprint className="w-7 h-7" />
              <span className="text-sm font-medium">Enroll Palm</span>
            </Link>
            <Link to="/customer/transactions" className="flex flex-col items-center gap-2 p-4 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition">
              <Receipt className="w-7 h-7" />
              <span className="text-sm font-medium">History</span>
            </Link>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-100 text-slate-600">
              <Wallet className="w-7 h-7" />
              <span className="text-sm font-medium">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <Link to="/customer/transactions" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : lastTx.length === 0 ? (
            <div className="text-slate-500 text-sm">No transactions yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lastTx.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-800">
                      {t.type === "topup" ? "Top-up" : (t.merchant_name || "Payment")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(t.created_at) ? t.created_at : t.created_at + "Z").toLocaleString()}
                      {t.palm_matched ? " · 🤚 Palm authorized" : ""}
                    </div>
                  </div>
                  <div className={t.type === "topup" ? "text-emerald-600 font-semibold" : "text-slate-700 font-semibold"}>
                    {t.type === "topup" ? "+" : "−"}৳{Number(t.amount).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
