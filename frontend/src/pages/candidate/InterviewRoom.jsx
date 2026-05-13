import { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useLanguage } from "../../context/LanguageContext"
import { useAuth } from "../../context/AuthContext"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import { startInterview, submitInterviewTurn, endInterview, getInterviewScores, getCandidateInterviewDetail, respondToCandidateInterview } from "../../api/authApi"
import Toast from "../../components/Toast"

const PHASES = ["intro", "technical", "behavioral", "closing"]

export default function InterviewRoom() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  
  const [stage, setStage] = useState("loading") // loading, invitation, language-select, recording, complete
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isResponding, setIsResponding] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkTimeLeft, setThinkTimeLeft] = useState(10)
  const [recordTimeLeft, setRecordTimeLeft] = useState(120)
  const [currentPhase, setCurrentPhase] = useState(0)
  const [messages, setMessages] = useState([])
  const [turn, setTurn] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [transcript, setTranscript] = useState("")
  const [interviewDetail, setInterviewDetail] = useState(null)
  const [responseReason, setResponseReason] = useState("")
  const [toast, setToast] = useState(null)
  
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  useEffect(() => {
    loadInterviewDetail()
  }, [interviewId])

  // Initialize camera
  useEffect(() => {
    if (stage === "recording") {
      initCamera()
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [stage])

  // Timers logic
  useEffect(() => {
    let interval = null
    if (isThinking && thinkTimeLeft > 0) {
      interval = setInterval(() => {
        setThinkTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (isThinking && thinkTimeLeft === 0) {
      setIsThinking(false)
      startRecording() // Auto start after thinking
    }
    return () => clearInterval(interval)
  }, [isThinking, thinkTimeLeft])

  useEffect(() => {
    let interval = null
    if (isRecording && recordTimeLeft > 0) {
      interval = setInterval(() => {
        setRecordTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (isRecording && recordTimeLeft === 0) {
      stopRecording() // Auto stop at 2 mins
    }
    return () => clearInterval(interval)
  }, [isRecording, recordTimeLeft])

  const loadInterviewDetail = async () => {
    try {
      const result = await getCandidateInterviewDetail(interviewId)
      setInterviewDetail(result.data)

      if (result.data.candidate_response === "REFUSED" || result.data.status === "CANCELLED") {
        // Auto-redirect when loading a refused interview
        setToast({ type: "info", message: "This interview invitation was declined" })
        setTimeout(() => {
          navigate("/candidate/interviews")
        }, 2000)
      } else if (result.data.candidate_response === "ACCEPTED") {
        setStage("language-select")
      } else {
        setStage("invitation")
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to load interview invitation" })
      console.error(err)
      setStage("complete")
    }
  }

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: true
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.ondataavailable = (e) => {
        chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        submitTurn(blob)
        chunksRef.current = []
      }
    } catch (err) {
      setToast({ type: "error", message: "Camera access denied" })
      console.error(err)
    }
  }

  const handleRespond = async (action) => {
    if (action === "REFUSED" && !responseReason.trim()) {
      setToast({ type: "error", message: "Please provide a justification for refusing" })
      return
    }

    try {
      setIsResponding(true)
      const payload = {
        action,
        reason: responseReason.trim() || null
      }
      await respondToCandidateInterview(interviewId, payload)
      if (action === "ACCEPTED") {
        setToast({ type: "success", message: "Invitation accepted" })
        setStage("language-select")
      } else {
        setToast({ type: "success", message: "Invitation refused. Redirecting..." })
        // Auto-redirect after 1.5 seconds
        setTimeout(() => {
          navigate("/candidate/dashboard")
        }, 1500)
      }
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to submit response" })
      console.error(err)
    } finally {
      setIsResponding(false)
    }
  }

  const handleLanguageSelect = async (lang) => {
    setSelectedLanguage(lang)
    try {
      setIsProcessing(true)
      const result = await startInterview(interviewId, { language: lang })
      
      setMessages([
        { role: "bot", content: result.data.bot_message, audio_url: result.data.audio_url }
      ])
      setAudioUrl(result.data.audio_url)
      setTurn(result.data.turn)
      
      const phaseIndex = PHASES.indexOf(result.data.phase)
      setCurrentPhase(phaseIndex >= 0 ? phaseIndex : 0)

      setStage("ready")
      setToast({ type: "success", message: "Ready to start" })

    } catch (err) {
      setToast({ type: "error", message: "Failed to load interview" })
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartInterviewButton = () => {
    setStage("recording")
    // Play opening question audio
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.onended = () => {
        setThinkTimeLeft(10)
        setIsThinking(true)
      }
      audio.play().catch(e => {
        console.error("Could not play intro audio:", e)
        setThinkTimeLeft(10)
        setIsThinking(true)
      })
    } else {
      setThinkTimeLeft(10)
      setIsThinking(true)
    }
  }

  const startRecording = () => {
    chunksRef.current = []
    setRecordTimeLeft(120)
    try {
      mediaRecorderRef.current?.start()
      setIsRecording(true)
    } catch(err) {
      console.error(err)
      setToast({ type: "error", message: "Could not start recording" })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setIsProcessing(true)
  }

  const submitTurn = async (videoBlob) => {
    try {
      const formData = new FormData()
      formData.append("audio_file", videoBlob, "recording.webm")
      formData.append("video_file", videoBlob, "recording.webm")

      const res = await submitInterviewTurn(interviewId, formData)
      const data = res.data
      
      setTranscript(data.candidate_transcript)
      setMessages([...messages, 
        { role: "candidate", content: data.candidate_transcript, signals: data.signals },
        { role: "bot", content: data.bot_response, audio_url: data.audio_url }
      ])
      setAudioUrl(data.audio_url)
      setTurn(data.turn)
      setCurrentPhase(PHASES.indexOf(data.phase))

      // Play bot audio automatically
      if (data.audio_url) {
        const audio = new Audio(data.audio_url)
        audio.onended = () => {
          if (!data.should_end) {
            // Start 10s thinking timer when audio finishes
            setThinkTimeLeft(10)
            setIsThinking(true)
          }
        }
        audio.play().catch(e => {
          console.error("Could not play audio:", e)
          if (!data.should_end) {
            setThinkTimeLeft(10)
            setIsThinking(true)
          }
        })
      } else if (!data.should_end) {
        setThinkTimeLeft(10)
        setIsThinking(true)
      }

      if (data.should_end) {
        setStage("complete")
      }

      setToast({ type: "success", message: "Turn processed" })
    } catch (err) {
      setToast({ type: "error", message: "Failed to process turn" })
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleEndInterview = async () => {
    try {
      await endInterview(interviewId)
      setStage("complete")
    } catch (err) {
      setToast({ type: "error", message: "Failed to end interview" })
    }
  }

  return (
    <CandidateLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

        {/* Invitation Stage */}
        {stage === "invitation" && (
          <div className="flex items-center justify-center min-h-screen p-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full mx-4">
              <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Interview Invitation</h2>
              <p className="text-gray-600 text-center mb-6">
                You have received an interview invitation. Please review the details below and confirm your attendance or decline if you're unavailable.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-900">
                <p className="font-semibold">Scheduled at</p>
                <p>{interviewDetail?.scheduled_at ? new Date(interviewDetail.scheduled_at).toLocaleString() : "To be confirmed"}</p>
                <p className="mt-2 text-xs text-blue-700">
                  Please confirm your attendance or propose a new time if you are unavailable.
                </p>
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message (optional for acceptance, <span className="text-red-600">required for rejection</span>)
              </label>
              <textarea
                value={responseReason}
                onChange={(e) => setResponseReason(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="If you decline, please explain why. If you accept, you can add any additional information..."
              />
              <p className="text-xs text-gray-500 mb-6">
                If you decline the interview, please provide a reason so the recruiter understands your situation.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleRespond("ACCEPTED")}
                  disabled={isResponding}
                  className="py-3 px-6 rounded-lg font-bold text-lg transition-all bg-green-600 hover:bg-green-700 text-white shadow-md disabled:opacity-50"
                >
                  {isResponding ? "Sending..." : "✅ Accept Interview"}
                </button>
                <button
                  onClick={() => handleRespond("REFUSED")}
                  disabled={isResponding}
                  className="py-3 px-6 rounded-lg font-bold text-lg transition-all bg-red-600 hover:bg-red-700 text-white shadow-md disabled:opacity-50"
                >
                  {isResponding ? "Sending..." : "❌ Refuse Interview"}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                If you accept, the camera and interview flow will open in this app.
              </p>
            </div>
          </div>
        )}
        
        {/* Language Selection Stage */}
        {stage === "language-select" && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
              <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Interview</h2>
              <p className="text-gray-600 text-center mb-8">
                Select your preferred interview language
              </p>

              {interviewDetail?.meeting_link && (
                <div className="mb-6 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900 break-all">
                  Open link: <a href={interviewDetail.meeting_link} className="underline font-semibold" target="_blank" rel="noreferrer">{interviewDetail.meeting_link}</a>
                </div>
              )}

              <div className="space-y-4">
                <button
                  onClick={() => handleLanguageSelect("en")}
                  disabled={isProcessing}
                  className="w-full py-4 px-6 rounded-lg font-bold text-lg transition-all
                    bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🇬🇧 English
                </button>

                <button
                  onClick={() => handleLanguageSelect("fr")}
                  disabled={isProcessing}
                  className="w-full py-4 px-6 rounded-lg font-bold text-lg transition-all
                    bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🇫🇷 Français
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-6 text-center">
                You will be asked several questions about your background and experience.
                Please speak clearly and take your time answering.
              </p>
            </div>
          </div>
        )}

        {/* Ready Stage */}
        {stage === "ready" && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Ready to Start</h2>
              <p className="text-gray-600 mb-8">
                Your interview is loaded. Ensure your microphone and camera are working properly.
              </p>
              <button
                onClick={handleStartInterviewButton}
                className="w-full py-4 px-6 rounded-lg font-bold text-lg transition-all
                  bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg"
              >
                ▶️ Start Interview
              </button>
            </div>
          </div>
        )}

        {/* Recording Stage */}
        {stage === "recording" && (
          <div className="p-8 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Video Preview */}
              <div className="md:col-span-2">
                <div className="bg-black rounded-lg overflow-hidden shadow-lg mb-6 ring-4 ring-black/10">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full aspect-video object-cover scale-x-[-1] transition-transform duration-300"
                  />
                </div>

                {/* Phase Indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    {PHASES.map((phase, i) => (
                      <div
                        key={phase}
                        className={`flex-1 h-2 mx-1 rounded-full transition-all ${
                          i < currentPhase ? "bg-green-500" : i === currentPhase ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">
                    Phase: <span className="font-bold capitalize">{PHASES[currentPhase] || "done"}</span>
                  </p>
                </div>

                {/* Recording Controls */}
                <div className="flex gap-4 items-center">
                  {isThinking ? (
                    <div className="flex-1 py-4 bg-orange-100 border-2 border-orange-500 text-orange-800 font-bold rounded-lg text-center flex items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
                      <span className="text-xl">{thinkTimeLeft}s</span>
                      <span>{selectedLanguage === "fr" ? "Réflexion en cours..." : "Thinking time..."}</span>
                    </div>
                  ) : isRecording ? (
                    <div className="flex-1 flex gap-4">
                      <div className="flex-1 py-3 bg-red-100 border border-red-300 text-red-800 font-bold rounded-lg flex items-center justify-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>
                        {selectedLanguage === "fr" ? "Enregistrement" : "Recording"}: {Math.floor(recordTimeLeft / 60)}:{(recordTimeLeft % 60).toString().padStart(2, '0')}
                      </div>
                      <button
                        onClick={stopRecording}
                        className="py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all"
                      >
                        {selectedLanguage === "fr" ? "Terminer" : "Finish Answer"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-lg text-center">
                      {selectedLanguage === "fr" ? "En attente de la question..." : "Waiting for question..."}
                    </div>
                  )}

                  {!isThinking && !isRecording && (
                    <button
                      onClick={handleEndInterview}
                      disabled={isProcessing}
                      className="py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg disabled:opacity-50"
                    >
                      {selectedLanguage === "fr" ? "Quitter l'entretien" : "End Interview"}
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript Panel */}
              <div className="bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
                <h3 className="font-bold text-lg mb-4">Transcript</h3>
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`p-3 rounded ${msg.role === "bot" ? "bg-blue-50" : "bg-gray-50"}`}>
                      <p className="text-xs font-bold text-gray-600 mb-1">{msg.role.toUpperCase()}</p>
                      <p className="text-sm text-gray-800">{msg.content}</p>
                      {msg.audio_url && (
                        <audio controls className="w-full mt-2 text-xs" src={msg.audio_url} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {isProcessing && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="bg-white p-8 rounded-lg shadow-xl">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-center mt-4 text-gray-600">Processing your response...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Complete Stage - Removed: Now auto-redirects after rejection/completion */}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </CandidateLayout>
  )
}
