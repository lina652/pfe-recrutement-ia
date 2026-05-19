import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import { getRecruiterInterviews, getInterviewDetail, getInterviewReport } from "../../api/authApi"
import Toast from "../../components/Toast"

export default function Interviews() {
  const { user } = useAuth()
  const [interviews, setInterviews] = useState([])
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadInterviews()
  }, [])

  const loadInterviews = async () => {
    try {
      const result = await getRecruiterInterviews()
      setInterviews(result.data || [])
    } catch (err) {
      // Silently fail without showing error toast
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (interview) => {
    try {
      const detailResult = await getInterviewDetail(interview.interview_id)
      setSelectedInterview(detailResult.data)
      
      if (interview.status === "COMPLETED") {
        try {
          const reportResult = await getInterviewReport(interview.interview_id)
          setReport(reportResult.data)
        } catch (err) {
          console.warn("Report not available yet")
        }
      }
      
      setShowDetail(true)
    } catch (err) {
      setToast({ type: "error", message: "Failed to load interview details" })
      console.error(err)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      INVITED: "bg-blue-100 text-blue-800",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800"
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  if (loading) {
    return (
      <RecruiterLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RecruiterLayout>
    )
  }

  return (
    <RecruiterLayout>
      <div>
        <PageHeader
          eyebrow={PAGE_EYEBROWS.recruiter}
          title="Interviews"
          subtitle="Manage and review candidate interviews"
        />

        {interviews.length === 0 ? (
          <div className="page-glass p-12 text-center">
            <p className="text-gray-500">No interviews yet</p>
          </div>
        ) : (
          <div className="page-glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="page-glass-thead border-b border-white/40">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Candidate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Job</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Language</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Turns</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {interviews.map((interview) => (
                    <tr key={interview.interview_id} className="hover:bg-white/25 transition">
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">{interview.candidate_id.substring(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{interview.job_id.substring(0, 8)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(interview.status)}`}>
                          {interview.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {interview.language === "en" ? "🇬🇧" : "🇫🇷"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">{interview.turn_count}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(interview.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewDetail(interview)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Interview Detail Modal */}
        {showDetail && selectedInterview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="page-glass shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-2xl font-bold">Interview Details</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Candidate ID</p>
                    <p className="text-lg font-mono text-gray-800">{selectedInterview.candidate_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Status</p>
                    <p className={`text-lg font-bold ${getStatusColor(selectedInterview.status)}`}>
                      {selectedInterview.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Phase</p>
                    <p className="text-lg font-bold capitalize">{selectedInterview.phase}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Turns Completed</p>
                    <p className="text-lg font-bold">{selectedInterview.turn_count}</p>
                  </div>
                </div>

                {report && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <h3 className="font-bold text-lg mb-3">AI Report</h3>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="page-glass-inset rounded-xl p-2 text-center">
                        <p className="text-2xl font-bold text-blue-600">{report.overall_score}</p>
                        <p className="text-xs text-gray-600">Overall</p>
                      </div>
                      <div className="page-glass-inset rounded-xl p-2 text-center">
                        <p className="text-2xl font-bold text-green-600">{report.communication_score}</p>
                        <p className="text-xs text-gray-600">Communication</p>
                      </div>
                      <div className="page-glass-inset rounded-xl p-2 text-center">
                        <p className="text-2xl font-bold text-purple-600">{report.technical_score}</p>
                        <p className="text-xs text-gray-600">Technical</p>
                      </div>
                      <div className="page-glass-inset rounded-xl p-2 text-center">
                        <p className="text-2xl font-bold text-orange-600">{report.motivation_score}</p>
                        <p className="text-xs text-gray-600">Motivation</p>
                      </div>
                    </div>
                    <div className="page-glass-inset rounded-xl p-3">
                      <p className="text-sm"><strong>Recommendation:</strong> {report.recommendation}</p>
                      {report.summary && (
                        <p className="text-sm mt-2"><strong>Summary:</strong> {report.summary}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </RecruiterLayout>
  )
}
