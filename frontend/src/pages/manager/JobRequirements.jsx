import { useEffect, useMemo, useState } from "react"
import ManagerLayout from "../../components/manager/ManagerLayout"
import API from "../../api/authApi"

const STATUS_STYLES = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-700", label: "⏳ Pending HR Review" },
  ACCEPTED: { bg: "bg-green-100", text: "text-green-700", label: "✅ Approved" },
  REJECTED: { bg: "bg-red-100", text: "text-red-700", label: "❌ Rejected" },
}

const initialForm = {
  title: "",
  description: "",
  requirements: "",
  required_skills: "",
  experience_years: "",
  education_level: "",
  location: "",
  contract_type: "CDI",
  department: "",
  closing_date: "",
}

const getMinClosingDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7) // Minimum 7 days from now
  return date.toISOString().split('T')[0]
}

export default function JobRequirements() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const fetchRequests = async () => {
    try {
      const res = await API.get("/manager/requirement-requests")
      setRequests(res.data.requests)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const hasPending = useMemo(
    () => requests.some((r) => r.status === "PENDING"),
    [requests]
  )

  const handleSubmit = async () => {
    setError("")
    if (!form.title.trim() || !form.requirements.trim()) {
      setError("Title and requirements are required")
      return
    }
    if (!form.closing_date) {
      setError("Closing date is required")
      return
    }
    if (form.experience_years !== "" && Number(form.experience_years) < 0) {
      setError("Experience years must be 0 or greater")
      return
    }
    if (hasPending) {
      setError("You already have a pending request. Wait for HR review first.")
      return
    }

    setSubmitting(true)
    try {
      await API.post("/manager/submit-requirements", {
        title: form.title.trim(),
        description: form.description.trim() || null,
        requirements: form.requirements.trim(),
        required_skills: form.required_skills.trim() || null,
        experience_years: form.experience_years ? parseInt(form.experience_years, 10) : null,
        education_level: form.education_level || null,
        location: form.location.trim() || null,
        contract_type: form.contract_type || "CDI",
        department: form.department.trim() || null,
        closing_date: form.closing_date,
      })
      setForm(initialForm)
      setSuccess("Requirements sent to HR for approval.")
      await fetchRequests()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit requirements")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ManagerLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Job Requirements</h1>
        <p className="text-gray-500 mt-1">Create a job request, then HR will approve or reject it.</p>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">New Requirement Request</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Senior Backend Engineer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Tunis / Remote"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Engineering"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
            <select
              value={form.contract_type}
              onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="FREELANCE">Freelance</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Role summary and responsibilities..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirements *</label>
            <textarea
              rows={4}
              value={form.requirements}
              onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Must-have qualifications..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Skills</label>
            <input
              value={form.required_skills}
              onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Python, SQL, React"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
            <input
              type="number"
              min="0"
              value={form.experience_years}
              onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
            <select
              value={form.education_level}
              onChange={(e) => setForm({ ...form, education_level: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select level</option>
              <option value="BAC">BAC</option>
              <option value="BAC+2">BAC+2</option>
              <option value="BAC+3">BAC+3</option>
              <option value="BAC+5">BAC+5</option>
              <option value="PHD">PHD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Closing Date *
              <span className="text-xs text-gray-500 ml-2">(Job will close on this date)</span>
            </label>
            <input
              type="date"
              value={form.closing_date}
              min={getMinClosingDate()}
              onChange={(e) => setForm({ ...form, closing_date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              On this date, the job will be removed from listings and top 10 candidates will be selected for interviews.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || hasPending}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
              submitting || hasPending
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-purple-700 text-white hover:bg-purple-800"
            }`}
          >
            {hasPending ? "Awaiting HR Review" : "Send to HR"}
          </button>
          <p className="text-xs text-gray-400">
            {hasPending
              ? "You can submit another request after HR reviews the current one."
              : "HR will approve or reject this request."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">My Request History</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-400">No requests submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const status = STATUS_STYLES[r.status] || STATUS_STYLES.PENDING
              return (
                <div key={r.request_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{r.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{r.requirements}</p>
                  {r.status === "REJECTED" && r.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      Rejection reason: {r.rejection_reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  )
}
