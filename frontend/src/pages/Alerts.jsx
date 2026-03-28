import { useEffect, useState } from "react";
import { fetchAlerts, handleAlert, ALERT_IMAGE_URL } from "../services/api";
import { ShieldAlert, CheckCircle, AlertTriangle, RefreshCw, Eye } from "lucide-react";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedAlertImages, setSelectedAlertImages] = useState(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts(filter || undefined);
      setAlerts(data.alerts || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const onHandle = async (id, action) => {
    try {
      await handleAlert(id, action);
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status: action } : a))
      );
    } catch {
      /* ignore */
    }
  };

  const statusColor = (s) => {
    if (s === "unhandled") return "bg-red-500/20 text-red-400";
    if (s === "dismissed") return "bg-slate-500/20 text-slate-400";
    return "bg-yellow-500/20 text-yellow-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Alerts</h1>
          <p className="text-sm text-slate-400">Unauthorised person detections</p>
        </div>
        <button
          onClick={loadAlerts}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Alerts", value: alerts.length, icon: ShieldAlert, color: "text-blue-400" },
          {
            label: "Unhandled",
            value: alerts.filter((a) => a.status === "unhandled").length,
            icon: AlertTriangle,
            color: "text-red-400",
          },
          {
            label: "Dismissed",
            value: alerts.filter((a) => a.status === "dismissed").length,
            icon: CheckCircle,
            color: "text-green-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-4 rounded-xl border border-slate-800 bg-[#1e293b] p-4"
          >
            <s.icon className={`h-8 w-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "unhandled", "dismissed", "escalated"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {/* Alert Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#1e293b]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Camera</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Detections</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No alerts found.
                </td>
              </tr>
            )}
            {alerts.map((a) => (
              <tr key={a._id} className="hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedImage(`${ALERT_IMAGE_URL}/${a.image_filename}`)}
                      className="flex items-center gap-1 text-blue-400 hover:underline"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    {a.images && a.images.length > 1 && (
                      <button
                        onClick={() => setSelectedAlertImages(a.images)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        ({a.images.length} pics)
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-white">{a.camera_id}</td>
                <td className="px-4 py-3 text-slate-300">
                  {new Date(a.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-white">
                    {a.detection_count || 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(
                      a.status
                    )}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {a.status === "unhandled" && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onHandle(a._id, "dismissed")}
                        className="rounded bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => onHandle(a._id, "escalated")}
                        className="rounded bg-red-600/80 px-2.5 py-1 text-xs text-white hover:bg-red-600"
                      >
                        Escalate
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[80vh] max-w-[80vw] overflow-hidden rounded-xl border border-slate-700 bg-[#1e293b] p-2">
            <img
              src={selectedImage}
              alt="Alert capture"
              className="max-h-[75vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* Multi-Image Gallery Modal */}
      {selectedAlertImages && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedAlertImages(null)}
        >
          <div
            className="relative max-h-[85vh] max-w-[85vw] overflow-auto rounded-xl border border-slate-700 bg-[#1e293b] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                All captures ({selectedAlertImages.length})
              </h3>
              <button
                onClick={() => setSelectedAlertImages(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {selectedAlertImages.map((img, i) => (
                <img
                  key={i}
                  src={`${ALERT_IMAGE_URL}/${img}`}
                  alt={`capture ${i + 1}`}
                  className="h-36 w-full cursor-pointer rounded-lg border border-slate-700 object-cover hover:border-blue-500"
                  onClick={() => {
                    setSelectedAlertImages(null);
                    setSelectedImage(`${ALERT_IMAGE_URL}/${img}`);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
