import {
  Users,
  Cctv,
  CalendarCheck,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import CameraCard from "../components/CameraCard";

const stats = [
  { label: "Total Employees", value: "124", icon: Users, color: "bg-blue-600" },
  { label: "Active Cameras", value: "8", icon: Cctv, color: "bg-green-600" },
  { label: "Today Attendance", value: "98", icon: CalendarCheck, color: "bg-indigo-600" },
  { label: "Alerts", value: "3", icon: AlertTriangle, color: "bg-red-600" },
];

const weeklyData = [
  { day: "Mon", present: 110, absent: 14 },
  { day: "Tue", present: 105, absent: 19 },
  { day: "Wed", present: 118, absent: 6 },
  { day: "Thu", present: 98, absent: 26 },
  { day: "Fri", present: 112, absent: 12 },
  { day: "Sat", present: 45, absent: 79 },
  { day: "Sun", present: 0, absent: 124 },
];

const pieData = [
  { name: "Present", value: 98 },
  { name: "Absent", value: 18 },
  { name: "Late", value: 8 },
];

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b"];

const cameras = [
  { name: "Entrance Camera", location: "Main Gate", status: "active" },
  { name: "Office Floor Cam", location: "2nd Floor", status: "active" },
  { name: "Admin Area Cam", location: "Admin Block", status: "active" },
  { name: "Parking Camera", location: "Basement B1", status: "offline" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">Welcome back — here's today's overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-800/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">Daily Attendance (This Week)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                itemStyle={{ color: "#e2e8f0" }}
              />
              <Bar dataKey="present" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">Attendance Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                itemStyle={{ color: "#e2e8f0" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CCTV Preview */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-slate-300">Live Camera Preview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cameras.map((cam) => (
            <CameraCard key={cam.name} {...cam} />
          ))}
        </div>
      </div>
    </div>
  );
}
