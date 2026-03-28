import { useState, useEffect, useCallback, useRef } from "react";
import CameraCard from "../components/CameraCard";
import IncidentMonitorPanel from "../components/IncidentMonitorPanel";
import {
  RefreshCw, Plus, X, ShieldCheck, ShieldOff, Smartphone,
  CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import {
  fetchCameras, addCamera, deleteCamera,
  startAutoDetect, stopAutoDetect, getAutoDetectStatus, getAutoDetectEvents,
} from "../services/api";

// ── Audio helpers ─────────────────────────────────────────────────
function playWelcomeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  } catch { /* */ }
}

function playAlertSiren() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((delay) => {
      [880, 660].forEach((freq, j) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + delay + j * 0.13);
        osc.stop(ctx.currentTime + delay + j * 0.13 + 0.12);
      });
    });
  } catch { /* */ }
}

const eventIcon = {
  "Attendance Marked": <CheckCircle2 className="h-4 w-4 text-green-400" />,
  "Already Marked": <Info className="h-4 w-4 text-blue-400" />,
  "Unknown Person": <AlertTriangle className="h-4 w-4 text-red-400" />,
};

export default function CCTVSummary() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [form, setForm] = useState({ camera_id: "", name: "", source: "", location: "", alarm_enabled: true });
  const [formError, setFormError] = useState("");
  const [autoDetect, setAutoDetect] = useState(false);
  const [events, setEvents] = useState([]);
  const prevEventsLen = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [camData, adStatus] = await Promise.all([
        fetchCameras(), getAutoDetectStatus(),
      ]);
      setCameras(camData.cameras || []);
      setAutoDetect(adStatus.running);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  // Poll auto-detect events
  useEffect(() => {
    if (!autoDetect) return;
    const poll = async () => {
      try {
        const data = await getAutoDetectEvents(30);
        const evts = data.events || [];
        // Play sounds for new events
        if (evts.length > prevEventsLen.current) {
          const newest = evts[0];
          if (newest?.status === "Unknown Person") playAlertSiren();
          else if (newest?.status === "Attendance Marked") playWelcomeSound();
        }
        prevEventsLen.current = evts.length;
        setEvents(evts);
      } catch { /* */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [autoDetect]);

  const toggleAutoDetect = async () => {
    try {
      if (autoDetect) { await stopAutoDetect(); setAutoDetect(false); }
      else { await startAutoDetect(); setAutoDetect(true); }
    } catch { /* */ }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.camera_id || !form.name || !form.source) {
      setFormError("Camera ID, Name, and Source are required.");
      return;
    }
    try {
      await addCamera(form);
      setForm({ camera_id: "", name: "", source: "", location: "", alarm_enabled: true });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to add camera");
    }
  };

  const handleDelete = async (cameraId) => {
    try {
      await deleteCamera(cameraId);
      setCameras((prev) => prev.filter((c) => c.camera_id !== cameraId));
    } catch { /* */ }
  };

  const activeCount = cameras.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">CCTV Name</h1>
          <p className="text-sm text-slate-400">
            {activeCount} of {cameras.length} cameras online
            {autoDetect && <span className="ml-2 text-green-400">· Auto-Detect ON</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Auto-detect toggle */}
          <button
            onClick={toggleAutoDetect}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              autoDetect
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {autoDetect ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {autoDetect ? "Stop Auto-Detect" : "Start Auto-Detect"}
          </button>
          <button
            onClick={() => setShowMobile(!showMobile)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Smartphone className="h-4 w-4" />
            Mobile Camera
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Add Camera"}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile camera instructions */}
      {showMobile && (
        <div className="rounded-xl border border-blue-800 bg-blue-950/40 p-5 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-300">
            <Smartphone className="h-4 w-4" />
            Connect Your Mobile Camera
          </h2>
          <div className="space-y-2 text-sm text-slate-300">
            <p className="font-medium text-white">Android — IP Webcam app (free):</p>
            <ol className="ml-4 list-decimal space-y-1 text-slate-400">
              <li>Install <span className="font-medium text-slate-200">IP Webcam</span> from Play Store</li>
              <li>Open it → scroll down → tap <span className="font-medium text-slate-200">Start server</span></li>
              <li>Note the URL shown (e.g. <code className="rounded bg-slate-800 px-1 text-blue-300">http://192.168.1.5:8080</code>)</li>
              <li>In <span className="font-medium text-slate-200">Add Camera</span> above, enter source as:<br/>
                  <code className="rounded bg-slate-800 px-1 text-green-300">http://192.168.1.5:8080/video</code>
              </li>
            </ol>
            <p className="font-medium text-white mt-3">iPhone — DroidCam or EpocCam:</p>
            <ol className="ml-4 list-decimal space-y-1 text-slate-400">
              <li>Install the app on iPhone and the PC client</li>
              <li>Connect via WiFi, then use the stream URL as the source</li>
            </ol>
            <p className="font-medium text-white mt-3">Any phone — via USB:</p>
            <ol className="ml-4 list-decimal space-y-1 text-slate-400">
              <li>Install <span className="font-medium text-slate-200">DroidCam</span> (Android) or <span className="font-medium text-slate-200">Camo</span> (iPhone)</li>
              <li>Connect USB, install PC client — phone appears as webcam index <code className="rounded bg-slate-800 px-1 text-green-300">1</code> or <code className="rounded bg-slate-800 px-1 text-green-300">2</code></li>
            </ol>
          </div>
          <p className="text-xs text-slate-500">
            Make sure your phone and PC are on the same WiFi network.
          </p>
        </div>
      )}

      {/* Add Camera Form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-slate-700 bg-[#1e293b] p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-white">Add New Camera</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Camera ID</label>
              <input
                value={form.camera_id}
                onChange={(e) => setForm({ ...form, camera_id: e.target.value })}
                placeholder="CAM-03"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Entrance Camera"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Source (RTSP / HTTP URL / webcam index / mobile IP)
              </label>
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="http://192.168.1.5:8080/video  or  0"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Main Gate – North"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Trigger Alarm</label>
              <select
                value={form.alarm_enabled ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, alarm_enabled: e.target.value === "yes" })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="yes">Yes (Trigger alarm)</option>
                <option value="no">No (Silent camera)</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Connect Camera
          </button>
          <p className="text-xs text-slate-500">
            Tip: <code className="text-slate-400">0</code> = laptop webcam,
            <code className="text-slate-400 ml-1">http://192.168.x.x:8080/video</code> = mobile camera (IP Webcam app),
            <code className="text-slate-400 ml-1">rtsp://...</code> = CCTV/IP camera
          </p>
        </form>
      )}

      <IncidentMonitorPanel />

      {/* Camera Grid */}
      {cameras.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <p className="text-slate-500 text-sm">No cameras connected yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Your First Camera
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cameras.map((cam) => (
            <CameraCard key={cam.camera_id} {...cam} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Live Detection Events */}
      {autoDetect && events.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Live Detection Feed
          </h2>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {events.map((evt, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  evt.status === "Unknown Person"
                    ? "border border-red-800 bg-red-950/30 text-red-300"
                    : evt.status === "Attendance Marked"
                    ? "border border-green-800 bg-green-950/30 text-green-300"
                    : "border border-slate-700 bg-slate-800/50 text-slate-300"
                }`}
              >
                {eventIcon[evt.status] || <Info className="h-4 w-4 text-slate-400" />}
                <span className="font-mono text-xs text-slate-500">{evt.camera_id}</span>
                <span className="flex-1">
                  {evt.status === "Unknown Person"
                    ? "Unauthorised person detected"
                    : evt.status === "Attendance Marked"
                    ? `Welcome! ${evt.name} — attendance marked`
                    : `${evt.name} — already marked`}
                </span>
                {evt.confidence && (
                  <span className="text-xs text-slate-500">{(evt.confidence * 100).toFixed(1)}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
