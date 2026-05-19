import { useEffect, useMemo, useRef, useState } from "react"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function pad2(n) {
  return String(n).padStart(2, "0")
}

export function toDateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

export function parseDateKey(value) {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return { year: y, monthIndex: m - 1, day: d }
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function startWeekday(year, monthIndex) {
  return new Date(year, monthIndex, 1).getDay()
}

/**
 * Frosted glass date picker (popover calendar).
 * value: "" or "YYYY-MM-DD"
 */
export default function GlassCalendarPicker({
  id,
  value = "",
  onChange,
  minYear = 2026,
  placeholder = "Registration date",
  className = "",
  "aria-label": ariaLabel,
}) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)

  const selected = parseDateKey(value)
  const now = new Date()
  const initialView = selected ?? {
    year: Math.max(now.getFullYear(), minYear),
    monthIndex: now.getMonth(),
  }

  const [viewYear, setViewYear] = useState(initialView.year)
  const [viewMonth, setViewMonth] = useState(initialView.monthIndex)

  useEffect(() => {
    if (!open) return
    const parsed = parseDateKey(value)
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.monthIndex)
    }
  }, [open, value])

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

  const minDate = useMemo(() => new Date(minYear, 0, 1), [minYear])
  const maxDate = useMemo(() => {
    const y = new Date().getFullYear() + 15
    return new Date(y, 11, 31)
  }, [])

  const displayLabel = selected
    ? new Date(selected.year, selected.monthIndex, selected.day).toLocaleDateString(
        undefined,
        { year: "numeric", month: "short", day: "numeric" }
      )
    : placeholder

  const grid = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth)
    const start = startWeekday(viewYear, viewMonth)
    const cells = []
    for (let i = 0; i < start; i += 1) cells.push(null)
    for (let d = 1; d <= total; d += 1) cells.push(d)
    return cells
  }, [viewYear, viewMonth])

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      if (viewYear <= minYear) return
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const canGoPrev =
    viewYear > minYear || (viewYear === minYear && viewMonth > 0)

  const canGoNext =
    viewYear < maxDate.getFullYear() ||
    (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth())

  const isDisabledDay = (day) => {
    const date = new Date(viewYear, viewMonth, day)
    return date < minDate || date > maxDate
  }

  const isSelectedDay = (day) =>
    selected &&
    selected.year === viewYear &&
    selected.monthIndex === viewMonth &&
    selected.day === day

  const isToday = (day) =>
    now.getFullYear() === viewYear &&
    now.getMonth() === viewMonth &&
    now.getDate() === day

  const pickDay = (day) => {
    if (isDisabledDay(day)) return
    onChange(toDateKey(viewYear, viewMonth, day))
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="page-glass-input flex w-full min-w-0 select-none items-center justify-between gap-2 rounded-xl py-2 pl-3 pr-2.5 text-left text-[13px] font-medium text-slate-900 transition-colors hover:bg-violet-50/90 focus:outline-none focus:ring-2 focus:ring-violet-200/60"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          <svg
            className="h-4 w-4 shrink-0 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className={value ? "truncate" : "truncate text-slate-500"}>
            {displayLabel}
          </span>
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-white/60 hover:text-slate-800"
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onChange("")
              }
            }}
          >
            ×
          </span>
        ) : (
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
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel || "Choose a date"}
          className="page-glass-dropdown absolute start-0 top-full z-[100] mt-1.5 w-[min(100%,18.5rem)] p-3 ring-1 ring-violet-200/50"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              disabled={!canGoPrev}
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-slate-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={goNextMonth}
              disabled={!canGoNext}
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((day, idx) =>
              day === null ? (
                <span key={`empty-${idx}`} className="aspect-square" />
              ) : (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabledDay(day)}
                  onClick={() => pickDay(day)}
                  className={`aspect-square rounded-lg text-xs font-semibold transition ${
                    isDisabledDay(day)
                      ? "cursor-not-allowed text-slate-300"
                      : isSelectedDay(day)
                        ? "bg-violet-600 text-white shadow-sm"
                        : isToday(day)
                          ? "bg-violet-100 text-violet-900 ring-1 ring-violet-300"
                          : "text-slate-800 hover:bg-violet-100"
                  }`}
                >
                  {day}
                </button>
              )
            )}
          </div>

          <p className="mt-2 text-center text-[10px] font-medium text-slate-500">
            Filter companies registered on this date
          </p>
        </div>
      )}
    </div>
  )
}
