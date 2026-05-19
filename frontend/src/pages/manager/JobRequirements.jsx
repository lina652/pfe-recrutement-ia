import { useEffect, useMemo, useState } from "react"
import ManagerLayout from "../../components/manager/ManagerLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import CheckboxChipGroup from "../../components/manager/CheckboxChipGroup"
import API from "../../api/authApi"
import {
  LOCATION_TYPES,
  EXPERIENCE_LEVELS,
  LANGUAGES,
  SOFT_SKILLS,
  CERTIFICATIONS,
  joinList,
} from "../../constants/managerJobOptions"
import {
  getMinClosingDatetimeLocal,
  isClosingOnOrAfterReference,
  closingDateErrorMessage,
  closingDateToApi,
} from "../../utils/closingDate"
import { formFieldClass } from "../../components/shared/FormField"

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
  location: "",
  location_type: "",
  contract_type: "CDI",
  department: "",
  experience_level: "",
  experience_years: "",
  education_level: "",
  languages: [],
  languages_other: "",
  soft_skills: [],
  soft_skills_other: "",
  certifications: [],
  certifications_other: "",
  closing_date: "",
}

export default function JobRequirements() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState(null)

  const patchForm = (partial) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(partial)) delete next[key]
      return next
    })
  }

  const fc = (key, extra = "") => formFieldClass(Boolean(fieldErrors[key]), extra)

  const FieldMsg = ({ name }) =>
    fieldErrors[name] ? (
      <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600" role="alert" data-field-error>
        <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
        {fieldErrors[name]}
      </p>
    ) : null

  const validateForm = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = "Job title is required"
    if (!form.requirements.trim()) errs.requirements = "Requirements are required"
    if (!form.closing_date) errs.closing_date = "Closing date and time are required"
    else if (!isClosingOnOrAfterReference(form.closing_date)) {
      errs.closing_date = closingDateErrorMessage()
    }
    if (!form.location_type) errs.location_type = "Please select a location type"
    if (!form.experience_level) errs.experience_level = "Please select an experience level"
    if (form.experience_years !== "" && Number(form.experience_years) < 0) {
      errs.experience_years = "Experience years must be 0 or greater"
    }
    if (form.languages.includes("OTHER") && !form.languages_other.trim()) {
      errs.languages_other = "Please specify other languages"
    }
    if (form.soft_skills.includes("OTHER") && !form.soft_skills_other.trim()) {
      errs.soft_skills_other = "Please specify other soft skills"
    }
    if (form.certifications.includes("OTHER") && !form.certifications_other.trim()) {
      errs.certifications_other = "Please specify other certifications"
    }
    return errs
  }

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

  const startEditingRequest = (req) => {
    setForm({
      title: req.title,
      description: req.description || "",
      requirements: req.requirements,
      required_skills: req.required_skills || "",
      location: req.location || "",
      location_type: req.location_type,
      contract_type: req.contract_type || "CDI",
      department: req.department || "",
      experience_level: req.experience_level,
      experience_years: req.experience_years || "",
      education_level: req.education_level || "",
      languages: req.languages_required ? req.languages_required.split(",").map(l => l.trim()).filter(Boolean) : [],
      languages_other: req.languages_other || "",
      soft_skills: req.soft_skills ? req.soft_skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      soft_skills_other: req.soft_skills_other || "",
      certifications: req.certifications ? req.certifications.split(",").map(c => c.trim()).filter(Boolean) : [],
      certifications_other: req.certifications_other || "",
      closing_date: req.closing_date ? new Date(req.closing_date).toISOString().slice(0, 16) : "",
    })
    setEditingId(req.request_id)
    setFieldErrors({})
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setForm(initialForm)
    setFieldErrors({})
  }

  const handleSubmit = async () => {
    setError("")
    const errs = validateForm()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setError("Please complete the highlighted fields before submitting.")
      const first = document.querySelector("[data-field-error]")
      first?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    
    if (!editingId && hasPending) {
      setError("You already have a pending request. Wait for HR review first.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        requirements: form.requirements.trim(),
        required_skills: form.required_skills.trim() || null,
        location: form.location.trim() || null,
        location_type: form.location_type,
        experience_level: form.experience_level,
        experience_years: form.experience_years ? parseInt(form.experience_years, 10) : null,
        education_level: form.education_level || null,
        languages_required: joinList(form.languages),
        languages_other: form.languages.includes("OTHER") ? form.languages_other.trim() : null,
        soft_skills: joinList(form.soft_skills),
        soft_skills_other: form.soft_skills.includes("OTHER") ? form.soft_skills_other.trim() : null,
        certifications: joinList(form.certifications),
        certifications_other: form.certifications.includes("OTHER")
          ? form.certifications_other.trim()
          : null,
        contract_type: form.contract_type || "CDI",
        department: form.department.trim() || null,
        closing_date: closingDateToApi(form.closing_date),
      }

      if (editingId) {
        // Edit existing requirement
        await API.put(`/manager/requirement-requests/${editingId}`, payload)
        setSuccess("Requirements updated successfully.")
      } else {
        // Create new requirement
        await API.post("/manager/submit-requirements", payload)
        setSuccess("Requirements sent to HR for approval.")
      }

      setForm(initialForm)
      setEditingId(null)
      setFieldErrors({})
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
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          {editingId ? "Edit Requirement Request" : "New Requirement Request"}
        </h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <section className="page-glass flex flex-col p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-violet-900/80">
              Job details
            </h3>
            <p className="mb-4 text-xs text-slate-500">Role title, location, and contract information.</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className={`mb-1 block text-sm font-medium ${fieldErrors.title ? "text-red-700" : "text-gray-700"}`}>
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => patchForm({ title: e.target.value })}
                  className={fc("title")}
                  aria-invalid={fieldErrors.title ? "true" : undefined}
                  placeholder="Senior Backend Engineer"
                />
                <FieldMsg name="title" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                <input
                  id="job-offer-location"
                  name="job-offer-location"
                  type="text"
                  value={form.location}
                  onChange={(e) => patchForm({ location: e.target.value })}
                  className={formFieldClass(false)}
                  placeholder="Tunis, Tunisia"
                  autoComplete="off"
                  data-lpignore="true"
                />
              </div>
              <div>
                <label className={`mb-1 block text-sm font-medium ${fieldErrors.location_type ? "text-red-700" : "text-gray-700"}`}>
                  Location Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.location_type}
                  onChange={(e) => patchForm({ location_type: e.target.value })}
                  className={fc("location_type")}
                  aria-invalid={fieldErrors.location_type ? "true" : undefined}
                >
                  <option value="">Select…</option>
                  {LOCATION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <FieldMsg name="location_type" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                <input
                  value={form.department}
                  onChange={(e) => patchForm({ department: e.target.value })}
                  className={formFieldClass(false)}
                  placeholder="Engineering"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Contract Type</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => patchForm({ contract_type: e.target.value })}
                  className={formFieldClass(false)}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  className={formFieldClass(false, "min-h-[6.5rem] resize-y")}
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
            <div className="flex flex-col gap-5">
              <div>
                <label className={`mb-1 block text-sm font-medium ${fieldErrors.requirements ? "text-red-700" : "text-gray-700"}`}>
                  Requirements <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.requirements}
                  onChange={(e) => patchForm({ requirements: e.target.value })}
                  className={fc("requirements", "min-h-[5rem] resize-y")}
                  placeholder="Must-have qualifications..."
                  aria-invalid={fieldErrors.requirements ? "true" : undefined}
                />
                <FieldMsg name="requirements" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-sm font-medium ${fieldErrors.experience_level ? "text-red-700" : "text-gray-700"}`}>
                    Experience Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.experience_level}
                    onChange={(e) => patchForm({ experience_level: e.target.value })}
                    className={fc("experience_level")}
                    aria-invalid={fieldErrors.experience_level ? "true" : undefined}
                  >
                    <option value="">Select…</option>
                    {EXPERIENCE_LEVELS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <FieldMsg name="experience_level" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Experience (years)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.experience_years}
                    onChange={(e) => patchForm({ experience_years: e.target.value })}
                    className={fc("experience_years")}
                    placeholder="e.g. 3"
                    aria-invalid={fieldErrors.experience_years ? "true" : undefined}
                  />
                  <FieldMsg name="experience_years" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Required Skills</label>
                <input
                  value={form.required_skills}
                  onChange={(e) => patchForm({ required_skills: e.target.value })}
                  className={formFieldClass(false)}
                  placeholder="Python, SQL, React"
                />
              </div>

              <CheckboxChipGroup
                label="Languages Required"
                options={LANGUAGES}
                selected={form.languages}
                onChange={(languages) => patchForm({ languages })}
                otherSelected={form.languages.includes("OTHER")}
                otherValue={form.languages_other}
                onOtherChange={(languages_other) => patchForm({ languages_other })}
                otherPlaceholder="e.g. German, Spanish, Italian…"
                otherError={fieldErrors.languages_other}
              />

              <CheckboxChipGroup
                label="Soft Skills"
                options={SOFT_SKILLS}
                selected={form.soft_skills}
                onChange={(soft_skills) => patchForm({ soft_skills })}
                otherSelected={form.soft_skills.includes("OTHER")}
                otherValue={form.soft_skills_other}
                onOtherChange={(soft_skills_other) => patchForm({ soft_skills_other })}
                otherPlaceholder="e.g. Mentoring, Public speaking…"
                otherError={fieldErrors.soft_skills_other}
              />

              <CheckboxChipGroup
                label="Certifications"
                options={CERTIFICATIONS}
                selected={form.certifications}
                onChange={(certifications) => patchForm({ certifications })}
                otherSelected={form.certifications.includes("OTHER")}
                otherValue={form.certifications_other}
                onOtherChange={(certifications_other) => patchForm({ certifications_other })}
                otherPlaceholder="e.g. Kubernetes CKA, TOGAF…"
                otherError={fieldErrors.certifications_other}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Education Level</label>
                <select
                  value={form.education_level}
                  onChange={(e) => patchForm({ education_level: e.target.value })}
                  className={formFieldClass(false)}
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
                <label className={`mb-1 block text-sm font-medium ${fieldErrors.closing_date ? "text-red-700" : "text-gray-700"}`}>
                  Closing date & time <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    (may be the same day and time as now)
                  </span>
                </label>
                <input
                  type="datetime-local"
                  value={form.closing_date}
                  min={getMinClosingDatetimeLocal()}
                  onChange={(e) => patchForm({ closing_date: e.target.value })}
                  className={fc("closing_date")}
                  aria-invalid={fieldErrors.closing_date ? "true" : undefined}
                />
                <FieldMsg name="closing_date" />
                <p className="mt-1 text-xs text-gray-500">
                  The job closes at this time, is removed from listings, and top candidates are shortlisted.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-white/40 pt-4 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || (!editingId && hasPending)}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
                  submitting || (!editingId && hasPending)
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-purple-700 text-white shadow-sm hover:bg-purple-800"
                }`}
              >
                {submitting ? "Saving..." : editingId ? "Update Requirement" : hasPending ? "Awaiting HR Review" : "Send to HR"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={submitting}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold transition border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              )}
              <p className="text-xs text-gray-500">
                {editingId
                  ? "Update the requirement details before sending to HR."
                  : hasPending
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
                    <div className="flex-1">
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
                  {r.status === "PENDING" && (
                    <div className="mt-3 flex gap-2 border-t border-white/40 pt-3">
                      <button
                        type="button"
                        onClick={() => startEditingRequest(r)}
                        className="text-xs font-semibold text-purple-700 hover:text-purple-800 hover:underline"
                      >
                        ✎ Edit
                      </button>
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
