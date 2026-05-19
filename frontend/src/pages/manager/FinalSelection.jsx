import { useEffect, useState } from "react"
import ManagerLayout from "../../components/manager/ManagerLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import RequestMoreModal from "../../components/manager/RequestMoreModal"
import FinalSelectionJobSelect from "../../components/manager/FinalSelectionJobSelect"
import API from "../../api/authApi"

export default function FinalSelection() {
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState("")
  const [jobDetail, setJobDetail] = useState(null)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [requestMoreOpen, setRequestMoreOpen] = useState(false)
  const [requestMoreJobId, setRequestMoreJobId] = useState(null)
  const [requestMoreJobTitle, setRequestMoreJobTitle] = useState("")

  useEffect(() => {
    setLoadingJobs(true)
    API.get("/manager/final-selection/jobs")
      .then((res) => {
        const list = res.data.jobs || []
        setJobs(list)
        if (list.length > 0 && !selectedJobId) {
          setSelectedJobId(list[0].job_id)
        }
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load jobs"))
      .finally(() => setLoadingJobs(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null)
      return
    }
    setLoadingCandidates(true)
    setError("")
    API.get(`/manager/final-selection/${selectedJobId}`)
      .then((res) => setJobDetail(res.data))
      .catch((err) => {
        setJobDetail(null)
        setError(err.response?.data?.detail || "Failed to load candidates")
      })
      .finally(() => setLoadingCandidates(false))
  }, [selectedJobId, success])

  const refreshJobDetail = () => {
    if (!selectedJobId) return
    API.get(`/manager/final-selection/${selectedJobId}`).then((res) => setJobDetail(res.data))
  }

  const handleSelect = async (appId) => {
    if (
      !window.confirm(
        "Are you sure you want to select this candidate? All other shortlisted candidates for this job will be rejected."
      )
    )
      return

    setError("")
    try {
      const res = await API.post("/manager/select", { app_id: appId })
      setSuccess(
        `Candidate selected. ${res.data.rejected_count} other candidate(s) rejected. Job offer closed.`
      )
      refreshJobDetail()
      setTimeout(() => setSuccess(""), 5000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to make selection")
    }
  }

  const handleRequestMore = (jobId, jobTitle) => {
    setRequestMoreJobId(jobId)
    setRequestMoreJobTitle(jobTitle)
    setRequestMoreOpen(true)
  }

  const handleRequestMoreSuccess = (data) => {
    const when = data?.new_closing_date
      ? new Date(data.new_closing_date).toLocaleString()
      : null
    setSuccess(
      when
        ? `Job reopened. New closing date: ${when}`
        : "Job reopened with updated closing date. Candidates can apply again."
    )
    setRequestMoreOpen(false)
    setRequestMoreJobId(null)
    setRequestMoreJobTitle("")
    refreshJobDetail()
    setTimeout(() => setSuccess(""), 5000)
  }

  const candidates = jobDetail?.candidates || []
  const ready = jobDetail?.ready === true

  return (
    <ManagerLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.manager}
        title="Final Selection"
        subtitle="Choose a job, then select the best candidate once all interviews are complete"
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

      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Job offer</label>
        <FinalSelectionJobSelect
          jobs={jobs}
          value={selectedJobId}
          onChange={setSelectedJobId}
          loading={loadingJobs}
        />
      </div>

      {loadingCandidates ? (
        <div className="flex justify-center mt-16">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedJobId ? null : !ready ? (
        <div className="page-glass p-8 sm:p-10 text-center text-gray-500">
          <p className="font-medium text-gray-700 mb-2">
            {jobDetail?.message || "Interviews still in progress"}
          </p>
          <p className="text-sm mb-6">
            {jobDetail?.pending_interviews ?? 0} shortlisted candidate(s) still need to finish their AI
            interview. Scores appear once everyone has completed.
          </p>
          {(jobDetail?.shortlisted_preview?.length ?? 0) > 0 && (
            <div className="mx-auto max-w-md text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Shortlisted for this job ({jobDetail.shortlisted_preview.length})
              </p>
              <ul className="space-y-2">
                {jobDetail.shortlisted_preview.map((row) => (
                  <li
                    key={row.app_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-white/50 px-4 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-slate-800">{row.candidate_name}</span>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500 capitalize">
                      {row.interview_status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                The count in the job selector is shortlisted applications, not manual picks. When the
                job closed, the AI may have shortlisted up to 10 top CV matches.
              </p>
            </div>
          )}
        </div>
      ) : candidates.length === 0 ? (
        <div className="page-glass p-12 text-center text-gray-400">
          No shortlisted candidates available for this job.
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((app) => (
            <div key={app.app_id} className="page-glass p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{app.candidate_name}</p>
                  <p className="text-sm text-gray-500 mt-1">{app.job_title}</p>

                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="rounded-full bg-purple-100 px-3 py-1 font-bold text-purple-800">
                      AI score: {app.composite_score}%
                    </span>
                    <span className="text-gray-600">CV: {app.cv_score}%</span>
                    <span className="text-gray-600">Interview: {app.interview_score}%</span>
                  </div>

                  <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(app.composite_score, 100)}%` }}
                    />
                  </div>

                  {app.ai_recommendation && (
                    <p className="text-xs text-gray-500 mt-2">CV match: {app.ai_recommendation}</p>
                  )}
                  {app.interview_recommendation && (
                    <p className="text-xs text-gray-500">
                      Interview: {app.interview_recommendation.replace(/_/g, " ")}
                    </p>
                  )}
                  {app.interview_summary && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{app.interview_summary}</p>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRequestMore(app.job_id, app.job_title)}
                    className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                  >
                    Request More
                  </button>
                  <button
                    type="button"
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

      <RequestMoreModal
        open={requestMoreOpen}
        jobId={requestMoreJobId}
        jobTitle={requestMoreJobTitle}
        onClose={() => setRequestMoreOpen(false)}
        onSuccess={handleRequestMoreSuccess}
      />
    </ManagerLayout>
  )
}
