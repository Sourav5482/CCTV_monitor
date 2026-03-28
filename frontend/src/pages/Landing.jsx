import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserPlus,
  Cctv,
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Database,
  Cpu,
  ArrowRight,
  Sparkles,
  Eye,
  Zap,
  Lock,
} from "lucide-react";

/* ─── Data ─────────────────────────────────────────── */
const featureData = [
  {
    id: "register",
    title: "Face Registration",
    subtitle: "Train employee profiles",
    description: "Capture images and build embedding profiles for reliable face identification.",
    details: "Register a new person by entering profile details and collecting face samples. The system stores embeddings for matching in recognition and attendance modules.",
    route: "/register-face",
    accent: "#10b981",
    accentDim: "rgba(16,185,129,0.15)",
    icon: UserPlus,
    tag: "Biometric",
  },
  {
    id: "cctv",
    title: "Live CCTV Preview",
    subtitle: "Manage connected cameras",
    description: "Add, monitor, and troubleshoot camera feeds from one screen.",
    details: "Connect RTSP/IP/mobile/webcam sources and monitor live feeds in one place.",
    route: "/cctv-live",
    accent: "#3b82f6",
    accentDim: "rgba(59,130,246,0.15)",
    icon: Cctv,
    tag: "Live",
  },
  {
    id: "cctv-features",
    title: "CCTV Features",
    subtitle: "Incident & AI monitoring",
    description: "Auto-detect unauthorized person and theft incidents.",
    details: "Use this page for auto-detection control, incident summaries, and recent incident capture metadata.",
    route: "/cctv-features",
    accent: "#f59e0b",
    accentDim: "rgba(245,158,11,0.15)",
    icon: ShieldAlert,
    tag: "AI",
  },
  {
    id: "records",
    title: "Attendance Records",
    subtitle: "Review and export logs",
    description: "Filter attendance by date and employee, then export records for reporting.",
    details: "Use this view for audit and HR reporting with searchable daily entries and status history from all cameras.",
    route: "/attendance",
    accent: "#06b6d4",
    accentDim: "rgba(6,182,212,0.15)",
    icon: ClipboardList,
    tag: "Reports",
  },
  {
    id: "alerts",
    title: "Security Alerts",
    subtitle: "Unauthorised person incidents",
    description: "Review unauthorised person detections, evidence images, and alert escalation status.",
    details: "The system groups unauthorised person detections, stores snapshots, and provides alert actions so security teams can investigate quickly.",
    route: "/alerts",
    accent: "#ef4444",
    accentDim: "rgba(239,68,68,0.15)",
    icon: ShieldAlert,
    tag: "Critical",
  },
];

const systemFlow = [
  { title: "Capture", text: "Live streams enter from RTSP, IP cameras, webcam, and mobile sources.", icon: Cctv, color: "#3b82f6" },
  { title: "Analyze", text: "Face recognition and incident logic process frames in real time.", icon: Cpu, color: "#a855f7" },
  { title: "Store", text: "Attendance records, incidents, and alerts persisted for audit and reporting.", icon: Database, color: "#10b981" },
  { title: "Respond", text: "Operators review alerts, confirm incidents, and take immediate action.", icon: Activity, color: "#f59e0b" },
];

const stats = [
  { label: "Modules", value: "5", icon: Zap },
  { label: "AI Flows", value: "3", icon: Sparkles },
  { label: "Uptime", value: "99.9%", icon: ShieldCheck },
  { label: "Monitoring", value: "24/7", icon: Eye },
];

/* ─── Animated Grid Canvas ─────────────────────────── */
function GridCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let t = 0;

    const dots = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      r: Math.random() * 1.5 + 0.5,
      pulse: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = 1;
        if (d.x > 1) d.x = 0;
        if (d.y < 0) d.y = 1;
        if (d.y > 1) d.y = 0;
      });

      // connections
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = (dots[i].x - dots[j].x) * W;
          const dy = (dots[i].y - dots[j].y) * H;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(6,182,212,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(dots[i].x * W, dots[i].y * H);
            ctx.lineTo(dots[j].x * W, dots[j].y * H);
            ctx.stroke();
          }
        }
      }

      // dots
      dots.forEach((d) => {
        const pulse = Math.sin(t + d.pulse) * 0.4 + 0.6;
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, d.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,182,212,${0.5 * pulse})`;
        ctx.fill();
      });

      // scanline
      const scanY = ((Math.sin(t * 0.4) + 1) / 2) * H;
      const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      grad.addColorStop(0, "rgba(6,182,212,0)");
      grad.addColorStop(0.5, "rgba(6,182,212,0.06)");
      grad.addColorStop(1, "rgba(6,182,212,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 40, W, 80);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.7 }} />;
}

/* ─── Glowing Orbs Background ───────────────────────── */
function OrbBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
        animation: "orbFloat1 12s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: "700px", height: "700px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)",
        animation: "orbFloat2 15s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: "50%",
        width: "400px", height: "400px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        animation: "orbFloat3 18s ease-in-out infinite",
      }} />
      <style>{`
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(60px,40px)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-50px,-60px)} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.3)} }
      `}</style>
    </div>
  );
}

/* ─── Feature Card ──────────────────────────────────── */
function FeatureCard({ feature, isActive, onClick }) {
  const Icon = feature.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${feature.accentDim}, rgba(15,23,42,0.9))`
          : "rgba(15,23,42,0.6)",
        border: isActive ? `1px solid ${feature.accent}60` : "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        padding: "20px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
        transform: isActive ? "scale(1.02)" : "scale(1)",
        boxShadow: isActive ? `0 0 30px ${feature.accent}25` : "none",
      }}
    >
      {isActive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg, transparent, ${feature.accent}, transparent)`,
        }} />
      )}
      <div style={{
        display: "inline-flex", padding: "10px", borderRadius: "12px",
        background: feature.accentDim, marginBottom: "14px",
        border: `1px solid ${feature.accent}30`,
      }}>
        <Icon size={18} style={{ color: feature.accent }} />
      </div>
      <div style={{
        display: "inline-block", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: feature.accent, background: `${feature.accent}15`,
        border: `1px solid ${feature.accent}30`, borderRadius: "4px",
        padding: "2px 8px", marginBottom: "10px", marginLeft: "8px", verticalAlign: "middle",
      }}>
        {feature.tag}
      </div>
      <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", marginBottom: "4px", letterSpacing: "-0.02em" }}>
        {feature.title}
      </h3>
      <p style={{ fontSize: "11px", color: feature.accent, fontWeight: 600, marginBottom: "8px", letterSpacing: "0.02em" }}>
        {feature.subtitle}
      </p>
      <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>
        {feature.description}
      </p>
    </button>
  );
}

/* ─── Main Component ────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(featureData[0].id);
  const [mounted, setMounted] = useState(false);
  const selected = useMemo(
    () => featureData.find((f) => f.id === selectedId) || featureData[0],
    [selectedId]
  );

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const base = {
    fontFamily: "'DM Mono', 'JetBrains Mono', 'Fira Code', monospace",
    color: "#e2e8f0",
    minHeight: "100vh",
  };

  const fadeIn = (delay = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  });

  return (
    <div style={{ ...base, position: "relative", padding: "0 0 80px 0" }}>
      <OrbBackground />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; }
        
        .hero-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          letter-spacing: -0.04em;
          line-height: 1.08;
          color: #fff;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .glow-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #0891b2, #0e7490);
          border: 1px solid rgba(6,182,212,0.4);
          border-radius: 10px; padding: 12px 24px;
          font-size: 13px; font-weight: 600; color: #fff;
          cursor: pointer; text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 0 20px rgba(6,182,212,0.3), 0 4px 15px rgba(0,0,0,0.3);
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.02em;
        }
        .glow-btn:hover {
          background: linear-gradient(135deg, #0e7490, #155e75);
          box-shadow: 0 0 35px rgba(6,182,212,0.5), 0 4px 20px rgba(0,0,0,0.4);
          transform: translateY(-2px);
        }
        
        .ghost-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: 12px 24px;
          font-size: 13px; font-weight: 600; color: #94a3b8;
          cursor: pointer; text-decoration: none;
          transition: all 0.3s ease;
          font-family: 'DM Mono', monospace;
        }
        .ghost-btn:hover {
          border-color: rgba(6,182,212,0.4); color: #e2e8f0;
          background: rgba(6,182,212,0.05);
        }

        .stat-card {
          background: rgba(15,23,42,0.8);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 18px;
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
          position: relative; overflow: hidden;
        }
        .stat-card:hover {
          border-color: rgba(6,182,212,0.3);
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .flow-card {
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 24px;
          backdrop-filter: blur(12px);
          transition: all 0.35s ease;
          position: relative; overflow: hidden;
        }
        .flow-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: #64748b;
        }
        
        .detail-panel {
          background: rgba(8,15,28,0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 32px;
          backdrop-filter: blur(20px);
          position: relative; overflow: hidden;
          height: 100%;
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #10b981; position: relative; display: inline-block;
        }
        .live-dot::after {
          content: ''; position: absolute; inset: -3px;
          border-radius: 50%; background: rgba(16,185,129,0.4);
          animation: pulse-ring 1.5s ease-out infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        .shimmer-line {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.6) 50%, transparent 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }

        @media (max-width: 768px) {
          .hero-title { font-size: 1.9rem; }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>

        {/* ── HERO ────────────────────────────────── */}
        <section style={{
          ...fadeIn(0),
          position: "relative", borderRadius: "24px",
          border: "1px solid rgba(6,182,212,0.2)",
          overflow: "hidden", marginBottom: "32px",
          background: "rgba(8,15,28,0.85)", backdropFilter: "blur(20px)",
        }}>
          <GridCanvas />
          
          {/* top shimmer */}
          <div className="shimmer-line" style={{ position: "absolute", top: 0, left: 0, right: 0, width: "100%" }} />

          <div style={{ position: "relative", zIndex: 2, padding: "clamp(32px, 5vw, 64px)", display: "grid", gridTemplateColumns: "1fr auto", gap: "48px", alignItems: "center" }}>
            <div>
              {/* badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px",
                background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)",
                borderRadius: "100px", padding: "6px 14px", marginBottom: "24px" }}>
                <div className="live-dot" />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#22d3ee", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Enterprise AI Surveillance Suite
                </span>
              </div>

              <h1 className="hero-title">Sudarshan-AI<br /></h1>
              <h2 className="text-2xl text-right ">"CCTV Security Intelligence"</h2>

              <p style={{ marginTop: "20px", maxWidth: "540px", fontSize: "14px", lineHeight: 1.75, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
                Real-time surveillance, face-based attendance, Authorised person recognisation and unauthorised person detection,
                and alert workflows — unified in one operations console.
              </p>

              <div style={{ marginTop: "28px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Link to="/register-face" className="glow-btn">
                  Launch Console <ArrowRight size={14} />
                </Link>
                <a href="#modules" className="ghost-btn">
                  Explore Modules
                </a>
              </div>
            </div>

            {/* stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", minWidth: "220px" }}>
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="stat-card">
                    <Icon size={14} style={{ color: "#06b6d4", marginBottom: "10px", display: "block" }} />
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "2px", fontWeight: 500 }}>
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FLOW ────────────────────────────────── */}
        <section style={{ ...fadeIn(0.1), marginBottom: "32px" }}>
          <p className="section-label" style={{ marginBottom: "16px" }}>// system pipeline</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {systemFlow.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flow-card">
                  {/* step number */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "12px",
                      background: `${step.color}18`, border: `1px solid ${step.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={18} style={{ color: step.color }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "#1e293b", fontWeight: 700, letterSpacing: "0.05em" }}>
                      0{i + 1}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", marginBottom: "8px", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.65 }}>{step.text}</p>
                  {/* colored bottom line */}
                  <div style={{ position: "absolute", bottom: 0, left: "20px", right: "20px", height: "2px", background: `linear-gradient(90deg, ${step.color}60, transparent)`, borderRadius: "1px" }} />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── MODULES ─────────────────────────────── */}
        <section id="modules" style={{ ...fadeIn(0.2), marginBottom: "32px" }}>
          <p className="section-label" style={{ marginBottom: "16px" }}>// feature modules</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px", alignItems: "start" }}>
            
            {/* cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
              {featureData.map((f) => (
                <FeatureCard
                  key={f.id}
                  feature={f}
                  isActive={selectedId === f.id}
                  onClick={() => setSelectedId(f.id)}
                />
              ))}
            </div>

            {/* detail panel */}
            <div className="detail-panel" style={{ position: "sticky", top: "24px" }}>
              {/* glowing accent top border */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: `linear-gradient(90deg, transparent, ${selected.accent}, transparent)`,
                transition: "background 0.4s ease",
              }} />

              {/* corner accent */}
              <div style={{
                position: "absolute", top: 0, right: 0, width: "120px", height: "120px",
                background: `radial-gradient(circle at top right, ${selected.accentDim}, transparent)`,
                transition: "background 0.4s ease",
              }} />

              <div style={{ position: "relative" }}>
                <div style={{
                  display: "inline-flex", padding: "12px", borderRadius: "14px",
                  background: selected.accentDim, border: `1px solid ${selected.accent}30`,
                  marginBottom: "20px", transition: "all 0.4s ease",
                }}>
                  {(() => { const Icon = selected.icon; return <Icon size={22} style={{ color: selected.accent }} />; })()}
                </div>

                <div style={{ display: "inline-block", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: selected.accent, background: `${selected.accent}15`,
                  border: `1px solid ${selected.accent}30`, borderRadius: "4px",
                  padding: "3px 10px", marginLeft: "12px", verticalAlign: "middle",
                  transition: "all 0.4s ease",
                }}>
                  {selected.tag}
                </div>

                <p style={{ fontSize: "11px", color: "#475569", marginTop: "16px", marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {selected.subtitle}
                </p>
                <h3 style={{ fontSize: "24px", fontWeight: 800, color: "#f1f5f9", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em", marginBottom: "16px", transition: "all 0.3s ease" }}>
                  {selected.title}
                </h3>

                <div className="shimmer-line" style={{ marginBottom: "16px" }} />

                <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.75, marginBottom: "28px" }}>
                  {selected.details}
                </p>

                <button
                  type="button"
                  onClick={() => navigate(selected.route)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    background: `linear-gradient(135deg, ${selected.accent}30, ${selected.accent}15)`,
                    border: `1px solid ${selected.accent}50`, borderRadius: "10px",
                    padding: "12px 22px", fontSize: "13px", fontWeight: 600,
                    color: selected.accent, cursor: "pointer",
                    transition: "all 0.3s ease", fontFamily: "'DM Mono', monospace",
                    boxShadow: `0 0 20px ${selected.accent}15`,
                    letterSpacing: "0.02em",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `linear-gradient(135deg, ${selected.accent}50, ${selected.accent}30)`; e.currentTarget.style.boxShadow = `0 0 30px ${selected.accent}35`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = `linear-gradient(135deg, ${selected.accent}30, ${selected.accent}15)`; e.currentTarget.style.boxShadow = `0 0 20px ${selected.accent}15`; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  Open Module <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────── */}
        <section style={{ ...fadeIn(0.3), position: "relative", borderRadius: "24px", overflow: "hidden",
          background: "rgba(8,15,28,0.9)", border: "1px solid rgba(6,182,212,0.2)",
          padding: "clamp(32px, 5vw, 56px)", backdropFilter: "blur(20px)" }}>
          
          {/* big decorative text */}
          <div style={{ position: "absolute", top: "50%", right: "-20px", transform: "translateY(-50%)",
            fontSize: "clamp(80px, 12vw, 140px)", fontWeight: 900, fontFamily: "'Syne', sans-serif",
            color: "rgba(6,182,212,0.04)", letterSpacing: "-0.06em", userSelect: "none", pointerEvents: "none", whiteSpace: "nowrap" }}>
            SECURE
          </div>

          <div className="shimmer-line" style={{ position: "absolute", top: 0, left: 0, right: 0 }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "24px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Lock size={16} style={{ color: "#06b6d4" }} />
                <span style={{ fontSize: "11px", color: "#06b6d4", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Full Ecosystem Console
                </span>
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", marginBottom: "10px" }}>
                Ready to operate your full<br />
                <span style={{ color: "#06b6d4" }}>CCTV ecosystem</span> from one console?
              </h2>
              <p style={{ fontSize: "13px", color: "#475569", fontFamily: "'DM Mono', monospace" }}>
                Real-time dashboards · Camera streams · Attendance · Security alerts
              </p>
            </div>
            <Link to="/register-face" className="glow-btn" style={{ whiteSpace: "nowrap", padding: "16px 32px", fontSize: "14px" }}>
              Launch Console
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}