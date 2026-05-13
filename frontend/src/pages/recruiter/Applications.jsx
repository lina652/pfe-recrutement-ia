import { useEffect, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import API, { getRecruiterJobs } from "../../api/authApi"

const STATUS_COLORS = {
  PENDING:      "bg-yellow-100 text-yellow-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  SHORTLISTED:  "bg-green-100 text-green-700",
  REJECTED:     "bg-red-100 text-red-700",
  ACCEPTED:     "bg-emerald-100 text-emerald-700",
}

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [jobFilter, setJobFilter] = useState("")
  const [selected, setSelected] = useState(null)
  const [overrideForm, setOverrideForm] = useState({ status: "", reason: "" })
  const [overrideLoading, setOverrideLoading] = useState("")
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const res = await API.get("/recruiter/applications", {
        params: {
          status: statusFilter || undefined,
          job_id: jobFilter || undefined
        }
      })
      setApplications(res.data.applications)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const jobsRes = await getRecruiterJobs()
        setJobs(jobsRes.data.jobs || [])
      } catch (err) {
        console.error(err)
      }
    }

    load()
  }, [])

  useEffect(() => { fetchApplications() }, [statusFilter, jobFilter])

  const handleOverride = async (appId) => {
    if (!overrideForm.status || !overrideForm.reason) {
      setError("Please select a status and provide a reason")
      return
    }
    try {
      setOverrideLoading(appId)
      await API.put(`/recruiter/applications/${appId}/override`, overrideForm)
      setSuccess("AI decision overridden successfully")
      setSelected(null)
      setOverrideForm({ status: "", reason: "" })
      await fetchApplications()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to override")
    } finally {
      setOverrideLoading("")
    }
  }



  return (
    <RecruiterLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Applications</h1>
        <p className="text-gray-500 mt-1">{total} total applications</p>
      </div>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="REJECTED">Rejected</option>
            <option value="ACCEPTED">Accepted</option>
          </select>

          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[240px]"
          >
            <option value="">All Jobs</option>
            {jobs.map((job) => (
              <option key={job.job_id} value={job.job_id}>
                {job.title} {job.company_name ? `- ${job.company_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Application ID</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Candidate</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Job</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">AI Score</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">HR Override</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Submitted</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No applications found
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <>
                    <tr key={app.app_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {app.app_id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {app.candidate_name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-700">{app.job_title || "—"}</div>
                        <div className="text-xs text-gray-400">{app.company_name || ""}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[app.status]}`}>
                          {app.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {app.final_score ? `${(app.final_score * 100).toFixed(0)}%` : "Pending"}
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
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setError("")
                              setSelected(selected?.app_id === app.app_id ? null : app)
                            }}
                            className="text-xs font-semibold px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          >
                            Override
                          </button>
                        </div>
                      </td>
                    </tr>
                    {selected?.app_id === app.app_id && (
                      <tr key={`override-${app.app_id}`}>
                        <td colSpan={8} className="px-6 py-4 bg-orange-50 border-t border-orange-100">
                          <div className="flex gap-4 items-end">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">New Status</label>
                              <select
                                value={overrideForm.status}
                                onChange={(e) => setOverrideForm({ ...overrideForm, status: e.target.value })}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              >
                                <option value="">Select status</option>
                                <option value="SHORTLISTED">Shortlist</option>
                                <option value="REJECTED">Reject</option>
                                <option value="UNDER_REVIEW">Under Review</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                              <input
                                type="text"
                                value={overrideForm.reason}
                                onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                                placeholder="Reason for overriding AI decision..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              />
                            </div>
                            <button
                              onClick={() => handleOverride(app.app_id)}
                                className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-700 transition flex items-center gap-2"
                                disabled={overrideLoading === app.app_id}
                            >
                                {overrideLoading === app.app_id ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Confirming...</span>
                                  </>
                                ) : (
                                  "Confirm Override"
                                )}
                            </button>
                            <button
                              onClick={() => setSelected(null)}
                              className="text-gray-500 text-sm hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </RecruiterLayout>
  )
}
