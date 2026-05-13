import RecruiterSidebar from "./RecruiterSidebar"
import TopBar from "../shared/TopBar"

export default function RecruiterLayout({ children, title = "Dashboard" }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <RecruiterSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopBar title={title} role="recruiter" />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}