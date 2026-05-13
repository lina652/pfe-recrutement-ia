import { useEffect, useState } from "react"
import ManagerLayout from "../../components/manager/ManagerLayout"
import StatsCard from "../../components/admin/StatsCard"
import API from "../../api/authApi"

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get("/manager/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ManagerLayout title="Overview">
      <div className="mb-10 p-8 rounded-3xl bg-gradient-to-br from-purple-900 to-indigo-900 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Hiring Manager Overview</h1>
          <p className="text-purple-200 text-lg">Monitor your department's recruitment progress.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard title="Total Jobs" value={stats?.total_jobs ?? 0} color="purple" icon="💼" />
          <StatsCard title="Active Jobs" value={stats?.active_jobs ?? 0} color="indigo" icon="✅" />
          <StatsCard title="Shortlisted" value={stats?.total_shortlisted ?? 0} color="blue" icon="⭐" />
          <StatsCard title="Accepted" value={stats?.total_accepted ?? 0} color="emerald" icon="🎉" />
          <StatsCard title="Rejected" value={stats?.total_rejected ?? 0} color="rose" icon="❌" />
          <StatsCard title="Pending Review" value={stats?.pending_review ?? 0} color="amber" icon="⏳" />
        </div>
      )}
    </ManagerLayout>
  )
}