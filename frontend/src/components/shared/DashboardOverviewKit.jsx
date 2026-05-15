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
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={DASHBOARD_OVERVIEW_VIDEO}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[min(100%,28rem)] bg-gradient-to-r from-black/78 via-black/45 to-transparent sm:w-[min(100%,34rem)]"
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
