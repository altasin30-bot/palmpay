import { useEffect, useState } from "react";
import { Receipt, Fingerprint } from "lucide-react";
import { api } from "../../api.js";

export default function MerchantTransactions() {
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
        <h2 className="text-xl font-bold text-slate-800">Payment History</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            No payments received yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-3">Customer</th>
                <th className="text-left px-6 py-3">Description</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Method</th>
                <th className="text-left px-6 py-3">Similarity</th>
                <th className="text-right px-6 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txs.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-700">
                    {t.customer_name || `Customer #${t.user_id}`}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {t.type}
                    {t.bill_id ? ` · Bill #${t.bill_id}` : ""}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(t.created_at) ? t.created_at : t.created_at + "Z").toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-slate-700">
                    {t.palm_matched === 1 ? (
                      <span className="inline-flex items-center gap-1 text-brand-700">
                        <Fingerprint className="w-4 h-4" /> Palm
                      </span>
                    ) : "Manual"}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {t.similarity != null ? Number(t.similarity).toFixed(4) : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                    {t.type === 'payment' ? '+' : '−'}৳{Number(t.amount).toLocaleString()}
                    {t.type === 'payment' && <button className="ml-2 text-sm underline" onClick={async()=>{if(window.confirm('Issue a full simulated refund?')){try{await api.refund(t.id);setTxs((await api.transactions()).transactions);alert('Refund completed')}catch(e){alert(e.message)}}}}>Refund</button>}
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
