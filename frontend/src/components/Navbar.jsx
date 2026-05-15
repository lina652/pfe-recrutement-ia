import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"
import LogoutConfirmDialog from "./shared/LogoutConfirmDialog"
import { DashboardNavIcon } from "./shared/DashboardNavIcons"

const NAVBAR_OFFSET_PX = 88

function scrollToElementById(id) {
  const el = document.getElementById(id)
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET_PX
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
  return true
}

function scrollToSectionWhenReady(sectionId, maxAttempts = 50) {
  let attempts = 0
  const tick = () => {
    attempts += 1
    if (scrollToElementById(sectionId) || attempts >= maxAttempts) return
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { lang, setLang, t, isRTL } = useLanguage()
  const [showLangPopup, setShowLangPopup] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const userMenuRef = useRef(null)
  const langMenuRef = useRef(null)

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setShowLangPopup(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const openLogoutConfirm = () => {
    setShowUserMenu(false)
    setLogoutConfirmOpen(true)
  }

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false)
    try {
      await logout()
    } catch {}
    navigate("/")
  }

  const logoutDialogCopy =
    lang === "fr"
      ? {
          title: "Se déconnecter ?",
          message: "Vous devrez vous reconnecter pour accéder à votre espace.",
          confirmLabel: "Se déconnecter",
          cancelLabel: "Annuler",
        }
      : lang === "ar"
        ? {
            title: "تسجيل الخروج؟",
            message: "ستحتاج إلى تسجيل الدخول مجددًا للوصول إلى مساحة العمل.",
            confirmLabel: "تسجيل الخروج",
            cancelLabel: "إلغاء",
          }
        : {
            title: "Sign out?",
            message: "You will need to sign in again to access your workspace.",
            confirmLabel: "Sign out",
            cancelLabel: "Cancel",
          }

  // Build initials from user name
  const initials = user
    ? `${(user.first_name || "")[0] || ""}${(user.last_name || "")[0] || ""}`.toUpperCase() || "U"
    : ""

  // Dashboard path based on role
  const dashboardPath = user
    ? user.role === "CANDIDATE" ? "/candidate/dashboard"
    : user.role === "RECRUITER" ? "/recruiter/dashboard"
    : user.role === "HIRING_MANAGER" ? "/manager/dashboard"
    : user.role === "ADMINISTRATOR" ? "/admin/dashboard"
    : user.role === "SUPER_ADMIN" ? "/superadmin/dashboard"
    : "/"
    : "/"

  const profilePath = user
    ? user.role === "CANDIDATE" ? "/candidate/profile"
    : `/${user.role === "RECRUITER" ? "recruiter" : user.role === "HIRING_MANAGER" ? "manager" : user.role === "ADMINISTRATOR" ? "admin" : "superadmin"}/profile`
    : "/login"

  const goHome = () => {
    navigate({ pathname: "/", hash: "" })
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    })
  }

  const goToLandingSection = (sectionId) => {
    if (location.pathname !== "/") {
      navigate({ pathname: "/", hash: sectionId })
      setTimeout(() => scrollToSectionWhenReady(sectionId), 50)
      return
    }
    navigate({ pathname: "/", hash: sectionId })
    scrollToSectionWhenReady(sectionId)
  }

  const activeNavKey = (() => {
    const p = location.pathname
    if (p === "/login") return "login"
    if (p.startsWith("/jobs")) return "jobs"
    if (p === "/") {
      if (location.hash === "#services") return "services"
      if (location.hash === "#contact") return "contact"
      return "home"
    }
    return null
  })()

  // Nav links — conditionally show Login or not
  const navLinks = [
    { navKey: "home", label: t.home, action: goHome },
    { navKey: "services", label: t.services, action: () => goToLandingSection("services") },
    { navKey: "jobs", label: t.jobs, action: () => navigate("/jobs") },
    { navKey: "contact", label: t.contact, action: () => goToLandingSection("contact") },
  ]

  if (!user) {
    navLinks.push({ navKey: "login", label: t.login, action: () => navigate("/login") })
  }

  return (
    <>
      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
        title={logoutDialogCopy.title}
        message={logoutDialogCopy.message}
        confirmLabel={logoutDialogCopy.confirmLabel}
        cancelLabel={logoutDialogCopy.cancelLabel}
      />
    <nav style={{
      background: "linear-gradient(135deg, rgba(91, 33, 182, 0.88) 0%, rgba(123, 90, 200, 0.82) 45%, rgba(150, 131, 236, 0.76) 100%)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(255,255,255,0.38)",
      boxShadow: "0 4px 20px rgba(67, 29, 120, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 40px"
    }}>
      {/* Logo */}
      <div
        onClick={goHome}
        style={{
          fontFamily: "'Monotype Corsiva','Apple Chancery',cursive",
          fontSize: "28px",
          color: "white",
          cursor: "pointer",
          textShadow: "0 1px 3px rgba(0,0,0,0.45), 0 0 18px rgba(123,90,200,0.35)",
        }}
      >
        Talent<span style={{ color: "#f97316", fontWeight: 700 }}>Os</span>
      </div>

      {/* Center Nav Links */}
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        {navLinks.map((link) => {
          const isActive = link.navKey === activeNavKey
          return (
            <span
              key={link.navKey}
              onClick={link.action}
              className={`navbar-link${isActive ? " navbar-link--active" : ""}`}
            >
              {link.label}
            </span>
          )
        })}
      </div>

      {/* Right Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative" }}>
        {/* Language Picker */}
        <div style={{ position: "relative" }} ref={langMenuRef}>
          <button onClick={() => setShowLangPopup(!showLangPopup)}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
              width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: "20px", transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          >🌐</button>
          {showLangPopup && (
            <div className="animate-slide-down" style={{
              position: "absolute", top: "100%", right: 0, marginTop: 8,
              background: "white", borderRadius: 12, padding: 8,
              boxShadow: "0 8px 30px rgba(0,0,0,0.15)", minWidth: 140, zIndex: 100
            }}>
              {[
                { code: "en", label: "🇬🇧 English" },
                { code: "fr", label: "🇫🇷 Français" },
                { code: "ar", label: "🇸🇦 العربية" },
              ].map((l) => (
                <div key={l.code}
                  onClick={() => { setLang(l.code); setShowLangPopup(false) }}
                  style={{
                    padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14,
                    fontWeight: lang === l.code ? 700 : 400,
                    color: lang === l.code ? "#7B5AC8" : "#374151",
                    background: lang === l.code ? "#f5f3ff" : "transparent",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => { if (lang !== l.code) e.currentTarget.style.background = "#f9fafb" }}
                  onMouseOut={(e) => { if (lang !== l.code) e.currentTarget.style.background = "transparent" }}
                >{l.label}</div>
              ))}
            </div>
          )}
        </div>

        {/* User Avatar / Post Job */}
        {user ? (
          <div style={{ position: "relative" }} ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "linear-gradient(135deg, #f97316, #ef4444)",
                border: "2px solid rgba(255,255,255,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "white", fontSize: 14, fontWeight: 800,
                letterSpacing: "1px", transition: "all 0.3s ease",
                boxShadow: "0 2px 12px rgba(249,115,22,0.4)"
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(249,115,22,0.6)" }}
              onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(249,115,22,0.4)" }}
            >
              {initials}
            </button>
            {showUserMenu && (
              <div className="animate-slide-down" style={{
                position: "absolute", top: "100%", right: 0, marginTop: 8,
                background: "white", borderRadius: 16, padding: "8px 0",
                boxShadow: "0 12px 40px rgba(0,0,0,0.18)", minWidth: 220, zIndex: 100,
                border: "1px solid #f3f4f6"
              }}>
                {/* User info header */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>
                    {user.first_name} {user.last_name}
                  </p>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0 0" }}>{user.email}</p>
                  <span style={{
                    display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 6,
                    background: "#f5f3ff", color: "#7B5AC8", textTransform: "uppercase", letterSpacing: "1px"
                  }}>{(user.role || "").replace("_", " ")}</span>
                </div>

                {/* Menu items */}
                {[
                  { icon: "dashboard", label: "My Dashboard", path: dashboardPath },
                  { icon: "user", label: "My Profile", path: profilePath },
                  ...(user.role === "CANDIDATE" ? [{ icon: "clipboardList", label: "My Applications", path: "/candidate/applications" }] : []),
                ].map((item, i) => (
                  <div key={i}
                    onClick={() => { navigate(item.path); setShowUserMenu(false) }}
                    style={{
                      padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 500,
                      color: "#374151", display: "flex", alignItems: "center", gap: 10,
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "#f5f3ff"; e.currentTarget.style.color = "#7B5AC8" }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#374151" }}
                  >
                    <DashboardNavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                    {item.label}
                  </div>
                ))}

                {/* Logout */}
                <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 4 }}>
                  <div
                    onClick={openLogoutConfirm}
                    style={{
                      padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      color: "#ef4444", display: "flex", alignItems: "center", gap: 10,
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626" }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#ef4444" }}
                  >
                    <DashboardNavIcon name="logout" className="h-5 w-5 shrink-0" />
                    Logout
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => navigate("/company/signup")}
            style={{
              background: "#5b21b6", color: "white", border: "none",
              padding: "10px 24px", fontSize: "12px", fontWeight: 700,
              letterSpacing: "2px", textTransform: "uppercase",
              borderRadius: "14px", cursor: "pointer"
            }}
            onMouseOver={(e) => e.target.style.opacity = 0.85}
            onMouseOut={(e) => e.target.style.opacity = 1}
          >{t.postJob}</button>
        )}
      </div>
    </nav>
    </>
  )
}
