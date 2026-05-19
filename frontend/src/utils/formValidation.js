/** Shared input styles + invalid (required empty) highlight */

export const FORM_FIELD_BASE =
  "page-glass-input w-full rounded-xl px-4 py-2 text-sm text-slate-800 transition-[box-shadow,border-color,background-color] duration-200 focus:outline-none focus:ring-2 focus:ring-violet-200/50"

export const FORM_FIELD_INVALID =
  "!border-red-400 !bg-red-50/50 ring-2 ring-red-500/25 focus:!border-red-500 focus:!ring-red-400/40"

export const FORM_LABEL_INVALID = "text-red-700"

export function formFieldClass(hasError, extra = "") {
  return [FORM_FIELD_BASE, extra, hasError ? FORM_FIELD_INVALID : ""].filter(Boolean).join(" ")
}

export function formGroupInvalidClass(hasError) {
  return hasError
    ? "rounded-xl ring-2 ring-red-500/20 ring-offset-2 ring-offset-transparent"
    : ""
}

/**
 * @param {Record<string, unknown>} values keyed by field id
 * @param {Record<string, string>} rules map field -> error message when empty
 * @returns {Record<string, string>} only fields with errors
 */
export function collectRequiredFieldErrors(values, rules) {
  const errors = {}
  for (const [key, message] of Object.entries(rules)) {
    const v = values[key]
    const empty =
      v === undefined ||
      v === null ||
      (typeof v === "string" && !v.trim()) ||
      (Array.isArray(v) && v.length === 0)
    if (empty) errors[key] = message
  }
  return errors
}
