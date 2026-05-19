import { useEffect, useState } from "react"
import { formFieldClass } from "../../utils/formValidation"

const glassInputClass =
  "page-glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"

function StepPill({ step, current, label }) {
  const active = step === current
  const done = step < current
  return (
    <div
      className={`flex items-center gap-2 text-xs font-semibold ${
        active ? "text-emerald-800" : done ? "text-emerald-600" : "text-slate-400"
      }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition ${
          active
            ? "border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
            : done
              ? "border-emerald-400 bg-emerald-100 text-emerald-800"
              : "border-slate-200 bg-white/60 text-slate-500"
        }`}
      >
        {done ? "✓" : step}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

function DialogShell({ open, onClose, children, labelledBy }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="page-glass relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/65 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400"
          aria-hidden
        />
        {children}
      </div>
    </div>
  )
}

/**
 * Two-step flow: confirm approval → set salary for the new job offer.
 */
export default function RequirementAcceptDialogs({
  target,
  step,
  submitting,
  onClose,
  onConfirmApproval,
  onSubmitSalary,
}) {
  const [salaryRange, setSalaryRange] = useState("")
  const [salaryError, setSalaryError] = useState("")

  useEffect(() => {
    if (target && step === "salary") {
      setSalaryRange(target.salary_range || "")
      setSalaryError("")
    }
  }, [target, step])

  const submitSalary = () => {
    const trimmed = salaryRange.trim()
    if (!trimmed) {
      setSalaryError("Salary range is required")
      return
    }
    setSalaryError("")
    onSubmitSalary(trimmed)
  }

  const closeAll = () => {
    if (submitting) return
    onClose()
  }

  const isConfirmOpen = Boolean(target && step === "confirm")
  const isSalaryOpen = Boolean(target && step === "salary")

  return (
    <>
      <DialogShell open={isConfirmOpen} onClose={closeAll} labelledBy="req-accept-confirm-title">
        <div className="p-6 sm:p-7">
          <div
            className="mb-5 flex items-center justify-center gap-3 sm:justify-start"
            aria-hidden
          >
            <StepPill step={1} current={1} label="Confirm" />
            <span className="h-px w-6 bg-slate-200" />
            <StepPill step={2} current={1} label="Salary" />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div
              className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-100/95 to-white/60 text-2xl shadow-inner sm:mx-0"
              aria-hidden
            >
              ✅
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h2
                id="req-accept-confirm-title"
                className="text-xl font-bold tracking-tight text-slate-900"
              >
                Approve requirements?
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                You are about to approve{" "}
                <span className="font-semibold text-emerald-900">{target?.title}</span>
                {target?.submitter_name ? (
                  <>
                    {" "}
                    submitted by{" "}
                    <span className="font-semibold text-slate-800">{target.submitter_name}</span>
                  </>
                ) : null}
                . A published job offer will be created for candidates.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-emerald-100/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Next step</p>
            <p className="mt-1 text-emerald-800/90">
              You will set the salary range shown on the public job listing and job details page.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAll}
              disabled={submitting}
              className="page-glass-input rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/60 disabled:opacity-50 sm:min-w-[6.5rem]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmApproval}
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 sm:min-w-[8.5rem]"
            >
              Continue
            </button>
          </div>
        </div>
      </DialogShell>

      <DialogShell open={isSalaryOpen} onClose={closeAll} labelledBy="req-accept-salary-title">
        <div className="p-6 sm:p-7">
          <div
            className="mb-5 flex items-center justify-center gap-3 sm:justify-start"
            aria-hidden
          >
            <StepPill step={1} current={2} label="Confirm" />
            <span className="h-px w-6 bg-slate-200" />
            <StepPill step={2} current={2} label="Salary" />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div
              className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-100/90 to-white/50 text-2xl shadow-inner sm:mx-0"
              aria-hidden
            >
              💰
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h2 id="req-accept-salary-title" className="text-xl font-bold tracking-tight text-slate-900">
                Salary for job listing
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                This amount appears on{" "}
                <span className="font-semibold text-slate-800">{target?.title}</span> in job cards
                and the detail page candidates see.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <label
              htmlFor="req-accept-salary-input"
              className={`block text-sm font-semibold ${salaryError ? "text-red-700" : "text-slate-700"}`}
            >
              Salary range <span className="text-red-500">*</span>
            </label>
            <input
              id="req-accept-salary-input"
              type="text"
              value={salaryRange}
              onChange={(e) => {
                setSalaryRange(e.target.value)
                if (salaryError) setSalaryError("")
              }}
              className={salaryError ? formFieldClass(true) : glassInputClass}
              placeholder="e.g. 2000-3000 TND / month"
              autoFocus
              disabled={submitting}
              aria-invalid={salaryError ? "true" : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) {
                  e.preventDefault()
                  submitSalary()
                }
              }}
            />
            {salaryError ? (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {salaryError}
              </p>
            ) : (
              <p className="text-xs font-medium text-slate-500">
                Shown on the public job listing and job details page.
              </p>
            )}
            {target?.salary_range && (
              <p className="text-xs text-emerald-700">
                Manager suggested:{" "}
                <span className="font-semibold">{target.salary_range}</span>
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAll}
              disabled={submitting}
              className="page-glass-input rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/60 disabled:opacity-50 sm:min-w-[6.5rem]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitSalary}
              disabled={submitting || !salaryRange.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 sm:min-w-[10rem]"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating job…
                </>
              ) : (
                "Create job offer"
              )}
            </button>
          </div>
        </div>
      </DialogShell>
    </>
  )
}
