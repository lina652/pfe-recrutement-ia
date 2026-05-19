import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { setPasswordFromInvite } from "../../api/authApi"

export default function StaffActivate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("Invalid invitation link. Ask your administrator for a new invite.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const res = await setPasswordFromInvite({ token, password })
      setSuccess(res.data.message || "Account activated. You can now sign in.")
      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { prefilledEmail: res.data.email },
        })
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to activate account")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 px-4">
        <div className="page-glass max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Invalid link</h1>
          <p className="mt-2 text-sm text-slate-600">
            This invitation link is missing or invalid. Contact your administrator.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 rounded-xl bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 px-4">
      <div className="w-full max-w-md page-glass p-8">
        <div className="mb-6 text-center">
          <p
            className="cursor-pointer font-['Monotype_Corsiva','Apple_Chancery',cursive] text-2xl text-slate-800"
            onClick={() => navigate("/")}
          >
            Talent<span className="text-orange-500">Os</span>
          </p>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Activate your account</h1>
          <p className="mt-1 text-sm text-slate-500">Set a password to join your company workspace</p>
        </div>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="page-glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-200/50"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="page-glass-input w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-200/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full rounded-xl bg-violet-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50"
          >
            {loading ? "Activating…" : "Activate account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have a password?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="font-semibold text-violet-700 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
