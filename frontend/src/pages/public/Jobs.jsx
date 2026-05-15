import React, { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useLanguage } from "../../context/LanguageContext"
import { getPublicJobs, matchJobsByCV, matchJobsByProfile, getMyApplications } from "../../api/authApi"
import { useAuth } from "../../context/AuthContext"
import Navbar from "../../components/Navbar"
import Toast from "../../components/Toast"
import GlassSelect from "../../components/shared/GlassSelect"

const SESSION_KEY = "talentos_ranked_jobs"
const SESSION_CV_KEY = "talentos_cv_name"
const SESSION_APPLIED_KEY = "talentos_applied_jobs"
const MIN_MATCH_PERCENTAGE = 40 // Minimum semantic matching threshold to apply

export default function Jobs() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, setLang, t, isRTL } = useLanguage()
  const [jobs, setJobs] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [search, setSearch] = useState("")
  const [location, setLocation] = useState("")
  const [contractType, setContractType] = useState("")
  const [loading, setLoading] = useState(!sessionStorage.getItem(SESSION_KEY))
  const [matching, setMatching] = useState(false)
  const [matchingMode, setMatchingMode] = useState(() => !!sessionStorage.getItem(SESSION_KEY))
  const [matchedCvName, setMatchedCvName] = useState(() => sessionStorage.getItem(SESSION_CV_KEY) || "")
  const [featuredJobs, setFeaturedJobs] = useState([])
  const [toast, setToast] = useState(null)
  const [appliedJobIds, setAppliedJobIds] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_APPLIED_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  // ── Fetch normally if no ranked jobs in session ──
  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      fetchJobs()
    }
  }, [])

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (location) params.append("location", location)
      if (contractType) params.append("contract_type", contractType)
      const res = await getPublicJobs(Object.fromEntries(params.entries()))
      const data = res.data
      setJobs(data.jobs || [])
      setMatchingMode(false)
      setMatchedCvName("")
    } catch {
      setJobs([])
      setMatchingMode(false)
      setMatchedCvName("")
    } finally {
      setLoading(false)
    }
  }

  const isFirstRender = React.useRef(true)

  // Re-fetch when filters change (but only if NOT in matching mode from session)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // If we're in matching mode, don't auto-fetch unranked jobs
    if (matchingMode) return
    fetchJobs()
  }, [search, location, contractType, matchingMode])

  // Auto-rank for logged-in candidates
  useEffect(() => {
    const autoRankFromProfile = async () => {
      if (!user || user.role !== "CANDIDATE") return
      // Don't override session ranked jobs
      if (sessionStorage.getItem(SESSION_KEY)) return
      setMatching(true)
      try {
        const params = new URLSearchParams()
        if (search) params.append("search", search)
        if (location) params.append("location", location)
        if (contractType) params.append("contract_type", contractType)
        const res = await matchJobsByProfile(Object.fromEntries(params.entries()))
        const data = res.data || {}
        const ranked = data.jobs || []
        if (ranked.length > 0) {
          setJobs(ranked)
          setMatchingMode(true)
          setMatchedCvName(data.profile?.name || "")
        } else {
          setMatchingMode(false)
          setMatchedCvName("")
        }
      } catch {
        setMatchingMode(false)
        setMatchedCvName("")
      } finally {
        setMatching(false)
      }
    }
    autoRankFromProfile()
  }, [user])

  // Clear ranking on logout
  useEffect(() => {
    if (!user && matchingMode && !sessionStorage.getItem(SESSION_KEY)) {
      clearRanking()
    }
  }, [user, matchingMode])

  // Fetch featured jobs
  useEffect(() => {
    getPublicJobs()
      .then((res) => setFeaturedJobs((res.data.jobs || []).slice(0, 3)))
      .catch(() => {})
  }, [])

  // ── Fetch applied jobs for logged-in candidates ──
  useEffect(() => {
    if (!user || user.role !== "CANDIDATE") {
      setAppliedJobIds(new Set())
      sessionStorage.removeItem(SESSION_APPLIED_KEY)
      return
    }
    getMyApplications()
      .then((res) => {
        const ids = (res.data.applications || []).map(a => a.job_id)
        const newSet = new Set(ids)
        setAppliedJobIds(newSet)
        sessionStorage.setItem(SESSION_APPLIED_KEY, JSON.stringify(ids))
      })
      .catch(() => {})
  }, [user])

  // ── Helper: mark a job as applied ──
  const markJobAsApplied = (jobId) => {
    setAppliedJobIds(prev => {
      const next = new Set(prev)
      next.add(jobId)
      sessionStorage.setItem(SESSION_APPLIED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  // ── Clear ranking ──
  const clearRanking = () => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_CV_KEY)
    setMatchingMode(false)
    setMatchedCvName("")
    fetchJobs()
  }

  // ── CV Upload handler ──
  const handleCVUpload = async (selectedFile) => {
    if (!selectedFile) return
    const formData = new FormData()
    formData.append("file", selectedFile)
    setMatching(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (location) params.append("location", location)
      if (contractType) params.append("contract_type", contractType)
      const res = await matchJobsByCV(formData, Object.fromEntries(params.entries()))
      const data = res.data || {}
      const rankedJobs = data.jobs || []

      if (rankedJobs.length > 0) {
        setJobs(rankedJobs)
        setMatchingMode(true)
        setMatchedCvName(data.cv?.extracted_name || "")

        // Persist in sessionStorage
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(rankedJobs))
        sessionStorage.setItem(SESSION_CV_KEY, data.cv?.extracted_name || "")

        // Show appropriate toast
        if (data.cv?.account_exists) {
          setToast({
            message: `Welcome back${data.cv.extracted_name ? `, ${data.cv.extracted_name}` : ""}! Your personalized matches are ready.`,
            variant: "welcome"
          })
        } else {
          setToast({
            message: "CV analyzed! Browse your personalized job matches below.",
            variant: "success"
          })
        }
      } else {
        setMatchingMode(false)
        setMatchedCvName("")
        setToast({
          message: "No matching jobs found for your CV. Try broadening your search.",
          variant: "info"
        })
      }
    } catch {
      setToast({
        message: "Could not analyze your CV. Please try again.",
        variant: "error"
      })
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ direction: isRTL ? "rtl" : "ltr" }}>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}

      {/* ── NAVBAR ── */}
      <Navbar />

      {/* ── HERO ── */}
      <section style={{
        background: "linear-gradient(135deg,#7B5AC8 0%,#9683EC 50%,#B8A8F0 100%)",
        marginTop: "60px", position: "relative", overflow: "visible",
        padding: "80px 40px 60px 40px", textAlign: "center"
      }}>
        {/* Blobs — own layer so the section can stay overflow:visible for dropdowns */}
        <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div className="animate-float" style={{ position: "absolute", width: 80, height: 80, background: "linear-gradient(135deg,#f97316,#ef4444)", borderRadius: "50% 30% 60% 40%", top: 40, left: 60, opacity: 0.7, filter: "blur(2px)" }}/>
        <div className="animate-float" style={{ position: "absolute", width: 60, height: 60, background: "#06b6d4", borderRadius: "40% 60% 30% 70%", top: 20, right: 100, opacity: 0.6, filter: "blur(2px)", animationDelay: "1s" }}/>
        <div className="animate-float" style={{ position: "absolute", width: 50, height: 50, background: "linear-gradient(135deg,#B8A8F0,#9683EC)", borderRadius: "50% 40% 60% 30%", bottom: 40, left: 200, opacity: 0.7, filter: "blur(2px)", animationDelay: "2s" }}/>
        <div className="animate-float" style={{ position: "absolute", width: 70, height: 70, background: "linear-gradient(135deg,#f97316,#ef4444)", borderRadius: "40% 60% 50% 30%", bottom: 20, right: 300, opacity: 0.6, filter: "blur(2px)", animationDelay: "3s" }}/>
        </div>

        <h1 style={{ fontSize: "48px", fontWeight: 200, color: "white", marginBottom: "16px", position: "relative", zIndex: 10, lineHeight: 1.2 }}>
          {t.findDreamJob}
        </h1>

        {/* Upload CV button */}
        <div style={{ position: "relative", zIndex: 10, marginBottom: "32px" }}>
          <label
            htmlFor="upload-cv-hero"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "white", color: "#7B5AC8", border: "none",
              padding: "14px 36px", fontSize: 14, fontWeight: 700,
              borderRadius: 30, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              transition: "all 0.3s ease"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f5f3ff"; e.currentTarget.style.transform = "translateY(-2px)" }}
            onMouseOut={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.transform = "translateY(0)" }}
          >
            📄 {t.uploadCV}
          </label>
          <input id="upload-cv-hero" type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0]
              if (selectedFile) handleCVUpload(selectedFile)
              e.target.value = "" // reset so same file can be re-uploaded
            }}
          />
        </div>

        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "stretch", maxWidth: 800, margin: "0 auto", gap: 0,
          background: "white", borderRadius: 12, overflow: "visible",
          boxShadow: "0 8px 24px rgba(15,23,42,0.08)", position: "relative", zIndex: 10
        }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t.jobTitle}
            className="rounded-s-xl"
            style={{ flex: 2, padding: "16px 20px", border: "none", outline: "none", fontSize: 14, color: "#374151" }}
          />
          <div style={{ width: 1, background: "#e5e7eb", margin: "8px 0" }}/>
          <input value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder={t.location}
            style={{ flex: 1, padding: "16px 20px", border: "none", outline: "none", fontSize: 14, color: "#374151" }}
          />
          <div style={{ width: 1, background: "#e5e7eb", margin: "8px 0" }}/>
          <GlassSelect
            id="jobs-contract-type"
            aria-label={t.contract}
            value={contractType}
            onChange={setContractType}
            plainTrigger
            options={[
              { value: "", label: t.allTypes },
              { value: "CDI", label: "CDI" },
              { value: "CDD", label: "CDD" },
              { value: "INTERNSHIP", label: "Internship" },
              { value: "FREELANCE", label: "Freelance" },
            ]}
            placeholder={t.allTypes}
            className="z-[21] flex-[0_0_10.5rem] min-h-[52px] min-w-0 self-stretch sm:flex-[0_0_11.5rem] [&>button]:min-h-[52px] [&>button]:!rounded-none [&>button]:!rounded-e-xl [&>button]:!px-3 [&>button]:!py-0"
            listClassName="!mt-1"
          />
        </div>
      </section>

      {/* ── JOB LISTINGS ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
          {jobs.length} {t.jobsAvailable}
        </p>

        {/* Ranking banner */}
        {matchingMode && (
          <div style={{
            marginBottom: 16, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
            border: "1px solid #e9d5ff", borderRadius: 14, padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <span style={{ color: "#5b21b6", fontSize: 13, fontWeight: 700 }}>
                Ranked by CV match{matchedCvName ? ` for ${matchedCvName}` : ""}
              </span>
            </div>
            <button
              onClick={clearRanking}
              style={{
                background: "rgba(91,33,182,0.1)", border: "1px solid #c4b5fd",
                borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                color: "#5b21b6", cursor: "pointer", transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#5b21b6"; e.currentTarget.style.color = "white" }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(91,33,182,0.1)"; e.currentTarget.style.color = "#5b21b6" }}
            >
              ✕ Clear Ranking
            </button>
          </div>
        )}

        {loading || matching ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", gap: 16 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #7B5AC8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            {matching && <p style={{ color: "#7B5AC8", fontSize: 13, fontWeight: 600 }}>Analyzing your CV with AI...</p>}
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
            <p>{t.noJobs}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 20 }}>
            {jobs.map((job) => (
              <div key={job.job_id} className="card-hover" style={{
                background: "white", borderRadius: 16, border: "1px solid #f3f4f6",
                padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                transition: "all 0.3s ease", cursor: "pointer"
              }} onClick={() => navigate(`/jobs/${job.job_id}`)}>
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{job.title}</h3>
                    <p style={{ fontSize: 13, color: "#7B5AC8", fontWeight: 600 }}>{job.company_name}</p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                    background: job.contract_type === "CDI" ? "#f0fdf4" : job.contract_type === "CDD" ? "#eff6ff" : "#faf5ff",
                    color: job.contract_type === "CDI" ? "#16a34a" : job.contract_type === "CDD" ? "#2563eb" : "#7c3aed"
                  }}>{job.contract_type}</span>
                </div>

                {/* Match percentage badge - Only show if CV uploaded (matchingMode) */}
                {matchingMode && typeof job.match_percentage === "number" && (
                  <div style={{
                    marginBottom: 12, borderRadius: 12, padding: "10px 12px",
                    background: job.match_percentage >= 75 ? "linear-gradient(135deg, #ecfdf5, #d1fae5)"
                      : job.match_percentage >= MIN_MATCH_PERCENTAGE ? "linear-gradient(135deg, #ecfeff, #cffafe)"
                      : "linear-gradient(135deg, #fef3c7, #fde68a)",
                    border: job.match_percentage >= 75 ? "1px solid #6ee7b7"
                      : job.match_percentage >= MIN_MATCH_PERCENTAGE ? "1px solid #67e8f9"
                      : "1px solid #fcd34d"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>
                        {job.match_percentage >= 75 ? "🟢" : job.match_percentage >= MIN_MATCH_PERCENTAGE ? "🔵" : "🟡"}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 800,
                        color: job.match_percentage >= 75 ? "#059669" : job.match_percentage >= MIN_MATCH_PERCENTAGE ? "#0891b2" : "#d97706"
                      }}>
                        {job.match_percentage.toFixed(1)}% Match
                      </span>
                    </div>
                    {job.match_percentage < MIN_MATCH_PERCENTAGE && (
                      <div style={{ fontSize: 11, color: "#d97706", marginTop: 4, fontWeight: 600 }}>
                        Minimum {MIN_MATCH_PERCENTAGE}% match required to apply
                      </div>
                    )}
                  </div>
                )}

                {job.description && (
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {job.description}
                  </p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {job.location && <span style={{ fontSize: 11, color: "#6b7280", background: "#f9fafb", padding: "4px 10px", borderRadius: 6 }}>📍 {job.location}</span>}
                  {job.salary_range && <span style={{ fontSize: 11, color: "#6b7280", background: "#f9fafb", padding: "4px 10px", borderRadius: 6 }}>💰 {job.salary_range}</span>}
                  {job.department && <span style={{ fontSize: 11, color: "#6b7280", background: "#f9fafb", padding: "4px 10px", borderRadius: 6 }}>🏢 {job.department}</span>}
                </div>
                {job.required_skills?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {job.required_skills.slice(0, 4).map((s, i) => (
                      <span key={i} style={{ fontSize: 11, background: "#f5f3ff", color: "#7B5AC8", padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{s.trim()}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {t.posted} {new Date(job.posted_date).toLocaleDateString()}
                  </span>
                  {appliedJobIds.has(job.job_id) ? (
                    <span
                      style={{
                        background: "linear-gradient(135deg, #059669, #10b981)", color: "white",
                        border: "none", padding: "8px 20px", borderRadius: 8,
                        fontSize: 12, fontWeight: 700, display: "inline-flex",
                        alignItems: "center", gap: 6
                      }}
                    >✓ Applied</span>
                  ) : (() => {
                    const canApply = matchingMode && typeof job.match_percentage === "number" && job.match_percentage >= MIN_MATCH_PERCENTAGE
                    const needsCV = !matchingMode
                    const lowMatch = matchingMode && typeof job.match_percentage === "number" && job.match_percentage < MIN_MATCH_PERCENTAGE
                    
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <button
                          onClick={(e) => { 
                            e.stopPropagation()
                            if (canApply) navigate(`/jobs/${job.job_id}/apply`) 
                          }}
                          disabled={!canApply}
                          title={needsCV ? "Upload your CV first" : lowMatch ? `Minimum ${MIN_MATCH_PERCENTAGE}% match required` : ""}
                          style={{
                            background: canApply 
                              ? "linear-gradient(135deg,#7B5AC8,#9683EC)" 
                              : "linear-gradient(135deg,#d1d5db,#9ca3af)",
                            color: "white",
                            border: "none", padding: "8px 20px", borderRadius: 8,
                            fontSize: 12, fontWeight: 600, 
                            cursor: canApply ? "pointer" : "not-allowed",
                            opacity: canApply ? 1 : 0.7
                          }}
                        >{t.applyNow}</button>
                        {needsCV && (
                          <span style={{ fontSize: 10, color: "#9ca3af" }}>Upload CV to apply</span>
                        )}
                        {lowMatch && (
                          <span style={{ fontSize: 10, color: "#d97706" }}>Match too low</span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Featured / Similar Jobs ── */}
        {!matchingMode && featuredJobs.length > 0 && (
          <div style={{ marginTop: 60 }}>
            <h2 className="dancing-title" style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginBottom: 24, textAlign: "center" }}>
              {t.featuredJobs}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
              {featuredJobs.map((job) => (
                <div key={job.job_id} className="card-hover" style={{
                  background: "linear-gradient(135deg,#f5f3ff,#ede9fe)", borderRadius: 16,
                  padding: 24, border: "1px solid #e9d5ff", cursor: "pointer"
                }} onClick={() => navigate(`/jobs/${job.job_id}`)}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>{job.title}</h3>
                  <p style={{ fontSize: 13, color: "#7B5AC8", fontWeight: 600, marginBottom: 12 }}>{job.company_name}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {job.location && <span style={{ fontSize: 11, color: "#6b7280" }}>📍 {job.location}</span>}
                    <span style={{ fontSize: 11, color: "#6b7280" }}>📋 {job.contract_type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: "linear-gradient(135deg,#7B5AC8 0%,#9683EC 60%,#B8A8F0 100%)",
        color: "white", padding: "32px 40px", textAlign: "center"
      }}>
        <p style={{ fontSize: 13, opacity: 0.7 }}>{t.copyright}</p>
      </footer>
    </div>
  )
}
