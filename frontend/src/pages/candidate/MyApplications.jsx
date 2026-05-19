import { useCallback, useEffect, useState } from "react"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import Toast from "../../components/Toast"
import ConfirmDialog from "../../components/shared/ConfirmDialog"
import { getMyApplications, deleteApplication } from "../../api/authApi"

const STATUS_COLORS = {
  PENDING: "bg-yellow-100 text-yellow-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  SHORTLISTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
}

export default function MyApplications() {
  const [applications, setApplications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState(null)
  const [withdrawTarget, setWithdrawTarget] = useState(null)

  const loadApplications = useCallback(() => {
    setLoading(true)
    return getMyApplications()
      .then((res) => {
        setApplications(res.data.applications)
        setTotal(res.data.total)
      })
      .catch((err) => {
        console.error(err)
        setToast({
          type: "error",
          message: err.response?.data?.detail || "Failed to load applications",
        })
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  const filtered = filter
    ? applications.filter((a) => a.status === filter)
    : applications

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return
    const app = withdrawTarget
    setDeletingId(app.app_id)
    try {
      await deleteApplication(app.app_id)
      setApplications((prev) => prev.filter((a) => a.app_id !== app.app_id))
      setTotal((t) => Math.max(0, t - 1))
      setWithdrawTarget(null)
      setToast({ type: "success", message: "Application withdrawn" })
    } catch (err) {
      setToast({
        type: "error",
        message: err.response?.data?.detail || "Failed to withdraw application",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <CandidateLayout>
      <ConfirmDialog
        open={Boolean(withdrawTarget)}
        onCancel={() => !deletingId && setWithdrawTarget(null)}
        onConfirm={confirmWithdraw}
        title="Withdraw application?"
        variant="danger"
        confirmLabel="Withdraw"
        cancelLabel="Cancel"
        loading={Boolean(deletingId)}
        message={null}
      >
        {withdrawTarget && (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              You are about to withdraw your application for{" "}
              <span className="font-semibold text-slate-900">{withdrawTarget.job_title}</span>
              {" at "}
              <span className="font-semibold text-blue-700">{withdrawTarget.company_name}</span>.
            </p>
            {withdrawTarget.status === "SHORTLISTED" && (
              <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-amber-900">
                You are shortlisted — any scheduled interview for this role will be cancelled.
              </div>
            )}
            <p className="mt-3 text-xs font-semibold text-red-700/90">This action cannot be undone.</p>
          </>
        )}
      </ConfirmDialog>

      <PageHeader
        eyebrow={PAGE_EYEBROWS.candidate}
        title="My Applications"
        count={total}
        countLabel="total applications"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {["", "PENDING", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "ACCEPTED"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === s
                ? "bg-blue-700 text-white"
                : "page-glass-pill text-gray-600 hover:bg-white/55"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-20 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="page-glass p-12 text-center text-gray-400">
          No applications found
        </div>
      ) : (
        <div className="page-glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="page-glass-thead border-b border-white/40">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Job</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Company</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Applied</th>
                <th className="px-6 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {filtered.map((app) => (
                <tr key={app.app_id} className="hover:bg-white/25">
                  <td className="px-6 py-4 font-medium text-gray-800">{app.job_title}</td>
                  <td className="px-6 py-4 text-blue-600">{app.company_name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[app.status]}`}
                    >
                      {app.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {new Date(app.submission_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {app.can_withdraw ? (
                      <button
                        type="button"
                        onClick={() => setWithdrawTarget(app)}
                        disabled={deletingId === app.app_id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === app.app_id ? "Withdrawing…" : "Withdraw"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} />}
    </CandidateLayout>
  )
}
