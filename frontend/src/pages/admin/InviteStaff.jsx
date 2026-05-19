import { useState } from "react"
import AdminLayout from "../../components/admin/AdminLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import { inviteStaff } from "../../api/authApi"

export default function InviteStaff() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "RECRUITER"
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await inviteStaff(form)
      setSuccess(
        res.data.email_sent
          ? `Invitation email sent to ${form.email}`
          : res.data.message || "Invitation created"
      )
      setForm({ first_name: "", last_name: "", email: "", role: "RECRUITER" })
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send invitation")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.admin}
        title="Invite Staff"
        subtitle="Send an invitation to a Recruiter or Hiring Manager"
        maxWidth="max-w-2xl"
      />

      <div className="mx-auto w-full max-w-lg page-glass p-8">

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            ✅ {success}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Sara"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mansouri"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="sara@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="RECRUITER">Recruiter / HR</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">What happens next?</p>
            <p>
              An invitation email will be sent via SMTP (e.g. Mailtrap).
              The staff member clicks the link to set a password and activate their account.
              The link expires in 3 days.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 transition disabled:opacity-50"
          >
            {loading ? "Sending invitation..." : "Send Invitation"}
          </button>
        </form>
      </div>
    </AdminLayout>
  )
}