import { useEffect, useState } from "react";
import { ActivitySquare, Siren } from "lucide-react";
import { ALERT_IMAGE_URL, getIncidentEvents, getIncidentSummary } from "../services/api";

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function IncidentMonitorPanel() {
  const [summary, setSummary] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeCapture, setActiveCapture] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, eventRes] = await Promise.all([
          getIncidentSummary(),
          getIncidentEvents(12),
        ]);
        setSummary(sumRes.incidents || []);
        setEvents(eventRes.incidents || []);
      } catch {
        setSummary([]);
        setEvents([]);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-slate-700 bg-[#1e293b] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Siren className="h-4 w-4 text-amber-400" />
          CCTV Incident Summary
        </h2>
        <span className="text-xs text-slate-400">Accident · Theft · Suspicious Movement · Weapon</span>
      </div>

      {summary.length === 0 ? (
        <p className="text-sm text-slate-500">Incident monitor data is not available yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <div
              key={item.key}
              className={`rounded-lg border p-3 ${
                item.status === "monitoring"
                  ? "border-amber-700 bg-amber-950/20"
                  : "border-slate-700 bg-slate-800/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <ActivitySquare className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-lg font-bold text-white">{item.count}</p>
              <p className="mt-1 text-xs text-slate-400">{item.message}</p>
              {Array.isArray(item.cameras) && item.cameras.length > 0 && (
                <p className="mt-2 text-xs text-amber-300">Cameras: {item.cameras.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <h3 className="text-sm font-semibold text-white">Recent Suspicious Captures</h3>
        {events.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No suspicious captures yet.</p>
        ) : (
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {events.map((evt, i) => (
              <div key={`${evt.timestamp || "t"}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-2">
                <button
                  type="button"
                  onClick={() => setActiveCapture(evt)}
                  className="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <img
                    src={`${ALERT_IMAGE_URL}/${evt.image_filename}`}
                    alt="incident"
                    className="h-14 w-20 rounded object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-amber-300 font-medium">{evt.incident_type?.replaceAll("_", " ") || "suspicious"}</p>
                  <p className="text-xs text-white truncate">Camera: {evt.camera_name || evt.camera_id}</p>
                  <p className="text-[11px] text-slate-400">Date: {fmtDate(evt.timestamp)}</p>
                  {evt.metadata && (
                    <p className="text-[11px] text-slate-500 truncate">
                      Meta: reason={evt.metadata.reason || "-"}
                      {typeof evt.metadata.score === "number" ? `, score=${evt.metadata.score}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeCapture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveCapture(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-950 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveCapture(null)}
              className="absolute right-3 top-3 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Close
            </button>
            <img
              src={`${ALERT_IMAGE_URL}/${activeCapture.image_filename}`}
              alt="suspicious capture"
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
            <div className="mt-2 text-xs text-slate-300">
              <p>Type: {activeCapture.incident_type?.replaceAll("_", " ") || "suspicious"}</p>
              <p>Camera: {activeCapture.camera_name || activeCapture.camera_id}</p>
              <p>Date: {fmtDate(activeCapture.timestamp)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
