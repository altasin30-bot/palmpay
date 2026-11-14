import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Hand, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "../api.js";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "customer", pin: "", shop: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null); // holds the registered email so we can show a banner

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setBusy(true);
    try {
      const payload = { ...form };
      if (form.role !== "customer") delete payload.pin;
      if (form.role !== "merchant") delete payload.shop;
      const res = await api.register(payload);
      // Show a clear success banner instead of silently navigating.
      setSuccess({
        id: res.id,
        email: form.email,
        role: form.role,
      });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <Hand className="w-7 h-7 text-brand-600" />
          <span className="text-xl font-bold text-slate-800">PalmPay</span>
        </div>

        <h2 className="text-2xl font-bold text-slate-800">Create your account</h2>
        <p className="text-slate-500 text-sm mt-1">Join PalmPay in under a minute.</p>

        {/* SUCCESS BANNER — shows the new account info clearly so you know it was created */}
        {success && (
          <div className="mt-5 p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Account created successfully!</div>
                <div className="text-sm mt-2 space-y-1">
                  <div>🆔 <b>User ID:</b> #{success.id}</div>
                  <div>📧 <b>Email:</b> {success.email}</div>
                  <div>👤 <b>Role:</b> <span className="capitalize">{success.role}</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/login", { state: { flash: `Account created — sign in with ${success.email}`, prefillEmail: success.email } })}
                  className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition"
                >
                  Go to Login →
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Only show the form when not yet successfully registered */}
        {!success && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              required value={form.name} onChange={(e) => update("name", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email" required
              value={form.email} onChange={(e) => update("email", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password" required minLength={6}
              value={form.password} onChange={(e) => update("password", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
            <select
              value={form.role} onChange={(e) => update("role", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
            >
              <option value="customer">Customer — pay with palm</option>
              <option value="merchant">Merchant — collect payments</option>
            </select>
          </div>

          {form.role === "customer" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PIN for fallback (4 digits)
              </label>
              <input
                type="text" inputMode="numeric" pattern="\d{4}" maxLength={4}
                value={form.pin} onChange={(e) => update("pin", e.target.value)}
                placeholder="1234"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
              />
            </div>
          )}

          {form.role === "merchant" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
              <input
                value={form.shop} onChange={(e) => update("shop", e.target.value)}
                placeholder="Dhaka Fresh Mart"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
              />
            </div>
          )}

          <button
            type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? "Creating…" : "Create Account"}
          </button>
        </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
