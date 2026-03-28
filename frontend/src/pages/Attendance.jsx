import { useState, useMemo, useEffect, useCallback } from "react";
import { Download, Search, RefreshCw } from "lucide-react";
import { fetchAttendance } from "../services/api";

const statusStyles = {
  Present: "bg-green-900/40 text-green-400 border-green-800",
  Late: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  Absent: "bg-red-900/40 text-red-400 border-red-800",
};

export default function Attendance() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(today);
  const [idFilter, setIdFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAttendance(dateFilter || undefined);
      setRecords(data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (!idFilter) return records;
    return records.filter((r) =>
      r.employee_id.toLowerCase().includes(idFilter.toLowerCase())
    );
  }, [records, idFilter]);

  const exportCSV = () => {
    const headers = ["Employee ID", "Name", "Date", "Entry Time", "Camera", "Status"];
    const rows = filtered.map((r) => [r.employee_id, r.name, r.date, r.entry_time, r.camera_id, r.status]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${dateFilter || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">View Entry Records</h1>
          <p className="text-sm text-slate-400">Employee attendance records{loading ? " — loading…" : ""}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Employee&nbsp;ID</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search ID..."
              value={idFilter}
              onChange={(e) => setIdFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-slate-300 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/80">
            <tr>
              {["Employee ID", "Name", "Date", "Entry Time", "Camera", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold text-slate-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No records found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.employee_id} className="transition hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-mono text-blue-400">{r.employee_id}</td>
                  <td className="px-4 py-3 text-slate-200">{r.name}</td>
                  <td className="px-4 py-3 text-slate-400">{r.date}</td>
                  <td className="px-4 py-3 text-slate-300">{r.entry_time}</td>
                  <td className="px-4 py-3 text-slate-400">{r.camera_id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
