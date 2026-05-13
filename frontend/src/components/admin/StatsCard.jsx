export default function StatsCard({ title, value, color, icon }) {
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