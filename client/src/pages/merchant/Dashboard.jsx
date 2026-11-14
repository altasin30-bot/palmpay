import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Receipt, PlusCircle, Scan, TrendingUp } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import StatCard from "../../components/StatCard.jsx";

export default function MerchantDashboard() {
  const { user } = useAuth();
  const [txs, setTxs]   = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.transactions(), api.billsList()])
      .then(([t, b]) => {
        setTxs(t.transactions || []);
        setBills(b.bills || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCollected = txs
    .filter((t) => t.type === "payment")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const paidBills = bills.filter((b) => b.status === "paid").length;
  const unpaidBills = bills.filter((b) => b.status === "unpaid").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Total Collected" value={`৳${totalCollected.toLocaleString()}`} accent="brand" />
        <StatCard icon={Receipt}    label="Payments Received" value={txs.filter((t) => t.type === "payment").length} accent="blue" />
        <StatCard icon={Store}      label="Shop"  value={user.merchant_shop || "—"} accent="slate" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/merchant/bills" className="flex flex-col items-center gap-2 p-4 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition">
              <PlusCircle className="w-7 h-7" />
              <span className="text-sm font-medium">Create Bill</span>
            </Link>
            <Link to="/merchant/pay" className="flex flex-col items-center gap-2 p-4 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition">
              <Scan className="w-7 h-7" />
              <span className="text-sm font-medium">Palm Payment</span>
            </Link>
            <Link to="/merchant/transactions" className="flex flex-col items-center gap-2 p-4 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition">
              <Receipt className="w-7 h-7" />
              <span className="text-sm font-medium">History</span>
            </Link>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-100 text-slate-600">
              <Receipt className="w-7 h-7" />
              <span className="text-sm font-medium">{paidBills} paid · {unpaidBills} unpaid</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Payments</h3>
            <Link to="/merchant/transactions" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : txs.length === 0 ? (
            <div className="text-slate-500 text-sm">No payments yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {txs.slice(0, 5).map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-800">
                      {t.type === "topup" ? "Top-up" : (t.customer_name || `Customer #${t.user_id}`)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(t.created_at) ? t.created_at : t.created_at + "Z").toLocaleString()}
                      {t.palm_matched === 1 ? " · 🤚 Palm" : ""}
                    </div>
                  </div>
                  <div className="font-semibold text-emerald-600">
                    +৳{Number(t.amount).toLocaleString()}
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
