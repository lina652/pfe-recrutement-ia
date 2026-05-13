import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useEffect, useState } from "react"
import API from "../../api/authApi"

const links = [
  { to: "/recruiter/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/recruiter/jobs", label: "Job Offers", icon: "💼" },
  { to: "/recruiter/requirements", label: "Requirement Requests", icon: "📨", badge: true, badgeKey: "requests" },
  { to: "/recruiter/applications", label: "Applications", icon: "📋" },
  { to: "/recruiter/interviews", label: "Interviews", icon: "🎙️" },
  { to: "/recruiter/ai", label: "AI Recommendations", icon: "🤖" },
  { to: "/recruiter/profile", label: "Edit Profile", icon: "✏️" },
]

export default function RecruiterSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)

  const avatar = user?.avatar_url
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  useEffect(() => {
    const fetchCounts = () => {
      API.get("/recruiter/notifications/unread-count")
        .then(res => setUnreadCount(res.data.unread_count))
        .catch(() => { })

      API.get("/recruiter/requirement-requests", { params: { status: "PENDING" } })
        .then(res => setPendingRequests(res.data.total))
        .catch(() => { })
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
    <aside className="w-64 min-h-screen bg-green-900 text-white flex flex-col">
      <div className="p-6 border-b border-green-800">
        <h1
          onClick={() => navigate("/")}
          style={{ fontFamily: "'Monotype Corsiva','Apple Chancery',cursive", fontSize: "24px", color: "white", marginBottom: "12px", cursor: "pointer" }}
        >
          Talent<span style={{ color: "#f97316" }}>Os</span>
        </h1>
        <p className="text-sm font-bold text-green-100">{user?.company_name || "Recruiter Panel"}</p>
      </div>

      <div
        className="p-4 border-b border-green-800 cursor-pointer hover:bg-green-800 transition"
        onClick={() => navigate("/recruiter/profile")}
      >
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: avatar ? "transparent" : "#16a34a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13
          }}>
            {avatar ? (
              <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initials}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-green-300">Recruiter / HR</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const badgeCount = link.badge ? getBadgeCount(link.badgeKey) : 0
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"
                }`
              }
            >
              <span>{link.icon}</span>
              <span className="flex-1">{link.label}</span>
              {link.badge && badgeCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-green-800">
        <div className="px-4 py-2 text-xs text-green-400 text-center">
          TalentOs © 2026
        </div>
      </div>
    </aside>
  )
}
