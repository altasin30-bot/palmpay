import { useEffect, useState } from "react";
import { Users, Fingerprint, Trash2, Search, Loader2 } from "lucide-react";
import { api } from "../../api.js";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    const data = await api.adminUsers();
    setUsers(data.users || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(id, name) {
    if (!window.confirm(`Suspend user "${name}"? Their transaction history will be kept.`)) return;
    setBusyId(id);
    try {
      await api.adminDeleteUser(id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    u.role.toLowerCase().includes(q.toLowerCase())
  );

  const roleBadge = (role) => ({
    customer: "bg-emerald-100 text-emerald-700",
    merchant: "bg-blue-100 text-blue-700",
    admin:    "bg-slate-200 text-slate-700",
  })[role];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-600" />
          <h2 className="text-xl font-bold text-slate-800">Users & Merchants</h2>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, role…"
            className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-3">User</th>
                <th className="text-left px-6 py-3">Role</th>
                <th className="text-left px-6 py-3">Wallet</th>
                <th className="text-left px-6 py-3">Shop</th>
                <th className="text-left px-6 py-3">Palm</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(u.role)}`}>
                      {u.role} · {u.account_status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-700">
                    ৳{Number(u.wallet_balance).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {u.merchant_shop || "—"}
                  </td>
                  <td className="px-6 py-3">
                    {u.palm_template ? (
                      <span className="inline-flex items-center gap-1 text-brand-700 text-xs">
                        <Fingerprint className="w-4 h-4" /> Enrolled
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Not enrolled</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(u.created_at) ? u.created_at : u.created_at + "Z").toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {u.role === "merchant" && u.account_status === "pending" && <button onClick={async()=>{try{await api.approveMerchant(u.id);await load()}catch(e){alert(e.message)}}} className="text-emerald-700 px-2">Approve</button>}
                    {u.role !== "admin" && u.account_status !== "suspended" && (
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        disabled={busyId === u.id}
                        className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 px-2 py-1 rounded text-xs transition disabled:opacity-50"
                      >
                        {busyId === u.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-6">
                    No users match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
