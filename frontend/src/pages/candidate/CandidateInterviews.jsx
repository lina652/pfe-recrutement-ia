import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import {
  getCandidateInterviews,
  respondToCandidateInterview,
  getInterviewTimeSlots,
  selectInterviewTimeSlot,
  updateInterviewLanguage,
  getInterviewScores,
  endInterview,
} from "../../api/authApi"
import Toast from "../../components/Toast"
import InterviewScheduleCalendar from "../../components/shared/InterviewScheduleCalendar"
import { canStartInterview, formatInterviewStartLabel, dayToScheduleIso } from "../../utils/interviewTime"

function ClockIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  )
}

export default function CandidateInterviews() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [isResponding, setIsResponding] = useState(false)
  const [responseReasons, setResponseReasons] = useState({})
  const [toast, setToast] = useState(null)
  
  // Time slot selection state
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false)
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [timeSlots, setTimeSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)
  const [submittingSlot, setSubmittingSlot] = useState(false)
  const [interviewLanguages, setInterviewLanguages] = useState({})
  const [savingLanguage, setSavingLanguage] = useState(null)
  const [resultsModal, setResultsModal] = useState(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [endingId, setEndingId] = useState(null)

  const [, setTick] = useState(0)

  useEffect(() => {
    loadInterviews()
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const loadInterviews = async () => {
    try {
      const result = await getCandidateInterviews()
      const list = result.data || []
      setInterviews(list)
      setInterviewLanguages(
        Object.fromEntries(list.map((i) => [i.interview_id, i.language || "en"]))
      )
    } catch (err) {
      // Silently fail without showing error toast
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      INVITED: "bg-blue-100 text-blue-800",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800"
    }
    return badges[status] || "bg-gray-100 text-gray-800"
  }

  const handleRespond = async (interviewId, action) => {
    const reason = responseReasons[interviewId] || ""
    if (action === "REFUSED" && !reason.trim()) {
      setToast({ type: "error", message: "Please provide a justification for refusing" })
      return
    }

    try {
      setIsResponding(true)
      await respondToCandidateInterview(interviewId, { action, reason: reason.trim() || null })
      setToast({ type: "success", message: action === "ACCEPTED" ? "Invitation accepted" : "Invitation refused" })
      loadInterviews() // Reload the list to get updated status
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to submit response" })
    } finally {
      setIsResponding(false)
    }
  }

  const handleEndSession = async (interview) => {
    setEndingId(interview.interview_id)
    try {
      await endInterview(interview.interview_id)
      await loadInterviews()
      setToast({ type: "success", message: "Interview session closed. You can view results when ready." })
      await openResults(interview.interview_id)
    } catch (err) {
      setToast({
        type: "error",
        message: err.response?.data?.detail || "Could not close interview session",
      })
    } finally {
      setEndingId(null)
    }
  }

  const openResults = async (interviewId) => {
    setResultsModal({ interviewId, report: null, error: null })
    setLoadingResults(true)
    try {
      const res = await getInterviewScores(interviewId)
      setResultsModal({ interviewId, report: res.data, error: null })
    } catch (err) {
      setResultsModal({
        interviewId,
        report: null,
        error: err.response?.data?.detail || "Results are not available yet",
      })
    } finally {
      setLoadingResults(false)
    }
  }

  const handleStartInterview = (interview) => {
    if (!canStartInterview(interview.scheduled_at)) {
      setToast({
        type: "error",
        message: `Interview available on ${formatInterviewStartLabel(interview.scheduled_at)}`,
      })
      return
    }
    navigate(`/candidate/interview/${interview.interview_id}`)
  }

  const handleLanguageChange = async (interviewId, language) => {
    setInterviewLanguages((prev) => ({ ...prev, [interviewId]: language }))
    setSavingLanguage(interviewId)
    try {
      await updateInterviewLanguage(interviewId, { language })
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to update language" })
      loadInterviews()
    } finally {
      setSavingLanguage(null)
    }
  }

  // Time slot functions
  const openTimeSlotModal = async (interview) => {
    setSelectedInterview(interview)
    setShowTimeSlotModal(true)
    setLoadingSlots(true)
    setSelectedSlot(null)
    setSelectedCalendarDate(null)

    try {
      const result = await getInterviewTimeSlots(interview.interview_id)
      setTimeSlots(result.data?.slots || [])
    } catch (err) {
      setToast({ type: "error", message: "Failed to load available days" })
      console.error(err)
    } finally {
      setLoadingSlots(false)
    }
  }

  const closeTimeSlotModal = () => {
    setShowTimeSlotModal(false)
    setSelectedInterview(null)
    setTimeSlots([])
    setSelectedSlot(null)
    setSelectedCalendarDate(null)
  }

  const handleSelectTimeSlot = async () => {
    const day = selectedCalendarDate || (selectedSlot ? new Date(selectedSlot.datetime) : null)
    if (!day || !selectedInterview) return

    setSubmittingSlot(true)
    try {
      await selectInterviewTimeSlot(selectedInterview.interview_id, {
        selected_datetime: dayToScheduleIso(day),
        language: interviewLanguages[selectedInterview.interview_id] || selectedInterview.language || "en",
      })
      setToast({ type: "success", message: "Interview day confirmed! Check your email for details." })
      closeTimeSlotModal()
      loadInterviews()
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to select interview day" })
    } finally {
      setSubmittingSlot(false)
    }
  }

  if (loading) {
    return (
      <CandidateLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CandidateLayout>
    )
  }

  return (
    <CandidateLayout>
      <div>
        <PageHeader
          eyebrow={PAGE_EYEBROWS.candidate}
          title="My Interviews"
          subtitle="View your interview invitations and schedule"
        />

        {interviews.length === 0 ? (
          <div className="page-glass p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-500 font-semibold">No interviews yet</p>
            <p className="text-gray-400 text-sm mt-2">
              You will receive interview invitations here
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {interviews.map((interview) => (
              <div
                key={interview.interview_id}
                className="page-glass p-4 w-full max-w-2xl mx-auto flex flex-col items-center text-center"
              >
                <div className="flex flex-col items-center gap-2 mb-3 w-full">
                  <span className={`px-2.5 py-1 rounded-full font-semibold text-xs ${getStatusBadge(interview.status)}`}>
                    {interview.status}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{interview.job_title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Created: {new Date(interview.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-3 px-4 py-2 rounded-lg page-glass-inset mx-auto">
                  <div className="flex flex-col items-center min-w-[4.5rem]">
                    <span className="text-gray-500 text-xs">Language</span>
                    {interview.status === "INVITED" ? (
                      <select
                        value={interviewLanguages[interview.interview_id] || interview.language || "en"}
                        onChange={(e) => handleLanguageChange(interview.interview_id, e.target.value)}
                        disabled={savingLanguage === interview.interview_id}
                        className="text-sm font-semibold text-gray-800 bg-transparent border-0 p-0 text-center focus:outline-none focus:ring-0 cursor-pointer"
                      >
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                      </select>
                    ) : (
                      <span className="text-sm font-semibold text-gray-800">
                        {(interviewLanguages[interview.interview_id] || interview.language) === "en" ? "English" : "Français"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-center min-w-[4.5rem]">
                    <span className="text-gray-500 text-xs">Phase</span>
                    <span className="text-sm font-semibold text-gray-800 capitalize">{interview.phase}</span>
                  </div>
                  <div className="flex flex-col items-center min-w-[4.5rem]">
                    <span className="text-gray-500 text-xs">Turns</span>
                    <span className="text-sm font-semibold text-gray-800">{interview.turn_count ?? 0}</span>
                  </div>
                </div>

                {interview.scheduled_at && (
                  <div className="mb-3 text-sm text-gray-600">
                    <span className="font-semibold">Scheduled:</span> {formatInterviewStartLabel(interview.scheduled_at)}
                  </div>
                )}

                {interview.candidate_response === "REFUSED" && (
                  <div className="mb-3 inline-flex items-center justify-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                    Invitation declined
                  </div>
                )}

                {interview.candidate_response === "REFUSED" && interview.candidate_response_reason && (
                  <div className="mb-3 page-glass-inset rounded-xl p-3 text-sm text-gray-700 whitespace-pre-line max-w-md mx-auto w-full">
                    <span className="font-semibold">Your message:</span> {interview.candidate_response_reason}
                  </div>
                )}

                {interview.status === "COMPLETED" && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 max-w-md mx-auto w-full">
                    <p className="font-semibold">Interview completed</p>
                    <p className="mt-1 text-emerald-800">
                      View your AI evaluation summary below.
                    </p>
                    <button
                      type="button"
                      onClick={() => openResults(interview.interview_id)}
                      className="mt-3 w-full rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      View interview results
                    </button>
                  </div>
                )}

                {/* Time Slot Selection for INVITED interviews without scheduled time */}
                {interview.status === "INVITED" && !interview.scheduled_at && (
                  <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg p-3 w-full max-w-md mx-auto">
                    <p className="font-semibold text-purple-900 text-sm mb-1">Select your interview day</p>
                    <p className="text-xs text-purple-700 mb-2">
                      You have been shortlisted. Pick an interview day that works for you.
                    </p>
                    <button
                      onClick={() => openTimeSlotModal(interview)}
                      className="w-full py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <ClockIcon className="w-5 h-5" />
                      Select interview day
                    </button>
                  </div>
                )}

                {/* Inline Accept/Refuse for Pending Invitations with scheduled time */}
                {interview.status === "INVITED" && !interview.candidate_response && interview.scheduled_at && (
                  <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-4 w-full max-w-md mx-auto">
                    <p className="font-semibold text-blue-900 mb-2">Respond to Invitation</p>
                    <textarea
                      value={responseReasons[interview.interview_id] || ""}
                      onChange={(e) => setResponseReasons({...responseReasons, [interview.interview_id]: e.target.value})}
                      placeholder="Write a justification if you refuse, or a message if you accept..."
                      className="w-full border border-blue-200 rounded-lg p-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRespond(interview.interview_id, "ACCEPTED")}
                        disabled={isResponding}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isResponding ? "..." : "✅ Accept"}
                      </button>
                      <button
                        onClick={() => handleRespond(interview.interview_id, "REFUSED")}
                        disabled={isResponding}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isResponding ? "..." : "❌ Refuse"}
                      </button>
                    </div>
                  </div>
                )}

                {interview.status === "IN_PROGRESS" && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 max-w-md mx-auto w-full">
                    <p className="font-semibold">Interview in progress</p>
                    <p className="mt-1 text-amber-800">
                      This session cannot be resumed or restarted. If you left the interview room, close the
                      session below or refresh after a moment.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => openResults(interview.interview_id)}
                        className="w-full rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        View interview results
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEndSession(interview)}
                        disabled={endingId === interview.interview_id}
                        className="w-full rounded-lg border border-amber-300 bg-white/80 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {endingId === interview.interview_id
                          ? "Closing session…"
                          : "Close interview session"}
                      </button>
                    </div>
                  </div>
                )}

                {interview.status === "INVITED" && interview.candidate_response === "ACCEPTED" && (
                <div className="flex flex-wrap justify-center gap-3 w-full max-w-md mx-auto">
                  {(() => {
                    const mayStart = canStartInterview(interview.scheduled_at)
                    return (
                      <div className="flex-1 min-w-[10rem]">
                        <button
                          type="button"
                          onClick={() => handleStartInterview(interview)}
                          disabled={!mayStart}
                          className={`w-full py-2 font-bold rounded-lg transition-colors ${
                            mayStart
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          ▶️ Start Interview
                        </button>
                        {!mayStart && interview.scheduled_at && (
                          <p className="mt-1 text-xs text-gray-500">
                            Available on {formatInterviewStartLabel(interview.scheduled_at)}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* Time Slot Selection Modal */}
      {showTimeSlotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="page-glass shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ClockIcon className="w-6 h-6" />
                Select your interview day
              </h2>
              <p className="text-purple-200 mt-1">
                Pick a day on the calendar — you can start anytime that day
              </p>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No available days. Please try again later.
                </div>
              ) : (
                <>
                {selectedInterview && (
                  <div className="mb-5 page-glass-inset rounded-xl p-4">
                    <label className="mb-2 block text-sm font-semibold text-gray-800">
                      Interview language
                    </label>
                    <select
                      value={interviewLanguages[selectedInterview.interview_id] || "en"}
                      onChange={(e) => handleLanguageChange(selectedInterview.interview_id, e.target.value)}
                      disabled={savingLanguage === selectedInterview.interview_id}
                      className="w-full max-w-xs rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
                    >
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                )}
                <InterviewScheduleCalendar
                  slots={timeSlots}
                  selectedDate={selectedCalendarDate}
                  onSelectDate={setSelectedCalendarDate}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                  dayOnly
                />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/40 p-6 page-glass-inset flex items-center justify-between">
              <button
                onClick={closeTimeSlotModal}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
              >
                Cancel
              </button>
              
              <div className="flex items-center gap-4">
                {selectedCalendarDate && (
                  <span className="text-sm text-purple-700 font-medium">
                    Selected: {formatInterviewStartLabel(selectedCalendarDate)}
                  </span>
                )}
                <button
                  onClick={handleSelectTimeSlot}
                  disabled={!selectedCalendarDate || submittingSlot}
                  className={`px-8 py-3 rounded-lg font-bold transition-all ${
                    selectedCalendarDate && !submittingSlot
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submittingSlot ? 'Confirming...' : '✓ Confirm day'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setResultsModal(null)}
          />
          <div className="relative page-glass max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Interview results</h3>
            {loadingResults && <p className="text-sm text-gray-500">Loading…</p>}
            {!loadingResults && resultsModal.error && (
              <p className="text-sm text-amber-800">{resultsModal.error}</p>
            )}
            {!loadingResults && resultsModal.report && (
              <div className="space-y-3 text-sm text-gray-700">
                <p className="font-bold text-violet-900 text-base">
                  Overall: {Math.round(resultsModal.report.overall_score)}%
                </p>
                <p>
                  Communication {resultsModal.report.communication_score}/10 · Technical{" "}
                  {resultsModal.report.technical_score}/10 · Motivation{" "}
                  {resultsModal.report.motivation_score}/10
                </p>
                {resultsModal.report.summary && <p>{resultsModal.report.summary}</p>}
                {resultsModal.report.strengths?.length > 0 && (
                  <ul className="list-disc pl-4 text-xs">
                    {resultsModal.report.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setResultsModal(null)}
              className="mt-6 w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </CandidateLayout>
  )
}





