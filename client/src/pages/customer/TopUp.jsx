import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "../../api.js";

// Quick-amount buttons + free input. Uses a unique idempotency key per attempt
// so a duplicate click never charges the simulated bKash/Nagad/Card payment twice.
const QUICK = [200, 500, 1000, 2000];
const METHODS = [
  { id: "bkash",  label: "bKash",  color: "bg-pink-100  text-pink-700"  },
  { id: "nagad",  label: "Nagad",  color: "bg-orange-100 text-orange-700" },
  { id: "card",   label: "Card",   color: "bg-slate-100  text-slate-700" },
];

export default function CustomerTopUp() {
  const navigate = useNavigate();
  const key = useRef(crypto.randomUUID());
  const [amount, setAmount]     = useState(500);
  const [method, setMethod]    = useState("bkash");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(null);

  async function handleTopUp() {
    setError("");
    setSuccess(null);
    setBusy(true);
    try {
      const idempotency_key = key.current;
      const res = await api.walletTopup({ amount: Number(amount), method, idempotency_key });
      setSuccess(res);
      key.current = crypto.randomUUID();
    } catch (err) {
      setError(err.message || "Top-up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Top Up Wallet</h3>
        <p className="text-sm text-slate-500 mb-5">
          Simulate a wallet top-up. No bKash, Nagad or card payment is actually processed.
        </p>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className={
                "py-2.5 rounded-lg border text-sm font-medium transition " +
                (amount === q
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-400")
              }
            >
              ৳{q.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <label className="block text-sm font-medium text-slate-700 mb-1">Amount (BDT)</label>
        <input
          type="number" min={1} max={50000}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
        />

        {/* Method */}
        <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Payment Method</label>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={
                "py-2.5 rounded-lg text-sm font-medium border transition " +
                (method === m.id
                  ? `${m.color} border-current`
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-400")
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" />
            <div>
              <div className="font-semibold">Top-up successful!</div>
              <div className="mt-1">
                Added ৳{success.amount.toLocaleString()} via {success.method}.
                <br />
                New balance: ৳{success.new_balance.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <button
          disabled={busy || amount <= 0}
          onClick={handleTopUp}
          className="mt-5 w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          {busy ? "Processing…" : `Top Up ৳${Number(amount).toLocaleString()}`}
        </button>
      </div>

      <button
        onClick={() => navigate("/customer")}
        className="text-sm text-brand-600 hover:underline"
      >
        ← Back to dashboard
      </button>
    </div>
  );
}
