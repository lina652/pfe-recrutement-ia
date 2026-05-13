import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

const links = [
  { to: "/admin/dashboard",        label: "Dashboard",       icon: "📊" },
  { to: "/admin/users",            label: "User Management", icon: "👥" },
  { to: "/admin/invite",           label: "Invite Staff",    icon: "✉️"  },
  { to: "/admin/logs",             label: "System Logs",     icon: "📋" },
  { to: "/admin/reports",          label: "Reports",         icon: "📄" },
  { to: "/admin/profile",          label: "Edit Profile",    icon: "✏️" },
]

export default function AdminSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const avatar = user?.avatar_url
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  return (
    <aside className="w-64 min-h-screen bg-blue-900 text-white flex flex-col">

      {/* Logo — click goes home */}
      <div className="p-6 border-b border-blue-800">
        <h1
          onClick={() => navigate("/")}
          style={{ fontFamily:"'Monotype Corsiva','Apple Chancery',cursive", fontSize:"24px", color:"white", marginBottom:"12px", cursor:"pointer" }}
        >
          Talent<span style={{ color:"#f97316" }}>Os</span>
        </h1>
        <p className="text-sm font-bold text-blue-100">{user?.company_name || "Admin Panel"}</p>
      </div>

      {/* User info — click goes to edit profile */}
      <div
        className="p-4 border-b border-blue-800 cursor-pointer hover:bg-blue-800 transition"
        onClick={() => navigate("/admin/profile")}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              overflow: "hidden", flexShrink: 0,
              background: avatar ? "transparent" : "#2563eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13
            }}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              initials
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-blue-300">Administrator</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-blue-700 text-white"
                  : "text-blue-200 hover:bg-blue-800 hover:text-white"
              }`
            }
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-blue-800">
        <div className="px-4 py-2 text-xs text-blue-400 text-center">
          TalentOs © 2026
        </div>
      </div>

    </aside>
  )
}