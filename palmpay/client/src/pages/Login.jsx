import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Hand, Mail, Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// Demo accounts — one-click login for the capstone defense
const DEMO_ACCOUNTS = [
  { label: "Customer",  email: "rahim@palmpay.com", password: "Rahim@123", color: "bg-emerald-600" },
  { label: "Merchant",  email: "shop@palmpay.com",  password: "Shop@123",  color: "bg-blue-600"   },
  { label: "Admin",     email: "admin@palmpay.com", password: "Admin@123", color: "bg-slate-700"  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Read the flash message + prefill email that Register.jsx may have sent
  const flash = location.state?.flash || "";
  const prefillEmail = location.state?.prefillEmail || "";

  const [email, setEmail]       = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(acc) {
    setError("");
    setBusy(true);
    try {
      setEmail(acc.email);
      setPassword(acc.password);
      const user = await login(acc.email, acc.password);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-50">
      {/* Left: marketing panel */}
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-brand-800 to-brand-600 text-white">
        <div className="flex items-center gap-2">
          <Hand className="w-8 h-8 text-brand-200" />
          <span className="text-2xl font-bold">PalmPay</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Pay with the<br />wave of your hand.
          </h1>
          <p className="mt-4 text-brand-100 max-w-md">
            PalmPay is a simulated biometric payment demo. It does not scan real palms or move real money.
          </p>
          <div className="mt-8 space-y-2 text-sm text-brand-100">
            <div>✓ Simulated palm enrollment and payment</div>
            <div>✓ Atomic, idempotent wallet transfers</div>
            <div>✓ Customer · Merchant · Admin roles</div>
          </div>
        </div>
        <div className="text-xs text-brand-200">
          UITS CSE Capstone · Demo build
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <Hand className="w-7 h-7 text-brand-600" />
            <span className="text-xl font-bold text-slate-800">PalmPay</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800">Welcome back</h2>
          <p className="text-slate-500 text-sm mt-1">
            Sign in to your PalmPay account.
          </p>

          {/* Flash banner — shown when arriving from a successful registration */}
          {flash && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{flash}</div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@palmpay.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Demo login box */}
          <div className="mt-6 p-4 rounded-xl border border-dashed border-brand-300 bg-brand-50">
            <div className="text-sm font-semibold text-brand-800 mb-2">
              🚀 One-Click Demo Login
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.label}
                  disabled={busy}
                  onClick={() => demoLogin(acc)}
                  className={`${acc.color} hover:opacity-90 text-white text-xs py-2 rounded-lg transition disabled:opacity-50`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-brand-700">
              Use these to try the customer, merchant, and admin dashboards instantly.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            New here?{" "}
            <Link to="/register" className="text-brand-600 font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
