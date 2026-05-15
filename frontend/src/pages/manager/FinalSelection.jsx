  import { useEffect, useState } from "react"
  import ManagerLayout from "../../components/manager/ManagerLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
  import API from "../../api/authApi"

  export default function FinalSelection() {
    const [applications, setApplications] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [success, setSuccess] = useState("")
    const [error, setError] = useState("")

    const fetchShortlisted = () => {
      setLoading(true)
      API.get("/manager/shortlisted")
        .then((res) => {
          setApplications(res.data.applications)
          setTotal(res.data.total)
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false))
    }

    useEffect(() => { fetchShortlisted() }, [])

    const handleSelect = async (appId) => {
      if (!window.confirm("Are you sure you want to select this candidate? All other shortlisted candidates for this job will be rejected.")) return

      setError("")
      try {
        const res = await API.post("/manager/select", { app_id: appId })
        setSuccess(`✅ Candidate selected. ${res.data.rejected_count} other candidates rejected. Job offer closed.`)
        fetchShortlisted()
        setTimeout(() => setSuccess(""), 5000)
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to make selection")
      }
    }

    const handleRequestMore = async (jobId) => {
      try {
        await API.post(`/manager/request-more/${jobId}`)
        setSuccess("Job reopened — more candidates can apply")
        setTimeout(() => setSuccess(""), 3000)
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to reopen job")
      }
    }

    return (
      <ManagerLayout>
        <PageHeader
          eyebrow={PAGE_EYEBROWS.manager}
          title="Final Selection"
          subtitle="Select the best candidate from the shortlist"
        />

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : applications.length === 0 ? (
          <div className="page-glass p-12 text-center text-gray-400">
            No shortlisted candidates available for selection
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div key={app.app_id} className="page-glass p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      Application — {app.app_id.slice(0, 8)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Job: {app.job_id.slice(0, 8)}...
                    </p>
                    {app.final_score && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${app.final_score * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-purple-700">
                          {(app.final_score * 100).toFixed(0)}% match
                        </span>
                      </div>
                    )}
                    {app.ai_recommendation && (
                      <p className="text-xs text-gray-500 mt-1">
                        AI: {app.ai_recommendation}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRequestMore(app.job_id)}
                      className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                    >
                      Request More
                    </button>
                    <button
                      onClick={() => handleSelect(app.app_id)}
                      className="bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-800 transition"
                    >
                      Select Candidate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ManagerLayout>
    )
  }