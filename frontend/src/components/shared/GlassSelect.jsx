import { useEffect, useRef, useState } from "react"

/**
 * Custom select with frosted glass dropdown (native <select> cannot be blurred).
 */
export default function GlassSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  listClassName = "",
  /** Solid white trigger (no frosted glass) — use inside white toolbars */
  plainTrigger = false,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
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

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder

  return (
    <div ref={rootRef} className={`relative min-w-0 ${plainTrigger ? "flex h-full min-h-0 flex-col" : ""} ${className}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          plainTrigger
            ? "flex w-full min-h-0 min-w-0 flex-1 select-none items-center justify-between gap-1.5 rounded-xl border-0 bg-white py-2 pl-3 pr-2.5 text-left text-[13px] font-medium text-slate-900 shadow-none backdrop-blur-none transition-colors duration-200 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-300/80"
            : "page-glass-input flex w-full min-w-0 select-none items-center justify-between gap-1.5 rounded-xl py-2 pl-3 pr-2.5 text-left text-[13px] font-medium !text-slate-900 transition-colors duration-200 hover:bg-violet-50/90 focus:outline-none focus:ring-2 focus:ring-violet-200/60"
        }
      >
        <span className="min-w-0 flex-1 truncate text-left text-inherit">{displayLabel}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`}
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
          aria-labelledby={id}
          style={{ color: "#0f172a" }}
          className={`page-glass-dropdown !border-slate-200/90 !bg-white !text-slate-900 absolute start-0 top-full z-[100] mt-1.5 max-h-60 w-full !rounded-lg py-1 shadow-lg shadow-violet-900/10 ring-1 ring-violet-200/50 overflow-x-hidden overflow-y-auto ${listClassName}`}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value
            const desc = opt.description
            return (
              <li key={opt.value || "__all__"} role="presentation" className="overflow-hidden">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-none border-0 px-3 py-2 text-left text-[13px] font-medium text-slate-900 outline-none ring-0 transition-colors duration-150 focus-visible:bg-violet-100 focus-visible:outline-none ${
                    isSelected
                      ? "bg-violet-100 font-semibold text-violet-950"
                      : "bg-white hover:bg-violet-200/70 hover:text-violet-950"
                  }`}
                >
                  <span>{opt.label}</span>
                  {desc ? (
                    <span className="max-w-none text-xs font-normal leading-snug text-slate-600">
                      {desc}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
