import { useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { useLanguage } from "../../context/LanguageContext"
import API from "../../api/authApi"
import Navbar from "../../components/Navbar"

const BLOBS = [
  { w:80, h:80, bg:"linear-gradient(135deg,#f97316,#ef4444)", br:"50% 30% 60% 40%", top:40, left:60, op:0.8 },
  { w:60, h:60, bg:"linear-gradient(135deg,#9683EC,#7B5AC8)", br:"40% 60% 30% 70%", bottom:120, left:40, op:0.7 },
  { w:50, h:50, bg:"linear-gradient(135deg,#f97316,#fb923c)", br:"60% 40% 50% 50%", bottom:60, left:200, op:0.8 },
  { w:40, h:40, bg:"#fb923c", br:"50%", bottom:40, left:260, op:0.9 },
  { w:70, h:70, bg:"linear-gradient(135deg,#f97316,#ef4444)", br:"50% 40% 60% 30%", top:20, right:500, op:0.7 },
  { w:90, h:90, bg:"#06b6d4", br:"40% 60% 30% 70%", top:80, right:80, op:0.7 },
  { w:60, h:60, bg:"linear-gradient(135deg,#B8A8F0,#9683EC)", br:"50% 40% 60% 30%", bottom:100, right:300, op:0.7 },
  { w:100, h:100, bg:"#06b6d4", br:"30% 60% 40% 70%", bottom:0, right:0, op:0.6 },
]

const LANDING_HASH_OFFSET = 88

function scrollToHashId(hash) {
  if (!hash || hash === "#") return
  const id = hash.startsWith("#") ? hash.slice(1) : hash
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - LANDING_HASH_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
}

export default function Landing() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, isRTL } = useLanguage()
  const [stats, setStats] = useState({ companies: 0, programs: 0, evaluations: 0, partners: 0 })
  const [animatedStats, setAnimatedStats] = useState({ companies: 0, programs: 0, evaluations: 0, partners: 0 })
  const [expandedService, setExpandedService] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await API.get("/superadmin/stats")
        const data = res.data
        setStats({
          companies: data.companies_count || 1000,
          programs: data.programs_count || 850,
          evaluations: data.evaluations_count || 795,
          partners: data.partners_count || 654
        })
      } catch {
        setStats({ companies: 1000, programs: 850, evaluations: 795, partners: 654 })
      }
    }
    fetchStats()
  }, [])

  // Deep links: /#services, /#contact — scroll after paint (Navbar also triggers scroll)
  useEffect(() => {
    const hash = location.hash
    if (!hash || hash.length < 2) return
    const t = window.setTimeout(() => scrollToHashId(hash), 60)
    return () => clearTimeout(t)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (stats.companies === 0) return
    const duration = 2000
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      setAnimatedStats({
        companies: Math.floor(stats.companies * progress),
        programs: Math.floor(stats.programs * progress),
        evaluations: Math.floor(stats.evaluations * progress),
        partners: Math.floor(stats.partners * progress)
      })
      if (progress < 1) requestAnimationFrame(animate)
      else setAnimatedStats(stats)
    }
    requestAnimationFrame(animate)
  }, [stats])

  const services = [
    { icon:"👤", gradient:"linear-gradient(135deg,#9683EC,#B8A8F0)", title:t.cvParsing, desc:t.cvDesc, more:t.cvMore },
    { icon:"💼", gradient:"linear-gradient(135deg,#ec4899,#f97316)", title:t.smartMatch, desc:t.matchDesc, more:t.matchMore },
    { icon:"⏳", gradient:"linear-gradient(135deg,#9683EC,#7B5AC8)", title:t.aiInterviews, desc:t.interviewDesc, more:t.interviewMore },
    { icon:"🔍", gradient:"linear-gradient(135deg,#06b6d4,#3b82f6)", title:t.ragAssess, desc:t.ragDesc, more:t.ragMore },
    { icon:"❤️", gradient:"linear-gradient(135deg,#f97316,#ef4444)", title:t.multiTenant, desc:t.tenantDesc, more:t.tenantMore },
    { icon:"👥", gradient:"linear-gradient(135deg,#ec4899,#f43f5e)", title:t.fullAuto, desc:t.autoDesc, more:t.autoMore },
  ]

  return (
    <div className="min-h-screen" style={{ direction: isRTL ? "rtl" : "ltr" }}>

      {/* ── NAVBAR ── */}
      <Navbar />

      {/* ── HERO ── */}
      <section style={{
        background: "linear-gradient(135deg,#7B5AC8 0%,#9683EC 50%,#B8A8F0 100%)",
        minHeight: "100vh", marginTop: "60px", position: "relative",
        overflow: "hidden", display: "flex", alignItems: "center", padding: "80px"
      }}>
        {BLOBS.map((b, i) => (
          <div key={i} className="animate-float" style={{
            position:"absolute", width:b.w, height:b.h,
            background:b.bg, borderRadius:b.br,
            top:b.top, left:b.left, right:b.right, bottom:b.bottom,
            opacity:b.op, filter:"blur(2px)",
            animationDelay: `${i * 0.5}s`
          }}/>
        ))}

        <div style={{ flex:1, color:"white", position:"relative", zIndex:10 }}>
          <p style={{
            fontFamily:"'Monotype Corsiva','Apple Chancery',cursive",
            fontSize:"20px", marginBottom:"16px", opacity:0.9
          }}>
            {t.hero_sub}
          </p>
          <h1 style={{ fontSize:"56px", fontWeight:300, lineHeight:1.2, marginBottom:"24px" }}>
            {t.hero_title1}{" "}
            <span style={{ fontWeight:900 }}>{t.hero_bold}</span>
            <br />
            {t.hero_title2}
          </h1>
          <p style={{ opacity:0.75, fontSize:"14px", lineHeight:1.9, maxWidth:"400px", marginBottom:"40px" }}>
            {t.hero_desc}
          </p>
          <div style={{ display:"flex", gap:"16px" }}>
            <button
              type="button"
              onClick={() => navigate("/jobs")}
              style={{
                background: "#ffffff", color: "#5b21b6", border: "none",
                padding: "10px 24px", fontSize: "12px", fontWeight: 700,
                letterSpacing: "2px", textTransform: "uppercase",
                borderRadius: "14px", cursor: "pointer",
              }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = "0.85" }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = "1" }}
            >
              {t.findJob}
            </button>
            <button
              type="button"
              onClick={() => navigate("/company/signup")}
              style={{
                background: "#5b21b6", color: "white", border: "none",
                padding: "10px 24px", fontSize: "12px", fontWeight: 700,
                letterSpacing: "2px", textTransform: "uppercase",
                borderRadius: "14px", cursor: "pointer",
              }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = "0.85" }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = "1" }}
            >
              {t.createCompany}
            </button>
          </div>
        </div>

        <div style={{ flex:1, display:"flex", justifyContent:"center", alignItems:"center", zIndex:10, position:"relative" }}>
          <div style={{ position:"absolute", width:80, height:80, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"50% 30% 60% 40%", top:-40, left:-60, opacity:0.8, filter:"blur(2px)" }}/>
          <div style={{ position:"absolute", width:100, height:100, background:"#06b6d4", borderRadius:"40% 60% 30% 70%", top:-20, right:-80, opacity:0.7, filter:"blur(2px)" }}/>
          <div style={{ position:"absolute", width:70, height:70, background:"linear-gradient(135deg,#B8A8F0,#9683EC)", borderRadius:"50% 40% 60% 30%", bottom:-30, right:-40, opacity:0.7, filter:"blur(2px)" }}/>
          <div style={{ position:"absolute", width:60, height:60, background:"rgba(139,92,246,0.4)", borderRadius:"40% 60% 50% 30%", bottom:-20, left:-50, opacity:0.6, filter:"blur(2px)" }}/>
          <div style={{
            width:380, height:380,
            borderRadius:"30% 70% 70% 30% / 30% 30% 70% 70%",
            overflow:"hidden",
            backgroundImage:"url('/recruitment.webp')",
            backgroundSize:"cover", backgroundPosition:"center",
            boxShadow:"0 20px 60px rgba(109,40,217,0.3)",
            display:"flex", alignItems:"center", justifyContent:"center"
          }} />
        </div>
      </section>

      {/* ── OUR SERVICES ── */}
      <section id="services" style={{ background:"white", padding:"80px 40px", scrollMarginTop: LANDING_HASH_OFFSET }}>
        <div style={{ textAlign:"center", marginBottom:"48px" }}>
          <h2 className="dancing-title" style={{ fontSize:"42px", fontWeight:700, color:"#111827", marginBottom:"16px" }}>
            {t.servicesTitle}
          </h2>
          <div style={{ width:60, height:3, background:"linear-gradient(135deg,#7B5AC8,#9683EC)", margin:"0 auto" }}/>
        </div>

        <div style={{ maxWidth:"1100px", margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"24px" }}>
          {services.map((s, i) => (
            <div key={i} className="card-hover" style={{
              background:"white", borderRadius:"16px", padding:"32px",
              textAlign:"center",
              boxShadow:"0 4px 24px rgba(0,0,0,0.07)",
              border:"1px solid #f3f4f6",
              transition:"all 0.3s ease"
            }}>
              <div style={{
                width:70, height:70, background:s.gradient,
                borderRadius:"50% 40% 60% 30%",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"28px", margin:"0 auto 20px auto"
              }}>
                {s.icon}
              </div>
              <h3 style={{ fontSize:"17px", fontWeight:700, color:"#111827", marginBottom:"12px" }}>
                {s.title}
              </h3>
              <p style={{ color:"#6b7280", fontSize:"13px", lineHeight:1.8 }}>
                {s.desc}
              </p>
              {expandedService === i && (
                <p style={{ color:"#6b7280", fontSize:"13px", lineHeight:1.8, marginTop:12, borderTop:"1px solid #f3f4f6", paddingTop:12 }}>
                  {s.more}
                </p>
              )}
              <button
                onClick={() => setExpandedService(expandedService === i ? null : i)}
                style={{
                  marginTop:16, background:"linear-gradient(135deg,#7B5AC8,#9683EC)",
                  color:"white", border:"none", borderRadius:14,
                  padding:"8px 20px", fontSize:12, fontWeight:600,
                  cursor:"pointer", transition:"all 0.3s ease"
                }}
                onMouseOver={(e) => e.target.style.opacity = 0.85}
                onMouseOut={(e) => e.target.style.opacity = 1}
              >
                {expandedService === i ? t.seeLess : t.seeMore}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPANIES BENEFITS ── */}
      <section style={{
        background:"linear-gradient(135deg,#B8A8F0 0%,#9683EC 40%,#7B5AC8 100%)",
        position:"relative", overflow:"hidden",
        display:"flex", alignItems:"center", padding:"64px 0"
      }}>
        <div style={{
          position:"absolute", width:120, height:120,
          background:"rgba(139,92,246,0.3)", borderRadius:"50%",
          left:200, top:"50%", transform:"translateY(-50%)", filter:"blur(2px)"
        }}/>

        <div style={{ flex:1, display:"flex", justifyContent:"center", alignItems:"center" }}>
          <div style={{
            width:320, height:220, background:"#1f2937", borderRadius:"12px",
            display:"flex", alignItems:"center", justifyContent:"center",
            transform:"rotate(-5deg)", boxShadow:"0 25px 50px rgba(0,0,0,0.3)", position:"relative"
          }}>
            <div style={{ width:"90%", height:"85%", background:"white", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:32, fontWeight:900, color:"#9683EC", letterSpacing:"4px", fontFamily:"'Monotype Corsiva','Apple Chancery',cursive" }}>
                Talent<span style={{ color:"#7B5AC8" }}>Os.</span>
              </span>
            </div>
            <div style={{ position:"absolute", bottom:-30, left:-20, width:"120%", height:30, background:"#374151", borderRadius:"4px", transform:"perspective(200px) rotateX(20deg)" }}/>
          </div>
        </div>

        <div style={{ flex:1, color:"white", padding:"0 64px", position:"relative", zIndex:10 }}>
          <h2 className="dancing-title" style={{ fontSize:"40px", fontWeight:700, color:"white", marginBottom:"16px" }}>
            {t.benefitsTitle}
          </h2>
          <div style={{ width:60, height:3, background:"white", marginBottom:"32px" }}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"24px", textAlign:"center" }}>
            {[
              { value:animatedStats.companies, label:t.companyHelp },
              { value:animatedStats.programs, label:t.corporate },
              { value:animatedStats.evaluations, label:t.aiEval },
              { value:animatedStats.partners, label:t.strategic },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ fontSize:"36px", fontWeight:700, marginBottom:"8px" }}>{s.value}</p>
                <p style={{ fontSize:"13px", opacity:0.8 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:"absolute", width:40, height:40, background:"linear-gradient(135deg,#ef4444,#f97316)", borderRadius:"50% 40% 60% 30%", bottom:20, right:200, opacity:0.8, filter:"blur(2px)" }}/>
      </section>

      {/* ── OUR AWESOME CLIENTS ── */}
      <section style={{ background:"white", padding:"64px 40px" }}>
        <div style={{ textAlign:"center", marginBottom:"40px" }}>
          <h2 className="dancing-title" style={{ fontSize:"42px", fontWeight:700, color:"#111827", marginBottom:"16px" }}>
            {t.clientsTitle}
          </h2>
          <div style={{ width:60, height:3, background:"linear-gradient(135deg,#7B5AC8,#9683EC)", margin:"0 auto" }}/>
        </div>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"16px" }}>
            {[
              { name:"TechCorp", s:{ fontFamily:"serif", fontStyle:"italic", fontSize:"28px" } },
              { name:"ORGANIC", s:{ letterSpacing:"6px", fontSize:"13px", fontWeight:300 } },
              { name:"natural", s:{ fontSize:"22px", fontWeight:300, letterSpacing:"2px" } },
              { name:"NEW WAVE", s:{ fontSize:"18px", fontWeight:900, letterSpacing:"3px" } },
            ].map((c, i) => (
              <div key={i} className="card-hover" style={{
                height:100, border:"1px solid #f3f4f6", borderRadius:8,
                background:"white", boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>
                <span style={{ color:"#374151", ...c.s }}>{c.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px" }}>
            {[
              { name:"A Design Hub", s:{ fontWeight:900, fontSize:"22px", letterSpacing:"2px" } },
              { name:"Mockup", s:{ fontFamily:"serif", fontStyle:"italic", fontSize:"32px" } },
              { name:"travel", s:{ fontFamily:"serif", fontStyle:"italic", fontSize:"32px" } },
            ].map((c, i) => (
              <div key={i} className="card-hover" style={{
                height:100, border:"1px solid #f3f4f6", borderRadius:8,
                background:"white", boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>
                <span style={{ color:"#374151", ...c.s }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ background:"#f9fafb", padding:"80px 40px", textAlign:"center", scrollMarginTop: LANDING_HASH_OFFSET }}>
        <h2 className="dancing-title" style={{ fontSize:"42px", fontWeight:700, color:"#111827", marginBottom:"16px" }}>
          {t.contactTitle}
        </h2>
        <div style={{ width:60, height:3, background:"linear-gradient(135deg,#7B5AC8,#9683EC)", margin:"0 auto 48px auto" }}/>
        <div style={{ display:"flex", justifyContent:"center", gap:"60px", flexWrap:"wrap" }}>
          {[
            { src:"/landing-page-emojis/email.svg", alt:t.contactEmail, label:t.contactEmail, value:"contact@talentos.tn" },
            { src:"/landing-page-emojis/phone.svg", alt:t.contactPhone, label:t.contactPhone, value:"+216 XX XXX XXX" },
            { src:"/landing-page-emojis/location.svg", alt:t.contactLocation, label:t.contactLocation, value:"Tunisia, North Africa" },
          ].map((c, i) => (
            <div key={i} className="card-hover" style={{
              background:"white", borderRadius:"16px", padding:"32px 40px",
              boxShadow:"0 4px 24px rgba(0,0,0,0.07)",
              border:"1px solid #f3f4f6", minWidth:"180px"
            }}>
              <img src={c.src} alt={c.alt} style={{ width:"64px", height:"64px", objectFit:"contain", margin:"0 auto 12px auto", display:"block" }} />
              <p style={{ fontWeight:700, color:"#111827", marginBottom:"4px", fontSize:"15px" }}>{c.label}</p>
              <p style={{ color:"#6b7280", fontSize:"14px" }}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background:"linear-gradient(135deg,#7B5AC8 0%,#9683EC 60%,#B8A8F0 100%)",
        position:"relative", overflow:"hidden",
        color:"white", padding:"64px 64px 32px 64px"
      }}>
        <div style={{ position:"absolute", width:60, height:60, background:"rgba(139,92,246,0.4)", borderRadius:"50% 40% 60% 30%", left:60, top:40, filter:"blur(2px)" }}/>
        <div style={{ position:"absolute", width:80, height:80, background:"linear-gradient(135deg,#f97316,#ef4444)", borderRadius:"40% 60% 30% 70%", bottom:20, right:40, opacity:0.8, filter:"blur(2px)" }}/>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"40px", marginBottom:"48px", position:"relative", zIndex:10 }}>
          <div>
            <h3 style={{ fontFamily:"'Monotype Corsiva','Apple Chancery',cursive", fontSize:"26px", marginBottom:"16px" }}>TalentOs.</h3>
            <p style={{ opacity:0.7, fontSize:"13px", lineHeight:1.8, marginBottom:"12px" }}>Tunisia, North Africa<br/>AI Recruitment Platform</p>
            <p style={{ opacity:0.7, fontSize:"13px" }}>+216 XX XXX XXX</p>
            <p style={{ opacity:0.7, fontSize:"13px" }}>contact@talentos.tn</p>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:"16px", marginBottom:"8px" }}>{t.candidatesCol}</h4>
            <div style={{ width:40, height:2, background:"white", marginBottom:"16px" }}/>
            <ul style={{ listStyle:"none", padding:0, margin:0 }}>
              {[
                { label:t.browseJobs, path:"/jobs" },
                { label:t.candidateProfile, path:"/candidate/profile" },
                { label:t.myApplications, path:"/candidate/applications" },
                { label:t.login, path:"/login" },
              ].map((l, i) => (
                <li key={i} onClick={() => navigate(l.path)} style={{ opacity:0.8, fontSize:"13px", marginBottom:"8px", cursor:"pointer" }}
                  onMouseOver={(e) => e.target.style.opacity = 1}
                  onMouseOut={(e) => e.target.style.opacity = 0.8}
                >{l.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:"16px", marginBottom:"8px" }}>{t.companiesCol}</h4>
            <div style={{ width:40, height:2, background:"white", marginBottom:"16px" }}/>
            <ul style={{ listStyle:"none", padding:0, margin:0 }}>
              {[
                { label:t.createCompany, path:"/company/signup" },
                { label:t.adminDashboard, path:"/admin/dashboard" },
                { label:t.createCompany, path:"/recruiter/jobs" },
                { label:t.login, path:"/login" },
              ].map((l, i) => (
                <li key={i} onClick={() => navigate(l.path)} style={{ opacity:0.8, fontSize:"13px", marginBottom:"8px", cursor:"pointer" }}
                  onMouseOver={(e) => e.target.style.opacity = 1}
                  onMouseOut={(e) => e.target.style.opacity = 0.8}
                >{l.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:"16px", marginBottom:"8px" }}>{t.platformCol}</h4>
            <div style={{ width:40, height:2, background:"white", marginBottom:"16px" }}/>
            <ul style={{ listStyle:"none", padding:0, margin:0 }}>
              {[t.aiCvParsing, t.semanticMatching, t.aiInterviews, t.ragAssess].map((l, i) => (
                <li key={i} style={{ opacity:0.8, fontSize:"13px", marginBottom:"8px" }}>{l}</li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ height:1, background:"rgba(255,255,255,0.2)", marginBottom:"24px", position:"relative", zIndex:10 }}/>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:10 }}>
          <p style={{ fontSize:"13px", opacity:0.6 }}>{t.copyright}</p>
          <div style={{ display:"flex", gap:"12px" }}>
            {["f", "t", "in", "📷"].map((s, i) => (
              <div key={i} style={{
                width:36, height:36, borderRadius:"50%",
                background:"rgba(255,255,255,0.15)",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", fontSize:"13px", fontWeight:"bold"
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#7B5AC8" }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white" }}
              >{s}</div>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
