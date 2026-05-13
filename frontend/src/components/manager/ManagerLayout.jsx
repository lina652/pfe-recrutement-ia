import ManagerSidebar from "./ManagerSidebar"
import TopBar from "../shared/TopBar"

export default function ManagerLayout({ children, title = "Dashboard" }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <ManagerSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopBar title={title} role="manager" />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}