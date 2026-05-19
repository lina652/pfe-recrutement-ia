import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  getPublicInterviewSchedule,
  submitPublicInterviewSchedule,
  updatePublicInterviewLanguage,
} from "../../api/authApi"
import InterviewScheduleCalendar from "../../components/shared/InterviewScheduleCalendar"
import { dayToScheduleIso, formatInterviewStartLabel } from "../../utils/interviewTime"

export default function ScheduleInterview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [meta, setMeta] = useState(null)
  const [slots, setSlots] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [language, setLanguage] = useState("en")
  const [savingLanguage, setSavingLanguage] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Invalid scheduling link. Check your invitation email.")
      return
    }
    loadSchedule()
  }, [token])

  const loadSchedule = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await getPublicInterviewSchedule(token)
      const data = res.data
      setMeta(data)
      setSlots(data.slots || [])
      if (data.already_scheduled) {
        setSuccess(
          `Your interview is already scheduled for ${formatInterviewStartLabel(data.scheduled_at)}.`
        )
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load interview schedule")
    } finally {
      setLoading(false)
    }
  }

  const handleLanguageChange = async (next) => {
    const prev = language
    setLanguage(next)
    if (!token || meta?.already_scheduled) return
    setSavingLanguage(true)
    try {
      await updatePublicInterviewLanguage(token, { language: next })
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update language")
      setLanguage(prev)
    } finally {
      setSavingLanguage(false)
    }
  }

  const handleConfirm = async () => {
    const day = selectedDate || (selectedSlot ? new Date(selectedSlot.datetime) : null)
    if (!day || !token) return
    setSubmitting(true)
    setError("")
    try {
      const res = await submitPublicInterviewSchedule(token, {
        selected_datetime: dayToScheduleIso(day),
        language,
      })
      setSuccess(
        res.data.message ||
          "Interview day confirmed! Details were saved to your application."
      )
      setMeta((m) => ({
        ...m,
        already_scheduled: true,
        scheduled_at: res.data.scheduled_at,
        meeting_link: res.data.meeting_link,
      }))
      setSelectedSlot(null)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to confirm interview day")
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 px-4">
        <div className="page-glass max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Invalid link</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 rounded-xl bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl page-glass overflow-hidden shadow-xl">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
          <p
            className="cursor-pointer font-['Monotype_Corsiva','Apple_Chancery',cursive] text-xl"
            onClick={() => navigate("/")}
          >
            Talent<span className="text-orange-400">Os</span>
          </p>
          <h1 className="mt-3 text-2xl font-bold">Select your interview day</h1>
          {meta && (
            <p className="mt-1 text-purple-200 text-sm">
              {meta.job_title}
              {meta.company_name ? ` · ${meta.company_name}` : ""}
            </p>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  {success}
                  {meta?.meeting_link && (
                    <p className="mt-2">
                      <a href={meta.meeting_link} className="font-semibold text-emerald-700 underline">
                        Open interview room
                      </a>
                      {" · "}
                      <a href="/login" className="font-semibold text-emerald-700 underline">
                        Sign in to dashboard
                      </a>
                    </p>
                  )}
                </div>
              )}

              {!meta?.already_scheduled && slots.length > 0 && (
                <>
                <div className="mb-6 page-glass-inset rounded-xl p-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Interview language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={savingLanguage}
                    className="page-glass-input w-full max-w-xs rounded-xl px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    The AI interview will be conducted in this language.
                  </p>
                </div>

                <InterviewScheduleCalendar
                  slots={slots}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                  dayOnly
                />
                </>
              )}

              {!meta?.already_scheduled && !loading && slots.length === 0 && !error && (
                <p className="text-center text-gray-500 py-8">No available slots right now.</p>
              )}

              {!meta?.already_scheduled && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
                  {selectedDate && (
                    <span className="text-sm text-purple-700 font-medium">
                      Selected: {formatInterviewStartLabel(selectedDate)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!selectedDate || submitting}
                    className={`ml-auto px-8 py-3 rounded-lg font-bold transition-all ${
                      selectedDate && !submitting
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {submitting ? "Confirming…" : "Confirm day"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

