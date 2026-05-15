import { useEffect } from "react"

/**
 * Glass-styled confirmation before sign-out (replaces window.confirm).
 */
export default function LogoutConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = "Sign out?",
  message = "You will need to sign in again to access your workspace.",
  confirmLabel = "Sign out",
  cancelLabel = "Cancel",
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-desc"
        className="page-glass relative z-10 w-full max-w-md rounded-2xl border border-white/65 p-6 shadow-[0_24px_64px_rgba(15,23,42,0.22)] sm:p-7"
      >
        <div className="flex gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-100/90 to-white/50 text-violet-700 shadow-inner backdrop-blur-sm"
            aria-hidden
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="logout-dialog-title" className="text-lg font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            <p id="logout-dialog-desc" className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="page-glass-input rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-violet-200/70 sm:min-w-[7rem]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400/60 sm:min-w-[7rem]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
