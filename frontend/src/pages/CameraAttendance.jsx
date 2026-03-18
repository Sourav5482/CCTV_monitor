import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import {
  Camera,
  CameraOff,
  ScanFace,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { detectAttendance, fetchAttendance } from "../services/api";

const SCAN_INTERVAL_MS = 2000;
const TABLE_REFRESH_MS = 10000;

// ── Audio helpers (Web Audio API) ─────────────────────────────────

function playWelcomeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Pleasant ascending chime: C5 → E5 → G5 → C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
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
    // Audio not supported
  }
}

function playAlertBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Urgent alarm: alternating high-low siren, 3 pulses
    [0, 0.3, 0.6].forEach((delay) => {
      // High tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "square";
      osc1.frequency.value = 880;
      gain1.gain.value = 0.3;
      osc1.start(ctx.currentTime + delay);
      osc1.stop(ctx.currentTime + delay + 0.12);
      // Low tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "square";
      osc2.frequency.value = 660;
      gain2.gain.value = 0.3;
      osc2.start(ctx.currentTime + delay + 0.13);
      osc2.stop(ctx.currentTime + delay + 0.25);
    });
  } catch {
    // Audio not supported
  }
}

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

function dataURLtoFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

const statusIcon = {
  "Attendance Marked": <CheckCircle2 className="h-5 w-5 text-green-400" />,
  "Already Marked": <Info className="h-5 w-5 text-blue-400" />,
  "Unknown Person": <AlertTriangle className="h-5 w-5 text-yellow-400" />,
};

const statusStyle = {
  "Attendance Marked": "border-green-700 bg-green-900/30 text-green-300",
  "Already Marked": "border-blue-700 bg-blue-900/30 text-blue-300",
  "Unknown Person": "border-yellow-700 bg-yellow-900/30 text-yellow-300",
};

const tableStatusStyles = {
  Present: "bg-green-900/40 text-green-400 border-green-800",
  Late: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  Absent: "bg-red-900/40 text-red-400 border-red-800",
};

export default function CameraAttendance() {
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notification, setNotification] = useState(null);
  const [records, setRecords] = useState([]);
  const [scanCount, setScanCount] = useState(0);

  const webcamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const tableIntervalRef = useRef(null);

  // Fetch attendance records
  const loadRecords = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await fetchAttendance(today);
      setRecords(data.records || []);
    } catch {
      // silently fail on background refresh
    }
  }, []);

  // Load records on mount and every TABLE_REFRESH_MS
  useEffect(() => {
    loadRecords();
    tableIntervalRef.current = setInterval(loadRecords, TABLE_REFRESH_MS);
    return () => clearInterval(tableIntervalRef.current);
  }, [loadRecords]);

  // Scanning loop
  useEffect(() => {
    if (!scanning) return;

    const scan = async () => {
      const shot = webcamRef.current?.getScreenshot();
      if (!shot) return;

      const file = dataURLtoFile(shot, "frame.jpg");
      setScanCount((c) => c + 1);

      try {
        const result = await detectAttendance(file);
        const status = result.status;

        if (status === "Attendance Marked") {
          playWelcomeSound();
          setNotification({
            type: status,
            text: `Welcome! Attendance marked for ${result.name}`,
          });
          loadRecords(); // refresh table immediately
        } else if (status === "Already Marked") {
          playWelcomeSound();
          setNotification({
            type: status,
            text: `Welcome back, ${result.name}! Already marked today`,
          });
        } else {
          playAlertBeep();
          setNotification({
            type: "Unknown Person",
            text: "Unknown person detected",
          });
        }
      } catch {
        setNotification({
          type: "Unknown Person",
          text: "Detection failed — check backend",
        });
      }
    };

    scanIntervalRef.current = setInterval(scan, SCAN_INTERVAL_MS);
    // Also run immediately
    scan();

    return () => clearInterval(scanIntervalRef.current);
  }, [scanning, loadRecords]);

  // Auto-dismiss notification after 4s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const startScan = () => {
    setScanCount(0);
    setScanning(true);
  };

  const stopScan = () => {
    setScanning(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <ScanFace className="h-6 w-6 text-blue-400" />
          Camera Attendance System
        </h1>
        <p className="text-sm text-slate-400">
          Automatic face detection and attendance marking via live camera.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Camera Panel — 3 cols */}
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
            {!cameraOn ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <CameraOff className="h-14 w-14 text-slate-700" />
                <p className="text-sm text-slate-500">Camera is off</p>
                <button
                  onClick={() => setCameraOn(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  <Camera className="h-4 w-4" />
                  Start Camera
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Live preview */}
                <div className="relative overflow-hidden rounded-lg border border-slate-700">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="block w-full"
                  />
                  {scanning && (
                    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      Scanning
                    </span>
                  )}
                  {scanning && (
                    <span className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-mono text-slate-300">
                      Scans: {scanCount}
                    </span>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-3">
                  {!scanning ? (
                    <button
                      onClick={startScan}
                      className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      <ScanFace className="h-4 w-4" />
                      Start Attendance Scan
                    </button>
                  ) : (
                    <button
                      onClick={stopScan}
                      className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      <StopCircle className="h-4 w-4" />
                      Stop Scan
                    </button>
                  )}
                  <button
                    onClick={() => {
                      stopScan();
                      setCameraOn(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
                  >
                    Turn Off Camera
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notification toast */}
          {notification && (
            <div
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                statusStyle[notification.type] || statusStyle["Unknown Person"]
              }`}
            >
              {statusIcon[notification.type] || statusIcon["Unknown Person"]}
              {notification.text}
            </div>
          )}
        </div>

        {/* Stats panel — 2 cols */}
        <div className="space-y-4 lg:col-span-2">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center">
              <p className="text-2xl font-bold text-white">{records.length}</p>
              <p className="text-xs text-slate-400">Marked Today</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center">
              <p className="text-2xl font-bold text-white">{scanCount}</p>
              <p className="text-xs text-slate-400">Scans Done</p>
            </div>
          </div>

          {/* Recent detections */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              Today's Attendance ({records.length})
            </h2>
            {records.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">
                No attendance records yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {records.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {r.employee_id} · {r.camera_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-slate-400">{r.entry_time}</p>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          tableStatusStyles[r.status] || tableStatusStyles.Present
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full attendance table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60">
        <div className="border-b border-slate-700 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-300">Attendance Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/80">
              <tr>
                {["Employee ID", "Name", "Date", "Entry Time", "Camera", "Status"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 font-semibold text-slate-300">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No records for today.
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i} className="transition hover:bg-slate-800/60">
                    <td className="px-4 py-3 font-mono text-blue-400">{r.employee_id}</td>
                    <td className="px-4 py-3 text-slate-200">{r.name}</td>
                    <td className="px-4 py-3 text-slate-400">{r.date}</td>
                    <td className="px-4 py-3 text-slate-300">{r.entry_time}</td>
                    <td className="px-4 py-3 text-slate-400">{r.camera_id}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          tableStatusStyles[r.status] || tableStatusStyles.Present
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
