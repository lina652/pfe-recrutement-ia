import { useEffect, useState } from "react"
import AdminLayout from "../../components/admin/AdminLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import { getLogs } from "../../api/authApi"

const ACTION_COLORS = {
  INVITE_STAFF:     "bg-blue-100 text-blue-700",
  ACTIVATE_USER:    "bg-green-100 text-green-700",
  DEACTIVATE_USER:  "bg-red-100 text-red-700",
  CHANGE_ROLE:      "bg-orange-100 text-orange-700",
  GENERATE_REPORT:  "bg-purple-100 text-purple-700",
}

export default function SystemLogs() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await getLogs({
        search: search || undefined,
        limit: 50
      })
      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [search])

  return (
    <AdminLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.admin}
        title="System Logs"
        count={total}
        countLabel="actions recorded"
      />

      <div className="mb-6 max-w-xl">
        <input
          type="text"
          placeholder="Search by action or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search logs by action or email"
          className="page-glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-200/50"
        />
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="page-glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="page-glass-thead border-b border-white/40">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Action</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Performed By</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Details</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">IP Address</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-white/25">
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"
                      }`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {log.user_email || "System"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                      {log.details || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                      {log.ip_address || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}