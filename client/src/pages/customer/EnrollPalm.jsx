import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fingerprint, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../api.js";

/**
 * EnrollPalm
 * ----------
 * Simulates the 3-scan enrollment flow described in the SRS:
 *   1. Customer clicks "Start Enrollment"
 *   2. UI runs 3 simulated scans (with a short delay + progress bar between each)
 *   3. Frontend calls /api/palm/enroll which averages the 3 scans into one
 *      128-dim template and stores it for that user.
 */
export default function EnrollPalm() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(0);   // 0 = idle, 1..3 = scanning
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [done, setDone]     = useState(null);
  const [consent,setConsent]=useState(false);

  async function runScan() {
    setError(""); setDone(null); setStep(1);

    // Animate the 3 scan steps with a small delay between each
    for (let i = 1; i <= 3; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 900));
    }

    setBusy(true);
    try {
      const res = await api.palmEnroll();
      setDone(res);
      setStep(0);
    } catch (err) {
      setError(err.message || "Enrollment failed");
      setStep(0);
    } finally {
      setBusy(false);
    }
  }

  const progress = step > 0 ? (step / 3) * 100 : 0;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Fingerprint className="w-6 h-6 text-brand-600" />
          <h3 className="text-lg font-semibold text-slate-800">Enroll Your Palm</h3>
        </div>

        <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
          This demo generates random sample data; it does not capture your palm. Data is encrypted using a local demo key. Re-enrolling replaces the active template.
        </p>

        {/* Hand visual */}
        <div className="relative w-40 h-48 mx-auto bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center mb-4">
          <Fingerprint className="w-20 h-20 text-brand-300/70" strokeWidth={1.2} />
          {step > 0 && (
            <div className="absolute left-0 right-0 h-1 bg-brand-400 shadow-[0_0_18px_4px_rgba(34,161,111,0.7)] animate-scan" />
          )}
          <div className="absolute bottom-2 text-xs text-brand-200">
            {step === 0 ? "READY" : `SCAN ${step} OF 3`}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {done && (
          <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2 text-left">
            <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" />
            <div>
              <div className="font-semibold">Palm enrolled successfully!</div>
              <div className="text-xs mt-1">
                Template ID: #{done.template_id} · {done.scan_count} scans averaged · {done.dim}-dim vector
              </div>
            </div>
          </div>
        )}

        <label className="block text-sm mb-4"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> I agree to create a simulated template on this device.</label>
        <button
          disabled={!consent || busy || step > 0}
          onClick={runScan}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
          {busy ? "Saving…" : step > 0 ? "Scanning…" : "Start Enrollment"}
        </button>
        <button className="block mx-auto mt-4 text-sm text-rose-700 underline" onClick={async()=>{if(window.confirm("Delete all simulated templates for your account?")){try{await api.palmDelete();setDone(null);alert("Simulated templates deleted.")}catch(e){setError(e.message)}}}}>Delete my simulated templates</button>
      </div>

      <button
        onClick={() => navigate("/customer")}
        className="text-sm text-brand-600 hover:underline mx-auto block"
      >
        ← Back to dashboard
      </button>
    </div>
  );
}
