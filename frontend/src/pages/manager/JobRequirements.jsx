import { useEffect, useMemo, useState } from "react"
import ManagerLayout from "../../components/manager/ManagerLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
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
  date.setDate(date.getDate() + 7)
  return date.toISOString().split("T")[0]
}

const fieldClass =
  "page-glass-input w-full rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200/50"

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
      <PageHeader
        eyebrow={PAGE_EYEBROWS.manager}
        title="Job Requirements"
        subtitle="Create a job request, then HR will approve or reject it."
      />

      {success && (
        <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <div className="mx-auto mb-6 max-w-6xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">New Requirement Request</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
          <section className="page-glass flex flex-col p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-violet-900/80">
              Job details
            </h3>
            <p className="mb-4 text-xs text-slate-500">Role title, location, and contract information.</p>
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={fieldClass}
                  placeholder="Senior Backend Engineer"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={fieldClass}
                  placeholder="Tunis / Remote"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className={fieldClass}
                  placeholder="Engineering"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Contract Type</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  className={fieldClass}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${fieldClass} min-h-[6.5rem] resize-y`}
                  placeholder="Role summary and responsibilities..."
                />
              </div>
            </div>
          </section>

          <section className="page-glass flex flex-col p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-violet-900/80">
              Requirements & timeline
            </h3>
            <p className="mb-4 text-xs text-slate-500">Skills, qualifications, and closing date for HR review.</p>
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Requirements *</label>
                <textarea
                  rows={4}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  className={`${fieldClass} min-h-[6.5rem] resize-y`}
                  placeholder="Must-have qualifications..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Required Skills</label>
                  <input
                    value={form.required_skills}
                    onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
                    className={fieldClass}
                    placeholder="Python, SQL, React"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Experience (years)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.experience_years}
                    onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                    className={fieldClass}
                    placeholder="3"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Education Level</label>
                <select
                  value={form.education_level}
                  onChange={(e) => setForm({ ...form, education_level: e.target.value })}
                  className={fieldClass}
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Closing Date *
                  <span className="ml-2 text-xs font-normal text-gray-500">(Job closes on this date)</span>
                </label>
                <input
                  type="date"
                  value={form.closing_date}
                  min={getMinClosingDate()}
                  onChange={(e) => setForm({ ...form, closing_date: e.target.value })}
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-gray-500">
                  On this date, the job is removed from listings and top candidates are shortlisted for interviews.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-white/40 pt-4 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || hasPending}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
                  submitting || hasPending
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-purple-700 text-white shadow-sm hover:bg-purple-800"
                }`}
              >
                {hasPending ? "Awaiting HR Review" : "Send to HR"}
              </button>
              <p className="text-xs text-gray-500">
                {hasPending
                  ? "You can submit another request after HR reviews the current one."
                  : "HR will approve or reject this request."}
              </p>
            </div>
          </section>
        </div>
      </div>

      <div className="page-glass mx-auto max-w-6xl p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">My Request History</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-400">No requests submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const status = STATUS_STYLES[r.status] || STATUS_STYLES.PENDING
              return (
                <div key={r.request_id} className="page-glass-inset rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{r.title}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{r.requirements}</p>
                  {r.status === "REJECTED" && r.rejection_reason && (
                    <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
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
