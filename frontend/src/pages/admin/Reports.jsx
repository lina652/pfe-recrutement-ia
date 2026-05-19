import { useEffect, useState } from "react"
import AdminLayout from "../../components/admin/AdminLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import { getReports, generateReport } from "../../api/authApi"
import ReportContentView from "../../components/admin/ReportContentView"

export default function Reports() {
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [title, setTitle] = useState("")
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await getReports()
      setReports(res.data.reports)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setGenerating(true)
    setError("")
    setSuccess("")
    try {
      await generateReport({ title, format: "JSON" })
      setSuccess("Report generated successfully")
      setTitle("")
      fetchReports()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate report")
      setTimeout(() => setError(""), 3000)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AdminLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.admin}
        title="Reports"
        count={total}
        countLabel="reports generated"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Generate report form */}
        <div className="page-glass p-6 h-fit">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Generate New Report
          </h2>

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              ✅ {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Monthly Recruitment Report"
                className="page-glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-200/50"
              />
            </div>
            <button
              type="submit"
              disabled={generating}
              className="w-full rounded-xl bg-violet-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Report"}
            </button>
          </form>
        </div>

        {/* Reports list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : reports.length === 0 ? (
            <div className="page-glass p-12 text-center text-gray-400">
              No reports yet. Generate your first report.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.report_id}
                  className={`page-glass cursor-pointer p-5 transition ${
                    selected?.report_id === report.report_id
                      ? "ring-2 ring-violet-300/80"
                      : "hover:ring-1 hover:ring-violet-200/60"
                  }`}
                  onClick={() =>
                    setSelected(
                      selected?.report_id === report.report_id ? null : report
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {report.title}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {new Date(report.generated_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                      {report.format}
                    </span>
                  </div>

                  {selected?.report_id === report.report_id && (
                    <div className="mt-5 border-t border-white/40 pt-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Report summary
                      </p>
                      <ReportContentView content={report.content} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  )
}