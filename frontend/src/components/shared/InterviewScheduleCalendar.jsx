import { useEffect, useMemo, useState } from "react"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function pad2(n) {
  return String(n).padStart(2, "0")
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function startWeekday(year, monthIndex) {
  return new Date(year, monthIndex, 1).getDay()
}

/** Group API slots by local calendar day (one slot per day expected). */
export function buildSlotCalendar(slots = []) {
  const byDate = {}
  let min = null
  let max = null

  for (const slot of slots) {
    const d = new Date(slot.datetime)
    if (Number.isNaN(d.getTime())) continue
    const key = toDateKey(d)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(slot)
    const day = startOfDay(d)
    if (!min || day < min) min = day
    if (!max || day > max) max = day
  }

  for (const key of Object.keys(byDate)) {
    byDate[key].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  }

  return { byDate, min, max }
}

/**
 * Month calendar for interview day selection (no time-of-day picker).
 */
export default function InterviewScheduleCalendar({
  slots = [],
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  dayOnly = true,
  className = "",
}) {
  const { byDate, min, max } = useMemo(() => buildSlotCalendar(slots), [slots])
  const today = useMemo(() => startOfDay(new Date()), [])

  const firstSlotDay = min || today
  const [viewYear, setViewYear] = useState(firstSlotDay.getFullYear())
  const [viewMonth, setViewMonth] = useState(firstSlotDay.getMonth())

  useEffect(() => {
    const anchor = selectedDate || min || today
    setViewYear(anchor.getFullYear())
    setViewMonth(anchor.getMonth())
  }, [slots.length, selectedDate, min, today])

  const grid = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth)
    const start = startWeekday(viewYear, viewMonth)
    const cells = []
    for (let i = 0; i < start; i += 1) cells.push(null)
    for (let d = 1; d <= total; d += 1) cells.push(d)
    return cells
  }, [viewYear, viewMonth])

  const canGoPrev =
    viewYear > firstSlotDay.getFullYear() ||
    (viewYear === firstSlotDay.getFullYear() && viewMonth > firstSlotDay.getMonth())

  const canGoNext =
    !max ||
    viewYear < max.getFullYear() ||
    (viewYear === max.getFullYear() && viewMonth < max.getMonth())

  const goPrevMonth = () => {
    if (!canGoPrev) return
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNextMonth = () => {
    if (!canGoNext) return
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const pickDay = (day) => {
    const date = startOfDay(new Date(viewYear, viewMonth, day))
    if (date < today) return
    const key = toDateKey(date)
    const dayList = (byDate[key] || []).filter((s) => s.available !== false)
    if (!dayList.length) return
    onSelectDate(date)
    if (dayOnly && onSelectSlot) {
      onSelectSlot(dayList[0])
    } else {
      onSelectSlot?.(null)
    }
  }

  return (
    <div className={className}>
      <div className="page-glass-inset rounded-2xl p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            disabled={!canGoPrev}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous month"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-base font-bold text-slate-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          <button
            type="button"
            onClick={goNextMonth}
            disabled={!canGoNext}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next month"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((wd) => (
            <span key={wd} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {wd}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((day, idx) => {
            if (day === null) {
              return <span key={`e-${idx}`} className="aspect-square" />
            }

            const date = startOfDay(new Date(viewYear, viewMonth, day))
            const key = toDateKey(date)
            const dayList = byDate[key] || []
            const hasAvailable = dayList.length > 0
            const isPast = date < today
            const isSelected = selectedDate && toDateKey(selectedDate) === key
            const isToday = toDateKey(today) === key

            return (
              <button
                key={day}
                type="button"
                disabled={isPast || !hasAvailable}
                onClick={() => pickDay(day)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition ${
                  isPast || !hasAvailable
                    ? "cursor-not-allowed text-slate-300"
                    : isSelected
                      ? "bg-violet-600 text-white shadow-md ring-2 ring-violet-300"
                      : isToday
                        ? "bg-violet-100 text-violet-900 ring-1 ring-violet-300 hover:bg-violet-200"
                        : "text-slate-800 hover:bg-violet-50"
                }`}
              >
                {day}
                {hasAvailable && !isPast && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-violet-500"
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">
          Select a highlighted day · weekends included · interview available all day
        </p>
      </div>

      {!dayOnly && selectedDate && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-slate-800">
            Available times —{" "}
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {/* Legacy time picker — kept if dayOnly=false */}
        </div>
      )}

      {dayOnly && !selectedDate && (
        <p className="mt-4 text-center text-sm text-slate-500">
          Tap a highlighted day to choose your interview date.
        </p>
      )}

      {dayOnly && selectedDate && (
        <p className="mt-4 text-center text-sm font-medium text-violet-800">
          Selected:{" "}
          {selectedDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
    </div>
  )
}
