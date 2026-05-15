import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import CandidateSidebar from "./CandidateSidebar"
import TopBar from "../shared/TopBar"
import { dashboardLayoutRootClass } from "../shared/dashboardSidebarShell"

export default function CandidateLayout({ children, title = "Dashboard" }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className={dashboardLayoutRootClass}>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/35 transition-opacity"
          aria-label="Fermer le menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <CandidateSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          role="candidate"
          roleLabel="Candidate"
          showMenuButton
          onMenuClick={() => setSidebarOpen((v) => !v)}
          onBarClick={() => setSidebarOpen(false)}
        />
        <main className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
