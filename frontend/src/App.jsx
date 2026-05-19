import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { LanguageProvider } from "./context/LanguageContext"
import ProtectedRoute from "./components/ProtectedRoute"

// Auth
import Login from "./pages/Login"

// Public
import Landing from "./pages/public/Landing"
import CompanySignup from "./pages/public/CompanySignup"
import Jobs from "./pages/public/Jobs"
import JobDetail from "./pages/public/JobDetail"
import Apply from "./pages/public/Apply"
import StaffActivate from "./pages/public/StaffActivate"
import ScheduleInterview from "./pages/public/ScheduleInterview"

// Super Admin
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard"
import Companies from "./pages/superadmin/Companies"

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard"
import UserManagement from "./pages/admin/UserManagement"
import InviteStaff from "./pages/admin/InviteStaff"
import SystemLogs from "./pages/admin/SystemLogs"
import Reports from "./pages/admin/Reports"

// Recruiter
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard"
import JobOffers from "./pages/recruiter/JobOffers"
import AIRecommendations from "./pages/manager/AIRecommendations"
import RequirementRequests from "./pages/recruiter/RequirementRequests"
import RecruiterNotifications from "./pages/recruiter/RecruiterNotifications"

// Manager
import ManagerDashboard from "./pages/manager/ManagerDashboard"
import JobRequirements from "./pages/manager/JobRequirements"
import FinalSelection from "./pages/manager/FinalSelection"
import ManagerNotifications from "./pages/manager/ManagerNotifications"

// Candidate
import CandidateDashboard from "./pages/candidate/CandidateDashboard"
import MyApplications from "./pages/candidate/MyApplications"
import MyProfile from "./pages/candidate/MyProfile"
import CandidateInterviews from "./pages/candidate/CandidateInterviews"
import InterviewRoom from "./pages/candidate/InterviewRoom"
import CandidateNotifications from "./pages/candidate/CandidateNotifications"

// Shared
import EditProfile from "./pages/shared/EditProfile"

// Layouts
import AdminLayout from "./components/admin/AdminLayout"
import RecruiterLayout from "./components/recruiter/RecruiterLayout"
import ManagerLayout from "./components/manager/ManagerLayout"
import CandidateLayout from "./components/candidate/CandidateLayout"
import SuperAdminLayout from "./components/superadmin/SuperAdminLayout"

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/company/signup" element={<CompanySignup />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:id/apply" element={<Apply />} />
            <Route path="/login" element={<Login />} />
            <Route path="/staff/activate" element={<StaffActivate />} />
            <Route path="/schedule-interview" element={<ScheduleInterview />} />

            {/* Super Admin */}
            <Route path="/superadmin/dashboard" element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }/>
            <Route path="/superadmin/companies" element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                <Companies />
              </ProtectedRoute>
            }/>
            <Route path="/superadmin/profile" element={
              <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                <EditProfile Layout={SuperAdminLayout} />
              </ProtectedRoute>
            }/>

            {/* Admin */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }/>
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <UserManagement />
              </ProtectedRoute>
            }/>
            <Route path="/admin/invite" element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <InviteStaff />
              </ProtectedRoute>
            }/>
            <Route path="/admin/logs" element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <SystemLogs />
              </ProtectedRoute>
            }/>
            <Route path="/admin/reports" element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <Reports />
              </ProtectedRoute>
            }/>
            <Route path="/admin/profile" element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <EditProfile Layout={AdminLayout} />
              </ProtectedRoute>
            }/>

            {/* Recruiter */}
            <Route path="/recruiter/dashboard" element={
              <ProtectedRoute allowedRoles={["RECRUITER"]}>
                <RecruiterDashboard />
              </ProtectedRoute>
            }/>
            <Route path="/recruiter/jobs" element={
              <ProtectedRoute allowedRoles={["RECRUITER"]}>
                <JobOffers />
              </ProtectedRoute>
            }/>
            <Route path="/manager/ai" element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER"]}>
                <AIRecommendations />
              </ProtectedRoute>
            }/>
            <Route path="/recruiter/requirements" element={
              <ProtectedRoute allowedRoles={["RECRUITER"]}>
                <RequirementRequests />
              </ProtectedRoute>
            }/>
            <Route path="/recruiter/notifications" element={
              <ProtectedRoute allowedRoles={["RECRUITER"]}>
                <RecruiterNotifications />
              </ProtectedRoute>
            }/>
            <Route path="/recruiter/profile" element={
              <ProtectedRoute allowedRoles={["RECRUITER"]}>
                <EditProfile Layout={RecruiterLayout} />
              </ProtectedRoute>
            }/>

            {/* Manager */}
            <Route path="/manager/dashboard" element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER"]}>
                <ManagerDashboard />
              </ProtectedRoute>
            }/>
            <Route path="/manager/jobs" element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER"]}>
                <JobRequirements />
              </ProtectedRoute>
            }/>

            <Route path="/manager/selection" element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER"]}>
                <FinalSelection />
              </ProtectedRoute>
            }/>
            <Route path="/manager/notifications" element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER"]}>
                <ManagerNotifications />
              </ProtectedRoute>
            }/>
            <Route path="/manager/profile" element={
              <ProtectedRoute allowedRoles={["HIRING_MANAGER"]}>
                <EditProfile Layout={ManagerLayout} />
              </ProtectedRoute>
            }/>

            {/* Candidate */}
            <Route path="/candidate/dashboard" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <CandidateDashboard />
              </ProtectedRoute>
            }/>
            <Route path="/candidate/applications" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <MyApplications />
              </ProtectedRoute>
            }/>
            <Route path="/candidate/interviews" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <CandidateInterviews />
              </ProtectedRoute>
            }/>
            <Route path="/candidate/interview/:interviewId" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <InterviewRoom />
              </ProtectedRoute>
            }/>
            <Route path="/candidate/notifications" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <CandidateNotifications />
              </ProtectedRoute>
            }/>
            <Route path="/candidate/profile" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <EditProfile Layout={CandidateLayout} />
              </ProtectedRoute>
            }/>

            {/* Unauthorized */}
            <Route path="/unauthorized" element={
              <div className="min-h-screen flex items-center justify-center">
                <p className="text-red-500 text-xl font-semibold">Access Denied</p>
              </div>
            }/>

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}