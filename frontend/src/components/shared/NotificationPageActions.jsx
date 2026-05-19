import { useState } from "react"

const ACCENT = {
  emerald: {
    primary: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 focus:ring-emerald-400/50",
    ring: "ring-emerald-200/60",
    dot: "bg-emerald-500",
  },
  violet: {
    primary: "bg-violet-600 hover:bg-violet-700 shadow-violet-600/20 focus:ring-violet-400/50",
    ring: "ring-violet-200/60",
    dot: "bg-violet-500",
  },
  blue: {
    primary: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 focus:ring-blue-400/50",
    ring: "ring-blue-200/60",
    dot: "bg-blue-500",
  },
}

function IconCheck() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

/**
 * Header actions for notification list pages (mark all read + clear all).
 */
export default function NotificationPageActions({
  unreadCount = 0,
  totalCount = 0,
  onMarkAllRead,
  onClearAll,
  clearing = false,
  accent = "emerald",
}) {
  const [confirmClear, setConfirmClear] = useState(false)
  const theme = ACCENT[accent] ?? ACCENT.emerald

  if (totalCount === 0) return null

  const handleClearClick = () => {
    if (clearing) return
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setConfirmClear(false)
    onClearAll()
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div
        className="flex flex-wrap items-center justify-end gap-2"
        role="toolbar"
        aria-label="Notification actions"
      >
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={clearing}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${theme.primary}`}
          >
            <IconCheck />
            Mark all read
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold tabular-nums">
              {unreadCount}
            </span>
          </button>
        )}

        {!confirmClear ? (
          <button
            type="button"
            onClick={handleClearClick}
            disabled={clearing}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white/50 px-4 py-2.5 text-sm font-semibold text-rose-800 shadow-sm transition hover:border-rose-300 hover:from-rose-100/90 hover:to-white/70 focus:outline-none focus:ring-2 focus:ring-rose-300/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clearing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
                Clearing…
              </>
            ) : (
              <>
                <IconTrash />
                Clear all
              </>
            )}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-rose-200/90 bg-rose-50/80 px-2 py-1.5">
            <span className="px-2 text-xs font-semibold text-rose-900">Delete all?</span>
            <button
              type="button"
              onClick={handleClearClick}
              disabled={clearing}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
            >
              Yes, clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              disabled={clearing}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white/70 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] font-medium text-slate-500 sm:text-right">
        {totalCount} notification{totalCount !== 1 ? "s" : ""}
        {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
      </p>
    </div>
  )
}
