import { useState } from "react"
import { flushSync } from "react-dom"
import { useNavigate, useLocation } from "react-router-dom"
import { login as loginApi, getMe, applyToJob, API_BASE_URL } from "../api/authApi"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"

const ROLE_REDIRECT = {
  CANDIDATE:      "/candidate/dashboard",
  RECRUITER:      "/recruiter/dashboard",
  HIRING_MANAGER: "/manager/dashboard",
  ADMINISTRATOR:  "/admin/dashboard",
  SUPER_ADMIN:    "/superadmin/dashboard",
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, isRTL } = useLanguage()
  const [form, setForm] = useState({ email: location.state?.prefilledEmail || "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await loginApi(form)
      const tokens = res.data
      localStorage.setItem("access_token", tokens.access_token)
      localStorage.setItem("refresh_token", tokens.refresh_token)
      const meRes = await getMe()
      const userData = meRes.data
      const role = userData?.role || tokens.role
      flushSync(() => login(tokens, userData))
      if (location.state?.fromCv && location.state?.pendingJobId && role === "CANDIDATE") {
        try {
          await applyToJob(location.state.pendingJobId)
        } catch {
          // keep login successful even if already applied
        }
      }
      const redirectTo = location.state?.redirectTo
      if (redirectTo && role === "CANDIDATE" && redirectTo.startsWith("/candidate/")) {
        navigate(redirectTo, { replace: true })
      } else {
        navigate(ROLE_REDIRECT[role] || "/")
      }
    } catch (err) {
      if (!err.response) {
        const api = API_BASE_URL
        const localhostOnWeb =
          import.meta.env.PROD &&
          /localhost|127\.0\.0\.1/.test(api)
        if (localhostOnWeb) {
          setError(
            `This site cannot call ${api} from the browser. On Vercel: Settings → Environment Variables → VITE_API_URL = your ngrok HTTPS URL, then redeploy.`
          )
        } else if (err.code === "ECONNABORTED") {
          setError(`Timeout contacting ${api}. Check uvicorn on port 8000 and ngrok if you use it.`)
        } else {
          setError(
            `Cannot reach ${api}. Keep uvicorn running; if using Vercel, also run ngrok http 8000 and set VITE_API_URL to that URL.`
          )
        }
      } else {
        const detail = err.response?.data?.detail
        setError(typeof detail === "string" ? detail : "Login failed")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      direction: isRTL ? "rtl" : "ltr"
    }}>

      {/* ── Landing page blobs ── */}
      <div style={{ position:"absolute", width:80, height:80, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"50% 30% 60% 40%", top:40, left:60, opacity:0.8, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:60, height:60, background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", borderRadius:"40% 60% 30% 70%", bottom:120, left:40, opacity:0.7, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:50, height:50, background:"linear-gradient(135deg,#f97316,#fb923c)", borderRadius:"60% 40% 50% 50%", bottom:60, left:200, opacity:0.8, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:40, height:40, background:"#fb923c", borderRadius:"50%", bottom:40, left:260, opacity:0.9, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:70, height:70, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"50% 40% 60% 30%", top:20, right:400, opacity:0.7, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:90, height:90, background:"#06b6d4", borderRadius:"40% 60% 30% 70%", top:60, right:60, opacity:0.7, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:60, height:60, background:"linear-gradient(135deg,#8b5cf6,#a855f7)", borderRadius:"50% 40% 60% 30%", bottom:100, right:200, opacity:0.7, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:100, height:100, background:"#06b6d4", borderRadius:"30% 60% 40% 70%", bottom:0, right:0, opacity:0.6, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:50, height:50, background:"linear-gradient(135deg,#a855f7,#7c3aed)", borderRadius:"50% 30% 60% 40%", top:120, left:300, opacity:0.5, filter:"blur(2px)" }}/>
      <div style={{ position:"absolute", width:70, height:70, background:"linear-gradient(135deg,#f97316,#fb923c)", borderRadius:"40% 60% 50% 30%", bottom:200, right:400, opacity:0.6, filter:"blur(2px)" }}/>

      {/* ── Login card ── */}
      <div style={{
        background: "white",
        borderRadius: "20px",
        padding: "48px 40px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 60px rgba(109,40,217,0.15)",
        position: "relative",
        zIndex: 10
      }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:"36px" }}>
          <div
            onClick={() => navigate("/")}
            style={{
              fontFamily:"'Monotype Corsiva','Apple Chancery',cursive",
              fontSize: "24px",
              color: "#1f2937",
              marginBottom: "8px",
              cursor: "pointer"
            }}
          >
            Talent<span style={{ color:"#f97316" }}>Os</span>
          </div>
          <h1 style={{
            color: "#1f2937",
            fontWeight: 700,
            fontSize: "24px",
            marginBottom: "6px"
          }}>
            {t.welcomeBack}
          </h1>
          <p style={{ color:"#9ca3af", fontSize:"14px" }}>
            {t.signInAccount}
          </p>
          <p style={{ color:"#d1d5db", fontSize:"11px", marginTop:"8px", wordBreak:"break-all" }}>
            API: {API_BASE_URL}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            color: "#ef4444",
            fontSize: "13px",
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>

          {/* Email */}
          <div style={{ marginBottom:"20px" }}>
            <label style={{
              color: "#374151",
              fontSize: "13px",
              fontWeight: 600,
              display: "block",
              marginBottom: "8px"
            }}>
              {t.emailAddress}
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Enter your Email Address"
              style={{
                width: "100%",
                border: "2px solid #e5e7eb",
                borderRadius: "10px",
                padding: "13px 16px",
                fontSize: "14px",
                color: "#1f2937",
                outline: "none",
                boxSizing: "border-box",
                background: "#f9fafb"
              }}
              onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
              onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom:"28px" }}>
            <label style={{
              color: "#374151",
              fontSize: "13px",
              fontWeight: 600,
              display: "block",
              marginBottom: "8px"
            }}>
              {t.password}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your Password"
                autoComplete="current-password"
                style={{
                  width: "100%",
                  border: "2px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: isRTL ? "13px 16px 13px 48px" : "13px 48px 13px 16px",
                  fontSize: "14px",
                  color: "#1f2937",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#f9fafb"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...(isRTL ? { left: 10, right: "auto" } : { right: 10, left: "auto" }),
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 8,
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 0,
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "15px",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "1px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {loading ? (
              <span
                className="inline-block h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden
              />
            ) : null}
            {loading ? t.signingIn : t.signInBtn}
          </button>

        </form>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
          <div style={{ flex:1, height:1, background:"#e5e7eb" }}/>
          <span style={{ color:"#9ca3af", fontSize:"12px" }}>{t.or}</span>
          <div style={{ flex:1, height:1, background:"#e5e7eb" }}/>
        </div>

        {/* Bottom links */}
        <div style={{ textAlign:"center" }}>
          <p style={{ color:"#9ca3af", fontSize:"12px", marginBottom:"12px" }}>
            {t.staffNote}
          </p>
          <div style={{ display:"flex", justifyContent:"center", gap:"16px" }}>
            <span
              onClick={() => navigate("/jobs")}
              style={{ color:"#7c3aed", fontSize:"13px", cursor:"pointer", fontWeight:600 }}
            >
              {t.browseJobsLink}
            </span>
            <span style={{ color:"#e5e7eb" }}>•</span>
            <span
              onClick={() => navigate("/company/signup")}
              style={{ color:"#7c3aed", fontSize:"13px", cursor:"pointer", fontWeight:600 }}
            >
              {t.createCompanyLink}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
