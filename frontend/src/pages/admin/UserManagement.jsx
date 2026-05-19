import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import AdminLayout from "../../components/admin/AdminLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import GlassSelect from "../../components/shared/GlassSelect"
import { getUsers, toggleUser, changeRole } from "../../api/authApi"

const ROLES = ["CANDIDATE", "RECRUITER", "HIRING_MANAGER", "ADMINISTRATOR"]

const ROLE_LABELS = {
  CANDIDATE: "Candidate",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring manager",
  ADMINISTRATOR: "Administrator",
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses", description: "Active and inactive users." },
  { value: "active", label: "Active", description: "Users who can sign in." },
  { value: "inactive", label: "Inactive", description: "Deactivated accounts." },
]

const ROLE_FILTER_OPTIONS = [
  {
    value: "",
    label: "All roles",
    description: "Show every user in your company.",
  },
  ...ROLES.map((r) => ({
    value: r,
    label: ROLE_LABELS[r],
    description:
      r === "CANDIDATE"
        ? "Applicants and external candidates."
        : r === "RECRUITER"
          ? "HR staff posting jobs and pipelines."
          : r === "HIRING_MANAGER"
            ? "Managers defining needs and shortlists."
            : "Company admins and access control.",
  })),
]

const ROLE_COLORS = {
  CANDIDATE:      "bg-purple-100 text-purple-700",
  RECRUITER:      "bg-green-100 text-green-700",
  HIRING_MANAGER: "bg-orange-100 text-orange-700",
  ADMINISTRATOR:  "bg-blue-100 text-blue-700",
}

export default function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const initialLoadDone = useRef(false)

  const fetchUsers = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const params = {}
      if (searchQuery) params.search = searchQuery
      if (roleFilter) params.role = roleFilter
      if (statusFilter === "active") params.is_active = true
      if (statusFilter === "inactive") params.is_active = false

      const res = await getUsers(params)
      setUsers(Array.isArray(res.data?.users) ? res.data.users : [])
      setTotal(typeof res.data?.total === "number" ? res.data.total : 0)
      setError("")
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load users")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [searchQuery, roleFilter, statusFilter])

  useEffect(() => {
    fetchUsers({ silent: !loading && users.length > 0 })
  }, [fetchUsers])

  const handleToggle = async (userId) => {
    try {
      const res = await toggleUser(userId)
      setSuccess(res.data.message)
      fetchUsers({ silent: true })
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to toggle user")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleRoleChange = async (userId, role) => {
    try {
      await changeRole(userId, role)
      setSuccess("Role updated successfully")
      fetchUsers({ silent: true })
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change role")
      setTimeout(() => setError(""), 3000)
    }
  }

  return (
    <AdminLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.admin}
        title="User Management"
        count={total}
        countLabel="users total"
      >
        <button
          type="button"
          onClick={() => navigate("/admin/invite")}
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
        >
          + Invite Staff
        </button>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users by name or email"
          className="page-glass-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-200/50"
        />
        <GlassSelect
          id="admin-users-status-filter"
          aria-label="Filter users by status"
          className="w-full min-w-[12rem] sm:max-w-[11rem] sm:shrink-0"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
          placeholder="All statuses"
        />
        <GlassSelect
          id="admin-users-role-filter"
          aria-label="Filter users by role"
          className="w-full min-w-[12rem] sm:max-w-[11rem] sm:shrink-0"
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLE_FILTER_OPTIONS}
          placeholder="All roles"
        />
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className={`page-glass overflow-hidden transition-opacity ${refreshing ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <thead className="page-glass-thead border-b border-white/40">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Email</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Role</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Joined</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-white/25">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_COLORS[user.role]}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(user.user_id)}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${user.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
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