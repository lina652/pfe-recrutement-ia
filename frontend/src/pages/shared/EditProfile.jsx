import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { updateProfile, getMe } from "../../api/authApi"
import { useLanguage } from "../../context/LanguageContext"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"

const inputClass =
  "page-glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-200/50 disabled:cursor-not-allowed disabled:opacity-70"

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

  const profileEyebrow =
    user?.role === "RECRUITER"
      ? PAGE_EYEBROWS.recruiter
      : user?.role === "HIRING_MANAGER"
        ? PAGE_EYEBROWS.manager
        : user?.role === "ADMINISTRATOR"
          ? PAGE_EYEBROWS.admin
          : user?.role === "SUPER_ADMIN"
            ? PAGE_EYEBROWS.superadmin
            : PAGE_EYEBROWS.candidate

  const content = (
    <div className="mx-auto max-w-xl">
      <PageHeader
        eyebrow={profileEyebrow}
        title={t.editProfile}
        subtitle={user?.email}
        maxWidth="max-w-xl"
      />

      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-sm font-medium text-emerald-800 backdrop-blur-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50/80 p-3 text-sm font-medium text-red-700 backdrop-blur-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="page-glass p-6 text-center sm:p-8">
          <p className="mb-5 text-sm font-semibold text-slate-700">{t.profilePhoto}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative mx-auto mb-5 flex h-[6.25rem] w-[6.25rem] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/70 bg-gradient-to-br from-violet-600 to-violet-400 shadow-lg ring-2 ring-white/50 transition hover:border-violet-300 hover:shadow-xl"
          >
            {preview ? (
              <img src={preview} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">{initials}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
              📷
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="page-glass-pill rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/55"
            >
              {t.changePhoto}
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="rounded-xl border border-red-200/70 bg-red-50/60 px-4 py-2 text-xs font-semibold text-red-600 backdrop-blur-sm transition hover:bg-red-50/80"
              >
                {t.removePhoto}
              </button>
            )}
          </div>
        </section>

        <section className="page-glass p-6 sm:p-8">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t.firstName}</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t.lastName}</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t.contactPhone}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t.phonePlaceholder}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t.emailAddress}</label>
            <input type="email" value={user?.email || ""} disabled className={inputClass} />
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg transition hover:from-violet-700 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? t.saving : t.saveChanges}
        </button>
      </form>
    </div>
  )

  return <Layout title={t.editProfile}>{content}</Layout>
}
