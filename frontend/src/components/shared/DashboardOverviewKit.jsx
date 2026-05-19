import { Link } from "react-router-dom"
import overviewVideo from "../../assets/video/recruiter.mp4"

/** Shared hero video (only asset available); same visual shell for all roles */
export const DASHBOARD_OVERVIEW_VIDEO = overviewVideo

export const dashboardGlassClass = "page-glass p-5 sm:p-6"

export function pct(num, den) {
  if (den == null || den <= 0) return 0
  return Math.min(100, Math.round((num / den) * 100))
}

export function MiniDonut({ valuePct, color, label, sub }) {
  const p = Math.min(100, Math.max(0, valuePct))
  const deg = p * 3.6
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[5.25rem] w-[5.25rem] shrink-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${color} ${deg}deg, #e2e8f0 ${deg}deg)`,
          }}
        />
        <div className="absolute inset-[9px] flex flex-col items-center justify-center rounded-full bg-white/95 text-center shadow-inner ring-1 ring-slate-200/80">
          <span className="text-base font-black tabular-nums text-slate-800 sm:text-lg">{p}%</span>
        </div>
      </div>
      <p className="max-w-[7rem] text-center text-[11px] font-bold leading-tight text-green-900">{label}</p>
      {sub ? <p className="max-w-[7rem] text-center text-[10px] font-medium text-slate-500">{sub}</p> : null}
    </div>
  )
}

/** Horizontal stacked bar for role share (e.g. recruiters vs hiring managers). */
export function RoleMixBar({ title, subtitle, segments }) {
  const total = segments.reduce((sum, s) => sum + (s.count ?? 0), 0)
  if (total <= 0) {
    return (
      <div className="w-full rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
        <p className="mt-2 text-[11px] font-medium text-slate-500">No recruiters or hiring managers yet</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-white/60 bg-white/40 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[10px] font-medium text-slate-500">{subtitle}</p>
      ) : null}
      <div
        className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-200/80 ring-1 ring-white/60"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${pct(s.count, total)}%`).join(", ")}
      >
        {segments.map((s) => {
          const width = pct(s.count, total)
          if (width <= 0) return null
          return (
            <div
              key={s.label}
              className="h-full shrink-0 transition-[width] duration-500"
              style={{ width: `${width}%`, backgroundColor: s.color }}
              title={`${s.label}: ${width}%`}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] font-semibold text-slate-800">{s.label}</span>
            <span className="text-[11px] font-black tabular-nums text-slate-900">
              {pct(s.count, total)}%
            </span>
            <span className="text-[10px] font-medium text-slate-500">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailLink({ to, children = "Detail" }) {
  return (
    <Link
      to={to}
      className="shrink-0 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      {children}
    </Link>
  )
}

export function DashboardOverviewHero({ title, subtitle }) {
  return (
    <div className="relative mb-8 min-h-[11rem] w-full overflow-hidden rounded-[28px] border border-white/20 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:min-h-[13rem]">
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={DASHBOARD_OVERVIEW_VIDEO}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[min(72%,20rem)] bg-gradient-to-r from-black/78 via-black/45 to-transparent sm:w-[min(100%,34rem)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[11rem] flex-col justify-center px-6 py-8 sm:min-h-[13rem] sm:px-10">
        <h1 className="text-3xl font-black tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.85)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-base font-medium text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.75)]">
          {subtitle}
        </p>
      </div>
    </div>
  )
}
