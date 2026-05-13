import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import API from "../../api/authApi"

export default function TopBar({ title, role }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifications, setNotifications] = useState([])

  // The role determines where we fetch notifications from
  const fetchNotifications = async () => {
    try {
      let endpoint = ""
      if (role === "candidate") endpoint = "/candidate/notifications"
      else if (role === "recruiter") endpoint = "/recruiter/notifications" // Assuming these exist or will exist
      else if (role === "manager") endpoint = "/manager/notifications"
      else return // SuperAdmin/Admin might not have this specific notification system yet

      if (!endpoint) return

      const res = await API.get(endpoint)
      setNotifications(res.data.notifications?.slice(0, 5) || [])
      setUnreadCount(res.data.unread_count || 0)
    } catch (err) {
      console.error("Failed to fetch notifications", err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const handleRefresh = () => fetchNotifications()
    window.addEventListener(`${role}-notifications-updated`, handleRefresh)
    const interval = setInterval(fetchNotifications, 30000)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener(`${role}-notifications-updated`, handleRefresh)
    }
  }, [role])

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout()
    }
  }

  const handleBellClick = () => {
    navigate(`/${role}/notifications`)
  }

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-gray-800">{title || "Dashboard"}</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Notification Bell */}
        {role !== "admin" && role !== "superadmin" && (
          <div className="relative cursor-pointer" onClick={handleBellClick}>
            <div className="p-2 rounded-full hover:bg-gray-100 transition relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="h-6 w-px bg-gray-300"></div>

        {/* User Profile Summary */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-gray-700">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-gray-500 capitalize">{role}</p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
