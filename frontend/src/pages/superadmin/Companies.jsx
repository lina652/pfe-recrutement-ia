import { useEffect, useState } from "react"
import SuperAdminLayout from "../../components/superadmin/SuperAdminLayout"
import { getCompanies, toggleCompany } from "../../api/authApi"

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const res = await getCompanies()
      setCompanies(res.data.companies)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Companies</h1>
        <p className="text-gray-500 mt-1">
          {companies.length} companies registered on the platform
        </p>
      </div>

      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        💡 Companies register themselves at <strong>/company/signup</strong>. 
        Your role is to monitor and suspend if needed.
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-gray-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Company</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Industry</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Slug</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Created</th>
                <th className="text-left px-6 py-3 text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No companies registered yet
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800">{company.name}</td>
                    <td className="px-6 py-4 text-gray-500">{company.industry || "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">/{company.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${company.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {company.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(company.company_id, company.is_active)}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${company.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
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
