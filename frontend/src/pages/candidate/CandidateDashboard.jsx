import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import { getMyApplications } from "../../api/authApi"
import {
  dashboardGlassClass,
  DashboardOverviewHero,
  DetailLink,
  MiniDonut,
  pct,
} from "../../components/shared/DashboardOverviewKit"

const STATUS_COLORS = {
  PENDING: "bg-amber-500/20 text-amber-700 border border-amber-500/30",
  UNDER_REVIEW: "bg-blue-500/20 text-blue-700 border border-blue-500/30",
  SHORTLISTED: "bg-purple-500/20 text-purple-700 border border-purple-500/30",
  REJECTED: "bg-red-500/20 text-red-700 border border-red-500/30",
  ACCEPTED: "bg-emerald-500/20 text-emerald-700 border border-emerald-500/30",
}

const STATUS_ICONS = {
  PENDING: "⏳",
  UNDER_REVIEW: "🔍",
  SHORTLISTED: "⭐",
  REJECTED: "❌",
  ACCEPTED: "🎉",
}

export default function CandidateDashboard() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyApplications()
      .then((res) => setApplications(res.data.applications))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const total = applications.length
    const pending = applications.filter((a) => a.status === "PENDING").length
    const underReview = applications.filter((a) => a.status === "UNDER_REVIEW").length
    const shortlisted = applications.filter((a) => a.status === "SHORTLISTED").length
    const accepted = applications.filter((a) => a.status === "ACCEPTED").length
    const rejected = applications.filter((a) => a.status === "REJECTED").length
    return { total, pending, underReview, shortlisted, accepted, rejected }
  }, [applications])

  const shortlistRate = pct(counts.shortlisted, counts.total)
  const acceptedRate = pct(counts.accepted, counts.total)
  const glass = dashboardGlassClass

  return (
    <CandidateLayout title="Overview">
      <DashboardOverviewHero
        title="Your applications"
        subtitle="Track where each application stands and what to do next."
      />

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className={glass}>
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-bold leading-snug text-green-900">Application volume</h2>
                <DetailLink to="/candidate/applications" />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50/90 px-3 py-2.5 ring-1 ring-rose-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    <span className="truncate text-sm font-semibold text-rose-900">Total applications</span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-rose-950">{counts.total}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-blue-50/90 px-3 py-2.5 ring-1 ring-blue-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <span className="truncate text-sm font-semibold text-blue-950">Under review</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black text-blue-950">{counts.underReview}</span>
                    <DetailLink to="/candidate/applications" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/90 px-3 py-2.5 ring-1 ring-amber-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span className="truncate text-sm font-semibold text-amber-950">Pending</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black text-amber-950">{counts.pending}</span>
                    <DetailLink to="/candidate/applications" />
                  </div>
                </div>
              </div>
            </section>

            <section className={glass}>
              <h2 className="mb-1 text-[15px] font-bold text-green-900">Outcomes & mix</h2>
              <p className="mb-4 text-xs font-medium text-slate-500">How your applications are distributed</p>
              <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center sm:items-start sm:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total submitted</p>
                  <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">{counts.total}</p>
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">Accepted {acceptedRate}% so far</p>
                </div>
                <div className="flex flex-1 flex-wrap items-end justify-center gap-6 sm:justify-end">
                  <MiniDonut valuePct={shortlistRate} color="#6366f1" label="Shortlisted" sub="÷ all applications" />
                  <MiniDonut valuePct={acceptedRate} color="#059669" label="Accepted" sub="÷ all applications" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <DetailLink to="/jobs">Browse jobs</DetailLink>
              </div>
            </section>

            <section className={glass}>
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-bold leading-snug text-green-900">Status breakdown</h2>
                <DetailLink to="/candidate/applications" />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/90 px-3 py-2.5 ring-1 ring-amber-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span className="truncate text-sm font-semibold text-amber-950">Pending</span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-amber-950">{counts.pending}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-violet-50/90 px-3 py-2.5 ring-1 ring-violet-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                    <span className="truncate text-sm font-semibold text-violet-950">Shortlisted</span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-violet-950">{counts.shortlisted}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/90 px-3 py-2.5 ring-1 ring-emerald-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                    <span className="truncate text-sm font-semibold text-emerald-900">Accepted</span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-emerald-950">{counts.accepted}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50/90 px-3 py-2.5 ring-1 ring-rose-100/80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    <span className="truncate text-sm font-semibold text-rose-900">Rejected</span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-rose-950">{counts.rejected}</span>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-green-900 sm:text-xl">Recent applications</h2>
              <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                {counts.total} total
              </span>
            </div>

            {applications.length === 0 ? (
              <section className={`${glass} p-10 text-center sm:p-14`}>
                <div className="mb-4 text-5xl">📝</div>
                <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-600">
                  Browse open roles and send your first application to see it here.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/jobs")}
                  className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
                >
                  Browse jobs
                </button>
              </section>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {applications.map((app) => (
                  <section key={app.app_id} className={`${glass} transition hover:border-white/80`}>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-xl shadow-sm">
                          🏢
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900">{app.job_title}</h3>
                          <p className="text-sm font-medium text-slate-600">
                            {app.company_name}
                            {app.location && <span className="text-slate-400"> • {app.location}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold ${STATUS_COLORS[app.status] || "bg-slate-100 text-slate-700"}`}
                        >
                          {STATUS_ICONS[app.status]} {app.status?.replace("_", " ")}
                        </span>
                        {app.final_score > 0 && (
                          <span className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1 text-xs font-bold text-slate-700">
                            Match {(app.final_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {app.ai_recommendation && (
                      <div className="mb-4 rounded-2xl border border-blue-100/80 bg-blue-50/60 p-4 text-sm text-slate-800">
                        <span className="mr-2 text-blue-500">💡</span>
                        {app.ai_recommendation}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-4 text-xs font-medium text-slate-500">
                      <span>
                        Applied{" "}
                        {new Date(app.submission_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate("/candidate/applications")}
                        className="font-bold text-green-900 underline-offset-2 hover:underline"
                      >
                        View details →
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </CandidateLayout>
  )
}
