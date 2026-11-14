import { useEffect, useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { api } from "../../api.js";

export default function AdminBiometric() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminBiometric()
      .then((data) => setTemplates(data.templates || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Fingerprint className="w-6 h-6 text-brand-600" />
        <h2 className="text-xl font-bold text-slate-800">Biometric Metadata</h2>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-lg flex items-start gap-2">
        <Lock className="w-5 h-5 mt-0.5 text-amber-600" />
        <div>
          Demo templates are encrypted at rest with a local key. This view shows metadata only. Do not use real biometric data in this demo.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No palm templates enrolled yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-3">Template ID</th>
                <th className="text-left px-6 py-3">User</th>
                <th className="text-left px-6 py-3">Scans</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Dimensions</th>
                <th className="text-left px-6 py-3">Created</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 align-top">
                  <td className="px-6 py-3 font-mono text-slate-700">#{t.id}</td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800">{t.user_name}</div>
                    <div className="text-xs text-slate-500">{t.email}</div>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{t.scan_count}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{t.dim}-dim</td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(t.created_at) ? t.created_at : t.created_at + "Z").toLocaleString()}
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
