import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useEffect, useState } from "react"
import API from "../../api/authApi"
import { DashboardNavIcon } from "../shared/DashboardNavIcons"
import { dashboardGlassSidebarClass, sidebarGlassNavClass } from "../shared/dashboardSidebarShell"

const links = [
  { to: "/recruiter/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/recruiter/jobs", label: "Job Offers", icon: "briefcase" },
  { to: "/recruiter/requirements", label: "Requirement Requests", icon: "inbox", badge: true, badgeKey: "requests" },
  { to: "/recruiter/applications", label: "Applications", icon: "clipboardList" },
  { to: "/recruiter/interviews", label: "Interviews", icon: "microphone" },
  { to: "/recruiter/ai", label: "AI Recommendations", icon: "cpu" },
  { to: "/recruiter/profile", label: "Edit Profile", icon: "pencil" },
]

export default function RecruiterSidebar({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)

  const avatar = user?.avatar_url
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  useEffect(() => {
    const fetchCounts = () => {
      API.get("/recruiter/notifications/unread-count")
        .then((res) => setUnreadCount(res.data.unread_count))
        .catch(() => {})

      API.get("/recruiter/requirement-requests", { params: { status: "PENDING" } })
        .then((res) => setPendingRequests(res.data.total))
        .catch(() => {})
    }
    const handleRefresh = () => fetchCounts()
    fetchCounts()
    window.addEventListener("recruiter-notifications-updated", handleRefresh)
    window.addEventListener("recruiter-requests-updated", handleRefresh)
    const interval = setInterval(fetchCounts, 30000)
    return () => {
      clearInterval(interval)
      window.removeEventListener("recruiter-notifications-updated", handleRefresh)
      window.removeEventListener("recruiter-requests-updated", handleRefresh)
    }
  }, [])

  const getBadgeCount = (badgeKey) => {
    if (badgeKey === "notifications") return unreadCount
    if (badgeKey === "requests") return pendingRequests
    return 0
  }

  return (
    <aside
      className={dashboardGlassSidebarClass(open)}
      aria-hidden={!open}
    >
      <div
        className="cursor-pointer border-b border-white/30 px-5 py-4 transition hover:bg-white/20"
        onClick={() => {
          navigate("/recruiter/profile")
          onClose?.()
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ring-2 ring-white/60"
            style={{
              background: avatar ? "transparent" : "linear-gradient(135deg,#059669,#047857)",
            }}
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs font-medium text-emerald-900/70">Recruiter / HR</p>
            {user?.company_name && (
              <p className="mt-1 truncate text-xs font-semibold text-emerald-900/85" title={user.company_name}>
                {user.company_name}
              </p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        {links.map((link) => {
          const badgeCount = link.badge ? getBadgeCount(link.badgeKey) : 0
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/recruiter/dashboard"}
              onClick={() => onClose?.()}
              className={({ isActive }) => sidebarGlassNavClass(isActive)}
            >
              <DashboardNavIcon name={link.icon} className="h-5 w-5 shrink-0 opacity-90" />
              <span className="flex-1 truncate">{link.label}</span>
              {link.badge && badgeCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-white/30 px-4 pt-3">
        <button
          type="button"
          onClick={() => onClose?.()}
          className="mb-2 w-full rounded-2xl border border-white/40 bg-white/30 py-2.5 text-sm font-semibold text-slate-800 backdrop-blur-sm transition hover:bg-white/45"
        >
          Fermer le menu
        </button>
        <p className="text-center text-[10px] font-medium text-emerald-900/60">TalentOs © 2026</p>
      </div>
    </aside>
  )
}
