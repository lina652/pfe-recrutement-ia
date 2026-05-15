import { useEffect, useState } from "react"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
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
      <PageHeader
        eyebrow={PAGE_EYEBROWS.candidate}
        title="My Applications"
        count={total}
        countLabel="total applications"
      />

      <div className="mb-6 flex gap-2 flex-wrap">
        {["", "PENDING", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "ACCEPTED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === s
                ? "bg-blue-700 text-white"
                : "page-glass-pill text-gray-600 hover:bg-white/55"
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
        <div className="page-glass p-12 text-center text-gray-400">
          No applications found
        </div>
      ) : (
        <div className="page-glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="page-glass-thead border-b border-white/40">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Job</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Company</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">AI Score</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {filtered.map((app) => (
                <tr key={app.app_id} className="hover:bg-white/25">
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