import { useState } from "react";
import { VideoOff, Trash2, RefreshCw } from "lucide-react";
import { getCameraStreamUrl, reconnectCamera } from "../services/api";

export default function CameraCard({
  camera_id,
  name,
  location,
  status = "active",
  source,
  onDelete,
  onPowerToggle,
}) {
  const isActive = status === "active";
  const isPoweredOn = status !== "offline";
  const [retrying, setRetrying] = useState(false);
  const [powerBusy, setPowerBusy] = useState(false);

  const handleReconnect = async () => {
    setRetrying(true);
    try {
      await reconnectCamera(camera_id);
    } catch { /* */ }
    finally { setRetrying(false); }
  };

  const handlePowerToggle = async () => {
    if (!onPowerToggle) return;
    setPowerBusy(true);
    try {
      await onPowerToggle(camera_id, !isPoweredOn);
    } catch {
      // ignore
    } finally {
      setPowerBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
      {/* Video feed */}
      <div className="relative flex aspect-video items-center justify-center bg-slate-900">
        {isActive ? (
          <>
            <img
              src={getCameraStreamUrl(camera_id)}
              alt={name}
              className="h-full w-full object-cover"
            />
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
          </>
        ) : (
          <>
            <VideoOff className="h-10 w-10 text-slate-700" />
            <span className="absolute left-3 top-3 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Offline
            </span>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{name}</h3>
          {onDelete && (
            <button
              onClick={() => onDelete(camera_id)}
              className="rounded p-1 text-slate-500 hover:bg-red-900/30 hover:text-red-400"
              title="Remove camera"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {location || source}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-slate-600"}`}
          />
          <span
            className={`text-xs font-medium ${isActive ? "text-green-400" : "text-slate-500"}`}
          >
            {isActive ? "Active" : status === "no_signal" ? "No Signal" : "Offline"}
          </span>
          {!isActive && (
            <button
              onClick={handleReconnect}
              disabled={retrying}
              className="ml-auto flex items-center gap-1 rounded bg-blue-600/80 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Reconnect"}
            </button>
          )}
        </div>
        {onPowerToggle && (
          <button
            onClick={handlePowerToggle}
            disabled={powerBusy}
            className={`mt-3 w-full rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              isPoweredOn
                ? "bg-rose-600/90 text-white hover:bg-rose-600"
                : "bg-emerald-600/90 text-white hover:bg-emerald-600"
            }`}
          >
            {powerBusy ? "Updating..." : isPoweredOn ? "Turn Camera Off" : "Turn Camera On"}
          </button>
        )}
      </div>
    </div>
  );
}
