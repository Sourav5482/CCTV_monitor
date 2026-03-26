import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import RegisterFace from "./pages/RegisterFace";
import LiveCCTVPreview from "./pages/LiveCCTVPreview";
import CCTVFeatures from "./pages/CCTVFeatures";
import Attendance from "./pages/Attendance";
import CameraAttendance from "./pages/CameraAttendance";
import Alerts from "./pages/Alerts";

function AppLayout() {
  const { pathname } = useLocation();
  const isLandingPage = pathname === "/";

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      {!isLandingPage && <Sidebar />}
      <div className={`flex flex-1 flex-col ${isLandingPage ? "" : "pl-64"}`}>
        <Navbar />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register-face" element={<RegisterFace />} />
            <Route path="/cctv-live" element={<LiveCCTVPreview />} />
            <Route path="/cctv-features" element={<CCTVFeatures />} />
            <Route path="/cctv-summary" element={<LiveCCTVPreview />} />
            <Route path="/camera-attendance" element={<CameraAttendance />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
