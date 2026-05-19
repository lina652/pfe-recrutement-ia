import { useState, useEffect, useRef } from "react"
import { useAuth } from "../../context/AuthContext"
import ManagerLayout from "../../components/manager/ManagerLayout"
import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"
import { 
  getRAGJobs, 
  getChatSuggestions,
  createRAGConversation,
  listRAGConversations,
  getRAGConversation,
  updateRAGConversation,
  deleteRAGConversation,
  sendRAGMessage
} from "../../api/authApi"
import Toast from "../../components/Toast"
import { DashboardNavIcon } from "../../components/shared/DashboardNavIcons"
import GlassSelect from "../../components/shared/GlassSelect"

export default function AIRecommendations() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState("")
  const [currentMessages, setCurrentMessages] = useState([])
  const [question, setQuestion] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newConvTitle, setNewConvTitle] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [selectedJobForNew, setSelectedJobForNew] = useState("")
  const [selectedJobFilter, setSelectedJobFilter] = useState("all")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [editingConvId, setEditingConvId] = useState(null)
  const [editingTitle, setEditingTitle] = useState("")
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [currentMessages])

  const loadData = async () => {
    try {
      const jobsResult = await getRAGJobs()
      const jobList = (jobsResult.data || []).slice().sort(
        (a, b) => (b.application_count || 0) - (a.application_count || 0)
      )
      setJobs(jobList)
      const firstJob = jobList.find((j) => (j.application_count || 0) > 0) || jobList[0]
      if (firstJob?.job_id) {
        setSelectedJobForNew(firstJob.job_id)
        setNewConvTitle(firstJob.title)
      }
      
      const convsResult = await listRAGConversations()
      setConversations(convsResult.data || [])
      if (convsResult.data?.length > 0) {
        loadConversation(convsResult.data[0].conversation_id)
      }
      
      const suggestionsResult = await getChatSuggestions("en")
      setSuggestions(suggestionsResult.data?.suggestions || [])
    } catch (err) {
      setToast({ type: "error", message: "Failed to load data" })
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadConversation = async (conversationId) => {
    try {
      const result = await getRAGConversation(conversationId)
      setSelectedConversationId(conversationId)
      setCurrentMessages(result.data.messages || [])
    } catch (err) {
      setToast({ type: "error", message: "Failed to load conversation" })
      console.error(err)
    }
  }

  const handleCreateConversation = async () => {
    if (!selectedJobForNew) {
      setToast({ type: "error", message: "Please select a job" })
      return
    }

    const title = getJobTitle(selectedJobForNew)

    try {
      setCreateLoading(true)
      const result = await createRAGConversation(selectedJobForNew, title)
      setConversations([result.data, ...conversations])
      setSelectedConversationId(result.data.conversation_id)
      setCurrentMessages([])
      setNewConvTitle("")
      setShowNewConversation(false)
      setToast({ type: "success", message: "Conversation created" })
    } catch (err) {
      setToast({ type: "error", message: "Failed to create conversation" })
      console.error(err)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    const userMessage = question.trim()
    setQuestion("")
    setCurrentMessages(prev => [...prev, { role: "user", content: userMessage, timestamp: new Date().toISOString() }])
    setIsLoading(true)

    try {
      let activeConversationId = selectedConversationId

      // Auto-create a conversation if none exists
      if (!activeConversationId) {
        if (!selectedJobForNew && jobs.length > 0) {
          setSelectedJobForNew(jobs[0].job_id)
        }
        
        const jobToUse = selectedJobForNew || (jobs.length > 0 ? jobs[0].job_id : null)
        if (!jobToUse) {
          setToast({ type: "error", message: "No jobs available to create a conversation" })
          setIsLoading(false)
          setCurrentMessages([])
          return
        }

        const result = await createRAGConversation(jobToUse, getJobTitle(jobToUse))
        
        activeConversationId = result.data.conversation_id
        setConversations([result.data, ...conversations])
        setSelectedConversationId(activeConversationId)
      }

      const result = await sendRAGMessage(activeConversationId, userMessage)
      setCurrentMessages(prev => [...prev, result.data])
    } catch (err) {
      setToast({ type: "error", message: "Failed to send message" })
      console.error(err)
      setCurrentMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFavorite = async (conversationId, currentState) => {
    try {
      await updateRAGConversation(conversationId, { is_favorite: !currentState })
      setConversations(conversations.map(conv =>
        conv.conversation_id === conversationId
          ? { ...conv, is_favorite: !currentState }
          : conv
      ))
    } catch (err) {
      setToast({ type: "error", message: "Failed to update conversation" })
      console.error(err)
    }
  }

  const handleRenameConversation = async (conversationId) => {
    if (!editingTitle.trim()) return
    
    try {
      await updateRAGConversation(conversationId, { title: editingTitle })
      setConversations(conversations.map(conv =>
        conv.conversation_id === conversationId
          ? { ...conv, title: editingTitle }
          : conv
      ))
      setEditingConvId(null)
      setEditingTitle("")
    } catch (err) {
      setToast({ type: "error", message: "Failed to rename conversation" })
      console.error(err)
    }
  }

  const handleDeleteConversation = async (conversationId) => {
    if (!window.confirm("Delete this conversation and all messages?")) return

    try {
      await deleteRAGConversation(conversationId)
      setConversations(conversations.filter(conv => conv.conversation_id !== conversationId))
      if (selectedConversationId === conversationId) {
        setSelectedConversationId("")
        setCurrentMessages([])
      }
      setToast({ type: "success", message: "Conversation deleted" })
    } catch (err) {
      setToast({ type: "error", message: "Failed to delete conversation" })
      console.error(err)
    }
  }

  const handleSuggestion = (suggestion) => {
    setQuestion(suggestion)
  }

  const getJobTitle = (jobId) => {
    const job = jobs.find((item) => item.job_id === jobId)
    return job?.title || "Unknown job"
  }

  const formatJobOptionLabel = (job) => {
    if (!job?.job_id) return job?.label || "Select job"
    const apps = job.application_count ?? 0
    const interviews = job.completed_interview_count ?? 0
    const base = job.title || job.label || "Job"
    return `${base} (${apps} applicant${apps === 1 ? "" : "s"}, ${interviews} interview${interviews === 1 ? "" : "s"})`
  }

  const handleNewConversationJobChange = (jobId) => {
    setSelectedJobForNew(jobId)
    if (jobId) {
      setNewConvTitle(getJobTitle(jobId))
    }
  }

  const openNewConversationPanel = () => {
    const jobId =
      selectedJobFilter !== "all"
        ? selectedJobFilter
        : selectedJobForNew || jobs[0]?.job_id || ""
    if (jobId) {
      setSelectedJobForNew(jobId)
      setNewConvTitle(getJobTitle(jobId))
    }
    setShowNewConversation(true)
  }

  const filteredConversations = conversations.filter((conv) => {
    const matchJob = selectedJobFilter === "all" || conv.job_id === selectedJobFilter
    const matchFavorite = !favoritesOnly || conv.is_favorite
    return matchJob && matchFavorite
  })

  const jobFilterOptions = [
    { value: "all", label: "All jobs" },
    ...jobs.map((job) => ({
      value: job.job_id,
      label: formatJobOptionLabel(job),
      title: job.title,
      application_count: job.application_count,
    })),
  ]

  const newConversationJobOptions = [
    { value: "", label: "Select job" },
    ...jobs.map((job) => ({
      value: job.job_id,
      label: formatJobOptionLabel(job),
      title: job.title,
      application_count: job.application_count,
    })),
  ]

  if (loading) {
    return (
      <ManagerLayout>
        <div className="mt-20 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        </div>
      </ManagerLayout>
    )
  }

  return (
    <ManagerLayout>
      <PageHeader
        eyebrow={PAGE_EYEBROWS.manager}
        title="AI Insights"
        subtitle="Ask questions about your candidates using AI analysis"
      />

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-4 md:min-h-[32rem]">
          {/* Sidebar - Conversations */}
          <div className="md:col-span-1">
            <div className="page-glass flex min-h-[28rem] flex-col md:min-h-[32rem]">
              <div className="p-4 border-b">
                <button
                  type="button"
                  onClick={() =>
                    showNewConversation ? setShowNewConversation(false) : openNewConversationPanel()
                  }
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                >
                  + New Conversation
                </button>
                <div className="mt-3 space-y-2">
                  <GlassSelect
                    id="ai-insights-job-filter"
                    aria-label="Filter conversations by job"
                    value={selectedJobFilter}
                    onChange={setSelectedJobFilter}
                    options={jobFilterOptions}
                    placeholder="All jobs"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={favoritesOnly}
                      onChange={(e) => setFavoritesOnly(e.target.checked)}
                    />
                    Favorites only
                  </label>
                </div>
              </div>

              {showNewConversation && (
                <div className="p-4 border-b bg-blue-50">
                  <GlassSelect
                    id="ai-new-conv-job"
                    aria-label="Job for new conversation"
                    className="mb-2"
                    value={selectedJobForNew}
                    onChange={handleNewConversationJobChange}
                    options={newConversationJobOptions}
                    placeholder="Select job"
                  />
                  {selectedJobForNew && (
                    <p className="mb-2 text-xs text-gray-600">
                      Conversation name:{" "}
                      <span className="font-semibold text-gray-800">{newConvTitle}</span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateConversation}
                      className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition flex items-center justify-center gap-2"
                      disabled={createLoading}
                    >
                      {createLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        "Create"
                      )}
                    </button>
                    <button
                      onClick={() => setShowNewConversation(false)}
                      className="flex-1 rounded bg-gray-400 px-3 py-1 text-sm text-white transition hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredConversations.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No conversations yet</p>
                ) : (
                  filteredConversations.map(conv => (
                    <div
                      key={conv.conversation_id}
                      className={`rounded-xl p-3 transition ${
                        selectedConversationId === conv.conversation_id
                          ? "bg-white/55 shadow-inner ring-1 ring-white/60"
                          : "page-glass-inset hover:bg-white/45"
                      }`}
                    >
                      {editingConvId === conv.conversation_id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameConversation(conv.conversation_id)}
                            className="text-green-600 hover:text-green-700 text-sm font-bold"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingConvId(null)
                              setEditingTitle("")
                            }}
                            className="text-gray-400 hover:text-gray-600 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => loadConversation(conv.conversation_id)}
                            className="w-full text-left"
                          >
                            <p className="font-semibold text-sm text-gray-800 truncate">
                              {conv.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {getJobTitle(conv.job_id)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {conv.message_count} messages
                            </p>
                          </button>
                          <div className="mt-2 flex justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(conv.conversation_id, conv.is_favorite)}
                              className={`rounded-lg p-1.5 transition hover:bg-white/55 ${
                                conv.is_favorite ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
                              }`}
                              aria-label={conv.is_favorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <DashboardNavIcon name="star" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingConvId(conv.conversation_id)
                                setEditingTitle(conv.title)
                              }}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/55 hover:text-emerald-800"
                              aria-label="Rename conversation"
                            >
                              <DashboardNavIcon name="pencil" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteConversation(conv.conversation_id)}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Delete conversation"
                            >
                              <DashboardNavIcon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex min-h-[28rem] flex-col overflow-hidden page-glass md:col-span-3 md:min-h-[32rem]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!selectedConversationId ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <DashboardNavIcon name="clipboardList" className="h-9 w-9" />
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">
                    No Conversation Selected
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-xs">
                    Create a new conversation or select one from the sidebar to start chatting
                  </p>
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <DashboardNavIcon name="cpu" className="h-9 w-9" />
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">
                    AI Candidate Insights
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-xs">
                    Ask questions about your candidates and get AI-powered analysis
                  </p>

                  {suggestions.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-3">
                        Try asking:
                      </p>
                      <div className="space-y-2">
                        {suggestions.slice(0, 3).map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestion(suggestion)}
                            className="block text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 p-3 rounded-lg transition w-64"
                          >
                            "{suggestion}"
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {currentMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="page-glass-inset rounded-2xl p-4">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-4">
              {suggestions.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {suggestions.slice(0, 5).map((suggestion, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSuggestion(suggestion)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-full transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about candidates..."
                  disabled={isLoading}
                  className="page-glass-input flex-1 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200/50 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 transition"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </ManagerLayout>
  )
}
