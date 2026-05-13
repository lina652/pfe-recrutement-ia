import { useState, useEffect, useRef } from "react"
import { useAuth } from "../../context/AuthContext"
import RecruiterLayout from "../../components/recruiter/RecruiterLayout"
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
      setJobs(jobsResult.data || [])
      setSelectedJobForNew(jobsResult.data?.[0]?.job_id || "")
      
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
    if (!newConvTitle.trim() || !selectedJobForNew) {
      setToast({ type: "error", message: "Please enter a title and select a job" })
      return
    }

    try {
      setCreateLoading(true)
      const result = await createRAGConversation(selectedJobForNew, newConvTitle)
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

        const newTitle = userMessage.length > 30 ? userMessage.substring(0, 30) + "..." : userMessage
        const result = await createRAGConversation(jobToUse, newTitle)
        
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

  const filteredConversations = conversations.filter((conv) => {
    const matchJob = selectedJobFilter === "all" || conv.job_id === selectedJobFilter
    const matchFavorite = !favoritesOnly || conv.is_favorite
    return matchJob && matchFavorite
  })

  if (loading) {
    return (
      <RecruiterLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RecruiterLayout>
    )
  }

  return (
    <RecruiterLayout>
      <div className="h-full flex flex-col p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AI Insights</h1>
        <p className="text-gray-600 mb-6">
          Ask questions about your candidates using AI analysis
        </p>

        <div className="grid md:grid-cols-4 gap-6 flex-1">
          {/* Sidebar - Conversations */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow flex flex-col h-full">
              <div className="p-4 border-b">
                <button
                  onClick={() => setShowNewConversation(!showNewConversation)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                >
                  + New Conversation
                </button>
                <div className="mt-3 space-y-2">
                  <select
                    value={selectedJobFilter}
                    onChange={(e) => setSelectedJobFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="all">All jobs</option>
                    {jobs.map((job) => (
                      <option key={job.job_id} value={job.job_id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
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
                  <input
                    type="text"
                    value={newConvTitle}
                    onChange={(e) => setNewConvTitle(e.target.value)}
                    placeholder="Conversation title..."
                    className="w-full px-3 py-2 border rounded mb-2 text-sm"
                  />
                  <select
                    value={selectedJobForNew}
                    onChange={(e) => setSelectedJobForNew(e.target.value)}
                    className="w-full px-3 py-2 border rounded mb-2 text-sm"
                  >
                    <option value="">Select Job</option>
                    {jobs.map(job => (
                      <option key={job.job_id} value={job.job_id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
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
                      className="flex-1 px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white text-sm rounded transition"
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
                      className={`p-3 rounded-lg transition ${
                        selectedConversationId === conv.conversation_id
                          ? "bg-blue-100 border-l-4 border-blue-600"
                          : "bg-gray-50 hover:bg-gray-100"
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
                          <div className="flex gap-1 mt-2 justify-end">
                            <button
                              onClick={() => handleToggleFavorite(conv.conversation_id, conv.is_favorite)}
                              className={`text-lg ${conv.is_favorite ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400 transition`}
                            >
                              ⭐
                            </button>
                            <button
                              onClick={() => {
                                setEditingConvId(conv.conversation_id)
                                setEditingTitle(conv.title)
                              }}
                              className="text-gray-400 hover:text-blue-600 transition text-sm"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteConversation(conv.conversation_id)}
                              className="text-gray-400 hover:text-red-600 transition text-sm"
                            >
                              🗑️
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
          <div className="md:col-span-3 flex flex-col bg-white rounded-lg shadow overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!selectedConversationId ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">
                    No Conversation Selected
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-xs">
                    Create a new conversation or select one from the sidebar to start chatting
                  </p>
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-6xl mb-4">🤖</div>
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
                      <div className="bg-gray-100 p-4 rounded-lg">
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
                  {suggestions.slice(0, 4).map((suggestion, i) => (
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
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
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
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </RecruiterLayout>
  )
}
