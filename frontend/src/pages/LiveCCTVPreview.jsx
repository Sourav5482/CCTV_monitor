import { useState, useEffect, useCallback } from "react";
import CameraCard from "../components/CameraCard";
import { RefreshCw, Plus, X, Smartphone } from "lucide-react";
import { fetchCameras, addCamera, deleteCamera } from "../services/api";

export default function LiveCCTVPreview() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [form, setForm] = useState({ camera_id: "", name: "", source: "", location: "" });
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const camData = await fetchCameras();
      setCameras(camData.cameras || []);
    } catch {
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.camera_id || !form.name || !form.source) {
      setFormError("Camera ID, Name, and Source are required.");
      return;
    }
    try {
      await addCamera(form);
      setForm({ camera_id: "", name: "", source: "", location: "" });
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
    } catch {
      // ignore
    }
  };

  const activeCount = cameras.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live CCTV Preview</h1>
          <p className="text-sm text-slate-400">
            {activeCount} of {cameras.length} cameras online
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowMobile((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Smartphone className="h-4 w-4" />
            Mobile Camera
          </button>

          <button
            onClick={() => setShowForm((v) => !v)}
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

      {showMobile && (
        <div className="rounded-xl border border-blue-800 bg-blue-950/40 p-5 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-300">
            <Smartphone className="h-4 w-4" />
            Connect Your Mobile Camera
          </h2>
          <div className="space-y-2 text-sm text-slate-300">
            <p className="font-medium text-white">Android — IP Webcam app:</p>
            <ol className="ml-4 list-decimal space-y-1 text-slate-400">
              <li>Install IP Webcam</li>
              <li>Tap Start server</li>
              <li>Use source: <code className="rounded bg-slate-800 px-1 text-green-300">http://PHONE_IP:8080/video</code></li>
            </ol>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-700 bg-[#1e293b] p-5 space-y-4">
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
              <label className="mb-1 block text-xs text-slate-400">Source</label>
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="rtsp://... or http://... or 0"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Main Gate"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <button type="submit" className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">
            Connect Camera
          </button>
        </form>
      )}

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
    </div>
  );
}
