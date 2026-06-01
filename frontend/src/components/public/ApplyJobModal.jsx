import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { uploadCV, confirmSignup, login, getMe, applyToJob, getMyApplications, attachCvUpload } from "../../api/authApi"
import { useAuth } from "../../context/AuthContext"
import { useLanguage } from "../../context/LanguageContext"
import { formFieldClass } from "../../utils/formValidation"
import { CV_ACCEPT } from "../../constants/cvUpload"

const ALERT_STYLES = {
  success: "border-slate-200 bg-white text-slate-800",
  info: "border-slate-200 bg-white text-slate-800",
  error: "border-slate-200 bg-white text-red-700",
  accountCreated: "border-slate-200 bg-white text-violet-800",
}

const ALERT_ICONS = {
  success: "text-emerald-600",
  info: "text-blue-600",
  error: "text-red-600",
  accountCreated: "text-violet-600",
}

function ModalAlert({ message, variant = "success" }) {
  if (!message) return null
  const icon = { success: "✓", info: "ℹ", error: "✕", accountCreated: "✓" }[variant] || "✓"
  return (
    <div
      role="status"
      className={`modal-alert-solid shrink-0 border-b border-slate-200 px-4 py-3.5 text-sm font-medium flex items-start gap-2.5 ${
        ALERT_STYLES[variant] || ALERT_STYLES.success
      }`}
    >
      <span
        className={`text-base font-bold leading-none mt-0.5 ${ALERT_ICONS[variant] || ALERT_ICONS.success}`}
        aria-hidden
      >
        {icon}
      </span>
      <p className="flex-1 text-left leading-snug">{message}</p>
    </div>
  )
}

const STEPS = { UPLOAD: "upload", CONFIRM: "confirm", SUCCESS: "success" }
const SESSION_APPLIED_KEY = "talentos_applied_jobs"

function markAppliedInSession(jobId) {
  try {
    const stored = sessionStorage.getItem(SESSION_APPLIED_KEY)
    const ids = stored ? JSON.parse(stored) : []
    if (!ids.includes(jobId)) ids.push(jobId)
    sessionStorage.setItem(SESSION_APPLIED_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

function applyLockKey(jobId) {
  return `talentos_apply_lock_${jobId}`
}

function getApplyLock(jobId) {
  try {
    return sessionStorage.getItem(applyLockKey(jobId))
  } catch {
    return null
  }
}

function setApplyLock(jobId, value) {
  try {
    if (!value) sessionStorage.removeItem(applyLockKey(jobId))
    else sessionStorage.setItem(applyLockKey(jobId), value)
  } catch {
    /* ignore */
  }
}

function ModalShell({ open, onClose, children, titleId, topAlert = null }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)] sm:rounded-2xl"
      >
        {topAlert}
        <div className="overflow-y-auto overscroll-contain min-h-0">{children}</div>
      </div>
    </div>
  )
}

export default function ApplyJobModal({
  jobId,
  jobTitle,
  open,
  onClose,
  onApplied,
  prefilledFile = null,
  cvData = null,
}) {
  const navigate = useNavigate()
  const { user, login: authLogin } = useAuth()
  const { t, isRTL } = useLanguage()
  const [step, setStep] = useState(STEPS.UPLOAD)
  const [file, setFile] = useState(prefilledFile)
  const [extracted, setExtracted] = useState(null)
  const [password, setPassword] = useState("")
  const [existingPassword, setExistingPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState(null)
  const directApplyRanRef = useRef(false)
  const applyInFlightRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setStep(STEPS.UPLOAD)
      setFile(prefilledFile)
      setExtracted(null)
      setPassword("")
      setExistingPassword("")
      setError("")
      setLoading(false)
      directApplyRanRef.current = false
      applyInFlightRef.current = false
    } else {
      // If cvData is provided, use it instead of requiring file upload
      if (cvData) {
        setExtracted(cvData)
        setStep(STEPS.CONFIRM)
        setFile(null)
      } else {
        setStep(STEPS.UPLOAD)
        setFile(prefilledFile)
        setExtracted(null)
      }
      setPassword("")
      setExistingPassword("")
      setError("")
      setLoading(false)
      directApplyRanRef.current = false
      applyInFlightRef.current = false
    }
  }, [open, prefilledFile, cvData])

  useEffect(() => {
    if (open && prefilledFile && !extracted && step === STEPS.UPLOAD && !cvData) {
      handleUpload(prefilledFile)
    }
  }, [open, prefilledFile, cvData])

  useEffect(() => {
    if (!open || user?.role !== "CANDIDATE" || !jobId || directApplyRanRef.current) return
    directApplyRanRef.current = true
    handleDirectApply()
  }, [open, user?.role, jobId])

  const finishSuccess = (message, variant = "success", isAccountCreated = false, shouldMarkApplied = true) => {
    if (shouldMarkApplied) {
      markAppliedInSession(jobId)
      onApplied?.(jobId)
    }
    setToast({ message, variant, isAccountCreated })
    setStep(STEPS.SUCCESS)
    setTimeout(() => {
      setToast(null)
      onClose()
    }, 3500)
  }

  const handleDirectApply = async () => {
    if (!user || !jobId || applyInFlightRef.current) return

    const lock = getApplyLock(jobId)
    if (lock === "submitted") {
      markAppliedInSession(jobId)
      onApplied?.(jobId)
      finishSuccess("Your application has been submitted successfully!", "success", false, false)
      return
    }
    if (lock === "pending") return

    applyInFlightRef.current = true
    setApplyLock(jobId, "pending")
    setLoading(true)
    setError("")
    try {
      const appsRes = await getMyApplications()
      const alreadyOnFile = (appsRes.data?.applications || []).some((a) => a.job_id === jobId)
      if (alreadyOnFile) {
        setApplyLock(jobId, "submitted")
        markAppliedInSession(jobId)
        onApplied?.(jobId)
        finishSuccess("Your application has been submitted successfully!", "success", false, false)
        return
      }

      await applyToJob(jobId)
      setApplyLock(jobId, "submitted")
      finishSuccess("Your application has been submitted successfully!", "success", false, true)
    } catch (err) {
      const detail = err.response?.data?.detail || ""
      if (detail.toLowerCase().includes("already applied")) {
        setApplyLock(jobId, "submitted")
        markAppliedInSession(jobId)
        onApplied?.(jobId)
        finishSuccess("Your application has been submitted successfully!", "success", false, false)
      } else if (detail.toLowerCase().includes("closed") || detail.toLowerCase().includes("not found")) {
        setApplyLock(jobId, "")
        setError("This position is no longer accepting applications.")
      } else {
        setApplyLock(jobId, "")
        setError(detail || "Failed to apply")
      }
    } finally {
      setLoading(false)
      applyInFlightRef.current = false
    }
  }

  const handleUpload = async (selectedFile = file) => {
    if (!selectedFile) return
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      const res = await uploadCV(formData)
      setExtracted(res.data)
      setStep(STEPS.CONFIRM)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to parse CV")
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    handleUpload(selectedFile)
  }

  const attachStoredCv = async (cvUploadId) => {
    if (!cvUploadId) return
    try {
      await attachCvUpload(cvUploadId)
    } catch (err) {
      console.warn("CV attach after signup:", err.response?.data?.detail || err.message)
    }
  }

  const handleConfirm = async () => {
    const normalizedEmail = (extracted?.extracted_email || "").trim().toLowerCase()
    if (!normalizedEmail) {
      setError("No email was extracted from your CV. Please upload another CV.")
      return
    }
    if (extracted?.account_exists ? !existingPassword : !password) return

    setLoading(true)
    setError("")
    try {
      let loginRes
      if (extracted?.account_exists) {
        loginRes = await login({ email: normalizedEmail, password: existingPassword })
      } else {
        await confirmSignup({
          extracted_name: extracted.extracted_name,
          extracted_email: normalizedEmail,
          extracted_phone: extracted.extracted_phone,
          extracted_skills: extracted.extracted_skills,
          password,
          cv_upload_id: extracted.cv_upload_id || null,
        })
        loginRes = await login({ email: normalizedEmail, password })
      }

      localStorage.setItem("access_token", loginRes.data.access_token)
      localStorage.setItem("refresh_token", loginRes.data.refresh_token)
      const meRes = await getMe()
      authLogin(loginRes.data, meRes.data)

      if (extracted?.account_exists && extracted?.cv_upload_id) {
        await attachStoredCv(extracted.cv_upload_id)
      }

      try {
        await applyToJob(jobId)
      } catch (applyErr) {
        console.warn("Apply after signup:", applyErr.response?.data?.detail)
      }

      finishSuccess(
        extracted?.account_exists
          ? "Welcome back! Your application has been submitted."
          : "Welcome to Talentos! Your account and application are ready.",
        !extracted?.account_exists ? "accountCreated" : "success",
        !extracted?.account_exists,
        true
      )
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const titleId = "apply-modal-title"

  const modalTopAlert = toast ? (
    <ModalAlert message={toast.message} variant={toast.variant} />
  ) : error ? (
    <ModalAlert message={error} variant="error" />
  ) : null

  if (!open || !jobId) return null

  if (user?.role === "CANDIDATE") {
    return (
      <ModalShell open={open} onClose={onClose} titleId={titleId} topAlert={modalTopAlert}>
        <div className="px-6 py-5 text-center" dir={isRTL ? "rtl" : "ltr"}>
          {loading ? (
            <>
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-[3px] border-violet-600 border-t-transparent" />
              <p className="text-sm font-medium text-slate-600">Submitting your application…</p>
            </>
          ) : error ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          ) : toast || step === STEPS.SUCCESS ? (
            <p className="text-4xl text-emerald-600" aria-hidden>
              ✓
            </p>
          ) : null}
        </div>
      </ModalShell>
    )
  }

  if (step === STEPS.SUCCESS) {
    const isAccountCreated = toast?.isAccountCreated
    return (
      <ModalShell open={open} onClose={onClose} titleId={titleId} topAlert={modalTopAlert}>
        <div className="p-8 text-center" dir={isRTL ? "rtl" : "ltr"}>
          {isAccountCreated ? (
            <>
              <p className="text-6xl">✓</p>
              <h2 id={titleId} className="mt-4 text-2xl font-bold text-slate-900">
                Account Created
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Your account has been created and your application submitted successfully.
              </p>
            </>
          ) : (
            <>
              <p className="text-6xl">✓</p>
              <h2 id={titleId} className="mt-4 text-2xl font-bold text-slate-900">
                {t.appSubmitted}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{t.appSuccess}</p>
            </>
          )}
        </div>
      </ModalShell>
    )
  }

  if (step === STEPS.CONFIRM) {
    return (
      <ModalShell open={open} onClose={onClose} titleId={titleId} topAlert={modalTopAlert}>
        <div className="p-6 sm:p-7" dir={isRTL ? "rtl" : "ltr"}>
          {cvData && (
            <div className="mb-4 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-3 text-sm text-emerald-700">
              ✓ {t.usingStoredCV}
            </div>
          )}
          <h2 id={titleId} className="text-xl font-bold text-slate-900">
            {t.isThisYou}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t.verifyInfo}</p>

          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            {[
              { l: t.name_, v: extracted?.extracted_name },
              { l: t.email_, v: extracted?.extracted_email },
              { l: t.phone_, v: extracted?.extracted_phone || "—" },
            ].map((r) => (
              <div key={r.l} className="mb-2 flex justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-500">{r.l}</span>
                <span className="font-medium text-slate-800">{r.v}</span>
              </div>
            ))}
            {extracted?.extracted_skills?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extracted.extracted_skills.map((s, i) => (
                  <span key={i} className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {extracted?.account_exists ? "Account password" : t.choosePassword}
            </label>
            <input
              type="password"
              value={extracted?.account_exists ? existingPassword : password}
              onChange={(e) =>
                extracted?.account_exists
                  ? setExistingPassword(e.target.value)
                  : setPassword(e.target.value)
              }
              className={formFieldClass(false)}
              placeholder={extracted?.account_exists ? "Your password" : t.minChars}
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setStep(STEPS.UPLOAD)}
              className="page-glass-input rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              {t.uploadAgain}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || (extracted?.account_exists ? !existingPassword : !password)}
              className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50"
            >
              {loading ? t.creatingAccount : t.confirmApply}
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell open={open} onClose={onClose} titleId={titleId} topAlert={modalTopAlert}>
      <div className="p-6 sm:p-7" dir={isRTL ? "rtl" : "ltr"}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-slate-900">
              {t.applyTitle}
            </h2>
            {jobTitle && (
              <p className="mt-0.5 text-sm font-medium text-violet-700">{jobTitle}</p>
            )}
            <p className="mt-1 text-sm text-slate-500">{t.applySubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/60 text-slate-500 hover:bg-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <label
          htmlFor="apply-cv-upload"
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 transition ${
            loading ? "border-violet-200 bg-violet-50/30" : "border-violet-200/80 bg-violet-50/20 hover:border-violet-400 hover:bg-violet-50/40"
          }`}
        >
          <input
            id="apply-cv-upload"
            type="file"
            accept={CV_ACCEPT}
            onChange={handleFileSelect}
            className="sr-only"
            disabled={loading}
          />
          <span className="text-4xl" aria-hidden>
            📄
          </span>
          <span className="mt-3 text-sm font-semibold text-violet-800">{t.clickUpload}</span>
          <span className="mt-1 text-xs text-slate-500">{t.fileTypes}</span>
          {file && (
            <span className="mt-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {file.name}
            </span>
          )}
        </label>

        {loading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-violet-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            {t.analyzing}
          </div>
        )}

        <p className="mt-5 text-center text-xs text-slate-500">
          {t.haveAccount}{" "}
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate("/login")
            }}
            className="font-semibold text-violet-700 hover:underline"
          >
            {t.signInLink}
          </button>
        </p>
      </div>
    </ModalShell>
  )
}
