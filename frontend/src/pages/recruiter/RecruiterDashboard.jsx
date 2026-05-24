import { useEffect, useMemo, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import API from "../../api/authApi"
import {
  dashboardGlassClass,
  DashboardOverviewHero,
  MiniDonut,
  pct,
} from "../../components/shared/DashboardOverviewKit"

export default function RecruiterDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get("/recruiter/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const s = useMemo(
    () => ({
      total_jobs: stats?.total_jobs ?? 0,
      active_jobs: stats?.active_jobs ?? 0,
      closed_jobs: stats?.closed_jobs ?? 0,
      total_applications: stats?.total_applications ?? 0,
      shortlisted: stats?.shortlisted_applications ?? 0,
      pending: stats?.pending_applications ?? 0 ,
      rejected: stats?.rejected_applications ?? 0,
      accepted: stats?.accepted_applications ?? 0,
    }),
    [stats]
  )

  const activeShare = pct(s.active_jobs, s.total_jobs)
  const shortlistRate = pct(s.shortlisted, s.total_applications)
  const acceptedRate = pct(s.accepted, s.total_applications)
  const glass = dashboardGlassClass

  return (
    <RecruiterLayout title="Overview">
      <DashboardOverviewHero
        title="Recruitment overview"
        subtitle="Here is a snapshot of your hiring pipeline today."
      />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className={glass}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-bold leading-snug text-green-900">Job activity</h2>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50/90 px-3 py-2.5 ring-1 ring-rose-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  <span className="truncate text-sm font-semibold text-rose-900">Total jobs</span>
                </div>
                <span className="shrink-0 text-sm font-black text-rose-950">{s.total_jobs}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/90 px-3 py-2.5 ring-1 ring-amber-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <span className="truncate text-sm font-semibold text-amber-950">Active openings</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-black text-amber-950">{s.active_jobs}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/90 px-3 py-2.5 ring-1 ring-emerald-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                  <span className="truncate text-sm font-semibold text-emerald-900">Closed jobs</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-black text-emerald-950">{s.closed_jobs}</span>
                </div>
              </div>
            </div>
          </section>

          <section className={glass}>
            <h2 className="mb-1 text-[15px] font-bold text-green-900">Applications & mix</h2>
            <p className="mb-4 text-xs font-medium text-slate-500">Live ratios from your current numbers</p>
            <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center sm:items-start sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total applications</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">{s.total_applications}</p>
                <p className="mt-1 text-[11px] font-medium text-emerald-700">Accepted {acceptedRate}% of volume</p>
              </div>
              <div className="flex flex-1 flex-wrap items-end justify-center gap-6 sm:justify-end">
                <MiniDonut valuePct={activeShare} color="#059669" label="Active share" sub="Active ÷ total jobs" />
                <MiniDonut valuePct={shortlistRate} color="#6366f1" label="Shortlist rate" sub="Shortlisted ÷ apps" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              {/* Job offers link intentionally removed */}
            </div>
          </section>

          <section className={glass}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-bold leading-snug text-green-900">Pipeline status</h2>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/90 px-3 py-2.5 ring-1 ring-amber-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <span className="truncate text-sm font-semibold text-amber-950">Pending review</span>
                </div>
                <span className="shrink-0 text-sm font-black text-amber-950">{s.pending}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-violet-50/90 px-3 py-2.5 ring-1 ring-violet-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                  <span className="truncate text-sm font-semibold text-violet-950">Shortlisted</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-black text-violet-950">{s.shortlisted}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/90 px-3 py-2.5 ring-1 ring-emerald-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                  <span className="truncate text-sm font-semibold text-emerald-900">Accepted</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-black text-emerald-950">{s.accepted}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50/90 px-3 py-2.5 ring-1 ring-rose-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  <span className="truncate text-sm font-semibold text-rose-900">Rejected</span>
                </div>
                <span className="shrink-0 text-sm font-black text-rose-950">{s.rejected}</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </RecruiterLayout>
  )
}
