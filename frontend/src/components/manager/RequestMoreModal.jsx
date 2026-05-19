import { useState, useEffect } from "react"
import API from "../../api/authApi"
import {
  closingDateToApi,
  closingDateErrorMessage,
  isClosingOnOrAfterReference,
} from "../../utils/closingDate"

export default function RequestMoreModal({
  open,
  jobId,
  jobTitle,
  onClose,
  onSuccess,
  apiPrefix = "/manager/request-more",
  apiSuffix = "",
}) {
  const [newClosingDate, setNewClosingDate] = useState("")
  const [newClosingTime, setNewClosingTime] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [minDate, setMinDate] = useState("")

  useEffect(() => {
    if (open) {
      // Set minimum date to today
      const today = new Date()
      const minDateStr = today.toISOString().split('T')[0]
      setMinDate(minDateStr)
      setNewClosingDate(minDateStr)
      setNewClosingTime("09:00")
      setError("")
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!newClosingDate) {
      setError("Please select a closing date")
      return
    }

    if (!newClosingTime) {
      setError("Please select a closing time")
      return
    }

    const dateTimeLocal = `${newClosingDate}T${newClosingTime}`
    if (!isClosingOnOrAfterReference(dateTimeLocal)) {
      setError(closingDateErrorMessage())
      return
    }

    setLoading(true)
    setError("")
    
    try {
      const isoDate = closingDateToApi(dateTimeLocal)
      const res = await API.post(`${apiPrefix}/${jobId}${apiSuffix}`, { new_closing_date: isoDate })
      onSuccess(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reopen job")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        aria-label="Close modal"
      />
      <div className="relative bg-white/80 backdrop-blur-md border border-white/40 rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Request More Candidates</h2>
        <p className="text-sm text-gray-600 mb-4">
          Set a new closing date for <strong>{jobTitle}</strong> to accept more candidate applications.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Closing Date
            </label>
            <input
              type="date"
              value={newClosingDate}
              onChange={(e) => setNewClosingDate(e.target.value)}
              min={minDate}
              className="w-full px-4 py-2 border border-white/40 bg-white/30 backdrop-blur-sm rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Select today or a future date
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Closing Time
            </label>
            <input
              type="time"
              value={newClosingTime}
              onChange={(e) => setNewClosingTime(e.target.value)}
              className="w-full px-4 py-2 border border-white/40 bg-white/30 backdrop-blur-sm rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Select the time when applications close
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 backdrop-blur-sm border border-red-300/40 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-white/40 bg-white/20 backdrop-blur-sm text-gray-700 font-semibold rounded-lg hover:bg-white/30 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reopening...
                </>
              ) : (
                "Reopen Job"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
