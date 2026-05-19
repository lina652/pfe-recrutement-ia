import { useEffect, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import RequirementAcceptDialogs from "../../components/recruiter/RequirementAcceptDialogs"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import API from "../../api/authApi"

const STATUS_BADGE = {
  PENDING:  { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
  ACCEPTED: { bg: "bg-green-100",  text: "text-green-700",  label: "Accepted" },
  REJECTED: { bg: "bg-red-100",    text: "text-red-700",    label: "Rejected" },
}

export default function RequirementRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("ALL")
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [editingSalaryId, setEditingSalaryId] = useState(null)
  const [editingSalaryValue, setEditingSalaryValue] = useState("")
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState(null)
  const [acceptStep, setAcceptStep] = useState(null)
  const [acceptSubmitting, setAcceptSubmitting] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const fetchRequests = async () => {
    try {
      const params = filter !== "ALL" ? { status: filter } : {}
      const res = await API.get("/recruiter/requirement-requests", { params })
      setRequests(res.data.requests)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [filter])

  const openAcceptFlow = (req) => {
    setError("")
    setAcceptTarget(req)
    setAcceptStep("confirm")
  }

  const closeAcceptFlow = () => {
    if (acceptSubmitting) return
    setAcceptTarget(null)
    setAcceptStep(null)
  }

  const handleAcceptSubmit = async (salaryRange) => {
    if (!acceptTarget) return
    setError("")
    setAcceptSubmitting(true)
    try {
      await API.put(`/recruiter/requirement-requests/${acceptTarget.request_id}/accept`, {
        salary_range: salaryRange || null,
      })
      const salaryNote = salaryRange
        ? ` Salary: ${salaryRange}.`
        : ""
      setSuccess(`Requirements approved and job offer created.${salaryNote}`)
      setAcceptTarget(null)
      setAcceptStep(null)
      window.dispatchEvent(new Event("recruiter-requests-updated"))
      fetchRequests()
      setTimeout(() => setSuccess(""), 5000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to accept")
    } finally {
      setAcceptSubmitting(false)
    }
  }

  const handleReject = async (requestId) => {
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejection")
      return
    }
    setError("")
    try {
      await API.put(`/recruiter/requirement-requests/${requestId}/reject`, {
        reason: rejectReason
      })
      setSuccess("Requirements rejected. The manager has been notified.")
      setRejectingId(null)
      setRejectReason("")
      window.dispatchEvent(new Event("recruiter-requests-updated"))
      fetchRequests()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reject")
    }
  }

  const startEditingSalary = (req) => {
    setEditingSalaryId(req.request_id)
    setEditingSalaryValue(req.salary_range || "")
    setError("")
  }

  const cancelEditingSalary = () => {
    setEditingSalaryId(null)
    setEditingSalaryValue("")
  }

  const handleEditSalary = async () => {
    const salary = editingSalaryValue.trim()
    if (!salary) {
      setError("Salary range cannot be empty")
      return
    }

    setError("")
    setEditingSubmitting(true)
    try {
      await API.put(`/recruiter/requirement-requests/${editingSalaryId}/salary`, {
        salary_range: salary
      })
      setSuccess("Salary range updated successfully.")
      setEditingSalaryId(null)
      setEditingSalaryValue("")
      window.dispatchEvent(new Event("recruiter-requests-updated"))
      fetchRequests()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update salary")
    } finally {
      setEditingSubmitting(false)
    }
  }

  return (
    <RecruiterLayout>
      <RequirementAcceptDialogs
        target={acceptTarget}
        step={acceptStep}
        submitting={acceptSubmitting}
        onClose={closeAcceptFlow}
        onConfirmApproval={() => setAcceptStep("salary")}
        onSubmitSalary={handleAcceptSubmit}
      />

      <PageHeader
        eyebrow={PAGE_EYEBROWS.recruiter}
        title="Requirement Requests"
        subtitle="Review manager requests and create jobs after approval"
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {["ALL", "PENDING", "ACCEPTED", "REJECTED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f
                ? "bg-green-700 text-white"
                : "page-glass-pill text-gray-600 hover:bg-white/55"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
          <span className="text-lg">✅</span> {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <span className="text-lg">⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="page-glass p-16 text-center">
          <p className="text-4xl mb-3">📨</p>
          <p className="text-gray-400 text-sm">No requirement requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const badge = STATUS_BADGE[req.status] || STATUS_BADGE.PENDING
            const isPending = req.status === "PENDING"
            const isRejecting = rejectingId === req.request_id

            return (
              <div key={req.request_id} className="page-glass p-5 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{req.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Submitted by <span className="font-medium text-gray-700">{req.submitter_name}</span>
                      {" · "}
                      {new Date(req.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Requirements details */}
                  <div className="page-glass-inset rounded-2xl p-4 mb-3">
                    {req.description && (
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">Description:</span> {req.description}
                      </p>
                    )}
                    <p className="text-sm font-medium text-gray-700 mb-2">📋 Requirements</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{req.requirements}</p>

                  <div className="flex flex-wrap gap-3 mt-3">
                    {req.required_skills && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                        🔧 {req.required_skills}
                      </span>
                    )}
                    {req.location_type && (
                      <span className="text-xs bg-violet-50 text-violet-700 px-3 py-1 rounded-full">
                        🏠 {req.location_type.replace("_", " ")}
                      </span>
                    )}
                    {req.experience_level && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                        📊 {req.experience_level.replace("_", "-")}
                        {req.experience_years ? ` · ${req.experience_years} yrs` : ""}
                      </span>
                    )}
                    {!req.experience_level && req.experience_years && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                        📅 {req.experience_years} years experience
                      </span>
                    )}
                    {req.languages_required && (
                      <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full">
                        🌐 {req.languages_required}
                        {req.languages_other ? ` (${req.languages_other})` : ""}
                      </span>
                    )}
                    {req.soft_skills && (
                      <span className="text-xs bg-pink-50 text-pink-800 px-3 py-1 rounded-full">
                        💡 {req.soft_skills}
                        {req.soft_skills_other ? ` · ${req.soft_skills_other}` : ""}
                      </span>
                    )}
                    {req.certifications && (
                      <span className="text-xs bg-cyan-50 text-cyan-800 px-3 py-1 rounded-full">
                        🏅 {req.certifications}
                        {req.certifications_other ? ` · ${req.certifications_other}` : ""}
                      </span>
                    )}
                    {req.education_level && (
                      <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full">
                        🎓 {req.education_level}
                      </span>
                    )}
                    {req.location && (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                        📍 {req.location}
                      </span>
                    )}
                    {req.contract_type && (
                      <span className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full">
                        📄 {req.contract_type}
                      </span>
                    )}
                    {req.department && (
                      <span className="text-xs bg-teal-50 text-teal-700 px-3 py-1 rounded-full">
                        🏢 {req.department}
                      </span>
                    )}
                    {req.salary_range && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                        💰 {req.salary_range}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rejection reason (if rejected) */}
                {req.status === "REJECTED" && req.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                    <p className="text-sm font-semibold text-red-700">Rejection Reason:</p>
                    <p className="text-sm text-red-600 mt-1">{req.rejection_reason}</p>
                  </div>
                )}

                {/* Show edit form if this request is being edited */}
                {editingSalaryId === req.request_id && (
                  <div className="pt-3 border-t border-gray-100 space-y-3 bg-amber-50 p-3 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-amber-700 mb-1">
                        Salary Range <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingSalaryValue}
                        onChange={(e) => setEditingSalaryValue(e.target.value)}
                        className="w-full border border-amber-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="e.g. 50k-70k USD"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleEditSalary}
                        disabled={editingSubmitting}
                        className="bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50"
                      >
                        {editingSubmitting ? "Saving..." : "Save Price"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingSalary}
                        disabled={editingSubmitting}
                        className="bg-gray-100 text-gray-600 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Show rejection form if this request is being rejected */}
                {isRejecting && editingSalaryId !== req.request_id && (
                  <div className="pt-3 border-t border-gray-100 space-y-3 bg-red-50 p-3 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">
                        Rejection Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full border border-red-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Explain why these requirements are being rejected..."
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(req.request_id)}
                        className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason(""); setError("") }}
                        className="bg-gray-100 text-gray-600 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons (only show when not editing or rejecting) */}
                {isPending && editingSalaryId !== req.request_id && isRejecting !== true && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => startEditingSalary(req)}
                      className="bg-amber-50 text-amber-600 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-amber-100 transition flex items-center gap-2"
                    >
                      <span>💰</span> Edit Price
                    </button>
                    <button
                      type="button"
                      onClick={() => openAcceptFlow(req)}
                      className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <span>✅</span> Approve & Create Job
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectingId(req.request_id); setRejectReason(""); setError("") }}
                      className="bg-red-50 text-red-600 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition flex items-center gap-2"
                    >
                      <span>❌</span> Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </RecruiterLayout>
  )
}
