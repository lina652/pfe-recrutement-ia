import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import AdminLayout from "../../components/admin/AdminLayout"
import { getUsers, toggleUser, changeRole } from "../../api/authApi"

const ROLES = ["CANDIDATE", "RECRUITER", "HIRING_MANAGER", "ADMINISTRATOR"]

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
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
      })
      setUsers(res.data.users)
      setTotal(res.data.total)
    } catch (err) {
      setError("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [search, roleFilter])

  const handleToggle = async (userId) => {
    try {
      const res = await toggleUser(userId)
      setSuccess(res.data.message)
      fetchUsers()
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
      fetchUsers()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change role")
      setTimeout(() => setError(""), 3000)
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500 mt-1">{total} users total</p>
        </div>
        <button
          onClick={() => navigate("/admin/invite")}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
        >
          + Invite Staff
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Email</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Role</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Joined</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
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
                          <option key={r} value={r}>{r.replace("_", " ")}</option>
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