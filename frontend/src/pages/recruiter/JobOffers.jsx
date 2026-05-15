import { useEffect, useMemo, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
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
    try {
      if (editingJobId) {
        await API.put(`/recruiter/jobs/${editingJobId}`, form);
        setSuccess("Job offer updated successfully");
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

  const handleToggle = async (jobId, isActive) => {
    try {
      await API.put(`/recruiter/jobs/${jobId}`, { is_active: !isActive })
      fetchJobs()
    } catch (err) {
      console.error(err)
    }
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
        <button
          type="button"
          onClick={() => {
            if (showForm) setEditingJobId(null)
            setShowForm(!showForm)
          }}
          className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800"
        >
          {showForm ? "Cancel" : "+ New Job Offer"}
        </button>
      </PageHeader>

      {success && <div className="mx-auto mb-3 max-w-6xl rounded-lg border border-green-200 bg-green-50 p-2.5 text-xs text-green-700">{success}</div>}
      {error && <div className="mx-auto mb-3 max-w-6xl rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

      {showForm && (
        <div className={`mx-auto mb-5 max-w-6xl ${dashboardGlassClass}`}>
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            {editingJobId ? "Edit Job Offer" : "Create New Job Offer"}
          </h2>
          {/* FIX 2: Changed handleCreate to handleSubmit */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-xs font-medium text-gray-700">Job Title</label>
                <input
                  type="text" required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={glassInputClass}
                  placeholder="e.g. Senior Python Developer"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={glassInputClass}
                  placeholder="e.g. Tunis, Tunisia"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-0.5 block text-xs font-medium text-gray-700">Contract Type</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  className={glassInputClass}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-xs font-medium text-gray-700">Salary Range</label>
                <input
                  type="text"
                  value={form.salary_range}
                  onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                  className={glassInputClass}
                  placeholder="e.g. 2000-3000 TND"
                />
              </div>
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-700">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Job description..."
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-700">Requirements</label>
              <textarea
                rows={2}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Required skills and experience..."
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-green-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800"
            >
              {/* FIX 3: Dynamic button text */}
              {editingJobId ? "Update Job Offer" : "Create Job Offer"}
            </button>
          </form>
        </div>
      )}

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
                <div
                  key={job.job_id}
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
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => handleEditClick(job)}
                      className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggle(job.job_id, job.is_active)}
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
              ))}
            </div>
          )}
        </div>
      )}
    </RecruiterLayout>
  )
}