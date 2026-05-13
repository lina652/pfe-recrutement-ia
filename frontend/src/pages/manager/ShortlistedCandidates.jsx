import { useEffect, useState } from "react"
import ManagerLayout from "../../components/manager/ManagerLayout"
import API from "../../api/authApi"

export default function ShortlistedCandidates() {
  const [applications, setApplications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get("/manager/shortlisted")
      .then((res) => {
        setApplications(res.data.applications)
        setTotal(res.data.total)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ManagerLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Shortlisted Candidates</h1>
        <p className="text-gray-500 mt-1">{total} candidates shortlisted by AI</p>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Application ID</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Job ID</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">AI Score</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Recommendation</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">HR Override</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No shortlisted candidates yet
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.app_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {app.app_id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {app.job_id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4">
                      {app.final_score ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${app.final_score * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-purple-700">
                            {(app.final_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs max-w-xs truncate">
                      {app.ai_recommendation || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {app.hr_override ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                          Overridden
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">AI Decision</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(app.submission_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </ManagerLayout>
  )
}