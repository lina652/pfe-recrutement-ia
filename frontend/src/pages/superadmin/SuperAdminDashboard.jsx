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

const panelClass = `${dashboardGlassClass} flex h-full min-h-[17.5rem] flex-col`

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
    }),
    [stats]
  )

  const activeRate = pct(s.active_companies, s.total_companies)
  const inactiveRate = pct(s.pending_companies, s.total_companies)

  return (
    <SuperAdminLayout title="Overview">
      <DashboardOverviewHero
        title="Platform overview"
        subtitle="Companies registered and active on TalentOs."
      />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          <section className={panelClass}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-bold leading-snug text-green-900">Companies</h2>
              <DetailLink to="/superadmin/companies">Directory</DetailLink>
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
                  <span className="truncate text-sm font-semibold text-amber-950">Suspended / inactive</span>
                </div>
                <span className="shrink-0 text-sm font-black text-amber-950">{s.pending_companies}</span>
              </div>
            </div>
          </section>

          <section className={panelClass}>
            <h2 className="mb-1 text-[15px] font-bold text-green-900">Company status</h2>
            <p className="mb-4 text-xs font-medium text-slate-500">Share of active vs suspended companies</p>
            <div className="flex flex-1 flex-col items-stretch justify-center gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center sm:items-start sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total companies</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">{s.total_companies}</p>
                <p className="mt-1 text-[11px] font-medium text-emerald-700">
                  {activeRate}% active on the platform
                </p>
              </div>
              <div className="flex flex-1 flex-wrap items-end justify-center gap-6 sm:justify-end">
                <MiniDonut valuePct={activeRate} color="#059669" label="Active" sub="÷ total companies" />
                <MiniDonut valuePct={inactiveRate} color="#d97706" label="Suspended" sub="÷ total companies" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <DetailLink to="/superadmin/companies">Manage companies</DetailLink>
            </div>
          </section>
        </div>
      )}
    </SuperAdminLayout>
  )
}
