import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useEffect, useState } from "react"
import API from "../../api/authApi"

const links = [
  { to: "/manager/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/manager/jobs", label: "Job Requirements", icon: "📝" },
  { to: "/manager/shortlisted", label: "Shortlisted Candidates", icon: "⭐" },
  { to: "/manager/selection", label: "Final Selection", icon: "✅" },
  { to: "/manager/profile", label: "Edit Profile", icon: "✏️" },
]

export default function ManagerSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  const avatar = user?.avatar_url
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  useEffect(() => {
    const fetchUnread = () => {
      API.get("/manager/notifications/unread-count")
        .then(res => setUnreadCount(res.data.unread_count))
        .catch(() => { })
    }
    const handleRefresh = () => fetchUnread()
    fetchUnread()
    window.addEventListener("manager-notifications-updated", handleRefresh)
    const interval = setInterval(fetchUnread, 30000)
    return () => {
      clearInterval(interval)
      window.removeEventListener("manager-notifications-updated", handleRefresh)
    }
  }, [])

  return (
    <aside className="w-64 min-h-screen bg-purple-900 text-white flex flex-col">
      <div className="p-6 border-b border-purple-800">
        <h1
          onClick={() => navigate("/")}
          style={{ fontFamily: "'Monotype Corsiva','Apple Chancery',cursive", fontSize: "24px", color: "white", marginBottom: "12px", cursor: "pointer" }}
        >
          Talent<span style={{ color: "#f97316" }}>Os</span>
        </h1>
        <p className="text-sm font-bold text-purple-100">{user?.company_name || "Hiring Manager Panel"}</p>
      </div>

      <div
        className="p-4 border-b border-purple-800 cursor-pointer hover:bg-purple-800 transition"
        onClick={() => navigate("/manager/profile")}
      >
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: avatar ? "transparent" : "#7c3aed",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13
          }}>
            {avatar ? (
              <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initials}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-purple-300">Hiring Manager</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? "bg-purple-700 text-white" : "text-purple-200 hover:bg-purple-800 hover:text-white"
              }`
            }
          >
            <span>{link.icon}</span>
            <span className="flex-1">{link.label}</span>
            {link.badge && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-purple-800">
        <div className="px-4 py-2 text-xs text-purple-400 text-center">
          TalentOs © 2026
        </div>
      </div>
    </aside>
  )
}
