import { NavLink } from "react-router-dom";
import {
  House,
  UserPlus,
  Cctv,
  ScanFace,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

const links = [
  { to: "/", label: "Landing", icon: House },
  { to: "/register-face", label: "Register Face", icon: UserPlus },
  { to: "/cctv-live", label: "Live CCTV Preview", icon: Cctv },
  { to: "/cctv-features", label: "CCTV Features", icon: ShieldAlert },
  { to: "/camera-attendance", label: "Camera Attendance", icon: ScanFace },
  { to: "/attendance", label: "View Attendance", icon: ClipboardList },
  { to: "/alerts", label: "Security Alerts", icon: ShieldAlert },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800 bg-[#0b1120]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
        <ShieldCheck className="h-7 w-7 text-blue-500" />
        <span className="text-lg font-bold tracking-wide text-white">
          CCTV<span className="text-blue-400">Monitor</span>
        </span>
      </div>

      {/* Nav Links */}
      <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-6 py-4">
        <p className="text-xs text-slate-600">© 2026 CCTVMonitor</p>
      </div>
    </aside>
  );
}
