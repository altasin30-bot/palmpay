import { useEffect, useState } from "react";
import { Receipt, ArrowDownCircle, ArrowUpCircle, Fingerprint } from "lucide-react";
import { api } from "../../api.js";

export default function CustomerTransactions() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.transactions()
      .then((data) => setTxs(data.transactions || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="w-6 h-6 text-brand-600" />
        <h2 className="text-xl font-bold text-slate-800">My Transactions</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            No transactions yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Description</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Method</th>
                <th className="text-right px-6 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txs.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {t.type === "topup"
                        ? <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                        : <ArrowUpCircle className="w-4 h-4 text-blue-600" />}
                      <span className="capitalize">{t.type}</span>
                      {t.palm_matched === 1 && (
                        <Fingerprint className="w-4 h-4 text-brand-600" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-700">
                    {t.type === "topup"
                      ? "Wallet top-up"
                      : t.type === "refund" ? "Refund" : (t.merchant_name || `Merchant #${t.merchant_id}`)}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(t.created_at) ? t.created_at : t.created_at + "Z").toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {t.type === "topup" ? (t.method || "Unknown") : (t.palm_matched === 1 ? "Simulated palm" : "Unknown")}
                  </td>
                  <td className={"px-6 py-3 text-right font-semibold " +
                    (t.type === "topup" ? "text-emerald-600" : "text-slate-700")}>
                    {['topup','refund'].includes(t.type) ? "+" : "−"}৳{Number(t.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
