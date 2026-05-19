import { useState, useEffect } from "react"

const VARIANTS = {
  success: {
    icon: "✓",
    bgColor: "rgba(34, 197, 94, 0.15)",
    textColor: "#16a34a",
    border: "rgba(34, 197, 94, 0.3)",
  },
  info: {
    icon: "ℹ",
    bgColor: "rgba(59, 130, 246, 0.15)",
    textColor: "#1e40af",
    border: "rgba(59, 130, 246, 0.3)",
  },
  error: {
    icon: "✕",
    bgColor: "rgba(239, 68, 68, 0.15)",
    textColor: "#b91c1c",
    border: "rgba(239, 68, 68, 0.3)",
  },
  accountCreated: {
    icon: "✓",
    bgColor: "rgba(168, 85, 247, 0.15)",
    textColor: "#7c3aed",
    border: "rgba(168, 85, 247, 0.3)",
  },
}

export default function Toast({ message, variant = "success", onClose, duration = 3500 }) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration - 300)
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
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        animation: exiting
          ? "toast-fade-out 0.3s ease forwards"
          : "toast-slide-down 0.4s ease forwards",
      }}
    >
      <div
        style={{
          background: v.bgColor,
          color: v.textColor,
          borderRadius: 8,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
          border: `1px solid ${v.border}`,
          backdropFilter: "blur(10px)",
          maxWidth: 500,
          minWidth: 300,
        }}
      >
        <span style={{ 
          fontSize: 18, 
          flexShrink: 0,
          fontWeight: "bold",
        }}>
          {v.icon}
        </span>
        <p style={{ 
          margin: 0, 
          fontSize: 13, 
          fontWeight: 500, 
          lineHeight: 1.5,
        }}>
          {message}
        </p>
        <button
          onClick={() => {
            setExiting(true)
            setTimeout(() => { setVisible(false); onClose?.() }, 300)
          }}
          style={{
            background: "transparent",
            border: "none",
            color: v.textColor,
            cursor: "pointer",
            fontSize: 18,
            fontWeight: 600,
            flexShrink: 0,
            marginLeft: 8,
            opacity: 0.6,
            transition: "opacity 0.2s",
            padding: 0,
          }}
          onMouseEnter={(e) => e.target.style.opacity = "1"}
          onMouseLeave={(e) => e.target.style.opacity = "0.6"}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
