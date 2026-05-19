import { useEffect, useRef, useState } from "react"

function StatusDot({ ready }) {
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`}
      aria-hidden
    />
  )
}

export default function FinalSelectionJobSelect({ jobs, value, onChange, loading }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selected = jobs.find((j) => j.job_id === value)

  useEffect(() => {
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  if (loading) {
    return (
      <div className="h-10 max-w-md animate-pulse rounded-xl bg-violet-100/60" />
    )
  }

  if (!jobs.length) {
    return (
      <p className="text-sm text-slate-600">
        No jobs yet. Submit requirements and wait for HR to publish the offer.
      </p>
    )
  }

  const jobLine = (job) => {
    const sub = job.subtitle || job.salary_range || job.department
    return sub ? `${job.title} · ${sub}` : job.title
  }

  const triggerLabel = selected ? jobLine(selected) : "Select a job…"
  const triggerMeta = selected
    ? `${selected.interviews_completed}/${selected.shortlisted_count} interviews · ${
        selected.ready_for_selection ? "Ready" : "In progress"
      }`
    : null

  return (
    <div ref={rootRef} className="relative max-w-md">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="page-glass-input flex w-full items-center justify-between gap-2 rounded-xl py-2 pl-3 pr-2.5 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-violet-50/90 focus:outline-none focus:ring-2 focus:ring-violet-300/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{triggerLabel}</span>
          {triggerMeta && (
            <span className="block truncate text-[11px] font-normal text-slate-500">{triggerMeta}</span>
          )}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-violet-600 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[200] max-h-56 overflow-y-auto rounded-xl border border-violet-200/80 bg-white py-1 shadow-lg shadow-violet-900/10 ring-1 ring-violet-100 animate-slide-down"
        >
          {jobs.map((job) => {
            const isSelected = job.job_id === value
            const pending = Math.max(0, job.shortlisted_count - job.interviews_completed)
            return (
              <li
                key={job.requirement_request_id || job.job_id}
                role="presentation"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(job.job_id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-violet-100 font-semibold text-violet-950"
                      : "text-slate-800 hover:bg-violet-50"
                  }`}
                >
                  <StatusDot ready={job.ready_for_selection} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{job.title}</span>
                    {(job.subtitle || job.salary_range) && (
                      <span className="block truncate text-[11px] font-normal text-slate-500">
                        {job.subtitle || job.salary_range}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-500">
                    {job.interviews_completed}/{job.shortlisted_count}
                  </span>
                </button>
                {!job.ready_for_selection && pending > 0 && (
                  <p className="px-3 pb-1.5 text-[10px] text-slate-400">
                    {pending} interview{pending !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
