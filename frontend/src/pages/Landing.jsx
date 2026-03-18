import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Cctv,
  ScanFace,
  ClipboardList,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const featureData = [
  {
    id: "register",
    title: "Face Registration",
    subtitle: "Train employee profiles",
    description:
      "Capture images and build embedding profiles for reliable face identification.",
    details:
      "Register a new person by entering profile details and collecting face samples. The system stores embeddings for matching in recognition and attendance modules.",
    route: "/register-face",
    color: "from-emerald-500/20 to-green-500/10",
    icon: UserPlus,
  },
  {
    id: "cctv",
    title: "Live CCTV Preview",
    subtitle: "Manage connected cameras",
    description:
      "Add, monitor, and troubleshoot camera feeds from one screen.",
    details:
      "Connect RTSP/IP/mobile/webcam sources and monitor live feeds in one place.",
    route: "/cctv-live",
    color: "from-indigo-500/20 to-sky-500/10",
    icon: Cctv,
  },
  {
    id: "cctv-features",
    title: "CCTV Features",
    subtitle: "Incident and AI monitoring",
    description:
      "Auto-detect, suspicious movement captures, and incident intelligence.",
    details:
      "Use this page for auto-detection control, incident summaries, and recent suspicious capture metadata.",
    route: "/cctv-features",
    color: "from-red-500/20 to-orange-500/10",
    icon: ShieldAlert,
  },
  {
    id: "live-attendance",
    title: "Camera Attendance",
    subtitle: "Real-time face check-in",
    description:
      "Run live recognition and mark attendance automatically with instant feedback.",
    details:
      "This page continuously scans a camera stream, recognizes known faces, and marks attendance while handling repeated detections safely.",
    route: "/camera-attendance",
    color: "from-amber-500/20 to-orange-500/10",
    icon: ScanFace,
  },
  {
    id: "records",
    title: "Attendance Records",
    subtitle: "Review and export logs",
    description:
      "Filter attendance by date and employee, then export records for reporting.",
    details:
      "Use this view for audit and HR reporting with searchable daily entries and status history from all cameras.",
    route: "/attendance",
    color: "from-violet-500/20 to-fuchsia-500/10",
    icon: ClipboardList,
  },
  {
    id: "alerts",
    title: "Security Alerts",
    subtitle: "Unknown person incidents",
    description:
      "Review unknown detections, evidence images, and alert escalation status.",
    details:
      "The system groups unknown detections, stores snapshots, and provides alert actions so security teams can investigate quickly.",
    route: "/alerts",
    color: "from-rose-500/20 to-red-500/10",
    icon: ShieldAlert,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(featureData[0].id);

  const selected = useMemo(
    () => featureData.find((item) => item.id === selectedId) || featureData[0],
    [selectedId]
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            Smart CCTV Platform
          </p>
          <h1 className="mt-4 text-3xl font-bold text-white">Welcome to CCTV Monitor</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Explore each module below. Click any feature card to view what it does,
            why it matters, and jump directly into that section.
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {featureData.map((feature) => {
            const Icon = feature.icon;
            const isActive = selectedId === feature.id;
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => setSelectedId(feature.id)}
                className={`group rounded-xl border p-4 text-left transition ${
                  isActive
                    ? "border-cyan-400 bg-slate-800"
                    : "border-slate-700 bg-slate-900/70 hover:border-slate-500"
                }`}
              >
                <div
                  className={`mb-4 inline-flex rounded-lg bg-gradient-to-br p-2 ${feature.color}`}
                >
                  <Icon className="h-5 w-5 text-slate-100" />
                </div>
                <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-1 text-xs font-medium text-cyan-300">{feature.subtitle}</p>
                <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
              </button>
            );
          })}
        </div>

        <aside className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-lg font-semibold text-white">Feature Details</h2>
          <p className="mt-4 text-sm text-cyan-300">{selected.subtitle}</p>
          <h3 className="mt-1 text-xl font-bold text-white">{selected.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{selected.details}</p>

          <button
            type="button"
            onClick={() => navigate(selected.route)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            Open Feature
            <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </section>
    </div>
  );
}
