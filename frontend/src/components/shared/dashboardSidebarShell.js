/** Outer wrapper for all role dashboard layouts (lilac / lilas mauve) */

export const dashboardLayoutRootClass =
  "flex min-h-screen bg-[linear-gradient(145deg,#b8a8d0_0%,#a894c0_48%,#9478b0_100%)]"



/** Frosted panel — matches dashboard cards (see index.css .page-glass) */

export const pageGlassClass = "page-glass"

export const pageGlassPanelClass = "page-glass overflow-hidden"

export const pageGlassInputClass =

  "page-glass-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200/50"

export const pageGlassPillInactiveClass =

  "page-glass-pill rounded-full text-gray-600 hover:bg-white/55"



/** Same detached glass sidebar shell as recruiter (all roles) */

export function dashboardGlassSidebarClass(open) {

  return `fixed left-3 top-3 bottom-3 z-50 flex w-[min(19rem,calc(100vw-1.5rem))] max-w-[88vw] flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/35 py-5 shadow-[0_12px_48px_rgba(15,23,42,0.2),0_4px_16px_rgba(15,23,42,0.08)] ring-1 ring-white/60 backdrop-blur-xl transition-transform duration-300 ease-out sm:left-4 sm:top-4 sm:bottom-4 md:w-72 ${

    open ? "translate-x-0" : "-translate-x-full pointer-events-none"

  }`

}



export function sidebarGlassNavClass(isActive) {

  return `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${

    isActive

      ? "bg-white/55 text-emerald-900 shadow-inner ring-1 ring-white/50"

      : "text-slate-800 hover:bg-white/35 hover:text-slate-900"

  }`

}

