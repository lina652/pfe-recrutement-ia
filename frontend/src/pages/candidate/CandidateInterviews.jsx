import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import { getCandidateInterviews, getInterviewScores, respondToCandidateInterview, getInterviewTimeSlots, selectInterviewTimeSlot } from "../../api/authApi"
import Toast from "../../components/Toast"

export default function CandidateInterviews() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState([])
  const [scores, setScores] = useState({})
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
  const [submittingSlot, setSubmittingSlot] = useState(false)

  useEffect(() => {
    loadInterviews()
  }, [])

  const loadInterviews = async () => {
    try {
      const result = await getCandidateInterviews()
      setInterviews(result.data || [])

      // Load scores for completed interviews
      for (const interview of result.data || []) {
        if (interview.status === "COMPLETED") {
          try {
            const scoreData = await getInterviewScores(interview.interview_id)
            setScores(prev => ({
              ...prev,
              [interview.interview_id]: scoreData.data
            }))
          } catch (err) {
            console.error("Could not load scores:", err)
          }
        }
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to load interviews" })
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

  const getResponseBadge = (response) => {
    const badges = {
      ACCEPTED: "bg-green-100 text-green-800",
      REFUSED: "bg-red-100 text-red-800"
    }
    return badges[response] || "bg-yellow-100 text-yellow-800"
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

  const handleStartInterview = (interviewId) => {
    navigate(`/candidate/interview/${interviewId}`)
  }

  // Time slot functions
  const openTimeSlotModal = async (interview) => {
    setSelectedInterview(interview)
    setShowTimeSlotModal(true)
    setLoadingSlots(true)
    setSelectedSlot(null)
    
    try {
      const result = await getInterviewTimeSlots(interview.interview_id)
      setTimeSlots(result.data?.slots || [])
    } catch (err) {
      setToast({ type: "error", message: "Failed to load time slots" })
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
  }

  const handleSelectTimeSlot = async () => {
    if (!selectedSlot || !selectedInterview) return
    
    setSubmittingSlot(true)
    try {
      await selectInterviewTimeSlot(selectedInterview.interview_id, {
        selected_datetime: selectedSlot.datetime
      })
      setToast({ type: "success", message: "Interview time confirmed! Check your email for details." })
      closeTimeSlotModal()
      loadInterviews()
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to select time slot" })
    } finally {
      setSubmittingSlot(false)
    }
  }

  // Group time slots by date
  const groupSlotsByDate = (slots) => {
    const grouped = {}
    slots.forEach(slot => {
      const date = new Date(slot.datetime).toDateString()
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(slot)
    })
    return grouped
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
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">My Interviews</h1>
        <p className="text-gray-600 mb-8">
          View your interview invitations and results
        </p>

        {interviews.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-500 font-semibold">No interviews yet</p>
            <p className="text-gray-400 text-sm mt-2">
              You will receive interview invitations here
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {interviews.map((interview) => (
              <div key={interview.interview_id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {interview.job_title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Created: {new Date(interview.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-4 py-2 rounded-full font-semibold text-sm ${getStatusBadge(interview.status)}`}>
                    {interview.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 font-semibold">Language</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">
                      {interview.language === "en" ? "🇬🇧 English" : "🇫🇷 Français"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 font-semibold">Phase</p>
                    <p className="text-lg font-bold text-gray-800 mt-1 capitalize">
                      {interview.phase}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 font-semibold">Turns</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">
                      {interview.turn_count || 0}
                    </p>
                  </div>
                </div>

                {interview.scheduled_at && (
                  <div className="mb-4 text-sm text-gray-600">
                    <span className="font-semibold">Scheduled:</span> {new Date(interview.scheduled_at).toLocaleString()}
                  </div>
                )}

                {interview.candidate_response && (
                  <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${getResponseBadge(interview.candidate_response)}`}>
                    <span>Response:</span>
                    <span>{interview.candidate_response}</span>
                  </div>
                )}

                {interview.candidate_response_reason && (
                  <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-line">
                    <span className="font-semibold">Your message:</span> {interview.candidate_response_reason}
                  </div>
                )}

                {/* Scores if completed */}
                {interview.status === "COMPLETED" && scores[interview.interview_id] && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="font-bold text-green-900 mb-3">Your Scores</p>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {scores[interview.interview_id].overall_score || "-"}
                        </p>
                        <p className="text-xs text-green-700">Overall</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {scores[interview.interview_id].communication_score || "-"}/10
                        </p>
                        <p className="text-xs text-blue-700">Communication</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {scores[interview.interview_id].technical_score || "-"}/10
                        </p>
                        <p className="text-xs text-purple-700">Technical</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {scores[interview.interview_id].motivation_score || "-"}/10
                        </p>
                        <p className="text-xs text-orange-700">Motivation</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Time Slot Selection for INVITED interviews without scheduled time */}
                {interview.status === "INVITED" && !interview.candidate_response && !interview.scheduled_at && (
                  <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="font-semibold text-purple-900 mb-2">🎉 Congratulations! Select Your Interview Time</p>
                    <p className="text-sm text-purple-700 mb-3">
                      You've been selected as a top candidate! Please choose your preferred interview time slot.
                    </p>
                    <button
                      onClick={() => openTimeSlotModal(interview)}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
                    >
                      📅 Select Interview Time
                    </button>
                  </div>
                )}

                {/* Inline Accept/Refuse for Pending Invitations with scheduled time */}
                {interview.status === "INVITED" && !interview.candidate_response && interview.scheduled_at && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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

                {/* Actions */}
                <div className="flex gap-3">
                  {interview.status === "INVITED" && interview.candidate_response === "ACCEPTED" && (
                    <button
                      onClick={() => handleStartInterview(interview.interview_id)}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                    >
                      ▶️ Start Interview
                    </button>
                  )}
                  {interview.status === "INVITED" && !interview.candidate_response && (
                    <button
                      onClick={() => handleStartInterview(interview.interview_id)}
                      className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                  )}
                  {interview.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => handleStartInterview(interview.interview_id)}
                      className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-colors"
                    >
                      ▶️ Resume Interview
                    </button>
                  )}
                  {interview.status === "COMPLETED" && (
                    <button
                      onClick={() => handleStartInterview(interview.interview_id)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                    >
                      View Interview
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* Time Slot Selection Modal */}
      {showTimeSlotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
              <h2 className="text-2xl font-bold">📅 Select Your Interview Time</h2>
              <p className="text-purple-200 mt-1">
                Choose a time slot that works best for you (next 7 days)
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
                  No available time slots. Please try again later.
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupSlotsByDate(timeSlots)).map(([date, slots]) => (
                    <div key={date}>
                      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <span className="text-purple-600">📆</span>
                        {new Date(date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {slots.map((slot, idx) => {
                          const time = new Date(slot.datetime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })
                          const isSelected = selectedSlot?.datetime === slot.datetime
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => slot.available && setSelectedSlot(slot)}
                              disabled={!slot.available}
                              className={`p-3 rounded-lg text-sm font-semibold transition-all ${
                                !slot.available 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                                  : isSelected
                                    ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                              }`}
                            >
                              {time}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
              <button
                onClick={closeTimeSlotModal}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
              >
                Cancel
              </button>
              
              <div className="flex items-center gap-4">
                {selectedSlot && (
                  <span className="text-sm text-purple-700 font-medium">
                    Selected: {new Date(selectedSlot.datetime).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
                <button
                  onClick={handleSelectTimeSlot}
                  disabled={!selectedSlot || submittingSlot}
                  className={`px-8 py-3 rounded-lg font-bold transition-all ${
                    selectedSlot && !submittingSlot
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submittingSlot ? 'Confirming...' : '✓ Confirm Time'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CandidateLayout>
  )
}
