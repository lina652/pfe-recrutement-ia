function startOfLocalDay(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** True on the scheduled calendar day or later (interview open all day). */
export function canStartInterview(scheduledAt) {
  if (!scheduledAt) return false
  const scheduled = startOfLocalDay(new Date(scheduledAt))
  if (Number.isNaN(scheduled.getTime())) return false
  const today = startOfLocalDay(new Date())
  return today.getTime() >= scheduled.getTime()
}

export function msUntilInterviewStart(scheduledAt) {
  if (!scheduledAt) return null
  const scheduled = startOfLocalDay(new Date(scheduledAt))
  if (Number.isNaN(scheduled.getTime())) return null
  return Math.max(0, scheduled.getTime() - startOfLocalDay(new Date()).getTime())
}

export function formatInterviewStartLabel(scheduledAt, locale) {
  if (!scheduledAt) return ""
  const start = new Date(scheduledAt)
  if (Number.isNaN(start.getTime())) return ""
  return start.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/** ISO string for API booking (local noon of the chosen day). */
export function dayToScheduleIso(date) {
  const d = new Date(date)
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0).toISOString()
}
