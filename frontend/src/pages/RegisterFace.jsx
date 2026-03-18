import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Camera, CameraOff, Cpu, Trash2, UserPlus } from "lucide-react";
import { trainFace } from "../services/api";

const TARGET_IMAGES = 200;
const CAPTURE_INTERVAL_MS = 200;

const videoConstraints = {
  width: 480,
  height: 360,
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

export default function RegisterFace() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [cameraOn, setCameraOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const webcamRef = useRef(null);
  const intervalRef = useRef(null);

  // Auto-capture loop
  useEffect(() => {
    if (capturing) {
      intervalRef.current = setInterval(() => {
        setPhotos((prev) => {
          if (prev.length >= TARGET_IMAGES) {
            clearInterval(intervalRef.current);
            setCapturing(false);
            return prev;
          }
          const shot = webcamRef.current?.getScreenshot();
          if (!shot) return prev;
          return [...prev, shot];
        });
      }, CAPTURE_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [capturing]);

  // Stop auto-capture when reaching target
  useEffect(() => {
    if (photos.length >= TARGET_IMAGES && capturing) {
      setCapturing(false);
    }
  }, [photos.length, capturing]);

  const startCapture = useCallback(() => {
    setMessage(null);
    setCapturing(true);
  }, []);

  const stopCapture = useCallback(() => {
    setCapturing(false);
  }, []);

  const clearPhotos = () => {
    setPhotos([]);
    setMessage(null);
  };

  const handleTrain = async () => {
    if (!name.trim() || !employeeId.trim()) {
      setMessage({ type: "error", text: "Please fill in Employee Name and Employee ID." });
      return;
    }
    if (photos.length < TARGET_IMAGES) {
      setMessage({ type: "error", text: `Please capture all ${TARGET_IMAGES} images first.` });
      return;
    }

    const files = photos.map((src, i) => dataURLtoFile(src, `capture_${i}.jpg`));

    setLoading(true);
    setMessage(null);

    try {
      await trainFace(name, phone, employeeId, files);
      setMessage({ type: "success", text: "Face training completed successfully." });
      setPhotos([]);
      setName("");
      setPhone("");
      setEmployeeId("");
      setCameraOn(false);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setMessage({ type: "error", text: `Training failed: ${detail}` });
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min((photos.length / TARGET_IMAGES) * 100, 100);
  const isReadyToTrain = photos.length >= TARGET_IMAGES && !loading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <UserPlus className="h-6 w-6 text-blue-400" />
          Register Face
        </h1>
        <p className="text-sm text-slate-400">
          Capture {TARGET_IMAGES} face images and train the recognition model.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Form + Camera */}
        <div className="space-y-5">
          {/* Form */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">Employee Details</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Employee Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sourav Das"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP001"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Camera */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">Face Capture</h2>

            {!cameraOn ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <CameraOff className="h-12 w-12 text-slate-700" />
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
                <div className="overflow-hidden rounded-lg border border-slate-700">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="block w-full"
                  />
                </div>

                {/* Capture controls */}
                <div className="flex flex-wrap gap-3">
                  {!capturing && photos.length < TARGET_IMAGES && (
                    <button
                      onClick={startCapture}
                      className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      <Camera className="h-4 w-4" />
                      Capture Face
                    </button>
                  )}
                  {capturing && (
                    <button
                      onClick={stopCapture}
                      className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Stop Capture
                    </button>
                  )}
                  {photos.length > 0 && !capturing && (
                    <button
                      onClick={clearPhotos}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Progress + Preview + Train */}
        <div className="space-y-5">
          {/* Progress */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Capture Progress</h2>
              <span className="font-mono text-sm text-blue-400">
                {photos.length} / {TARGET_IMAGES}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-900">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  photos.length >= TARGET_IMAGES ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {capturing && (
              <p className="mt-2 animate-pulse text-xs text-blue-400">
                Capturing faces… {photos.length} / {TARGET_IMAGES}
              </p>
            )}
            {photos.length >= TARGET_IMAGES && !capturing && (
              <p className="mt-2 text-xs text-green-400">
                All {TARGET_IMAGES} images captured. Ready to train!
              </p>
            )}
          </div>

          {/* Preview Grid */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              Captured Faces ({photos.length})
            </h2>
            {photos.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-600">
                No images captured yet.
              </p>
            ) : (
              <div className="grid max-h-80 grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
                {photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`face ${i + 1}`}
                    className="aspect-square w-full rounded object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          {message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                message.type === "success"
                  ? "border border-green-600 bg-green-900/40 text-green-300"
                  : "border border-red-600 bg-red-900/40 text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Train Button */}
          <button
            onClick={handleTrain}
            disabled={!isReadyToTrain}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-base font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Training Model…
              </>
            ) : (
              <>
                <Cpu className="h-5 w-5" />
                Train Model
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
