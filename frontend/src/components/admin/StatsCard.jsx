export default function StatsCard({ title, value, color, icon, variant }) {
  const accentBar = {
    blue: "bg-blue-500",
    green: "bg-green-600",
    emerald: "bg-emerald-600",
    red: "bg-red-500",
    rose: "bg-rose-500",
    purple: "bg-purple-600",
    indigo: "bg-indigo-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
    gray: "bg-slate-500",
  }

  if (variant === "glass") {
    const bar = accentBar[color] || accentBar.blue
    return (
      <div className="group relative overflow-hidden rounded-[26px] border border-white/70 bg-white/55 p-6 shadow-[0_12px_40px_rgba(15,40,25,0.12)] backdrop-blur-xl transition duration-200 hover:border-white/90 hover:bg-white/68 hover:shadow-[0_18px_48px_rgba(15,40,25,0.16)]">
        <div className={`absolute left-0 top-0 h-1 w-full ${bar} opacity-90`} aria-hidden />
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-green-900">{title}</p>
            <p className="text-3xl font-black tabular-nums tracking-tight text-slate-900 sm:text-[2.35rem]">{value}</p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-2xl shadow-sm ring-1 ring-black/10">
            {icon}
          </div>
        </div>
      </div>
    )
  }

  const colors = {
    blue: "from-blue-500/10 to-blue-500/5 border-blue-200 text-blue-700",
    green: "from-green-500/10 to-green-500/5 border-green-200 text-green-700",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-700",
    red: "from-red-500/10 to-red-500/5 border-red-200 text-red-700",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-200 text-rose-700",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-200 text-purple-700",
    indigo: "from-indigo-500/10 to-indigo-500/5 border-indigo-200 text-indigo-700",
    orange: "from-orange-500/10 to-orange-500/5 border-orange-200 text-orange-700",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-700",
    gray: "from-gray-500/10 to-gray-500/5 border-gray-200 text-gray-700",
  }

  const selectedColor = colors[color] || colors.blue

  return (
    <div className={`bg-white/60 backdrop-blur-xl border rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-gradient-to-br ${selectedColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{title}</p>
          <p className="text-4xl font-black">{value}</p>
        </div>
        <div className="text-4xl p-3 bg-white/50 rounded-2xl shadow-sm">{icon}</div>
      </div>
    </div>
  )
}