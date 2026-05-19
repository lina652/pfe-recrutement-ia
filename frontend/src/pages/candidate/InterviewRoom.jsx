import { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useLanguage } from "../../context/LanguageContext"
import { useAuth } from "../../context/AuthContext"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import {
  startInterview,
  submitInterviewTurn,
  endInterview,
  endInterviewOnPageLeave,
  getCandidateInterviewDetail,
  respondToCandidateInterview,
  updateInterviewLanguage,
  getInterviewScores,
} from "../../api/authApi"
import Toast from "../../components/Toast"
import { canStartInterview, formatInterviewStartLabel } from "../../utils/interviewTime"

const PHASES = ["intro", "technical", "behavioral", "closing"]

const RECORDING_MIME_PRIMARY = "video/webm;codecs=vp8,opus"
const RECORDING_MIME_FALLBACK = "video/webm"
const RECORDING_TIMESLICE_MS = 250
const MIN_RECORDING_BYTES = 1000
const VIDEO_BITS_PER_SECOND = 500_000

function resolveRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return RECORDING_MIME_FALLBACK
  if (MediaRecorder.isTypeSupported(RECORDING_MIME_PRIMARY)) return RECORDING_MIME_PRIMARY
  if (MediaRecorder.isTypeSupported(RECORDING_MIME_FALLBACK)) return RECORDING_MIME_FALLBACK
  return ""
}

export default function InterviewRoom() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  
  const [stage, setStage] = useState("loading") // loading, invitation, waiting, starting, language-select, recording, complete
  const [tick, setTick] = useState(0)
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
  const [interviewReport, setInterviewReport] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)
  
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recorderMimeRef = useRef(RECORDING_MIME_FALLBACK)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const startLockRef = useRef(false)
  const transcriptEndRef = useRef(null)
  const botAudioRef = useRef(null)
  const sessionEndedRef = useRef(false)
  const liveSessionRef = useRef(false)
  const endRequestedRef = useRef(false)

  const markLiveSession = () => {
    liveSessionRef.current = true
  }

  const markSessionClosed = () => {
    liveSessionRef.current = false
  }

  const abortInterviewOnLeave = () => {
    if (endRequestedRef.current || !liveSessionRef.current) return
    endRequestedRef.current = true
    liveSessionRef.current = false
    teardownInterviewSession()
    endInterviewOnPageLeave(interviewId)
  }

  useEffect(() => {
    loadInterviewDetail()
  }, [interviewId])

  useEffect(() => {
    const onPageHide = () => abortInterviewOnLeave()
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      abortInterviewOnLeave()
    }
  }, [interviewId])

  useEffect(() => {
    if (stage !== "waiting") return undefined
    const id = setInterval(() => setTick((t) => t + 1), 15000)
    return () => clearInterval(id)
  }, [stage])

  useEffect(() => {
    if (stage !== "waiting" || !canStartInterview(interviewDetail?.scheduled_at)) return
    const lang = interviewLanguage(interviewDetail)
    if (lang && interviewDetail?.scheduled_at) {
      setSelectedLanguage(lang)
      setStage("starting")
      beginInterviewSession(lang, interviewDetail)
    } else {
      setStage("language-select")
    }
  }, [stage, interviewDetail?.scheduled_at, interviewDetail?.language, tick])

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
      if (!sessionEndedRef.current) startRecording()
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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const stopBotAudio = () => {
    const audio = botAudioRef.current
    if (audio) {
      audio.onended = null
      audio.pause()
      try {
        audio.currentTime = 0
      } catch {
        /* ignore */
      }
      botAudioRef.current = null
    }
    if (typeof document !== "undefined") {
      document.querySelectorAll("audio").forEach((el) => {
        el.pause()
        try {
          el.currentTime = 0
        } catch {
          /* ignore */
        }
      })
    }
  }

  const teardownInterviewSession = () => {
    sessionEndedRef.current = true
    markSessionClosed()
    stopBotAudio()
    setIsThinking(false)
    setIsRecording(false)
    setIsProcessing(false)
    if (mediaRecorderRef.current?.state === "recording") {
      try {
        mediaRecorderRef.current.requestData()
        mediaRecorderRef.current.stop()
      } catch {
        /* ignore */
      }
    }
    chunksRef.current = []
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const playBotAudio = (url, onDone) => {
    if (sessionEndedRef.current || !url) {
      onDone?.()
      return
    }
    stopBotAudio()
    const audio = new Audio(url)
    botAudioRef.current = audio
    audio.onended = () => {
      if (sessionEndedRef.current) return
      botAudioRef.current = null
      onDone?.()
    }
    audio.onerror = () => {
      botAudioRef.current = null
      if (!sessionEndedRef.current) onDone?.()
    }
    audio.play().catch(() => {
      if (!sessionEndedRef.current) onDone?.()
    })
  }

  const mapServerMessages = (list) =>
    (list || []).map((m, i) => ({
      id: m.turn_number != null ? `t${m.turn_number}-${m.role}` : `${m.role}-${i}`,
      role: m.role,
      content: m.content,
      audio_url: m.audio_url,
      signals: m.signals,
    }))

  const applyMessagesFromDetail = (data) => {
    if (data.messages?.length) {
      setMessages(mapServerMessages(data.messages))
      const lastBot = [...data.messages].reverse().find((m) => m.role === "bot")
      if (lastBot?.audio_url) setAudioUrl(lastBot.audio_url)
    }
    if (data.turn_count != null) setTurn(data.turn_count)
    if (data.phase) {
      const idx = PHASES.indexOf(data.phase)
      if (idx >= 0) setCurrentPhase(idx)
    }
  }

  const refreshMessagesFromServer = async () => {
    const result = await getCandidateInterviewDetail(interviewId)
    const data = result.data
    setInterviewDetail(data)
    applyMessagesFromDetail(data)
    return data
  }

  const interviewLanguage = (detail) => {
    const raw = (detail?.language || "").toLowerCase()
    if (raw.startsWith("fr")) return "fr"
    if (raw.startsWith("en")) return "en"
    return null
  }

  const beginInterviewSession = async (lang, detail = interviewDetail) => {
    if (startLockRef.current) return
    if (!canStartInterview(detail?.scheduled_at)) {
      setToast({
        type: "error",
        message: `Interview available on ${formatInterviewStartLabel(detail?.scheduled_at)}`,
      })
      setStage("waiting")
      return
    }
    startLockRef.current = true
    sessionEndedRef.current = false
    markLiveSession()
    setSelectedLanguage(lang)
    try {
      setIsProcessing(true)
      await startInterview(interviewId, { language: lang })
      const refreshed = await refreshMessagesFromServer()

      setStage("recording")

      const playUrl =
        refreshed.messages?.length
          ? [...refreshed.messages].reverse().find((m) => m.role === "bot")?.audio_url
          : null

      const afterBotAudio = () => {
        if (sessionEndedRef.current) return
        setThinkTimeLeft(10)
        setIsThinking(true)
      }
      if (playUrl) {
        playBotAudio(playUrl, afterBotAudio)
      } else {
        afterBotAudio()
      }
    } catch (err) {
      startLockRef.current = false
      markSessionClosed()
      endRequestedRef.current = false
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to start interview" })
      setStage(detail?.messages?.length ? "error" : "language-select")
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const loadInterviewDetail = async () => {
    setStage("loading")
    startLockRef.current = false
    sessionEndedRef.current = false
    try {
      const result = await getCandidateInterviewDetail(interviewId)
      const data = result.data
      setInterviewDetail(data)

      if (data.candidate_response === "REFUSED" || data.status === "CANCELLED") {
        setToast({ type: "info", message: "This interview invitation was declined" })
        setTimeout(() => navigate("/candidate/interviews"), 2000)
      } else if (data.status === "COMPLETED") {
        setToast({ type: "info", message: "This interview is already completed" })
        setStage("complete")
      } else if (data.status === "IN_PROGRESS") {
        setToast({
          type: "info",
          message: "This interview is already in progress and cannot be resumed.",
        })
        setStage("error")
        setTimeout(() => navigate("/candidate/interviews"), 2500)
      } else if (data.candidate_response === "ACCEPTED") {
        const lang = interviewLanguage(data)
        if (lang) setSelectedLanguage(lang)
        if (!canStartInterview(data.scheduled_at)) {
          setStage("waiting")
        } else if (lang && data.scheduled_at) {
          setStage("starting")
          beginInterviewSession(lang, data)
        } else {
          setStage("language-select")
        }
      } else {
        setStage("invitation")
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to load interview invitation" })
      console.error(err)
      setStage("error")
    }
  }

  const recordingErrorMsg = (key) => {
    const fr = selectedLanguage === "fr"
    const messages = {
      denied: fr ? "Accès caméra/micro refusé" : "Camera/microphone access denied",
      tooSmall: fr
        ? "Enregistrement trop court ou vide. Réessayez en parlant clairement."
        : "Recording too short or empty. Please try again and speak clearly.",
      startFailed: fr ? "Impossible de démarrer l'enregistrement" : "Could not start recording",
    }
    return messages[key] || messages.startFailed
  }

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 15, max: 24 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      const mimeType = resolveRecordingMimeType()
      recorderMimeRef.current = mimeType || RECORDING_MIME_FALLBACK
      const recorderOptions = { videoBitsPerSecond: VIDEO_BITS_PER_SECOND }
      if (mimeType) recorderOptions.mimeType = mimeType

      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current.onstop = () => {
        if (sessionEndedRef.current) {
          chunksRef.current = []
          return
        }
        const blob = new Blob(chunksRef.current, { type: recorderMimeRef.current })
        chunksRef.current = []
        if (blob.size < MIN_RECORDING_BYTES) {
          setIsProcessing(false)
          setThinkTimeLeft(10)
          setIsThinking(true)
          setToast({ type: "error", message: recordingErrorMsg("tooSmall") })
          return
        }
        submitTurn(blob)
      }
    } catch (err) {
      setToast({ type: "error", message: recordingErrorMsg("denied") })
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
        const scheduled = interviewDetail?.scheduled_at
        const lang = interviewLanguage(interviewDetail)
        if (!canStartInterview(scheduled)) {
          setStage("waiting")
        } else if (lang && scheduled) {
          setStage("starting")
          beginInterviewSession(lang, {
            ...interviewDetail,
            candidate_response: "ACCEPTED",
            scheduled_at: scheduled,
          })
        } else {
          setStage("language-select")
        }
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
    if (!canStartInterview(interviewDetail?.scheduled_at)) {
      setToast({
        type: "error",
        message: `Interview available on ${formatInterviewStartLabel(interviewDetail?.scheduled_at)}`,
      })
      return
    }
    try {
      setIsProcessing(true)
      await updateInterviewLanguage(interviewId, { language: lang })
      setInterviewDetail((prev) => (prev ? { ...prev, language: lang } : prev))
      setStage("starting")
      await beginInterviewSession(lang)
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to save language" })
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const startRecording = () => {
    if (sessionEndedRef.current) return
    chunksRef.current = []
    setRecordTimeLeft(120)
    try {
      mediaRecorderRef.current?.start(RECORDING_TIMESLICE_MS)
      setIsRecording(true)
    } catch (err) {
      console.error(err)
      setToast({ type: "error", message: recordingErrorMsg("startFailed") })
    }
  }

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current
    setIsRecording(false)
    if (!recorder || recorder.state !== "recording") {
      return
    }
    setIsProcessing(true)
    try {
      recorder.requestData()
      await new Promise((resolve) => setTimeout(resolve, 200))
      recorder.stop()
      await new Promise((resolve) => setTimeout(resolve, 300))
    } catch (err) {
      console.error(err)
      setIsProcessing(false)
      setThinkTimeLeft(10)
      setIsThinking(true)
      setToast({ type: "error", message: recordingErrorMsg("startFailed") })
    }
  }

  const submitTurn = async (videoBlob) => {
    if (sessionEndedRef.current) return
    try {
      const formData = new FormData()
      formData.append("audio_file", videoBlob, "recording.webm")
      formData.append("video_file", videoBlob, "recording.webm")

      const res = await submitInterviewTurn(interviewId, formData)
      const data = res.data

      if (sessionEndedRef.current) return

      setTranscript(data.candidate_transcript)
      await refreshMessagesFromServer()
      if (sessionEndedRef.current) return

      setAudioUrl(data.audio_url)

      if (data.should_end) {
        teardownInterviewSession()
        endRequestedRef.current = true
        try {
          await endInterview(interviewId)
        } catch (endErr) {
          console.error(endErr)
        }
        setStage("complete")
        loadInterviewReport()
      } else if (data.audio_url) {
        playBotAudio(data.audio_url, () => {
          if (sessionEndedRef.current) return
          setThinkTimeLeft(10)
          setIsThinking(true)
        })
      } else {
        setThinkTimeLeft(10)
        setIsThinking(true)
      }

      setToast({ type: "success", message: "Turn processed" })
    } catch (err) {
      setToast({ type: "error", message: "Failed to process turn" })
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const loadInterviewReport = async () => {
    setLoadingReport(true)
    try {
      const res = await getInterviewScores(interviewId)
      setInterviewReport(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReport(false)
    }
  }

  const handleEndInterview = async () => {
    teardownInterviewSession()
    endRequestedRef.current = true
    try {
      await endInterview(interviewId)
      setStage("complete")
      setToast({ type: "success", message: "Interview ended" })
      loadInterviewReport()
    } catch (err) {
      setToast({ type: "error", message: "Failed to end interview" })
    }
  }

  useEffect(() => {
    if (stage === "complete" || stage === "error") {
      teardownInterviewSession()
    }
  }, [stage])

  return (
    <CandidateLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

        {stage === "loading" && (
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="page-glass max-w-md p-8 text-center shadow-xl">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-violet-600" role="status" aria-label="Loading" />
              <h2 className="text-xl font-bold text-gray-800">Loading interview…</h2>
            </div>
          </div>
        )}

        {(stage === "complete" || stage === "error") && (
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="page-glass max-w-lg w-full p-8 shadow-xl">
              <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">
                {stage === "complete" ? "Interview finished" : "Could not open interview"}
              </h2>
              <p className="text-sm text-gray-600 mb-6 text-center">
                {stage === "complete"
                  ? "Thank you for completing your interview."
                  : "Please try again from My Interviews."}
              </p>

              {stage === "complete" && (
                <div className="mb-6 text-left">
                  {loadingReport && (
                    <p className="text-sm text-gray-500 text-center">Loading your evaluation…</p>
                  )}
                  {!loadingReport && interviewReport && (
                    <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 space-y-3">
                      <p className="text-sm font-bold text-violet-900">
                        Overall score: {Math.round(interviewReport.overall_score)}%
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-700">
                        <span>Communication: {interviewReport.communication_score}/10</span>
                        <span>Technical: {interviewReport.technical_score}/10</span>
                        <span>Motivation: {interviewReport.motivation_score}/10</span>
                      </div>
                      {interviewReport.summary && (
                        <p className="text-sm text-gray-700">{interviewReport.summary}</p>
                      )}
                      {interviewReport.strengths?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600">Strengths</p>
                          <ul className="text-xs text-gray-600 list-disc pl-4">
                            {interviewReport.strengths.slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {!loadingReport && !interviewReport && (
                    <p className="text-sm text-gray-500 text-center">
                      Your evaluation report will be ready shortly. Check back from My Interviews.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate("/candidate/interviews")}
                className="w-full rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
              >
                Back to My Interviews
              </button>
            </div>
          </div>
        )}

        {/* Invitation Stage */}
        {stage === "invitation" && (
          <div className="flex items-center justify-center min-h-screen p-6">
            <div className="page-glass shadow-xl p-8 max-w-2xl w-full mx-4">
              <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Interview Invitation</h2>
              <p className="text-gray-600 text-center mb-6">
                You have received an interview invitation. Please review the details below and confirm your attendance or decline if you're unavailable.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-900">
                <p className="font-semibold">Scheduled at</p>
                <p>{interviewDetail?.scheduled_at ? formatInterviewStartLabel(interviewDetail.scheduled_at) : "To be confirmed"}</p>
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
        
        {/* Waiting until scheduled time */}
        {stage === "waiting" && (
          <div className="flex items-center justify-center min-h-screen p-6">
            <div className="page-glass shadow-xl p-8 max-w-md w-full mx-4 text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Interview scheduled</h2>
              <p className="text-gray-600 mb-4">
                Your interview opens on the scheduled day. You can start anytime that day.
              </p>
              <p className="text-lg font-semibold text-blue-800 mb-6">
                {formatInterviewStartLabel(interviewDetail?.scheduled_at)}
              </p>
              <button
                type="button"
                onClick={() => navigate("/candidate/interviews")}
                className="w-full py-3 px-6 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800"
              >
                Back to my interviews
              </button>
            </div>
          </div>
        )}

        {/* Starting — brief load while session opens (language already chosen on My Interviews) */}
        {stage === "starting" && (
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="page-glass max-w-md p-8 text-center shadow-xl">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-violet-600" role="status" aria-label="Loading" />
              <h2 className="text-xl font-bold text-gray-800">Starting interview…</h2>
              <p className="mt-2 text-sm text-gray-600">Please allow camera and microphone access when prompted.</p>
            </div>
          </div>
        )}

        {/* Language — only if not set during day scheduling */}
        {stage === "language-select" && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="page-glass shadow-xl p-8 max-w-md w-full mx-4">
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
                <div className="flex flex-col gap-3">
                  <div
                    className={`min-h-[3.25rem] flex items-center justify-center rounded-lg border px-4 py-3 text-center font-semibold ${
                      isThinking
                        ? "border-orange-300 bg-orange-50 text-orange-800"
                        : isRecording
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {isThinking ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" aria-hidden="true" />
                        <span className="text-xl tabular-nums">{thinkTimeLeft}s</span>
                        <span>{selectedLanguage === "fr" ? "Réflexion en cours..." : "Thinking time..."}</span>
                      </div>
                    ) : isRecording ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
                        <span>
                          {selectedLanguage === "fr" ? "Enregistrement" : "Recording"}:{" "}
                          {Math.floor(recordTimeLeft / 60)}:
                          {(recordTimeLeft % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    ) : isProcessing ? (
                      <span>
                        {selectedLanguage === "fr" ? "Traitement en cours..." : "Processing your answer..."}
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        {selectedLanguage === "fr" ? "En attente de la question..." : "Waiting for question..."}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={stopRecording}
                      disabled={!isRecording || isProcessing}
                      className="min-w-[10rem] flex-1 py-3 px-6 rounded-lg font-bold shadow-md transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
                    >
                      {selectedLanguage === "fr" ? "Terminer la réponse" : "Finish Answer"}
                    </button>
                    <button
                      type="button"
                      onClick={handleEndInterview}
                      className="min-w-[10rem] flex-1 py-3 px-6 rounded-lg font-bold shadow-md transition-all bg-gray-700 text-white hover:bg-gray-800"
                    >
                      {selectedLanguage === "fr" ? "Quitter l'entretien" : "End Interview"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Transcript Panel */}
              <div className="page-glass p-4 max-h-96 overflow-y-auto">
                <h3 className="font-bold text-lg mb-4">Transcript</h3>
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-gray-500">Conversation will appear here…</p>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-xl ${msg.role === "bot" ? "page-glass-inset bg-blue-50/40" : "page-glass-inset"}`}>
                      <p className="text-xs font-bold text-gray-600 mb-1">{msg.role.toUpperCase()}</p>
                      <p className="text-sm text-gray-800">{msg.content}</p>
                      {msg.audio_url && (
                        <audio controls className="w-full mt-2 text-xs" src={msg.audio_url} />
                      )}
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>

            {isProcessing && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="page-glass p-8 shadow-xl">
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
