import { useEffect, useMemo, useState } from "react"

import AdminLayout from "../../components/admin/AdminLayout"

import { getStats } from "../../api/authApi"

import {

  dashboardGlassClass,

  DashboardOverviewHero,

  DetailLink,

  MiniDonut,

  pct,

  RoleMixBar,

} from "../../components/shared/DashboardOverviewKit"



const panelClass = `${dashboardGlassClass} flex h-full min-h-[17.5rem] flex-col`
const compositionPanelClass = `${dashboardGlassClass} flex h-full min-h-[22rem] flex-col`



export default function AdminDashboard() {

  const [stats, setStats] = useState(null)

  const [loading, setLoading] = useState(true)



  useEffect(() => {

    getStats()

      .then((res) => setStats(res.data))

      .catch((err) => console.error(err))

      .finally(() => setLoading(false))

  }, [])



  const s = useMemo(

    () => ({

      total_staff: stats?.total_staff ?? 0,

      total_recruiters: stats?.total_recruiters ?? 0,

      total_hiring_managers: stats?.total_hiring_managers ?? 0,

      total_admins: stats?.total_admins ?? 0,

      active_staff: stats?.active_staff ?? 0,

      inactive_staff: stats?.inactive_staff ?? 0,

      total_logs: stats?.total_logs ?? 0,

      total_reports: stats?.total_reports ?? 0,

    }),

    [stats]

  )



  const activeRate = pct(s.active_staff, s.total_staff)

  const inactiveRate = pct(s.inactive_staff, s.total_staff)

  const roleMixSegments = useMemo(
    () => [
      { label: "Recruiters", count: s.total_recruiters, color: "#7c3aed" },
      { label: "Hiring managers", count: s.total_hiring_managers, color: "#f59e0b" },
    ],
    [s.total_recruiters, s.total_hiring_managers]
  )



  return (

    <AdminLayout title="Overview">

      <DashboardOverviewHero

        title="Organization administration"

        subtitle="Manage users, roles, and activity for your company workspace."

      />



      {loading ? (

        <div className="mt-16 flex justify-center">

          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />

        </div>

      ) : (

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">

          <section className={panelClass}>

            <div className="mb-4 flex items-start justify-between gap-2">

              <h2 className="text-[15px] font-bold leading-snug text-green-900">Account health</h2>

              <DetailLink to="/admin/users">Users</DetailLink>

            </div>

            <div className="flex flex-1 flex-col justify-center space-y-2.5">

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50/90 px-3 py-2.5 ring-1 ring-rose-100/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />

                  <span className="truncate text-sm font-semibold text-rose-900">Total staff</span>

                </div>

                <span className="shrink-0 text-sm font-black text-rose-950">{s.total_staff}</span>

              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/90 px-3 py-2.5 ring-1 ring-emerald-100/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />

                  <span className="truncate text-sm font-semibold text-emerald-900">Active staff</span>

                </div>

                <div className="flex shrink-0 items-center gap-2">

                  <span className="text-sm font-black text-emerald-950">{s.active_staff}</span>

                  <DetailLink to="/admin/users" />

                </div>

              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100/90 px-3 py-2.5 ring-1 ring-slate-200/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />

                  <span className="truncate text-sm font-semibold text-slate-800">Inactive staff</span>

                </div>

                <span className="shrink-0 text-sm font-black text-slate-900">{s.inactive_staff}</span>

              </div>

            </div>

          </section>



          <section className={compositionPanelClass}>

            <h2 className="mb-1 text-[15px] font-bold text-green-900">Composition</h2>

            <p className="mb-4 text-xs font-medium text-slate-500">Staff activation overview</p>

            <div className="flex flex-1 flex-col justify-center gap-5">

              <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center sm:items-start sm:text-left">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Directory size</p>

                  <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">{s.total_staff}</p>

                  <p className="mt-1 text-[11px] font-medium text-emerald-700">{activeRate}% staff active</p>

                </div>

                <div className="flex flex-1 flex-wrap items-center justify-center gap-6 sm:justify-end">

                  <MiniDonut valuePct={activeRate} color="#059669" label="Active rate" sub="Active ÷ staff" />

                  <MiniDonut valuePct={inactiveRate} color="#94a3b8" label="Inactive rate" sub="Inactive ÷ staff" />

                </div>

              </div>

              <RoleMixBar
                title="Recruiter vs hiring manager"
                subtitle="Percentage split among operational roles"
                segments={roleMixSegments}
              />

            </div>

            <div className="mt-auto flex justify-end pt-4">

              <DetailLink to="/admin/reports">Reports</DetailLink>

            </div>

          </section>



          <section className={panelClass}>

            <div className="mb-4 flex items-start justify-between gap-2">

              <h2 className="text-[15px] font-bold leading-snug text-green-900">Roles & activity</h2>

              <DetailLink to="/admin/logs">Logs</DetailLink>

            </div>

            <div className="flex flex-1 flex-col justify-center space-y-2.5">

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-blue-50/90 px-3 py-2.5 ring-1 ring-blue-100/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />

                  <span className="truncate text-sm font-semibold text-blue-950">Administrators</span>

                </div>

                <span className="shrink-0 text-sm font-black text-blue-950">{s.total_admins}</span>

              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-violet-50/90 px-3 py-2.5 ring-1 ring-violet-100/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />

                  <span className="truncate text-sm font-semibold text-violet-950">Recruiters</span>

                </div>

                <span className="shrink-0 text-sm font-black text-violet-950">{s.total_recruiters}</span>

              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/90 px-3 py-2.5 ring-1 ring-amber-100/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />

                  <span className="truncate text-sm font-semibold text-amber-950">Hiring managers</span>

                </div>

                <span className="shrink-0 text-sm font-black text-amber-950">{s.total_hiring_managers}</span>

              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100/90 px-3 py-2.5 ring-1 ring-slate-200/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />

                  <span className="truncate text-sm font-semibold text-slate-800">System logs</span>

                </div>

                <div className="flex shrink-0 items-center gap-2">

                  <span className="text-sm font-black text-slate-900">{s.total_logs}</span>

                  <DetailLink to="/admin/logs" />

                </div>

              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-indigo-50/90 px-3 py-2.5 ring-1 ring-indigo-100/80">

                <div className="flex min-w-0 items-center gap-2">

                  <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" />

                  <span className="truncate text-sm font-semibold text-indigo-950">Reports generated</span>

                </div>

                <span className="shrink-0 text-sm font-black text-indigo-950">{s.total_reports}</span>

              </div>

            </div>

          </section>

        </div>

      )}

    </AdminLayout>

  )

}


