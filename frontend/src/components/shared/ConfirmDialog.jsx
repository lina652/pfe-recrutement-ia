import { useEffect } from "react"

const VARIANTS = {
  danger: {
    iconBg: "border-red-200/70 bg-gradient-to-br from-red-50 to-white/60 text-red-600",
    confirm:
      "rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-900/15 transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400/60 disabled:opacity-60 sm:min-w-[7.5rem]",
  },
  default: {
    iconBg:
      "border-violet-200/60 bg-gradient-to-br from-violet-100/90 to-white/50 text-violet-700",
    confirm:
      "rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-300/60 disabled:opacity-60 sm:min-w-[7.5rem]",
  },
}

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  icon,
  showTopAccent = true,
}) {
  const styles = VARIANTS[variant] || VARIANTS.default

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onCancel, loading])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Dismiss"
        disabled={loading}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message || children ? "confirm-dialog-desc" : undefined}
        className="page-glass relative z-10 w-full max-w-md animate-slide-down overflow-hidden rounded-2xl border border-white/65 shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
      >
        {showTopAccent && (
          <div
            className={`h-1 w-full ${
              variant === "danger"
                ? "bg-gradient-to-r from-red-600 via-red-500 to-rose-400"
                : "bg-gradient-to-r from-violet-600 via-violet-400 to-indigo-400"
            }`}
            aria-hidden
          />
        )}
        <div className="p-6 sm:p-7">
          <div className="flex gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner backdrop-blur-sm ${styles.iconBg}`}
              aria-hidden
            >
              {icon ?? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="confirm-dialog-title" className="text-lg font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              {message && (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{message}</p>
              )}
              {children ? <div id="confirm-dialog-desc">{children}</div> : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="page-glass-input rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-violet-200/70 disabled:opacity-50 sm:min-w-[7rem]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={styles.confirm}
            >
              {loading ? "Please wait…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
