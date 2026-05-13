import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { updateProfile, getMe } from "../../api/authApi"
import { useLanguage } from "../../context/LanguageContext"

export default function EditProfile({ Layout }) {
  const { user, login } = useAuth()
  const { t } = useLanguage()
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  })
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
      })
      if (user.avatar_url) setPreview(user.avatar_url)
    }
  }, [user])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatar(reader.result)
      setPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setAvatar("")
    setPreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const payload = { ...form }
      if (avatar !== null) payload.avatar_url = avatar
      await updateProfile(payload)
      const meRes = await getMe()
      const tokens = {
        access_token: localStorage.getItem("access_token"),
        refresh_token: localStorage.getItem("refresh_token"),
      }
      login(tokens, meRes.data)
      setSuccess(t.profileUpdated)
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || "Update failed")
    } finally {
      setLoading(false)
    }
  }

  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`

  const content = (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937" }}>{t.editProfile}</h1>
        <p style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
          {t.editProfile}
        </p>
      </div>

      {success && (
        <div style={{
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          color: "#16a34a", fontSize: 13
        }}>{success}</div>
      )}
      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          color: "#ef4444", fontSize: 13
        }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Avatar */}
        <div style={{
          background: "white", borderRadius: 16, border: "1px solid #e5e7eb",
          padding: 24, marginBottom: 20, textAlign: "center"
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 16 }}>
            {t.profilePhoto}
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 100, height: 100, borderRadius: "50%",
              margin: "0 auto 16px auto", cursor: "pointer",
              overflow: "hidden", position: "relative",
              background: preview ? "transparent" : "linear-gradient(135deg, #7B5AC8, #9683EC)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "3px solid #e5e7eb",
              transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "#7B5AC8"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
          >
            {preview ? (
              <img src={preview} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "white", fontSize: 32, fontWeight: 700 }}>{initials}</span>
            )}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.5)", color: "white",
              fontSize: 10, padding: "4px 0", textAlign: "center"
            }}>📷</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                background: "#f3f4f6", color: "#374151", border: "none",
                padding: "6px 16px", borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: "pointer"
              }}
            >{t.changePhoto}</button>
            {preview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                style={{
                  background: "#fef2f2", color: "#ef4444", border: "none",
                  padding: "6px 16px", borderRadius: 8, fontSize: 12,
                  fontWeight: 600, cursor: "pointer"
                }}
              >{t.removePhoto}</button>
            )}
          </div>
        </div>

        {/* Fields */}
        <div style={{
          background: "white", borderRadius: 16, border: "1px solid #e5e7eb",
          padding: 24, marginBottom: 20
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                {t.firstName}
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                style={{
                  width: "100%", border: "2px solid #e5e7eb", borderRadius: 10,
                  padding: "11px 16px", fontSize: 13, color: "#1f2937",
                  outline: "none", boxSizing: "border-box", background: "#f9fafb"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #7B5AC8"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                {t.lastName}
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                style={{
                  width: "100%", border: "2px solid #e5e7eb", borderRadius: 10,
                  padding: "11px 16px", fontSize: 13, color: "#1f2937",
                  outline: "none", boxSizing: "border-box", background: "#f9fafb"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #7B5AC8"}
                onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              {t.contactPhone}
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t.phonePlaceholder}
              style={{
                width: "100%", border: "2px solid #e5e7eb", borderRadius: 10,
                padding: "11px 16px", fontSize: 13, color: "#1f2937",
                outline: "none", boxSizing: "border-box", background: "#f9fafb"
              }}
              onFocus={(e) => e.target.style.border = "2px solid #7B5AC8"}
              onBlur={(e) => e.target.style.border = "2px solid #e5e7eb"}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              {t.emailAddress}
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              style={{
                width: "100%", border: "2px solid #e5e7eb", borderRadius: 10,
                padding: "11px 16px", fontSize: 13, color: "#9ca3af",
                outline: "none", boxSizing: "border-box", background: "#f3f4f6",
                cursor: "not-allowed"
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #7B5AC8, #9683EC)",
            color: "white", border: "none", borderRadius: 10,
            padding: 14, fontSize: 14, fontWeight: 700,
            letterSpacing: 1, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.3s ease"
          }}
        >
          {loading ? t.saving : t.saveChanges}
        </button>
      </form>
    </div>
  )

  return <Layout>{content}</Layout>
}
