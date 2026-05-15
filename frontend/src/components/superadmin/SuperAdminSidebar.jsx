import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { dashboardGlassSidebarClass, sidebarGlassNavClass } from "../shared/dashboardSidebarShell"
import { DashboardNavIcon } from "../shared/DashboardNavIcons"

const links = [
  { to: "/superadmin/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/superadmin/companies", label: "Companies", icon: "building" },
  { to: "/superadmin/profile", label: "Edit Profile", icon: "pencil" },
]

export default function SuperAdminSidebar({ open = false, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const avatar = user?.avatar_url
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  return (
    <aside className={dashboardGlassSidebarClass(open)} aria-hidden={!open}>
      <div
        className="cursor-pointer border-b border-white/30 px-5 py-4 transition hover:bg-white/20"
        onClick={() => {
          navigate("/superadmin/profile")
          onClose?.()
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ring-2 ring-white/60"
            style={{
              background: avatar ? "transparent" : "linear-gradient(135deg,#4b5563,#1f2937)",
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
            <p className="text-xs font-medium text-emerald-900/70">Super administrator</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-emerald-900/75">Super admin panel</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/superadmin/dashboard"}
            onClick={() => onClose?.()}
            className={({ isActive }) => sidebarGlassNavClass(isActive)}
          >
            <DashboardNavIcon name={link.icon} className="h-5 w-5 shrink-0 opacity-90" />
            <span className="flex-1 truncate">{link.label}</span>
          </NavLink>
        ))}
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
