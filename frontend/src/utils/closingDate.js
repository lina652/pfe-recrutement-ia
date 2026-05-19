/** Closing date must not be before job creation / submission (same moment allowed). */

export function toDatetimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Earliest selectable closing = now (same day and time as creation allowed). */
export function getMinClosingDatetimeLocal() {
  return toDatetimeLocalValue(new Date())
}

/** Allow closing at or after reference time (1 min grace for datetime-local rounding). */
export function isClosingOnOrAfterReference(value, referenceMs = Date.now()) {
  if (!value) return false
  const closing = new Date(value)
  if (Number.isNaN(closing.getTime())) return false
  return closing.getTime() >= referenceMs - 60_000
}

export function closingDateErrorMessage() {
  return "Closing date cannot be before the current time. You may use the same day and time as now."
}

/** Send closing to API as UTC ISO (datetime-local is browser local time). */
export function closingDateToApi(datetimeLocalValue) {
  if (!datetimeLocalValue) return datetimeLocalValue
  const d = new Date(datetimeLocalValue)
  if (Number.isNaN(d.getTime())) return datetimeLocalValue
  return d.toISOString()
}
