import { useEffect, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import API from "../../api/authApi"

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
      const res = await API.get("/recruiter/jobs", {
        params: { search: search || undefined }
      })
      setJobs(res.data.jobs)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [search])

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Job Offers</h1>
          <p className="text-gray-500 mt-1">{total} jobs posted</p>
        </div>
        <button
          onClick={() => {
              if(showForm) setEditingJobId(null); // Reset edit mode if cancelling
              setShowForm(!showForm);
          }}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 transition"
        >
          {showForm ? "Cancel" : "+ New Job Offer"}
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {editingJobId ? "Edit Job Offer" : "Create New Job Offer"}
          </h2>
          {/* FIX 2: Changed handleCreate to handleSubmit */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  type="text" required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. Senior Python Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. Tunis, Tunisia"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary Range</label>
                <input
                  type="text"
                  value={form.salary_range}
                  onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. 2000-3000 TND"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Job description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
              <textarea
                rows={3}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Required skills and experience..."
              />
            </div>
            <button
              type="submit"
              className="bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 transition"
            >
              {/* FIX 3: Dynamic button text */}
              {editingJobId ? "Update Job Offer" : "Create Job Offer"}
            </button>
          </form>
        </div>
      )}

      {/* ... Rest of your search and mapping code remains the same ... */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No job offers yet. Create your first one.
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.job_id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{job.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {job.location || "Remote"} · {job.salary_range || "Salary not specified"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${CONTRACT_COLORS[job.contract_type]}`}>
                        {job.contract_type}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${job.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {job.is_active ? "Active" : "Closed"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                        onClick={() => handleEditClick(job)}
                        className="text-xs font-semibold px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    >
                        Edit
                    </button>
                    <button
                      onClick={() => handleToggle(job.job_id, job.is_active)}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${job.is_active ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                    >
                      {job.is_active ? "Close" : "Reopen"}
                    </button>
                    <button
                      onClick={() => handleDelete(job.job_id)}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {job.description && (
                  <p className="text-sm text-gray-600 mt-3 line-clamp-2">{job.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Posted {new Date(job.posted_date).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </RecruiterLayout>
  )
}