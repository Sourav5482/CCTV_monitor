import { NavLink, useLocation } from "react-router-dom";
import {
  House,
  UserPlus,
  Cctv,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

const landingLinks = [
  { to: "/", label: "Landing", icon: House },
];

const appLinks = [
  { to: "/register-face", label: "Register Face", icon: UserPlus },
  { to: "/cctv-live", label: "Live CCTV Preview", icon: Cctv },
  { to: "/cctv-features", label: "CCTV Features", icon: ShieldAlert },
  { to: "/attendance", label: "View Entry Records", icon: ClipboardList },
  { to: "/alerts", label: "Security Alerts", icon: ShieldAlert },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const links = pathname === "/" ? landingLinks : appLinks;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800 bg-[#0b1120]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
        <ShieldCheck className="h-7 w-7 text-blue-500" />
        <span className="text-lg font-bold tracking-wide text-white">Sudarshan<span className="text-blue-400">AI</span></span>
      </div>

      {/* Nav Links */}
      <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
        {links.map((link) => {
          const LinkIcon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <LinkIcon className="h-5 w-5" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-6 py-4">
        <p className="text-xs text-slate-600">© 2026 SudarshanAI</p>
      </div>
    </aside>
  );
}
