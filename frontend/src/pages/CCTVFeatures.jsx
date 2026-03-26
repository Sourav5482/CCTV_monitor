import { useState, useEffect, useCallback, useRef } from "react";
import IncidentMonitorPanel from "../components/IncidentMonitorPanel";
import { ShieldCheck, ShieldOff, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  fetchCameras,
  fetchAttendance,
  getCameraStreamUrl,
  reconnectCamera,
  getAutoDetectStatus,
  getAutoDetectEvents,
  startAutoDetect,
  stopAutoDetect,
} from "../services/api";

let sharedAudioContext = null;

function getSharedAudioContext() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioContext) {
      sharedAudioContext = new Ctx();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {
        // ignore
      });
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playWelcomeSound() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
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
    const ctx = getSharedAudioContext();
    if (!ctx) return;
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

const AUTO_MARKED_STORAGE_KEY = "cctv_auto_marked_entries";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildEventKey(evt) {
  if (!evt) return "";
  return [
    evt.alert_id || "",
    evt.employee_id || "",
    evt.camera_id || "",
    evt.status || "",
    evt.name || "",
    evt.confidence ?? "",
  ].join("|");
}

export default function CCTVFeatures() {
  const [autoDetect, setAutoDetect] = useState(false);
  const [events, setEvents] = useState([]);
  const [autoMarkedEntries, setAutoMarkedEntries] = useState([]);
  const [cameraAlarmMap, setCameraAlarmMap] = useState({});
  const [cameraId, setCameraId] = useState("0");
  const [streamError, setStreamError] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [streamRefreshKey, setStreamRefreshKey] = useState(0);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmActive, setAlarmActive] = useState(false);
  const lastProcessedEventRef = useRef("");
  const alarmLoopRef = useRef(null);

  const saveAutoMarkedToStorage = useCallback((entries) => {
    try {
      localStorage.setItem(AUTO_MARKED_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }, []);

  const loadAutoMarkedFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(AUTO_MARKED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setAutoMarkedEntries(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadStoredAttendance = useCallback(async () => {
    try {
      const data = await fetchAttendance(todayDateString());
      const records = (data?.records || []).map((record) => ({
        employee_id: record.employee_id || "-",
        name: record.name || "Unknown",
        camera_id: record.camera_id || "-",
        date: record.date || todayDateString(),
        entry_time: record.entry_time || "--:--",
        status: record.status || "Present",
      }));
      setAutoMarkedEntries(records);
      saveAutoMarkedToStorage(records);
    } catch {
      // ignore
    }
  }, [saveAutoMarkedToStorage]);

  const stopAlarmLoop = useCallback(() => {
    if (alarmLoopRef.current) {
      clearInterval(alarmLoopRef.current);
      alarmLoopRef.current = null;
    }
    setAlarmActive(false);
  }, []);

  const startAlarmLoop = useCallback(() => {
    if (alarmLoopRef.current || !alarmEnabled) return;

    playAlertSiren();
    alarmLoopRef.current = setInterval(() => {
      playAlertSiren();
    }, 900);
    setAlarmActive(true);
  }, [alarmEnabled]);

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
    loadAutoMarkedFromStorage();
    loadStoredAttendance();
  }, [loadAutoMarkedFromStorage, loadStoredAttendance]);

  useEffect(() => {
    if (!autoDetect) return;
    const interval = setInterval(loadStoredAttendance, 6000);
    return () => clearInterval(interval);
  }, [autoDetect, loadStoredAttendance]);

  useEffect(() => {
    const resolveCameraZero = async () => {
      try {
        const data = await fetchCameras();
        const cams = data?.cameras || [];

        setCameraAlarmMap(
          Object.fromEntries(
            cams.map((cam) => [String(cam?.camera_id), cam?.alarm_enabled !== false])
          )
        );

        const sourceZero = cams.find((cam) => String(cam?.source) === "0");
        const idZero = cams.find((cam) => String(cam?.camera_id) === "0");
        const preferred = sourceZero || idZero;

        if (preferred?.camera_id) {
          setCameraId(String(preferred.camera_id));
        }
      } catch {
        // keep fallback camera id "0"
      }
    };

    resolveCameraZero();
  }, []);

  useEffect(() => {
    if (!autoDetect) return;
    const poll = async () => {
      try {
        const data = await getAutoDetectEvents(30);
        const evts = data.events || [];
        const newest = evts[0];
        const newestKey = buildEventKey(newest);
        if (newestKey && newestKey !== lastProcessedEventRef.current) {
          lastProcessedEventRef.current = newestKey;
          if (newest?.status === "Unknown Person") {
            const shouldAlarm = cameraAlarmMap[String(newest?.camera_id)] !== false;
            if (shouldAlarm) {
              startAlarmLoop();
            }
          } else {
            if (newest?.status === "Attendance Marked") {
              playWelcomeSound();
              loadStoredAttendance();
            }
          }
        }
        setEvents(evts);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [autoDetect, cameraAlarmMap, loadStoredAttendance, startAlarmLoop]);

  useEffect(() => {
    if (!alarmEnabled) {
      stopAlarmLoop();
    }
  }, [alarmEnabled, stopAlarmLoop]);

  useEffect(() => {
    if (!autoDetect) {
      stopAlarmLoop();
      lastProcessedEventRef.current = "";
    }
  }, [autoDetect, stopAlarmLoop]);

  useEffect(() => {
    return () => {
      stopAlarmLoop();
    };
  }, [stopAlarmLoop]);

  const toggleAutoDetect = async () => {
    // Prime/resume audio context from user interaction to satisfy browser autoplay rules.
    getSharedAudioContext();
    try {
      if (autoDetect) {
        await stopAutoDetect();
        setAutoDetect(false);
        stopAlarmLoop();
      } else {
        await startAutoDetect();
        setAutoDetect(true);
      }
    } catch {
      // ignore
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setStreamError("");

    try {
      await reconnectCamera(cameraId);
      setStreamRefreshKey((k) => k + 1);
    } catch {
      setStreamError(`Could not reconnect camera ${cameraId}.`);
    } finally {
      setIsReconnecting(false);
    }
  };

  const streamSrc = `${getCameraStreamUrl(cameraId)}?k=${streamRefreshKey}`;

  const toggleAlarmEnabled = () => {
    // Prime/resume audio context from user interaction to satisfy browser autoplay rules.
    getSharedAudioContext();
    setAlarmEnabled((prev) => !prev);
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

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={toggleAlarmEnabled}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              alarmEnabled
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-slate-700 text-slate-200 hover:bg-slate-600"
            }`}
          >
            {alarmEnabled ? "Alarm ON" : "Alarm OFF"}
          </button>

          {alarmActive && (
            <button
              onClick={stopAlarmLoop}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
            >
              Stop Alarm
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Camera Live Preview</h2>
            <p className="mt-1 text-xs text-slate-400">
              Streaming registered CCTV camera using source 0 mapping.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md border border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-300">
              Camera ID: {cameraId}
            </span>
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="rounded-md border border-cyan-500/50 px-3 py-1 text-xs font-medium text-cyan-300 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isReconnecting ? "Reconnecting..." : "Reconnect"}
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-2xl overflow-hidden rounded-xl ">
          <div className="relative flex h-[220px] w-[190px] items-center justify-center sm:h-[220px]">
            <img
              src={streamSrc}
              alt={`Live stream from camera ${cameraId}`}
              className="h-full w-full object-cover rounded-2xl"
              onLoad={() => setStreamError("")}
              onError={() => setStreamError(`Could not start video source for camera ${cameraId}.`)}
            />
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>

            {streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 px-4 text-center">
                <p className="max-w-md text-xs text-red-300">{streamError}</p>
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isReconnecting ? "Reconnecting..." : "Retry Stream"}
                </button>
              </div>
            )}
          </div>
        </div>
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

      <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Auto Marked Entry Details</h2>
          <button
            onClick={loadStoredAttendance}
            className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Refresh Entries
          </button>
        </div>

        {autoMarkedEntries.length === 0 ? (
          <p className="text-xs text-slate-400">No auto-marked entries yet for today.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900/95 text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Employee ID</th>
                  <th className="px-3 py-2 font-medium">Camera</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Entry Time</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {autoMarkedEntries.map((entry, idx) => (
                  <tr key={`${entry.employee_id}-${entry.date}-${entry.entry_time}-${idx}`} className="border-t border-slate-700/80 text-slate-200">
                    <td className="px-3 py-2">{entry.name}</td>
                    <td className="px-3 py-2 font-mono">{entry.employee_id}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{entry.camera_id}</td>
                    <td className="px-3 py-2 text-slate-300">{entry.date}</td>
                    <td className="px-3 py-2 text-slate-300">{entry.entry_time}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-emerald-300">{entry.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
