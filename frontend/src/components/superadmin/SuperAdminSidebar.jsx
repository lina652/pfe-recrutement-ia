import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

const links = [
  { to: "/superadmin/dashboard", label: "Dashboard",  icon: "📊" },
  { to: "/superadmin/companies", label: "Companies",  icon: "🏢" },
  { to: "/superadmin/profile",   label: "Edit Profile", icon: "✏️" },
]

export default function SuperAdminSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const avatar = user?.avatar_url
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1
          onClick={() => navigate("/")}
          style={{ fontFamily:"'Monotype Corsiva','Apple Chancery',cursive", fontSize:"24px", color:"white", marginBottom:"4px", cursor:"pointer" }}
        >
          Talent<span style={{ color:"#f97316" }}>Os</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">Super Admin Panel</p>
      </div>

      <div
        className="p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition"
        onClick={() => navigate("/superadmin/profile")}
      >
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: avatar ? "transparent" : "#4b5563",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13
          }}>
            {avatar ? (
              <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initials}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-gray-400">Super Administrator</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`
            }
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="px-4 py-2 text-xs text-gray-500 text-center">
          TalentOs © 2026
        </div>
      </div>
    </aside>
  )
}