import { useEffect, useState } from "react"
import SuperAdminLayout from "../../components/superadmin/SuperAdminLayout"
import StatsCard from "../../components/admin/StatsCard"
import { getSuperAdminStats, getCompanies } from "../../api/authApi"

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSuperAdminStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <SuperAdminLayout title="Overview">
      <div className="mb-10 p-8 rounded-3xl bg-gradient-to-br from-gray-900 to-slate-800 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Platform Overview</h1>
          <p className="text-gray-300 text-lg">Monitor all companies and activity across the system.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-gray-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard title="Total Companies" value={stats?.total_companies ?? 0} color="blue" icon="🏢" />
          <StatsCard title="Active Companies" value={stats?.active_companies ?? 0} color="emerald" icon="✅" />
          <StatsCard title="Pending Companies" value={stats?.pending_companies ?? 0} color="amber" icon="⏳" />
          <StatsCard title="Total Users" value={stats?.total_users ?? 0} color="purple" icon="👥" />
          <StatsCard title="Total Candidates" value={stats?.total_candidates ?? 0} color="indigo" icon="🎓" />
          <StatsCard title="Total Admins" value={stats?.total_admins ?? 0} color="gray" icon="👔" />
        </div>
      )}
    </SuperAdminLayout>
  )
}