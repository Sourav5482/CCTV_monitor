import { useState, useEffect, useCallback, useRef } from "react";
import IncidentMonitorPanel from "../components/IncidentMonitorPanel";
import { ShieldCheck, ShieldOff, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  getAutoDetectStatus,
  getAutoDetectEvents,
  startAutoDetect,
  stopAutoDetect,
} from "../services/api";

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
  } catch {
    // ignore
  }
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
  } catch {
    // ignore
  }
}

const eventIcon = {
  "Attendance Marked": <CheckCircle2 className="h-4 w-4 text-green-400" />,
  "Already Marked": <Info className="h-4 w-4 text-blue-400" />,
  "Unknown Person": <AlertTriangle className="h-4 w-4 text-red-400" />,
};

export default function CCTVFeatures() {
  const [autoDetect, setAutoDetect] = useState(false);
  const [events, setEvents] = useState([]);
  const prevEventsLen = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getAutoDetectStatus();
      setAutoDetect(Boolean(status.running));
    } catch {
      setAutoDetect(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 8000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  useEffect(() => {
    if (!autoDetect) return;
    const poll = async () => {
      try {
        const data = await getAutoDetectEvents(30);
        const evts = data.events || [];
        if (evts.length > prevEventsLen.current) {
          const newest = evts[0];
          if (newest?.status === "Unknown Person") playAlertSiren();
          else if (newest?.status === "Attendance Marked") playWelcomeSound();
        }
        prevEventsLen.current = evts.length;
        setEvents(evts);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [autoDetect]);

  const toggleAutoDetect = async () => {
    try {
      if (autoDetect) {
        await stopAutoDetect();
        setAutoDetect(false);
      } else {
        await startAutoDetect();
        setAutoDetect(true);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">CCTV Features</h1>
          <p className="text-sm text-slate-400">
            Auto-detection, suspicious movement capture, and incident intelligence.
          </p>
        </div>

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
      </div>

      <IncidentMonitorPanel />

      {autoDetect && events.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Live Detection Feed</h2>
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
                    ? "Unknown person detected"
                    : evt.status === "Attendance Marked"
                    ? `Attendance marked for ${evt.name}`
                    : `${evt.name} already marked`}
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
