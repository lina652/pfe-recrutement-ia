import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useLanguage } from "../../context/LanguageContext"
import { getPublicJobDetail, getSimilarJobs } from "../../api/authApi"

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang, setLang, t, isRTL } = useLanguage()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [similarJobs, setSimilarJobs] = useState([])
  const [showLangPopup, setShowLangPopup] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPublicJobDetail(id)
      .then((res) => { setJob(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    getSimilarJobs(id)
      .then((res) => setSimilarJobs((res.data.jobs || []).slice(0, 3)))
      .catch(() => {})
  }, [id])

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:36, height:36, border:"3px solid #7B5AC8", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    </div>
  )

  if (!job) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <p style={{ fontSize:48, marginBottom:16 }}>🔍</p>
        <p style={{ color:"#6b7280", fontSize:18 }}>{t.jobNotFound}</p>
        <button onClick={() => navigate("/jobs")} style={{ marginTop:16, background:"#7B5AC8", color:"white", border:"none", padding:"12px 28px", borderRadius:8, cursor:"pointer", fontWeight:600 }}>
          {t.backToJobs}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ direction:isRTL?"rtl":"ltr", paddingBottom:80 }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        background:"linear-gradient(135deg,#7B5AC8 0%,#9683EC 50%,#B8A8F0 100%)",
        position:"fixed", top:0, left:0, right:0, zIndex:50,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 40px"
      }}>
        <div onClick={() => navigate("/")} style={{ fontFamily:"'Monotype Corsiva','Apple Chancery',cursive", fontSize:"28px", color:"white", cursor:"pointer" }}>
          Talent<span style={{ color:"#f97316", fontWeight:700 }}>Os</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"32px" }}>
          {[
            { label:t.home, action:() => navigate("/") },
            { label:t.jobs, action:() => navigate("/jobs") },
            { label:t.login, action:() => navigate("/login") },
          ].map((l, i) => (
            <span key={i} onClick={l.action}
              style={{ color:"white", fontSize:"13px", fontWeight:600, letterSpacing:"2px", textTransform:"uppercase", cursor:"pointer", opacity:0.9 }}
              onMouseOver={(e)=>e.target.style.opacity=0.6}
              onMouseOut={(e)=>e.target.style.opacity=0.9}
            >{l.label}</span>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative" }}>
          <div style={{ position:"relative" }}>
            <button onClick={()=>setShowLangPopup(!showLangPopup)}
              style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:20 }}
            >🌐</button>
            {showLangPopup && (
              <div className="animate-slide-down" style={{ position:"absolute", top:"100%", right:0, marginTop:8, background:"white", borderRadius:12, padding:8, boxShadow:"0 8px 30px rgba(0,0,0,0.15)", minWidth:140, zIndex:100 }}>
                {[{code:"en",label:"🇬🇧 English"},{code:"fr",label:"🇫🇷 Français"},{code:"ar",label:"🇸🇦 العربية"}].map((l)=>(
                  <div key={l.code} onClick={()=>{setLang(l.code);setShowLangPopup(false)}}
                    style={{ padding:"10px 16px", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:lang===l.code?700:400, color:lang===l.code?"#7B5AC8":"#374151", background:lang===l.code?"#f5f3ff":"transparent" }}
                  >{l.label}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO HEADER ── */}
      <section style={{
        background:"linear-gradient(135deg,#7B5AC8 0%,#9683EC 50%,#B8A8F0 100%)",
        marginTop:60, position:"relative", overflow:"hidden",
        padding:"60px 40px 48px 40px"
      }}>
        {/* Floating blobs */}
        <div className="animate-float" style={{ position:"absolute", width:80, height:80, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"50% 30% 60% 40%", top:20, left:80, opacity:0.6, filter:"blur(2px)" }}/>
        <div className="animate-float" style={{ position:"absolute", width:60, height:60, background:"#06b6d4", borderRadius:"40% 60% 30% 70%", top:10, right:120, opacity:0.5, filter:"blur(2px)", animationDelay:"1s" }}/>
        <div className="animate-float" style={{ position:"absolute", width:50, height:50, background:"linear-gradient(135deg,#B8A8F0,#9683EC)", borderRadius:"50% 40% 60% 30%", bottom:20, left:300, opacity:0.6, filter:"blur(2px)", animationDelay:"2s" }}/>

        <div style={{ maxWidth:1100, margin:"0 auto", position:"relative", zIndex:10 }}>
          <button onClick={() => navigate("/jobs")} style={{
            background:"rgba(255,255,255,0.15)", color:"white", border:"none",
            padding:"8px 20px", borderRadius:20, fontSize:13, fontWeight:600,
            cursor:"pointer", marginBottom:24, display:"inline-flex", alignItems:"center", gap:6
          }}>
            {t.backToJobs}
          </button>

          <h1 style={{ fontSize:40, fontWeight:200, color:"white", marginBottom:12 }}>{job.title}</h1>
          <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ color:"white", fontSize:16, fontWeight:600 }}>{job.company_name}</span>
            {job.location && <span style={{ color:"rgba(255,255,255,0.8)", fontSize:14 }}>📍 {job.location}</span>}
            <span style={{
              fontSize:12, fontWeight:700, padding:"4px 14px", borderRadius:20,
              background:"rgba(255,255,255,0.2)", color:"white"
            }}>{job.contract_type}</span>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <section style={{ maxWidth:1100, margin:"0 auto", padding:"40px 20px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:32 }}>

          {/* Left Column */}
          <div>
            {/* Description */}
            <div style={{ background:"white", borderRadius:16, border:"1px solid #f3f4f6", padding:28, marginBottom:20, boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:"#111827", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                📋 {t.jobDescription}
              </h2>
              <p style={{ color:"#4b5563", fontSize:14, lineHeight:1.9, whiteSpace:"pre-line" }}>{job.description}</p>
            </div>

            {/* Requirements */}
            {job.requirements && (
              <div style={{ background:"white", borderRadius:16, border:"1px solid #f3f4f6", padding:28, marginBottom:20, boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
                <h2 style={{ fontSize:20, fontWeight:700, color:"#111827", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                  ✅ {t.requirements}
                </h2>
                <p style={{ color:"#4b5563", fontSize:14, lineHeight:1.9, whiteSpace:"pre-line" }}>{job.requirements}</p>
              </div>
            )}

            {/* Skills */}
            {job.required_skills?.length > 0 && (
              <div style={{ background:"white", borderRadius:16, border:"1px solid #f3f4f6", padding:28, marginBottom:20, boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
                <h2 style={{ fontSize:20, fontWeight:700, color:"#111827", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                  🔧 {t.requiredSkills}
                </h2>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {job.required_skills.map((s, i) => (
                    <span key={i} style={{ background:"#f5f3ff", color:"#7B5AC8", padding:"6px 16px", borderRadius:20, fontSize:13, fontWeight:600 }}>
                      {s.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column — Details */}
          <div>
            <div style={{ background:"white", borderRadius:16, border:"1px solid #f3f4f6", padding:28, boxShadow:"0 2px 12px rgba(0,0,0,0.04)", position:"sticky", top:100 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:"#111827", marginBottom:20 }}>
                {t.jobDetails}
              </h2>
              <div style={{ display:"grid", gap:16 }}>
                {[
                  { icon:"📋", label:t.contract, value:job.contract_type },
                  { icon:"📍", label:t.locationType, value:job.location_type || "—" },
                  { icon:"🏢", label:t.department, value:job.department || "—" },
                  { icon:"📊", label:t.level, value:job.experience_level || "—" },
                  { icon:"⏱️", label:t.experience, value:job.experience_years ? `${job.experience_years} ${t.years}` : "—" },
                  { icon:"🎓", label:t.education, value:job.education_level || "—" },
                  { icon:"💰", label:t.salary, value:job.salary_range || "—" },
                  { icon:"📅", label:t.postedDate, value:new Date(job.posted_date).toLocaleDateString() },
                ].map((d, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #f9fafb", paddingBottom:12 }}>
                    <span style={{ fontSize:13, color:"#6b7280" }}>{d.icon} {d.label}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#1f2937" }}>{d.value}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => navigate(`/jobs/${id}/apply`)} style={{
                width:"100%", marginTop:24,
                background:"linear-gradient(135deg,#7B5AC8,#9683EC)", color:"white",
                border:"none", padding:"14px 0", borderRadius:10,
                fontSize:15, fontWeight:700, cursor:"pointer",
                transition:"all 0.3s ease"
              }}
              onMouseOver={(e) => e.target.style.opacity = 0.9}
              onMouseOut={(e) => e.target.style.opacity = 1}
              >
                {t.applyWithCV}
              </button>
            </div>
          </div>
        </div>

        {/* ── SIMILAR JOBS ── */}
        {similarJobs.length > 0 && (
          <div style={{ marginTop:60 }}>
            <h2 className="dancing-title" style={{ fontSize:32, fontWeight:700, color:"#111827", marginBottom:24, textAlign:"center" }}>
              {t.similarJobs}
            </h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
              {similarJobs.map((j) => (
                <div key={j.job_id} className="card-hover" style={{
                  background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", borderRadius:16,
                  padding:24, border:"1px solid #e9d5ff", cursor:"pointer"
                }} onClick={() => { navigate(`/jobs/${j.job_id}`); window.scrollTo(0, 0) }}>
                  <h3 style={{ fontSize:16, fontWeight:700, color:"#1f2937", marginBottom:6 }}>{j.title}</h3>
                  <p style={{ fontSize:13, color:"#7B5AC8", fontWeight:600, marginBottom:12 }}>{j.company_name}</p>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {j.location && <span style={{ fontSize:11, color:"#6b7280" }}>📍 {j.location}</span>}
                    <span style={{ fontSize:11, color:"#6b7280" }}>📋 {j.contract_type}</span>
                    {j.salary_range && <span style={{ fontSize:11, color:"#6b7280" }}>💰 {j.salary_range}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── STICKY APPLY BAR ── */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:50,
        background:"white", borderTop:"1px solid #e5e7eb",
        padding:"12px 40px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        boxShadow:"0 -4px 20px rgba(0,0,0,0.08)"
      }}>
        <div>
          <p style={{ fontSize:16, fontWeight:700, color:"#111827" }}>{job.title}</p>
          <p style={{ fontSize:13, color:"#7B5AC8", fontWeight:600 }}>{job.company_name}</p>
        </div>
        <button onClick={() => navigate(`/jobs/${id}/apply`)} style={{
          background:"linear-gradient(135deg,#7B5AC8,#9683EC)", color:"white",
          border:"none", padding:"12px 32px", borderRadius:10,
          fontSize:14, fontWeight:700, cursor:"pointer",
          boxShadow:"0 4px 16px rgba(123,90,200,0.3)"
        }}>
          {t.applyWithCV}
        </button>
      </div>
    </div>
  )
}
