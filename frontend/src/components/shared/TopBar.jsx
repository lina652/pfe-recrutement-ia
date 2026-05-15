import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useLanguage } from "../../context/LanguageContext"
import API from "../../api/authApi"
import LogoutConfirmDialog from "./LogoutConfirmDialog"

export default function TopBar({ title, role, roleLabel, showMenuButton, onMenuClick, onBarClick }) {
  const { user, logout } = useAuth()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const fetchNotifications = async () => {
    try {
      let endpoint = ""
      if (role === "candidate") endpoint = "/candidate/notifications"
      else if (role === "recruiter") endpoint = "/recruiter/notifications"
      else if (role === "manager") endpoint = "/manager/notifications"
      else return

      if (!endpoint) return

      const res = await API.get(endpoint)
      setUnreadCount(res.data.unread_count || 0)
    } catch (err) {
      console.error("Failed to fetch notifications", err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const handleRefresh = () => fetchNotifications()
    window.addEventListener(`${role}-notifications-updated`, handleRefresh)
    const interval = setInterval(fetchNotifications, 30000)

    return () => {
      clearInterval(interval)
      window.removeEventListener(`${role}-notifications-updated`, handleRefresh)
    }
  }, [role])

  const handleLogoutClick = () => setLogoutConfirmOpen(true)

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false)
    await logout()
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

  const handleBellClick = () => {
    navigate(`/${role}/notifications`)
  }

  const displayRole = roleLabel || (typeof role === "string" ? role : "")

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
      <header
        role="banner"
        onClick={() => onBarClick?.()}
        className={`sticky top-0 flex items-center justify-between border-b border-white/50 bg-white/55 px-4 py-4 shadow-[0_4px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-8 ${onBarClick ? "z-[45]" : "z-40"}`}
      >
      <div className="flex items-center gap-3 sm:gap-4">
        {showMenuButton && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMenuClick?.()
              }}
              className="rounded-lg p-2 text-gray-700 transition hover:bg-white/25"
              aria-label="Ouvrir le menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer rounded-lg px-1 py-0.5 text-left transition hover:bg-white/20"
              aria-label="TalentOs — Accueil"
            >
              <span
                className="leading-none text-slate-900"
                style={{
                  fontFamily: "'Monotype Corsiva','Apple Chancery',cursive",
                  fontSize: "26px",
                }}
              >
                Talent<span style={{ color: "#f97316", fontWeight: 700 }}>Os</span>
              </span>
            </button>
          </>
        )}
        {!showMenuButton && (
          <h2 className="text-lg font-bold text-gray-800 sm:text-xl">{title || "Dashboard"}</h2>
        )}
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {role !== "admin" && role !== "superadmin" && (
          <div className="relative cursor-pointer" onClick={handleBellClick}>
            <div className="relative rounded-full p-2 transition hover:bg-white/25">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="hidden h-6 w-px bg-gray-300 sm:block" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-gray-700">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs capitalize text-gray-500">{displayRole}</p>
          </div>

          <button
            type="button"
            onClick={handleLogoutClick}
            className="flex items-center justify-center rounded-full p-2 text-red-500 transition-colors hover:bg-red-50"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
    </>
  )
}
