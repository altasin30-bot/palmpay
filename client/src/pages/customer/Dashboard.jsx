import { useEffect, useState } from "react";
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

  useEffect(() => {
    Promise.all([api.walletBalance(), api.transactions()])
      .then(([b, t]) => {
        setBalance(b.balance);
        setTxs(t.transactions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const lastTx = txs.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Wallet}     label="Wallet Balance"  value={`৳${balance.toLocaleString()}`} accent="brand" />
        <StatCard icon={Receipt}    label="Total Transactions" value={txs.length}  accent="blue" />
        <StatCard icon={ShieldCheck} label="PIN fallback" value={user.pin_set ? "Set" : "Not set"} accent={user.pin_set ? "brand" : "amber"} />
      </div>

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
