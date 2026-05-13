import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import { getMyApplications } from "../../api/authApi"

const STATUS_COLORS = {
  PENDING:      "bg-amber-500/20 text-amber-500 border border-amber-500/30",
  UNDER_REVIEW: "bg-blue-500/20 text-blue-500 border border-blue-500/30",
  SHORTLISTED:  "bg-purple-500/20 text-purple-500 border border-purple-500/30",
  REJECTED:     "bg-red-500/20 text-red-500 border border-red-500/30",
  ACCEPTED:     "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30",
}

const STATUS_ICONS = {
  PENDING:      "⏳",
  UNDER_REVIEW: "🔍",
  SHORTLISTED:  "⭐",
  REJECTED:     "❌",
  ACCEPTED:     "🎉",
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

  const pending = applications.filter((a) => a.status === "PENDING").length
  const shortlisted = applications.filter((a) => a.status === "SHORTLISTED").length
  const accepted = applications.filter((a) => a.status === "ACCEPTED").length

  return (
    <CandidateLayout title="Overview">
      <div className="mb-10 p-8 rounded-3xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Welcome back! 👋</h1>
          <p className="text-blue-200 text-lg">Here's what's happening with your job applications today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white/60 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Pending</h3>
            <span className="p-2 bg-amber-100 rounded-xl text-amber-600">⏳</span>
          </div>
          <p className="text-5xl font-black text-gray-800">{pending}</p>
        </div>
        
        <div className="bg-white/60 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Shortlisted</h3>
            <span className="p-2 bg-purple-100 rounded-xl text-purple-600">⭐</span>
          </div>
          <p className="text-5xl font-black text-gray-800">{shortlisted}</p>
        </div>
        
        <div className="bg-white/60 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Accepted</h3>
            <span className="p-2 bg-emerald-100 rounded-xl text-emerald-600">🎉</span>
          </div>
          <p className="text-5xl font-black text-gray-800">{accepted}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Recent Applications</h2>
        <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-sm font-bold">{applications.length} total</span>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-100 p-16 text-center shadow-lg">
          <div className="text-6xl mb-6">📝</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No applications yet</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">You haven't applied to any jobs yet. Browse our open positions and find your next role.</p>
          <button
            onClick={() => navigate("/jobs")}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            Browse Jobs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {applications.map((app) => (
            <div key={app.app_id} className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 p-6 shadow-lg hover:shadow-xl transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl shadow-sm border border-white">
                    🏢
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">{app.job_title}</h3>
                    <p className="text-sm font-medium text-gray-500">{app.company_name} {app.location && <span className="text-gray-400 font-normal"> • {app.location}</span>}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${STATUS_COLORS[app.status]} flex items-center gap-1.5`}>
                    {STATUS_ICONS[app.status]} {app.status.replace("_", " ")}
                  </span>
                  {app.final_score > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                      🤖 Match: {(app.final_score * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
              
              {app.ai_recommendation && (
                <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-2xl p-4 text-sm text-gray-700 shadow-inner">
                  <div className="flex gap-2">
                    <span className="text-blue-500">💡</span>
                    <p className="leading-relaxed text-blue-900/80 font-medium">{app.ai_recommendation}</p>
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-medium text-gray-400">
                <span>Applied {new Date(app.submission_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <button className="text-blue-600 hover:text-blue-800 font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">View Details →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CandidateLayout>
  )
}