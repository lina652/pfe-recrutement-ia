import axios from "axios"

export const API_BASE_URL = "https://difficult-finisher-neglector.ngrok-free.dev"

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem("refresh_token")
      if (refresh) {
        try {
          const res = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: refresh }
          )
          localStorage.setItem("access_token", res.data.access_token)
          localStorage.setItem("refresh_token", res.data.refresh_token)
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`
          return API(error.config)
        } catch {
          localStorage.clear()
          window.location.href = "/login"
        }
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (data) => API.post("/auth/login", data)
export const getMe = () => API.get("/auth/me")
export const logout = () => API.post("/auth/logout")
export const changePassword = (data) => API.put("/auth/change-password", data)
export const updateProfile = (data) => API.put("/auth/profile", data)

// Admin
export const getStats = () => API.get("/admin/stats")
export const inviteStaff = (data) => API.post("/admin/invite", data)
export const setPasswordFromInvite = (data) =>
  axios.post(`${API_BASE_URL}/admin/set-password`, data)
export const getUsers = (params) => API.get("/admin/users", { params })
export const toggleUser = (id) => API.put(`/admin/users/${id}/toggle`)
export const changeRole = (id, role) => API.put(`/admin/users/${id}/role`, { role })
export const getLogs = (params) => API.get("/admin/logs", { params })
export const getReports = () => API.get("/admin/reports")
export const generateReport = (data) => API.post("/admin/reports", data)

// Super Admin
export const getSuperAdminStats = () => API.get("/superadmin/stats")
export const getCompanies = (params) => API.get("/superadmin/companies", { params })
export const toggleCompany = (id) => API.put(`/superadmin/companies/${id}/toggle`)

// Recruiter
export const getRecruiterJobs = () => API.get("/recruiter/jobs")

// Public — no auth needed
export const getPublicJobs = (params) => axios.get(`${API_BASE_URL}/public/jobs`, { params })
export const getPublicJobDetail = (id) => axios.get(`${API_BASE_URL}/public/jobs/${id}`)
export const getSimilarJobs = (id) => axios.get(`${API_BASE_URL}/public/jobs/${id}/similar`)
export const getPublicFilters = () => axios.get(`${API_BASE_URL}/public/filters`)
export const matchJobsByCV = (formData, params) =>
  axios.post(`${API_BASE_URL}/public/jobs/match-cv`, formData, { params })
export const matchJobsByProfile = (params) => API.get("/public/jobs/match-profile", { params })

// Candidate signup — no auth needed
export const uploadCV = (formData) => axios.post(`${API_BASE_URL}/candidate/signup/cv`, formData)
export const confirmSignup = (data) => axios.post(`${API_BASE_URL}/candidate/signup/confirm`, data)
export const attachCvUpload = (cvUploadId) =>
  API.post("/candidate/cv/attach-upload", { cv_upload_id: cvUploadId })

// Candidate — auth needed
export const getCandidateProfile = () => API.get("/candidate/profile")
export const getMyApplications = () => API.get("/candidate/applications")
export const deleteApplication = (appId) => API.delete(`/candidate/applications/${appId}`)
export const applyToJob = (jobId) => API.post(`/candidate/apply/${jobId}`)
export const getCandidateNotifications = () => API.get("/candidate/notifications")
export const markCandidateNotificationRead = (id) => API.put(`/candidate/notifications/${id}/read`)
export const clearRecruiterNotifications = () => API.delete("/recruiter/notifications")
export const clearManagerNotifications = () => API.delete("/manager/notifications")
export const clearCandidateNotifications = () => API.delete("/candidate/notifications")

// Interview — Candidate
export const getCandidateInterviews = () => API.get("/interviews/candidate/my-interviews")
export const getCandidateInterviewDetail = (interviewId) => API.get(`/interviews/candidate/${interviewId}`)
export const respondToCandidateInterview = (interviewId, data) => API.post(`/interviews/candidate/${interviewId}/respond`, data)
export const startInterview = (interviewId, data) => API.post(`/interviews/candidate/${interviewId}/start`, data)
export const submitInterviewTurn = (interviewId, formData) => API.post(`/interviews/candidate/${interviewId}/turn`, formData, {
  headers: { "Content-Type": "multipart/form-data" }
})
export const endInterview = (interviewId) => API.post(`/interviews/candidate/${interviewId}/end`)

/** Best-effort end when the tab closes (keepalive fetch). */
export function endInterviewOnPageLeave(interviewId) {
  if (!interviewId) return
  const token = localStorage.getItem("access_token")
  if (!token) return
  const base = API.defaults.baseURL || API_BASE_URL
  fetch(`${base}/interviews/candidate/${interviewId}/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {})
}
export const getInterviewScores = (interviewId) => API.get(`/interviews/candidate/${interviewId}/scores`)
export const getInterviewTimeSlots = (interviewId) => API.get(`/interviews/candidate/${interviewId}/time-slots`)
export const selectInterviewTimeSlot = (interviewId, data) => API.post(`/interviews/candidate/${interviewId}/select-time`, data)
export const updateInterviewLanguage = (interviewId, data) => API.patch(`/interviews/candidate/${interviewId}/language`, data)

// Public interview scheduling (email link, no login)
const PublicAPI = axios.create({ baseURL: API_BASE_URL })
export const getPublicInterviewSchedule = (token) =>
  PublicAPI.get("/public/interview/schedule", { params: { token } })
export const submitPublicInterviewSchedule = (token, data) =>
  PublicAPI.post("/public/interview/schedule", data, { params: { token } })
export const updatePublicInterviewLanguage = (token, data) =>
  PublicAPI.patch("/public/interview/schedule/language", data, { params: { token } })

// Interview — Recruiter
export const proposeInterviewTime = (interviewId, data) => API.post(`/interviews/candidate/${interviewId}/propose-time`, data)
export const getRecruiterInterviews = (jobId) => API.get("/interviews/recruiter/all", { params: { job_id: jobId } })
export const getInterviewDetail = (interviewId) => API.get(`/interviews/recruiter/${interviewId}/detail`)
export const getInterviewReport = (interviewId) => API.get(`/interviews/recruiter/${interviewId}/report`)

// RAG — Recruiter
export const getChatSuggestions = (language = "en") => API.get(`/rag/suggestions/${language}`)
export const ragChat = (data) => API.post("/rag/chat", data)
export const getRAGJobs = () => API.get("/rag/jobs")

// RAG Conversations — Recruiter
export const createRAGConversation = (jobId, title) => 
  API.post("/rag/conversations", { job_id: jobId, title })
export const listRAGConversations = (jobId = null, favoritesOnly = false) =>
  API.get("/rag/conversations", { params: { job_id: jobId, favorites_only: favoritesOnly } })
export const getRAGConversation = (conversationId) =>
  API.get(`/rag/conversations/${conversationId}`)
export const updateRAGConversation = (conversationId, data) =>
  API.put(`/rag/conversations/${conversationId}`, data)
export const deleteRAGConversation = (conversationId) =>
  API.delete(`/rag/conversations/${conversationId}`)
export const sendRAGMessage = (conversationId, question) =>
  API.post(`/rag/conversations/${conversationId}/messages`, { 
    conversation_id: conversationId,
    question 
  })

export default API
