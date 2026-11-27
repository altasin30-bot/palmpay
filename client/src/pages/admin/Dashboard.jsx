import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Fingerprint, Receipt, BarChart3, TrendingUp, Wallet, MapPin } from "lucide-react";
import { api } from "../../api.js";
import StatCard from "../../components/StatCard.jsx";

export default function AdminDashboard() {
  const [reports, setReports] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState(null);

  useEffect(() => {
    api.adminDevices().then(setDevices).catch(() => setDevices(null));
    Promise.all([api.adminReports(), api.transactions()])
      .then(([r, t]) => {
        setReports(r);
        setTxs(t.transactions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-slate-500">Loading admin dashboard…</div>;
  if (!reports) return <div className="p-10 text-rose-500">Failed to load reports.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Users"     value={reports.users.total}      accent="slate" />
        <StatCard icon={Fingerprint}  label="Palm Templates" value={reports.palm_templates}  accent="brand" />
        <StatCard icon={TrendingUp}   label="Total Payments"  value={`৳${Number(reports.transactions.total_payments).toLocaleString()}`} accent="blue" />
        <StatCard icon={Wallet}       label="Total Top-ups"   value={`৳${Number(reports.transactions.total_topups).toLocaleString()}`} accent="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard icon={Receipt} label="Total Transactions" value={reports.transactions.total} accent="rose" />
        <StatCard icon={Users}   label="Customers"           value={reports.users.customers}     accent="brand" />
      </div>

      <Link to="/admin/devices" className="block"><StatCard icon={MapPin} label="Simulated active devices (not live)" value={devices ? devices.simulated_active_count : "—"} accent="brand" /></Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/users" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-brand-400 transition">
          <Users className="w-8 h-8 text-brand-600 mb-2" />
          <h3 className="font-semibold text-slate-800">Manage Users</h3>
          <p className="text-sm text-slate-500">View, search, and suspend users & merchants.</p>
        </Link>
        <Link to="/admin/biometric" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-brand-400 transition">
          <Fingerprint className="w-8 h-8 text-brand-600 mb-2" />
          <h3 className="font-semibold text-slate-800">Biometric Metadata</h3>
          <p className="text-sm text-slate-500">Inspect encrypted palm templates.</p>
        </Link>
        <Link to="/admin/reports" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-brand-400 transition">
          <BarChart3 className="w-8 h-8 text-brand-600 mb-2" />
          <h3 className="font-semibold text-slate-800">Reports & Charts</h3>
          <p className="text-sm text-slate-500">Charts and analytics for transactions.</p>
        </Link>
      </div>

      {/* Recent activity across the whole system */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Recent System Activity</h3>
        {txs.length === 0 ? (
          <div className="text-slate-500 text-sm">No transactions yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {txs.slice(0, 8).map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-slate-800">
                    {t.type === "topup"
                      ? `${t.customer_name || `User #${t.user_id}`} topped up`
                      : `${t.customer_name || `User #${t.user_id}`} → ${t.merchant_name || "Merchant"}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(t.created_at) ? t.created_at : t.created_at + "Z").toLocaleString()}
                    {t.palm_matched === 1 ? " · 🤚 Palm" : ""}
                  </div>
                </div>
                <div className="font-semibold text-slate-700">
                  ৳{Number(t.amount).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
