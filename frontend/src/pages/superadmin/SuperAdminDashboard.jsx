import { useEffect, useMemo, useState } from "react"
import SuperAdminLayout from "../../components/superadmin/SuperAdminLayout"
import { getSuperAdminStats } from "../../api/authApi"
import {
  dashboardGlassClass,
  DashboardOverviewHero,
  DetailLink,
  MiniDonut,
  pct,
} from "../../components/shared/DashboardOverviewKit"

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSuperAdminStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const s = useMemo(
    () => ({
      total_companies: stats?.total_companies ?? 0,
      active_companies: stats?.active_companies ?? 0,
      pending_companies: stats?.pending_companies ?? 0,
      total_users: stats?.total_users ?? 0,
      total_candidates: stats?.total_candidates ?? 0,
      total_admins: stats?.total_admins ?? 0,
      total_recruiters: stats?.total_recruiters ?? 0,
    }),
    [stats]
  )

  const activeCoRate = pct(s.active_companies, s.total_companies)
  const candidateShare = pct(s.total_candidates, s.total_users)
  const glass = dashboardGlassClass

  return (
    <SuperAdminLayout title="Overview">
      <DashboardOverviewHero
        title="Platform overview"
        subtitle="Companies and users across the entire TalentOs deployment."
      />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className={glass}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-bold leading-snug text-green-900">Companies</h2>
              <DetailLink to="/superadmin/companies">Companies</DetailLink>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50/90 px-3 py-2.5 ring-1 ring-rose-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  <span className="truncate text-sm font-semibold text-rose-900">Total companies</span>
                </div>
                <span className="shrink-0 text-sm font-black text-rose-950">{s.total_companies}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/90 px-3 py-2.5 ring-1 ring-emerald-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                  <span className="truncate text-sm font-semibold text-emerald-900">Active companies</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-black text-emerald-950">{s.active_companies}</span>
                  <DetailLink to="/superadmin/companies" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/90 px-3 py-2.5 ring-1 ring-amber-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <span className="truncate text-sm font-semibold text-amber-950">Pending / inactive</span>
                </div>
                <span className="shrink-0 text-sm font-black text-amber-950">{s.pending_companies}</span>
              </div>
            </div>
          </section>

          <section className={glass}>
            <h2 className="mb-1 text-[15px] font-bold text-green-900">Platform scale</h2>
            <p className="mb-4 text-xs font-medium text-slate-500">Users and company activation</p>
            <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center sm:items-start sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total users</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">{s.total_users}</p>
                <p className="mt-1 text-[11px] font-medium text-emerald-700">
                  {activeCoRate}% companies active
                </p>
              </div>
              <div className="flex flex-1 flex-wrap items-end justify-center gap-6 sm:justify-end">
                <MiniDonut valuePct={activeCoRate} color="#059669" label="Active cos." sub="÷ total companies" />
                <MiniDonut valuePct={candidateShare} color="#6366f1" label="Candidates" sub="÷ all users" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <DetailLink to="/superadmin/companies">Directory</DetailLink>
            </div>
          </section>

          <section className={glass}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-bold leading-snug text-green-900">People on platform</h2>
              <DetailLink to="/superadmin/companies">Manage</DetailLink>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-blue-50/90 px-3 py-2.5 ring-1 ring-blue-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  <span className="truncate text-sm font-semibold text-blue-950">Candidates</span>
                </div>
                <span className="shrink-0 text-sm font-black text-blue-950">{s.total_candidates}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-violet-50/90 px-3 py-2.5 ring-1 ring-violet-100/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                  <span className="truncate text-sm font-semibold text-violet-950">Recruiters</span>
                </div>
                <span className="shrink-0 text-sm font-black text-violet-950">{s.total_recruiters}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-600" />
                  <span className="truncate text-sm font-semibold text-slate-800">Administrators</span>
                </div>
                <span className="shrink-0 text-sm font-black text-slate-900">{s.total_admins}</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </SuperAdminLayout>
  )
}
