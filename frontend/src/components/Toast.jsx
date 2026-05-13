import { useState, useEffect } from "react"

const VARIANTS = {
  success: {
    bg: "linear-gradient(135deg, #059669, #10b981)",
    icon: "✅",
    border: "#34d399",
  },
  info: {
    bg: "linear-gradient(135deg, #7B5AC8, #9683EC)",
    icon: "💡",
    border: "#a78bfa",
  },
  error: {
    bg: "linear-gradient(135deg, #dc2626, #ef4444)",
    icon: "❌",
    border: "#f87171",
  },
  welcome: {
    bg: "linear-gradient(135deg, #7B5AC8, #9683EC)",
    icon: "👋",
    border: "#a78bfa",
  },
}

export default function Toast({ message, variant = "success", onClose, duration = 4500 }) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration - 500)
    const closeTimer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, duration)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(closeTimer)
    }
  }, [duration, onClose])

  if (!visible) return null

  const v = VARIANTS[variant] || VARIANTS.success

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 9999,
        animation: exiting
          ? "toast-fade-out 0.5s ease forwards"
          : "toast-slide-in 0.5s cubic-bezier(0.21, 1.02, 0.73, 1) forwards",
      }}
    >
      <div
        style={{
          background: v.bg,
          color: "white",
          borderRadius: 16,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
          border: `1px solid ${v.border}`,
          maxWidth: 420,
          minWidth: 280,
          backdropFilter: "blur(12px)",
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>{v.icon}</span>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
          {message}
        </p>
        <button
          onClick={() => {
            setExiting(true)
            setTimeout(() => { setVisible(false); onClose?.() }, 400)
          }}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "50%",
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
            marginLeft: 4,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
