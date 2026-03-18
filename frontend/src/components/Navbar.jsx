import { Bell, Search, User } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0f172a]/80 px-6 backdrop-blur-md">
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search employees, cameras..."
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2 pl-10 pr-4 text-sm text-slate-300 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-200">Admin</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
