import { useEffect, useRef, useState } from "react";
import { Hand, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

/**
 * PalmScanner
 * -----------
 * A self-contained demo of the palm-vein scanning experience.
 * Props:
 *   - onScan(mode):  async callback that should call /api/palm/verify or /api/payments/process.
 *                    Returns either { matched:true, ... } or { matched:false, similarity, ... }.
 *   - modes:         list of demo modes to show buttons for. Default = all three.
 *   - title:         optional heading text.
 *
 * The scanner runs a short "scanning" animation (2s) before calling onScan so the
 * experience feels realistic. The visual hand outline + scan line is pure SVG/CSS.
 */
export default function PalmScanner({
  onScan,
  modes = ["success", "unrecognized", "poor_lighting"],
  title = "Place your palm on the scanner",
}) {
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState(null); // { matched, similarity, ... } | null
  const [error, setError]         = useState("");
  const timerRef = useRef(null);

  // Cleanup any pending animation timer when unmounting
  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function runScan(mode) {
    setResult(null);
    setError("");
    setScanning(true);
    // Simulate the 2s scan animation, then call the backend
    timerRef.current = setTimeout(async () => {
      try {
        const res = await onScan(mode);
        setResult(res);
      } catch (e) {
        setError(e.message || "Scan failed");
      } finally {
        setScanning(false);
      }
    }, 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {title && <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>}

      {/* The scanner viewport */}
      <div className="relative w-56 h-64 mx-auto bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
        {/* Hand outline (SVG) */}
        <Hand className="w-32 h-32 text-brand-300/70" strokeWidth={1.2} />

        {/* Moving scan line */}
        {scanning && (
          <div className="absolute left-0 right-0 h-1 bg-brand-400 shadow-[0_0_18px_4px_rgba(34,161,111,0.7)] animate-scan" />
        )}

        {/* Corner accents */}
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-brand-400 rounded-tl-lg" />
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-brand-400 rounded-tr-lg" />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-brand-400 rounded-bl-lg" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-brand-400 rounded-br-lg" />

        {/* Idle hint */}
        {!scanning && !result && !error && (
          <div className="absolute bottom-3 text-xs text-brand-200/80 tracking-wider animate-pulse">
            READY
          </div>
        )}

        {/* Scanning label */}
        {scanning && (
          <div className="absolute bottom-3 text-xs text-brand-300 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> SCANNING VEIN PATTERN…
          </div>
        )}
      </div>

      {/* Result panel */}
      {result && (
        <div
          className={`mt-5 p-4 rounded-xl border text-sm flex items-start gap-3 ${
            result.matched
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {result.matched
            ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" />
            : <XCircle className="w-5 h-5 mt-0.5 text-rose-600" />}
          <div className="flex-1">
            <div className="font-semibold">
              {result.matched ? "Palm verified" : "Palm not recognized"}
            </div>
            <div className="text-xs opacity-80">
              Cosine similarity: <b>{(result.similarity ?? 0).toFixed(4)}</b>
              {" / threshold "}
              <b>{(result.threshold ?? 0.9).toFixed(2)}</b>
            </div>
            {result.user && (
              <div className="text-xs mt-1 opacity-80">
                Customer: <b>{result.user.name}</b> ({result.user.email})
                {" · Balance ৳"}{result.user.wallet_balance?.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Demo controls */}
      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Demo Controls</div>
        <div className="flex flex-wrap gap-2">
          {modes.includes("success") && (
            <button
              disabled={scanning}
              onClick={() => runScan("success")}
              className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition"
            >
              Force Success
            </button>
          )}
          {modes.includes("unrecognized") && (
            <button
              disabled={scanning}
              onClick={() => runScan("unrecognized")}
              className="flex-1 min-w-[120px] bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition"
            >
              Unrecognized Palm
            </button>
          )}
          {modes.includes("poor_lighting") && (
            <button
              disabled={scanning}
              onClick={() => runScan("poor_lighting")}
              className="flex-1 min-w-[120px] bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition"
            >
              Poor Lighting
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          These buttons simulate different scanning outcomes for demo purposes.
        </p>
      </div>
    </div>
  );
}
