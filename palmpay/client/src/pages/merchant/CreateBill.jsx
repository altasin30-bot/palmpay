import { useEffect, useState } from "react";
import { PlusCircle, Receipt, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "../../api.js";

export default function MerchantBills() {
  const [amount, setAmount]     = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [created, setCreated]   = useState(null);
  const [bills, setBills]       = useState([]);

  async function loadBills() {
    const data = await api.billsList();
    setBills(data.bills || []);
  }

  useEffect(() => { loadBills(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError(""); setCreated(null);
    if (!amount || Number(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    setBusy(true);
    try {
      const res = await api.billsCreate({ amount: Number(amount), description: description.trim() });
      setCreated(res);
      setAmount(""); setDescription("");
      loadBills();
    } catch (err) {
      setError(err.message || "Failed to create bill");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create bill */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-semibold text-slate-800">Create a Bill</h3>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (BDT)</label>
              <input
                type="number" min={1} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text" value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Groceries — 2kg rice, 1L oil"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                {error}
              </div>
            )}

            {created && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" />
                <div>
                  Bill #{created.bill_id} created for ৳{created.amount.toLocaleString()}.
                  Head to <b>Palm Payment</b> to start the scan.
                </div>
              </div>
            )}

            <button
              type="submit" disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {busy ? "Creating…" : "Create Bill"}
            </button>
          </form>
        </div>

        {/* Bills list */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-semibold text-slate-800">Your Bills</h3>
          </div>

          {bills.length === 0 ? (
            <div className="text-slate-500 text-sm">No bills yet. Create your first one!</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bills.map((b) => (
                <li key={b.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-slate-800">#{b.id} · {b.description}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(b.created_at) ? b.created_at : b.created_at + "Z").toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {b.status==='unpaid' && <button className="text-rose-700 underline" onClick={async()=>{if(window.confirm('Cancel this unpaid bill?')){try{await api.cancelBill(b.id);loadBills()}catch(e){alert(e.message)}}}}>Cancel</button>}
                    <span className="font-semibold text-slate-700">৳{Number(b.amount).toLocaleString()}</span>
                    <span className={
                      "text-xs px-2 py-0.5 rounded-full " +
                      (b.status === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700")
                    }>
                      {b.status}
                    </span>
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
