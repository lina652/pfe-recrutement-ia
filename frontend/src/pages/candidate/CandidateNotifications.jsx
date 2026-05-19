import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import NotificationPageActions from "../../components/shared/NotificationPageActions"
import { getCandidateNotifications, markCandidateNotificationRead, clearCandidateNotifications } from "../../api/authApi"

const TYPE_STYLES = {
  INTERVIEW_TIME_SELECTION: {
    icon: "📅",
    color: "border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50 to-transparent hover:bg-violet-50",
  },
  INTERVIEW_INVITED: { icon: "🎯", color: "border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent hover:bg-blue-50" },
  INTERVIEW_INVITE_SENT: { icon: "📤", color: "border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/80 to-transparent hover:bg-emerald-50" },
  APPLICATION_RECEIVED: { icon: "✅", color: "border-l-4 border-l-emerald-400 bg-gradient-to-r from-emerald-50/50 to-transparent" },
  APPLICATION_ACCEPTED: {
    icon: "🎉",
    color: "border-l-4 border-l-green-600 bg-gradient-to-r from-green-50 to-transparent hover:bg-green-50",
  },
  APPLICATION_REJECTED: {
    icon: "📋",
    color: "border-l-4 border-l-gray-400 bg-gradient-to-r from-gray-50 to-transparent hover:bg-gray-50",
  },
}

export default function CandidateNotifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [clearing, setClearing] = useState(false)

  const fetchNotifications = async () => {
    try {
      const res = await getCandidateNotifications()
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unread_count)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [])

  const markAsRead = async (id) => {
    try {
      await markCandidateNotificationRead(id)
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      window.dispatchEvent(new Event("candidate-notifications-updated"))
    } catch (err) {
      console.error(err)
    }
  }

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markAsRead(notification.notification_id)
    }
    // Navigate to interview page if it's an interview invitation
    if (notification.type === "INTERVIEW_TIME_SELECTION") {
      navigate("/candidate/interviews")
      return
    }
    if (notification.type === "INTERVIEW_INVITED" && notification.reference_id) {
      navigate(`/candidate/interview/${notification.reference_id}`)
      return
    }
    if (notification.type === "APPLICATION_ACCEPTED" || notification.type === "APPLICATION_REJECTED") {
      navigate("/candidate/applications")
    }
  }

  const clearAll = async () => {
    if (!notifications.length || clearing) return
    setClearing(true)
    try {
      await clearCandidateNotifications()
      setNotifications([])
      setUnreadCount(0)
      window.dispatchEvent(new Event("candidate-notifications-updated"))
    } catch (err) {
      console.error(err)
    } finally {
      setClearing(false)
    }
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read)
    for (const n of unread) {
      await markCandidateNotificationRead(n.notification_id)
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    window.dispatchEvent(new Event("candidate-notifications-updated"))
  }

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <CandidateLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.candidate}
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : "You're all caught up!"
        }
      />

      <div className="mx-auto mb-4 flex max-w-6xl justify-end">
        <NotificationPageActions
          unreadCount={unreadCount}
          totalCount={notifications.length}
          onMarkAllRead={markAllRead}
          onClearAll={clearAll}
          clearing={clearing}
          accent="blue"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">Loading notifications...</p>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="page-glass p-16 text-center">
          <p className="text-6xl mb-4">🔔</p>
          <p className="text-lg font-semibold text-gray-600 mb-2">No notifications yet</p>
          <p className="text-sm text-gray-400">Check back later for interview invitations, selection results, and updates</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const style = TYPE_STYLES[n.type] || { icon: "🔔", color: "border-l-4 border-l-gray-400" }
            const isClickable =
              n.type === "INTERVIEW_INVITED" ||
              n.type === "INTERVIEW_TIME_SELECTION" ||
              n.type === "APPLICATION_ACCEPTED" ||
              n.type === "APPLICATION_REJECTED"
            return (
              <div 
                key={n.notification_id} 
                onClick={() => handleNotificationClick(n)} 
                className={`page-glass border ${style.color} p-5 transition-all duration-200 ${
                  isClickable ? "cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01]" : "opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0 mt-1">{style.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold ${
                          !n.is_read ? "text-gray-900 text-base" : "text-gray-700 text-sm"
                        }`}>
                          {n.title}
                        </h3>
                        {!n.is_read && <span className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0 animate-pulse" />}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{n.message}</p>
                      {n.type === "INTERVIEW_TIME_SELECTION" && (
                        <p className="text-xs text-violet-700 font-semibold mt-2">
                          Click to choose your interview time slot
                        </p>
                      )}
                      {n.type === "INTERVIEW_INVITED" && (
                        <p className="text-xs text-blue-600 font-semibold mt-2">Click to confirm or decline the interview</p>
                      )}
                      {n.type === "APPLICATION_ACCEPTED" && (
                        <p className="text-xs text-green-700 font-semibold mt-2">Click to view your application status</p>
                      )}
                      {n.type === "APPLICATION_REJECTED" && (
                        <p className="text-xs text-gray-600 font-semibold mt-2">Click to view your applications</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                    {isClickable && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">→ View</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CandidateLayout>
  )
}
