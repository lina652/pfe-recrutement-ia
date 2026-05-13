import { useEffect, useState } from "react"
import AdminLayout from "../../components/admin/AdminLayout"
import StatsCard from "../../components/admin/StatsCard"
import { getStats } from "../../api/authApi"

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout title="Overview">
      <div className="mb-10 p-8 rounded-3xl bg-gradient-to-br from-blue-900 to-cyan-900 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Platform Administration</h1>
          <p className="text-blue-200 text-lg">Manage your organization's users and system activity.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">👥</span>
            User Statistics
          </h2>
          {/* Main stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <StatsCard title="Total Users" value={stats?.total_users ?? 0} color="blue" icon="👥" />
            <StatsCard title="Candidates" value={stats?.total_candidates ?? 0} color="purple" icon="🎓" />
            <StatsCard title="Recruiters" value={stats?.total_recruiters ?? 0} color="green" icon="💼" />
            <StatsCard title="Hiring Managers" value={stats?.total_hiring_managers ?? 0} color="orange" icon="👔" />
            <StatsCard title="Active Users" value={stats?.active_users ?? 0} color="emerald" icon="✅" />
            <StatsCard title="Inactive Users" value={stats?.inactive_users ?? 0} color="rose" icon="🚫" />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">⚙️</span>
            System Activity
          </h2>
          {/* Secondary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <StatsCard title="System Logs" value={stats?.total_logs ?? 0} color="gray" icon="📋" />
            <StatsCard title="Reports Generated" value={stats?.total_reports ?? 0} color="indigo" icon="📄" />
          </div>
        </>
      )}
    </AdminLayout>
  )
}