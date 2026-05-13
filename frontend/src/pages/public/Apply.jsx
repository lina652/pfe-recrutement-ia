import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { uploadCV, confirmSignup, login, getMe, applyToJob } from "../../api/authApi"
import { useAuth } from "../../context/AuthContext"
import { useLanguage } from "../../context/LanguageContext"
import Toast from "../../components/Toast"

const STEPS = { UPLOAD: "upload", CONFIRM: "confirm", SUCCESS: "success" }
const SESSION_APPLIED_KEY = "talentos_applied_jobs"

// Helper to persist applied job in sessionStorage
function markAppliedInSession(jobId) {
  try {
    const stored = sessionStorage.getItem(SESSION_APPLIED_KEY)
    const ids = stored ? JSON.parse(stored) : []
    if (!ids.includes(jobId)) ids.push(jobId)
    sessionStorage.setItem(SESSION_APPLIED_KEY, JSON.stringify(ids))
  } catch {}
}

export default function Apply() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login: authLogin } = useAuth()
  const { t, isRTL } = useLanguage()
  const [step, setStep] = useState(STEPS.UPLOAD)
  const [file, setFile] = useState(location.state?.prefilledFile || null)
  const [extracted, setExtracted] = useState(null)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [existingPassword, setExistingPassword] = useState("")
  const [toast, setToast] = useState(null)

  const appliedRef = useRef(false)

  // If user is already logged in, skip upload step — go straight to apply
  useEffect(() => {
    if (user && user.role === "CANDIDATE" && !appliedRef.current) {
      appliedRef.current = true
      handleDirectApply()
    }
  }, [user])

  // Direct apply for logged-in users
  const handleDirectApply = async () => {
    if (!user) return
    setLoading(true)
    setError("")
    try {
      await applyToJob(id)
      markAppliedInSession(id)
      setToast({
        message: (
          <span>
            Application submitted successfully! 🎉
            <br />
            <span style={{ color: "#ffdddd", fontWeight: "bold" }}>Check your notifications in your profile</span>
          </span>
        ),
        variant: "success"
      })
      // Navigate back to jobs so they can keep browsing ranked results
      setTimeout(() => navigate("/jobs", { replace: true }), 2000)
    } catch (err) {
      const detail = err.response?.data?.detail || ""
      if (detail.includes("already applied")) {
        markAppliedInSession(id)
        setToast({
          message: "You've already applied to this job.",
          variant: "info"
        })
        setTimeout(() => navigate("/jobs", { replace: true }), 2000)
      } else {
        setError(detail || "Failed to apply")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (location.state?.prefilledFile) {
      handleUpload(location.state.prefilledFile)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [])

  const handleUpload = async (selectedFile = file) => {
    if (!selectedFile) return
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      const res = await uploadCV(formData)
      const parsed = res.data
      setExtracted(parsed)
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

  const handleConfirm = async () => {
    const normalizedEmail = (extracted?.extracted_email || "").trim().toLowerCase()
    if (!normalizedEmail) {
      setError("No email was extracted from your CV. Please upload another CV.")
      return
    }
    if (extracted?.account_exists) {
      if (!existingPassword) return
    } else if (!password) return

    setLoading(true)
    setError("")
    try {
      let loginRes
      if (extracted?.account_exists) {
        // Existing account — just log in
        loginRes = await login({
          email: normalizedEmail,
          password: existingPassword
        })
      } else {
        // New account — create it (no auto-application!)
        await confirmSignup({
          extracted_name: extracted.extracted_name,
          extracted_email: normalizedEmail,
          extracted_phone: extracted.extracted_phone,
          extracted_skills: extracted.extracted_skills,
          password,
          // NOTE: no job_id — we don't auto-apply on signup
        })
        loginRes = await login({
          email: normalizedEmail,
          password
        })
      }

      localStorage.setItem("access_token", loginRes.data.access_token)
      localStorage.setItem("refresh_token", loginRes.data.refresh_token)
      const meRes = await getMe()
      authLogin(loginRes.data, meRes.data)

      // Now explicitly apply to this job
      try {
        await applyToJob(id)
        markAppliedInSession(id)
      } catch (applyErr) {
        // Might fail if already applied — that's okay
        markAppliedInSession(id)
        console.warn("Apply after signup:", applyErr.response?.data?.detail)
      }

      // Show toast
      setToast({
        message: (
          <span>
            {extracted?.account_exists
              ? "Logged in & application submitted! 🎉"
              : "Account created successfully! Application submitted! 🎉"}
            <br />
            <span style={{ color: "#ffdddd", fontWeight: "bold" }}>Check your notifications in your profile</span>
          </span>
        ),
        variant: "success"
      })

      // Navigate back to jobs so they keep seeing ranked results
      setTimeout(() => {
        navigate("/jobs", { replace: true })
      }, 2500)

      setStep(STEPS.SUCCESS)
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    background: "white", borderRadius: 20, padding: 40,
    boxShadow: "0 8px 40px rgba(123,90,200,0.12)",
    width: "100%", maxWidth: 460, border: "1px solid #f3f4f6"
  }

  // If user is logged in, show a loading/applying state
  if (user && user.role === "CANDIDATE") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#f5f3ff 0%,#ede9fe 50%,#f5f3ff 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        direction: isRTL ? "rtl" : "ltr"
      }}>
        {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
        <div style={{ ...cardStyle, textAlign: "center" }}>
          {loading ? (
            <>
              <div style={{ width: 40, height: 40, border: "3px solid #7B5AC8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px auto" }}/>
              <p style={{ color: "#6b7280", fontSize: 14 }}>Submitting your application...</p>
            </>
          ) : error ? (
            <>
              <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>{error}</p>
              <button onClick={() => navigate("/jobs")}
                style={{ background: "linear-gradient(135deg,#7B5AC8,#9683EC)", color: "white", border: "none", padding: "12px 24px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}
              >Back to Jobs</button>
            </>
          ) : (
            <div>
              <p style={{ color: "#16a34a", fontSize: 14, fontWeight: 600 }}>✅ Application submitted!</p>
              <p style={{ color: "red", fontSize: 14, marginTop: 8, fontWeight: "bold" }}>Check your notifications in your profile</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // STEP 1 — Upload CV
  if (step === STEPS.UPLOAD) return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#f5f3ff 0%,#ede9fe 50%,#f5f3ff 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      direction: isRTL ? "rtl" : "ltr", position: "relative", overflow: "hidden"
    }}>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
      {/* Decorative blobs */}
      <div className="animate-float" style={{ position: "absolute", width: 100, height: 100, background: "linear-gradient(135deg,#7B5AC8,#9683EC)", borderRadius: "50% 30% 60% 40%", top: 60, left: 80, opacity: 0.15, filter: "blur(20px)" }}/>
      <div className="animate-float" style={{ position: "absolute", width: 120, height: 120, background: "linear-gradient(135deg,#f97316,#ef4444)", borderRadius: "40% 60% 30% 70%", bottom: 80, right: 100, opacity: 0.1, filter: "blur(20px)", animationDelay: "2s" }}/>

      <div style={cardStyle}>
        <button onClick={() => navigate(`/jobs/${id}`)}
          style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}
        >{t.backToJob}</button>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#7B5AC8", marginBottom: 8 }}>
          {t.applyTitle}
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
          {t.applySubtitle}
        </p>

        <div style={{
          border: "2px dashed #d8b4fe", borderRadius: 16, padding: 40,
          textAlign: "center", marginBottom: 16, background: "#faf5ff",
          transition: "all 0.3s ease", cursor: "pointer"
        }}>
          <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileSelect} style={{ display: "none" }} id="cv-upload" />
          <label htmlFor="cv-upload" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <p style={{ color: "#7B5AC8", fontWeight: 600, fontSize: 14 }}>{t.clickUpload}</p>
            <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{t.fileTypes}</p>
          </label>
          {file && <p style={{ marginTop: 12, color: "#16a34a", fontSize: 13, fontWeight: 600 }}>✅ {file.name}</p>}
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {loading && (
          <button disabled
            style={{
              width: "100%", background: "linear-gradient(135deg,#7B5AC8,#9683EC)",
              color: "white", border: "none", padding: 14, borderRadius: 10,
              fontWeight: 700, fontSize: 14, cursor: "not-allowed", opacity: 0.8
            }}
          >{t.analyzing}</button>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 16 }}>
          {t.haveAccount}{" "}
          <a href="/login" style={{ color: "#7B5AC8", fontWeight: 600, textDecoration: "none" }}>{t.signInLink}</a>
        </p>
      </div>
    </div>
  )

  // STEP 2 — Confirm
  if (step === STEPS.CONFIRM) return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#f5f3ff 0%,#ede9fe 50%,#f5f3ff 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      direction: isRTL ? "rtl" : "ltr"
    }}>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#7B5AC8", marginBottom: 8 }}>{t.isThisYou}</h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>{t.verifyInfo}</p>

        <div style={{ background: "#f5f3ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          {[
            { l: t.name_, v: extracted.extracted_name },
            { l: t.email_, v: extracted.extracted_email },
            { l: t.phone_, v: extracted.extracted_phone || "—" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{r.l}</span>
              <span style={{ fontSize: 13, color: "#1f2937" }}>{r.v}</span>
            </div>
          ))}
          {extracted.extracted_skills?.length > 0 && (
            <div>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{t.skillsDetected}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {extracted.extracted_skills.map((s, i) => (
                  <span key={i} style={{ background: "#e9d5ff", color: "#7B5AC8", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{t.confidence}</span>
            <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>{(extracted.confidence_score * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          {extracted?.account_exists ? (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Enter your account password
              </label>
              <input type="password" value={existingPassword} onChange={(e) => setExistingPassword(e.target.value)}
                placeholder="Your existing account password"
                style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "11px 16px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.border = "2px solid #7B5AC8"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </>
          ) : (
            <>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{t.choosePassword}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t.minChars}
                style={{ width: "100%", border: "2px solid #e5e7eb", borderRadius: 10, padding: "11px 16px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.border = "2px solid #7B5AC8"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </>
          )}
          <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            Email extracted from CV: {extracted?.extracted_email || "—"}
          </p>
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={() => setStep(STEPS.UPLOAD)}
            style={{ border: "1px solid #d1d5db", color: "#6b7280", background: "white", padding: 12, borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >{t.uploadAgain}</button>
          <button onClick={handleConfirm} disabled={loading || (extracted?.account_exists ? !existingPassword : !password)}
            style={{
              background: "linear-gradient(135deg,#7B5AC8,#9683EC)", color: "white", border: "none",
              padding: 12, borderRadius: 10, fontWeight: 700, fontSize: 13,
              cursor: (loading || (extracted?.account_exists ? !existingPassword : !password)) ? "not-allowed" : "pointer",
              opacity: (loading || (extracted?.account_exists ? !existingPassword : !password)) ? 0.5 : 1
            }}
          >{loading ? t.creatingAccount : t.confirmApply}</button>
        </div>
      </div>
    </div>
  )

  // STEP 3 — Success
  if (step === STEPS.SUCCESS) return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#f5f3ff 0%,#ede9fe 50%,#f5f3ff 100%)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>{t.appSubmitted}</h2>
        <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 14, lineHeight: 1.8 }}>
          {t.appSuccess}
          <br />
          <span style={{ color: "red", fontWeight: "bold" }}>Check your notifications in your profile</span>
        </p>
        <button onClick={() => navigate("/jobs")}
          style={{
            width: "100%", background: "linear-gradient(135deg,#7B5AC8,#9683EC)",
            color: "white", border: "none", padding: 14, borderRadius: 10,
            fontWeight: 700, fontSize: 14, cursor: "pointer"
          }}
        >Back to Jobs</button>
      </div>
    </div>
  )
}
