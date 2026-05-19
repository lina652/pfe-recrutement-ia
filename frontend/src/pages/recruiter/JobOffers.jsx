import { useEffect, useMemo, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import RequestMoreModal from "../../components/manager/RequestMoreModal"
import API from "../../api/authApi"
import { dashboardGlassClass } from "../../components/shared/DashboardOverviewKit"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"

const CONTRACT_COLORS = {
  CDI:        "bg-green-100 text-green-700",
  CDD:        "bg-blue-100 text-blue-700",
  INTERNSHIP: "bg-purple-100 text-purple-700",
  FREELANCE:  "bg-orange-100 text-orange-700",
}

export default function JobOffers() {
  const [editingJobId, setEditingJobId] = useState(null)
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [contractFilter, setContractFilter] = useState("ALL")
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenJob, setReopenJob] = useState(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    requirements: "",
    location: "",
    contract_type: "CDI",
    salary_range: "",
  })

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter === "ACTIVE") params.is_active = true
      if (statusFilter === "CLOSED") params.is_active = false

      const res = await API.get("/recruiter/jobs", { params })
      setJobs(res.data.jobs)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [search, statusFilter])

  const displayedJobs = useMemo(() => {
    if (contractFilter === "ALL") return jobs
    return jobs.filter((j) => j.contract_type === contractFilter)
  }, [jobs, contractFilter])

  const pillClass = (active) =>
    `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-green-700 text-white shadow-sm"
        : "page-glass-pill text-gray-700 hover:bg-white/55"
    }`

  const glassInputClass =
    "page-glass-input w-full rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200/50"

  // FIX 1: This is the unified function for both Create and Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.salary_range?.trim()) {
      setError("Salary range is required");
      return;
    }
    try {
      if (editingJobId) {
        // Only update salary when editing
        await API.put(`/recruiter/jobs/${editingJobId}/salary`, { salary_range: form.salary_range });
        setSuccess("Job salary updated successfully");
      } else {
        await API.post("/recruiter/jobs", form);
        setSuccess("Job offer created successfully");
      }
      
      setShowForm(false);
      setEditingJobId(null);
      setForm({ title: "", description: "", requirements: "", location: "", contract_type: "CDI", salary_range: "" });
      fetchJobs();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Action failed");
    }
  };

  const handleToggle = (job) => {
    if (job.is_active) {
      API.put(`/recruiter/jobs/${job.job_id}`, { is_active: false })
        .then(() => fetchJobs())
        .catch((err) => setError(err.response?.data?.detail || "Failed to close job"))
      return
    }
    setReopenJob(job)
    setReopenOpen(true)
  }

  const handleReopenSuccess = (data) => {
    const when = data?.closing_date ? new Date(data.closing_date).toLocaleString() : null
    setSuccess(when ? `Job reopened. Closes: ${when}` : "Job reopened successfully.")
    setReopenOpen(false)
    setReopenJob(null)
    fetchJobs()
    setTimeout(() => setSuccess(""), 5000)
  }

  const handleDelete = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job offer?")) return
    try {
      await API.delete(`/recruiter/jobs/${jobId}`)
      setSuccess("Job offer deleted")
      fetchJobs()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete")
    }
  }

  const handleEditClick = (job) => {
    setForm({
      title: job.title || "",
      description: job.description || "",
      requirements: job.requirements || "",
      location: job.location || "",
      contract_type: job.contract_type || "CDI",
      salary_range: job.salary_range || "",
    });
    setEditingJobId(job.job_id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll up to see the form
  };

  return (
    <RecruiterLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.recruiter}
        title="Job Offers"
        count={total}
        countLabel="jobs posted"
      >
        {/* Recruiters cannot create jobs directly - only via requirement approval */}
      </PageHeader>

      {success && <div className="mx-auto mb-3 max-w-6xl rounded-lg border border-green-200 bg-green-50 p-2.5 text-xs text-green-700">{success}</div>}
      {error && <div className="mx-auto mb-3 max-w-6xl rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

      <div className="mx-auto mb-5 flex max-w-6xl flex-col items-center gap-4">
        <input
          type="search"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="page-glass-input w-full max-w-md rounded-xl px-4 py-2.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-violet-200/50"
        />

        <div className="flex flex-wrap justify-center gap-2">
          {[
            { key: "ALL", label: "All" },
            { key: "ACTIVE", label: "Active" },
            { key: "CLOSED", label: "Closed" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={pillClass(statusFilter === key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {[
            { key: "ALL", label: "All contracts" },
            { key: "CDI", label: "CDI" },
            { key: "CDD", label: "CDD" },
            { key: "INTERNSHIP", label: "Internship" },
            { key: "FREELANCE", label: "Freelance" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setContractFilter(key)}
              className={pillClass(contractFilter === key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-600 border-t-transparent"/>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl">
          {displayedJobs.length === 0 ? (
            <div className={`${dashboardGlassClass} py-8 text-center text-sm text-gray-500`}>
              {jobs.length === 0
                ? "No job offers yet. Create your first one."
                : "No jobs match your filters."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {displayedJobs.map((job) => (
                <div key={job.job_id}>
                  {editingJobId === job.job_id && showForm ? (
                    // Inline Edit Form (Salary Only)
                    <div className={`flex h-full min-h-[11rem] flex-col !rounded-xl !p-5 !bg-amber-50 border-2 border-amber-300 ${dashboardGlassClass}`}>
                      <h3 className="text-base font-semibold text-gray-800 mb-3">{job.title}</h3>
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Salary Range</label>
                          <input
                            type="text"
                            value={form.salary_range}
                            onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                            placeholder="e.g. 50k-70k EUR"
                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-amber-200">
                        <button
                          onClick={() => {
                            setShowForm(false)
                            setEditingJobId(null)
                            setForm({ title: "", description: "", requirements: "", location: "", contract_type: "CDI", salary_range: "" })
                          }}
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmit}
                          className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal Job Card
                    <div
                      className={`flex h-full min-h-[11rem] flex-col !rounded-xl !p-5 ${dashboardGlassClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-semibold text-gray-800">{job.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {job.location || "Remote"} · {job.salary_range || "Salary not specified"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTRACT_COLORS[job.contract_type]}`}>
                            {job.contract_type}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${job.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {job.is_active ? "Active" : "Closed"}
                          </span>
                        </div>
                        {job.description && (
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">{job.description}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-400">
                          Posted {new Date(job.posted_date).toLocaleDateString()}
                          {job.closing_date && (
                            <> · Closes {new Date(job.closing_date).toLocaleString()}</>
                          )}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                        <button
                          onClick={() => handleEditClick(job)}
                          className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                        >
                          Edit Price
                        </button>
                        <button
                          onClick={() => handleToggle(job)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${job.is_active ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                        >
                          {job.is_active ? "Close" : "Reopen"}
                        </button>
                        <button
                          onClick={() => handleDelete(job.job_id)}
                          className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <RequestMoreModal
        open={reopenOpen}
        jobId={reopenJob?.job_id}
        jobTitle={reopenJob?.title}
        apiPrefix="/recruiter/jobs"
        apiSuffix="/reopen"
        onClose={() => {
          setReopenOpen(false)
          setReopenJob(null)
        }}
        onSuccess={handleReopenSuccess}
      />
    </RecruiterLayout>
  )
}