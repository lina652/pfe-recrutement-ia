import { useCallback, useEffect, useMemo, useState } from "react"
import SuperAdminLayout from "../../components/superadmin/SuperAdminLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import GlassSelect from "../../components/shared/GlassSelect"
import GlassCalendarPicker, { parseDateKey } from "../../components/shared/GlassCalendarPicker"
import { getCompanies, toggleCompany } from "../../api/authApi"

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses", description: "Active and suspended companies." },
  { value: "active", label: "Active", description: "Companies that can use the platform." },
  { value: "inactive", label: "Inactive", description: "Suspended companies." },
]

const YEAR_FILTER_START = 2026

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchQuery) params.search = searchQuery
      if (statusFilter === "active") params.is_active = true
      if (statusFilter === "inactive") params.is_active = false

      const picked = parseDateKey(dateFilter)
      if (picked) {
        params.year = picked.year
        params.month = picked.monthIndex + 1
        params.day = picked.day
      }

      const res = await getCompanies(params)
      setCompanies(res.data.companies ?? [])
      setTotal(res.data.total ?? 0)
    } catch (err) {
      console.error(err)
      setError("Failed to load companies")
      setTimeout(() => setError(""), 3000)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, dateFilter])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const hasFilters = useMemo(
    () => Boolean(searchQuery || statusFilter || dateFilter),
    [searchQuery, statusFilter, dateFilter]
  )

  const clearFilters = () => {
    setSearch("")
    setSearchQuery("")
    setStatusFilter("")
    setDateFilter("")
  }

  const handleToggle = async (companyId, isActive) => {
    try {
      await toggleCompany(companyId)
      setSuccess(`Company ${isActive ? "suspended" : "activated"} successfully`)
      fetchCompanies()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update company")
      setTimeout(() => setError(""), 3000)
    }
  }

  return (
    <SuperAdminLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.superadmin}
        title="Companies"
        count={total}
        countLabel="companies matching filters"
      />

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="text"
            placeholder="Search by name, slug, industry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search companies"
            className="page-glass-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-200/50"
          />
          <GlassSelect
            id="superadmin-companies-status"
            aria-label="Filter by status"
            className="w-full min-w-[11rem] sm:max-w-[11rem] sm:shrink-0"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="All statuses"
          />
          <GlassCalendarPicker
            id="superadmin-companies-date"
            aria-label="Filter by registration date"
            className="w-full min-w-[12rem] sm:max-w-[14rem] sm:shrink-0"
            value={dateFilter}
            onChange={setDateFilter}
            minYear={YEAR_FILTER_START}
            placeholder="Registration date"
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="w-fit text-xs font-semibold text-sky-800 underline-offset-2 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-20 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-transparent" />
        </div>
      ) : (
        <div className="page-glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="page-glass-thead border-b border-white/40">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Company</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Industry</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Slug</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Created</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    {hasFilters ? "No companies match your filters" : "No companies registered yet"}
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-white/25">
                    <td className="px-6 py-4 font-semibold text-gray-800">{company.name}</td>
                    <td className="px-6 py-4 text-gray-500">{company.industry || "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">/{company.slug}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          company.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {company.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggle(company.company_id, company.is_active)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                          company.is_active
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                      >
                        {company.is_active ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </SuperAdminLayout>
  )
}
