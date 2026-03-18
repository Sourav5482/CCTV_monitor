import { useCallback, useRef } from "react";
import Webcam from "react-webcam";

const videoConstraints = {
  width: 480,
  height: 360,
  facingMode: "user",
};

export default function WebcamCapture({ onCapture, disabled }) {
  const webcamRef = useRef(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [onCapture]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="overflow-hidden rounded-xl border-2 border-slate-700 shadow-lg">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="block"
          width={480}
          height={360}
        />
      </div>

      <button
        type="button"
        onClick={capture}
        disabled={disabled}
        className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0011.586 3H8.414a1 1 0 00-.707.293L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
        Capture Photo
      </button>
    </div>
  );
}
