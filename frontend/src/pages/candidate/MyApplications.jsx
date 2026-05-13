import { useEffect, useState } from "react"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import { getMyApplications } from "../../api/authApi"

const STATUS_COLORS = {
  PENDING:      "bg-yellow-100 text-yellow-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  SHORTLISTED:  "bg-green-100 text-green-700",
  REJECTED:     "bg-red-100 text-red-700",
  ACCEPTED:     "bg-emerald-100 text-emerald-700",
}

export default function MyApplications() {
  const [applications, setApplications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    getMyApplications()
      .then((res) => {
        setApplications(res.data.applications)
        setTotal(res.data.total)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter
    ? applications.filter((a) => a.status === filter)
    : applications

  return (
    <CandidateLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Applications</h1>
        <p className="text-gray-500 mt-1">{total} total applications</p>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        {["", "PENDING", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "ACCEPTED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === s
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No applications found
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Job</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Company</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">AI Score</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((app) => (
                <tr key={app.app_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {app.job_title}
                  </td>
                  <td className="px-6 py-4 text-blue-600">
                    {app.company_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[app.status]}`}>
                      {app.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {app.final_score
                      ? `${(app.final_score * 100).toFixed(0)}%`
                      : "Pending"
                    }
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(app.submission_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CandidateLayout>
  )
}