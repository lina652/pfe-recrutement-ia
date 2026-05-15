import { useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { login as loginApi, getMe } from "../../api/authApi"
import { useAuth } from "../../context/AuthContext"
import { useLanguage } from "../../context/LanguageContext"

const STEPS = { FORM: "form", OTP: "otp" }

const inputStyle = {
  width: "100%",
  border: "2px solid #e5e7eb",
  borderRadius: "10px",
  padding: "11px 16px",
  fontSize: "13px",
  color: "#1f2937",
  outline: "none",
  boxSizing: "border-box",
  background: "#f9fafb"
}

// ── Shared wrapper ──
const Wrapper = ({ children, isRTL }) => (
  <div style={{
    minHeight: "100vh",
    background: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    padding: "40px 20px",
    direction: isRTL ? "rtl" : "ltr"
  }}>
    {/* Blobs */}
    <div style={{ position:"absolute", width:80, height:80, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"50% 30% 60% 40%", top:40, left:60, opacity:0.8, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:60, height:60, background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", borderRadius:"40% 60% 30% 70%", bottom:120, left:40, opacity:0.7, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:50, height:50, background:"linear-gradient(135deg,#f97316,#fb923c)", borderRadius:"60% 40% 50% 50%", bottom:60, left:200, opacity:0.8, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:40, height:40, background:"#fb923c", borderRadius:"50%", bottom:40, left:260, opacity:0.9, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:90, height:90, background:"#06b6d4", borderRadius:"40% 60% 30% 70%", top:60, right:60, opacity:0.7, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:70, height:70, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"50% 40% 60% 30%", top:20, right:400, opacity:0.7, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:60, height:60, background:"linear-gradient(135deg,#8b5cf6,#a855f7)", borderRadius:"50% 40% 60% 30%", bottom:100, right:200, opacity:0.7, filter:"blur(2px)" }}/>
    <div style={{ position:"absolute", width:100, height:100, background:"#06b6d4", borderRadius:"30% 60% 40% 70%", bottom:0, right:0, opacity:0.6, filter:"blur(2px)" }}/>
    {children}
  </div>
)

export default function CompanySignup() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t, isRTL } = useLanguage()
  const [step, setStep] = useState(STEPS.FORM)
  const [companyId, setCompanyId] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    company_name: "",
    company_website: "",
    tax_id: "",
    industry: "",
    admin_first_name: "",
    admin_last_name: "",
    admin_email: "",
    admin_password: "",
    confirm_password: ""
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (form.admin_password !== form.confirm_password) {
      setError(t.passwordsNoMatch)
      return
    }
    if (form.admin_password.length < 8) {
      setError(t.passwordTooShort)
      return
    }
    setLoading(true)
    try {
      const res = await axios.post("http://localhost:8000/superadmin/signup", {
        company_name: form.company_name,
        company_website: form.company_website,
        tax_id: form.tax_id || undefined,
        industry: form.industry || undefined,
        admin_first_name: form.admin_first_name,
        admin_last_name: form.admin_last_name,
        admin_email: form.admin_email,
        admin_password: form.admin_password
      })
      setCompanyId(res.data.company_id)
      setAdminEmail(form.admin_email)
      setAdminPassword(form.admin_password)
      setStep(STEPS.OTP)
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError(t.enterCode); return }
    setLoading(true)
    setError("")
    try {
      await axios.post("http://localhost:8000/superadmin/verify-otp", {
        email: adminEmail,
        otp_code: otp,
        company_id: companyId
      })
      const loginRes = await loginApi({ email: adminEmail, password: adminPassword })
      const meRes = await getMe()
      login(loginRes.data, meRes.data)
      navigate("/admin/dashboard")
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError("")
    try {
      await axios.post(`http://localhost:8000/superadmin/resend-otp?email=${adminEmail}&company_id=${companyId}`)
      setError(t.newCodeSent)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend")
    }
  }

  // ── STEP 1 — Form ──
  if (step === STEPS.FORM) return (
    <Wrapper isRTL={isRTL}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        padding: "40px",
        width: "100%",
        maxWidth: "520px",
        boxShadow: "0 20px 60px rgba(109,40,217,0.15)",
        position: "relative",
        zIndex: 10
      }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:"28px" }}>
          <div
            onClick={() => navigate("/")}
            style={{ fontFamily:"'Monotype Corsiva','Apple Chancery',cursive", fontSize:"24px", color:"#1f2937", marginBottom:"8px", cursor:"pointer" }}
          >
            Talent<span style={{ color:"#f97316" }}>Os</span>
          </div>
          <h1 style={{ color:"#1f2937", fontWeight:700, fontSize:"22px", marginBottom:"4px" }}>
            {t.createCompanyAccount}
          </h1>
          <p style={{ color:"#9ca3af", fontSize:"13px" }}>
            {t.startHiring}
          </p>
        </div>

        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"8px", padding:"10px 16px", marginBottom:"16px", color:"#ef4444", fontSize:"13px", textAlign:"center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Company section */}
          <p style={{ fontSize:"11px", fontWeight:700, color:"#9ca3af", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>
            {t.companyInfo}
          </p>

          <div style={{ marginBottom:"14px" }}>
            <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.companyName}</label>
            <input
              type="text" required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              placeholder="Tech Corp Tunisia"
              style={inputStyle}
              onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
              onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
            />
          </div>

          <div style={{ marginBottom:"14px" }}>
            <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.companyWebsite}</label>
            <input
              type="text" required
              value={form.company_website}
              onChange={(e) => setForm({ ...form, company_website: e.target.value })}
              placeholder="https://techcorp.tn"
              style={inputStyle}
              onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
              onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
            />
            <p style={{ fontSize:"11px", color:"#9ca3af", marginTop:"4px" }}>
              {t.domainNote}
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
            <div>
              <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.industry}</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="Technology"
                style={inputStyle}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
            <div>
              <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.taxId}</label>
              <input
                type="text"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder="123456789"
                style={inputStyle}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
          </div>

          {/* Admin section */}
          <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:"16px", marginBottom:"14px" }}>
            <p style={{ fontSize:"11px", fontWeight:700, color:"#9ca3af", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"12px" }}>
              {t.yourAdmin}
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
            <div>
              <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.firstName}</label>
              <input
                type="text" required
                value={form.admin_first_name}
                onChange={(e) => setForm({ ...form, admin_first_name: e.target.value })}
                style={inputStyle}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
            <div>
              <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.lastName}</label>
              <input
                type="text" required
                value={form.admin_last_name}
                onChange={(e) => setForm({ ...form, admin_last_name: e.target.value })}
                style={inputStyle}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
          </div>

          <div style={{ marginBottom:"14px" }}>
            <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.workEmail}</label>
            <input
              type="email" required
              value={form.admin_email}
              onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
              placeholder="you@techcorp.com"
              style={inputStyle}
              onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
              onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
            />
            <p style={{ fontSize:"11px", color:"#9ca3af", marginTop:"4px" }}>
              {t.domainMatch}
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"20px" }}>
            <div>
              <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.passwordLabel}</label>
              <input
                type="password" required
                value={form.admin_password}
                onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                placeholder="Min 8 characters"
                style={inputStyle}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
            <div>
              <label style={{ fontSize:"13px", fontWeight:600, color:"#374151", display:"block", marginBottom:"6px" }}>{t.confirmPassword}</label>
              <input
                type="password" required
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                style={inputStyle}
                onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
          </div>

          <div style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:"8px", padding:"10px 14px", marginBottom:"20px", fontSize:"12px", color:"#6d28d9" }}>
            {t.otpNotice}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width:"100%",
              background:"linear-gradient(135deg,#6d28d9,#7c3aed)",
              color:"white",
              border:"none",
              borderRadius:"10px",
              padding:"14px",
              fontSize:"14px",
              fontWeight:700,
              letterSpacing:"1px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginBottom:"16px",
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
            {loading ? t.creatingAccountBtn : t.createAccountBtn}
          </button>

        </form>

        <div style={{ textAlign:"center" }}>
          <span style={{ color:"#9ca3af", fontSize:"13px" }}>
            {t.haveAccountQ}{" "}
          </span>
          <span
            onClick={() => navigate("/login")}
            style={{ color:"#7c3aed", fontSize:"13px", fontWeight:600, cursor:"pointer" }}
          >
            {t.signInQ}
          </span>
        </div>

      </div>
    </Wrapper>
  )

  // ── STEP 2 — OTP ──
  return (
    <Wrapper isRTL={isRTL}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        padding: "48px 40px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 60px rgba(109,40,217,0.15)",
        position: "relative",
        zIndex: 10,
        textAlign: "center"
      }}>

        <div style={{ fontSize:"48px", marginBottom:"16px" }}>📧</div>

        <div
          onClick={() => navigate("/")}
          style={{ fontFamily:"'Monotype Corsiva','Apple Chancery',cursive", fontSize:"20px", color:"#1f2937", marginBottom:"12px", cursor:"pointer" }}
        >
          Talent<span style={{ color:"#f97316" }}>Os</span>
        </div>

        <h1 style={{ color:"#1f2937", fontWeight:700, fontSize:"22px", marginBottom:"8px" }}>
          {t.checkEmail}
        </h1>
        <p style={{ color:"#9ca3af", fontSize:"13px", marginBottom:"4px" }}>
          {t.sentCode}
        </p>
        <p style={{ color:"#6d28d9", fontWeight:700, fontSize:"14px", marginBottom:"28px" }}>
          {adminEmail}
        </p>

        {error && (
          <div style={{
            background: error.includes("sent") || error.includes("terminal") ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${error.includes("sent") || error.includes("terminal") ? "#bbf7d0" : "#fecaca"}`,
            borderRadius:"8px",
            padding:"10px 16px",
            marginBottom:"16px",
            color: error.includes("sent") || error.includes("terminal") ? "#16a34a" : "#ef4444",
            fontSize:"13px"
          }}>
            {error}
          </div>
        )}

        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          style={{
            width:"100%",
            border:"2px solid #e5e7eb",
            borderRadius:"12px",
            padding:"16px",
            textAlign:"center",
            fontSize:"32px",
            fontWeight:700,
            letterSpacing:"12px",
            outline:"none",
            boxSizing:"border-box",
            marginBottom:"20px",
            color:"#1f2937"
          }}
          onFocus={(e) => e.target.style.border = "2px solid #7c3aed"}
          onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
        />

        <button
          onClick={handleVerifyOTP}
          disabled={otp.length !== 6 || loading}
          style={{
            width:"100%",
            background:"linear-gradient(135deg,#6d28d9,#7c3aed)",
            color:"white",
            border:"none",
            borderRadius:"10px",
            padding:"14px",
            fontSize:"14px",
            fontWeight:700,
            letterSpacing:"1px",
            cursor: otp.length !== 6 || loading ? "not-allowed" : "pointer",
            opacity: otp.length !== 6 || loading ? 0.6 : 1,
            marginBottom:"16px",
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
          {loading ? t.verifying : t.verifyActivate}
        </button>

        <p style={{ color:"#9ca3af", fontSize:"13px", marginBottom:"16px" }}>
          {t.noCode}{" "}
          <span
            onClick={handleResend}
            style={{ color:"#7c3aed", fontWeight:600, cursor:"pointer" }}
          >
            {t.resendCode}
          </span>
        </p>

        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#92400e", marginBottom:"10px" }}>
          {t.codeExpires}
        </div>

        <div style={{ background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#6b7280" }}>
          {t.devMode}
        </div>

      </div>
    </Wrapper>
  )
}