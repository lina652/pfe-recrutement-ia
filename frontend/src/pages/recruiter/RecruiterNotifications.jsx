import { useEffect, useState } from "react"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import NotificationPageActions from "../../components/shared/NotificationPageActions"
import API, { clearRecruiterNotifications } from "../../api/authApi"

const TYPE_STYLES = {
  REQUIREMENT_SUBMITTED: { icon: "📨", color: "border-l-blue-500 bg-blue-50/50" },
  REQUIREMENT_ACCEPTED:  { icon: "✅", color: "border-l-green-500 bg-green-50/50" },
  REQUIREMENT_REJECTED:  { icon: "❌", color: "border-l-red-500 bg-red-50/50" },
  INTERVIEW_INVITE_SENT: { icon: "📤", color: "border-l-green-500 bg-green-50/50" },
  INTERVIEW_RESPONSE: { icon: "💬", color: "border-l-purple-500 bg-purple-50/50" },
}

export default function RecruiterNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [clearing, setClearing] = useState(false)

  const fetchNotifications = async () => {
    try {
      const res = await API.get("/recruiter/notifications")
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
      await API.put(`/recruiter/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      window.dispatchEvent(new Event("recruiter-notifications-updated"))
    } catch (err) {
      console.error(err)
    }
  }

  const clearAll = async () => {
    if (!notifications.length || clearing) return
    setClearing(true)
    try {
      await clearRecruiterNotifications()
      setNotifications([])
      setUnreadCount(0)
      window.dispatchEvent(new Event("recruiter-notifications-updated"))
    } catch (err) {
      console.error(err)
    } finally {
      setClearing(false)
    }
  }

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read)
    for (const n of unread) {
      await API.put(`/recruiter/notifications/${n.notification_id}/read`)
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    window.dispatchEvent(new Event("recruiter-notifications-updated"))
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
    <RecruiterLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.recruiter}
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
          accent="emerald"
        />
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="page-glass p-16 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-gray-400 text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const style = TYPE_STYLES[n.type] || { icon: "🔔", color: "border-l-gray-400" }
            return (
              <div
                key={n.notification_id}
                onClick={() => !n.is_read && markAsRead(n.notification_id)}
                className={`
                  page-glass p-4 border-l-4
                  ${style.color}
                  ${!n.is_read ? "cursor-pointer hover:shadow-md" : "opacity-75"}
                  transition-all duration-200
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-xl mt-0.5">{style.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-semibold ${!n.is_read ? "text-gray-900" : "text-gray-600"}`}>
                          {n.title}
                        </h3>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-green-600 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{n.message}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </RecruiterLayout>
  )
}
