import { useEffect, useState } from "react"
import AdminLayout from "../../components/admin/AdminLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import { getReports, generateReport } from "../../api/authApi"

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
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={generating}
              className="w-full bg-blue-700 text-white py-2 rounded-lg font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50"
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
                  className="page-glass p-5 cursor-pointer hover:border-blue-300 transition"
                  onClick={() => setSelected(
                    selected?.report_id === report.report_id ? null : report
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {report.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(report.generated_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {report.format}
                    </span>
                  </div>

                  {/* Expanded content */}
                  {selected?.report_id === report.report_id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        Report Content:
                      </p>
                      <pre className="text-xs page-glass-inset rounded-lg p-3 overflow-auto text-gray-700">
                        {report.content}
                      </pre>
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