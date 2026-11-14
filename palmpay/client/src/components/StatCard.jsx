// Small reusable stat card used on dashboards.
export default function StatCard({ icon: Icon, label, value, accent = "brand" }) {
  const colors = {
    brand:   "bg-brand-50  text-brand-700  border-brand-200",
    blue:    "bg-blue-50   text-blue-700   border-blue-200",
    amber:   "bg-amber-50  text-amber-700  border-amber-200",
    rose:    "bg-rose-50   text-rose-700   border-rose-200",
    slate:   "bg-slate-100 text-slate-700  border-slate-200",
  };
  return (
    <div className={`rounded-xl border p-5 flex items-center gap-4 ${colors[accent]}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-lg bg-white/60 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div>
        <div className="text-sm font-medium opacity-80">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}
