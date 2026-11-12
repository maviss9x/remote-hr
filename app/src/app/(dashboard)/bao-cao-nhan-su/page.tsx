"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Clock,
  TrendingUp,
  Briefcase,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
} from "lucide-react";
import { exportHrReportExcel } from "@/lib/exportHrReportExcel";

interface StaffFluctuation {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  role: string;
  status: string;
  avatarUrl?: string | null;
  probationStartDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  leaveDate?: string | null;
  contractType?: string;
  contractStatus?: string;
  isInput: boolean;
  isOutput: boolean;
}

interface AttendanceRecord {
  id: number;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  probationStartDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  totalRegistered: number;
  attended: number;
  absent: number;
  lateCount: number;
  passQcCount: number;
  attendanceRate: number;
  isWorkingInMonth: boolean;
  hasNoShift: boolean;
}

interface WeekBucket {
  name: string;
  start: number;
  end: number;
  attended: number;
  absent: number;
  total: number;
}

interface ReportData {
  month: number;
  year: number;
  summary: {
    totalStaff: number;
    activeStaff: number;
    inputCount: number;
    outputCount: number;
    workingStaffCount: number;
    absentStaffCount: number;
    totalShiftsCount: number;
    totalAttendedShifts: number;
    totalAbsentShifts: number;
    overallAttendanceRate: number;
  };
  inputStaff: StaffFluctuation[];
  outputStaff: StaffFluctuation[];
  attendanceRecords: AttendanceRecord[];
  weekBuckets: WeekBucket[];
}

export default function BaoCaoNhanSuPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [activeTab, setActiveTab] = useState<"fluctuation" | "attendance" | "absent">("fluctuation");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fluctuationFilter, setFluctuationFilter] = useState<"ALL" | "INPUT" | "OUTPUT" | "ACTIVE">("ALL");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/reports/personnel?month=${selectedMonth}&year=${selectedYear}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Không thể tải dữ liệu báo cáo nhân sự");
      }
      const json: ReportData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi lấy báo cáo");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getRoleBadge = (role: string) => {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700/80">
        Nhân sự Remote
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OFFICIAL":
      case "ACTIVE":
        return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30 flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> Chính thức</span>;
      case "PROBATION":
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400 font-medium border border-amber-500/30 flex items-center gap-1 w-fit"><Clock size={12} /> Thử việc</span>;
      case "INACTIVE":
      case "TERMINATED":
        return <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-400 font-medium border border-rose-500/30 flex items-center gap-1 w-fit"><XCircle size={12} /> Đã nghỉ việc</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-slate-500/20 text-slate-400 font-medium border border-slate-500/30 w-fit">{status}</span>;
    }
  };

  // Lọc danh sách biến động nhân sự
  const filteredFluctuationList = useMemo(() => {
    if (!data) return [];
    let list: StaffFluctuation[] = [];

    // Hợp nhất danh sách nhân sự
    const allMap = new Map<number, StaffFluctuation>();
    data.inputStaff.forEach((s) => allMap.set(s.id, s));
    data.outputStaff.forEach((s) => allMap.set(s.id, s));
    data.attendanceRecords.forEach((r) => {
      if (!allMap.has(r.id)) {
        allMap.set(r.id, {
          id: r.id,
          fullName: r.fullName,
          phone: r.phone,
          role: r.role,
          status: r.status,
          avatarUrl: r.avatarUrl,
          probationStartDate: r.probationStartDate,
          contractStartDate: r.contractStartDate,
          contractEndDate: r.contractEndDate,
          leaveDate: null,
          isInput: false,
          isOutput: false,
        });
      }
    });

    list = Array.from(allMap.values());

    // Lọc theo loại biến động
    if (fluctuationFilter === "INPUT") {
      list = list.filter((item) => item.isInput);
    } else if (fluctuationFilter === "OUTPUT") {
      list = list.filter((item) => item.isOutput);
    } else if (fluctuationFilter === "ACTIVE") {
      list = list.filter((item) => item.status === "ACTIVE" || item.status === "PROBATION");
    }

    // Lọc theo trạng thái
    if (statusFilter !== "ALL") {
      if (statusFilter === "ACTIVE") {
        list = list.filter((item) => item.status === "ACTIVE" || item.status === "OFFICIAL");
      } else if (statusFilter === "PROBATION") {
        list = list.filter((item) => item.status === "PROBATION");
      } else if (statusFilter === "INACTIVE") {
        list = list.filter((item) => item.status === "INACTIVE" || item.status === "TERMINATED");
      }
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.fullName.toLowerCase().includes(q) ||
          item.phone.includes(q)
      );
    }

    return list;
  }, [data, fluctuationFilter, statusFilter, searchTerm]);

  // Lọc danh sách chuyên cần
  const filteredAttendanceList = useMemo(() => {
    if (!data) return [];
    let list = [...data.attendanceRecords];

    if (statusFilter !== "ALL") {
      if (statusFilter === "ACTIVE") {
        list = list.filter((item) => item.status === "ACTIVE" || item.status === "OFFICIAL");
      } else if (statusFilter === "PROBATION") {
        list = list.filter((item) => item.status === "PROBATION");
      } else if (statusFilter === "INACTIVE") {
        list = list.filter((item) => item.status === "INACTIVE" || item.status === "TERMINATED");
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.fullName.toLowerCase().includes(q) ||
          item.phone.includes(q)
      );
    }

    return list;
  }, [data, statusFilter, searchTerm]);

  // Lọc danh sách nhân sự nghỉ / vắng
  const filteredAbsentList = useMemo(() => {
    if (!data) return [];
    let list = data.attendanceRecords.filter(
      (item) => item.absent > 0 || (item.status === "ACTIVE" && item.hasNoShift)
    );

    if (statusFilter !== "ALL") {
      if (statusFilter === "ACTIVE") {
        list = list.filter((item) => item.status === "ACTIVE" || item.status === "OFFICIAL");
      } else if (statusFilter === "PROBATION") {
        list = list.filter((item) => item.status === "PROBATION");
      } else if (statusFilter === "INACTIVE") {
        list = list.filter((item) => item.status === "INACTIVE" || item.status === "TERMINATED");
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.fullName.toLowerCase().includes(q) ||
          item.phone.includes(q)
      );
    }

    return list;
  }, [data, statusFilter, searchTerm]);

  // Xuất file Excel chuẩn phong cách Freetrip với 3 Sheet đầy đủ Background, Border, Styling
  const handleExportExcel = async () => {
    if (!data) return;

    try {
      await exportHrReportExcel({
        month: selectedMonth,
        year: selectedYear,
        formatDate,
        fluctuations: filteredFluctuationList,
        attendances: filteredAttendanceList,
        absents: filteredAbsentList,
      });
    } catch (err: any) {
      console.error("Lỗi khi xuất file Excel báo cáo nhân sự:", err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <UserCheck size={24} />
            </span>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Báo Cáo Nhân Sự
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Tổng hợp biến động đầu vào, đầu ra, số lượng nhân sự đi làm và nghỉ việc theo tháng (Áp dụng cho cấp nhân sự)
          </p>
        </div>

        {/* TIME CONTROLS & ACTIONS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1 font-semibold text-[var(--text-primary)] text-sm">
              <Calendar size={15} className="text-orange-500" />
              <span>Tháng {selectedMonth}/{selectedYear}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw size={17} className={loading ? "animate-spin text-orange-500" : ""} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || !data}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Tổng nhân sự */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-[var(--shadow-sm)] relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng nhân sự</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? "..." : data?.summary.totalStaff || 0}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
            <span className="text-emerald-500 font-semibold">{data?.summary.activeStaff || 0}</span> đang hoạt động
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Đầu vào trong tháng */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-[var(--shadow-sm)] relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Đầu vào (Mới)</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <UserPlus size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-500">
            {loading ? "..." : `+${data?.summary.inputCount || 0}`}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Bắt đầu thử việc / ký HĐ mới
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Đầu ra trong tháng */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-[var(--shadow-sm)] relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Đầu ra (Nghỉ việc)</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <UserMinus size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-rose-500">
            {loading ? "..." : `-${data?.summary.outputCount || 0}`}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Nghỉ việc / Kết thúc HĐ
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Nhân sự đi làm */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-[var(--shadow-sm)] relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Đi làm thực tế</span>
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
              <Briefcase size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-orange-500">
            {loading ? "..." : data?.summary.workingStaffCount || 0}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
            <span>{data?.summary.totalAttendedShifts || 0} lượt ca hoàn thành</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 5: Chuyên cần & Ca vắng */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-[var(--shadow-sm)] relative overflow-hidden">
          <div className="flex items-center justify-between text-[var(--text-secondary)] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Tỉ lệ đi làm</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-500">
            {loading ? "..." : `${data?.summary.overallAttendanceRate || 0}%`}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            <span className="text-rose-500 font-semibold">{data?.summary.totalAbsentShifts || 0}</span> ca vắng / nghỉ
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* WEEKLY BREAKDOWN PROGRESS BARS */}
      {data && data.weekBuckets.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock size={16} className="text-orange-500" />
              <span>Tiến độ ca làm việc theo tuần (Tháng {selectedMonth})</span>
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đi làm đạt
              </span>
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Vắng / Nghỉ
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.weekBuckets.map((bucket, idx) => {
              const attendedPercent = bucket.total > 0 ? Math.round((bucket.attended / bucket.total) * 100) : 0;
              return (
                <div key={idx} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{bucket.name}</span>
                    <span className="text-[var(--text-secondary)] font-semibold">{bucket.total} ca</span>
                  </div>
                  <div className="w-full bg-[var(--bg-hover)] rounded-full h-2.5 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${attendedPercent}%` }}
                      title={`Đi làm: ${bucket.attended} ca`}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${100 - attendedPercent}%` }}
                      title={`Vắng: ${bucket.absent} ca`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[var(--text-secondary)]">
                    <span className="text-emerald-500 font-medium">Đi làm: {bucket.attended} ({attendedPercent}%)</span>
                    <span className="text-rose-500 font-medium">Vắng: {bucket.absent}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & TABS SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* TABS */}
          <div className="flex items-center p-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("fluctuation")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "fluctuation"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <UserCheck size={16} />
              <span>Biến động nhân sự (Vào / Ra)</span>
              {data && (
                <span className="ml-1 px-1.5 py-0.2 bg-black/20 rounded-full text-xs">
                  {filteredFluctuationList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("attendance")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "attendance"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Briefcase size={16} />
              <span>Chuyên cần & Đi làm</span>
              {data && (
                <span className="ml-1 px-1.5 py-0.2 bg-black/20 rounded-full text-xs">
                  {filteredAttendanceList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("absent")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "absent"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <AlertTriangle size={16} />
              <span>Nhân sự nghỉ / Vắng</span>
              {data && (
                <span className="ml-1 px-1.5 py-0.2 bg-black/20 rounded-full text-xs">
                  {filteredAbsentList.length}
                </span>
              )}
            </button>
          </div>

          {/* SEARCH & SELECT FILTERS */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Tìm họ tên, số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500/50 transition-all"
              />
            </div>

            {activeTab === "fluctuation" && (
              <select
                value={fluctuationFilter}
                onChange={(e: any) => setFluctuationFilter(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-500/50"
              >
                <option value="ALL">Tất cả biến động</option>
                <option value="INPUT">Chỉ đầu vào (+)</option>
                <option value="OUTPUT">Chỉ đầu ra (-)</option>
                <option value="ACTIVE">Đang hoạt động</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-500/50"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Chính thức (Active)</option>
              <option value="PROBATION">Thử việc (Probation)</option>
              <option value="INACTIVE">Đã nghỉ việc (Inactive)</option>
            </select>
          </div>
        </div>

        {/* TAB CONTENT: TAB 1 - BIẾN ĐỘNG NHÂN SỰ */}
        {activeTab === "fluctuation" && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">STT</th>
                    <th className="py-3.5 px-4">Nhân sự</th>
                    <th className="py-3.5 px-4">Chức vụ</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Bắt đầu thử việc</th>
                    <th className="py-3.5 px-4">Ký hợp đồng</th>
                    <th className="py-3.5 px-4">Hết hạn / Ngày nghỉ</th>
                    <th className="py-3.5 px-4 text-center">Phân loại biến động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                        <RefreshCw size={24} className="animate-spin mx-auto text-orange-500 mb-2" />
                        Đang nạp dữ liệu nhân sự...
                      </td>
                    </tr>
                  ) : filteredFluctuationList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                        Không tìm thấy bản ghi biến động nhân sự nào phù hợp
                      </td>
                    </tr>
                  ) : (
                    filteredFluctuationList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3.5 px-4 text-center text-[var(--text-muted)] font-mono text-xs">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 font-bold flex items-center justify-center text-xs shrink-0">
                              {item.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">{item.fullName}</div>
                              <div className="text-xs text-[var(--text-secondary)] font-mono">{item.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{getRoleBadge(item.role)}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-secondary)]">
                          {formatDate(item.probationStartDate)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-secondary)]">
                          {formatDate(item.contractStartDate)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-secondary)]">
                          {formatDate(item.leaveDate || item.contractEndDate)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.isInput ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                              <UserPlus size={12} /> Đầu vào mới
                            </span>
                          ) : item.isOutput ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                              <UserMinus size={12} /> Đầu ra (Đã nghỉ)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                              Đang làm việc
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: TAB 2 - CHUYÊN CẦN & ĐI LÀM */}
        {activeTab === "attendance" && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">STT</th>
                    <th className="py-3.5 px-4">Nhân sự</th>
                    <th className="py-3.5 px-4">Chức vụ</th>
                    <th className="py-3.5 px-4 text-center">Đăng ký</th>
                    <th className="py-3.5 px-4 text-center">Thực đi</th>
                    <th className="py-3.5 px-4 text-center">Vắng / Nghỉ</th>
                    <th className="py-3.5 px-4 text-center">Đi muộn</th>
                    <th className="py-3.5 px-4 text-center">QC Pass</th>
                    <th className="py-3.5 px-4 text-center">Tỉ lệ đi làm</th>
                    <th className="py-3.5 px-4 text-center">Đánh giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[var(--text-muted)]">
                        <RefreshCw size={24} className="animate-spin mx-auto text-orange-500 mb-2" />
                        Đang nạp dữ liệu chuyên cần...
                      </td>
                    </tr>
                  ) : filteredAttendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[var(--text-muted)]">
                        Không có dữ liệu chuyên cần phù hợp
                      </td>
                    </tr>
                  ) : (
                    filteredAttendanceList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3.5 px-4 text-center text-[var(--text-muted)] font-mono text-xs">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[var(--text-primary)]">{item.fullName}</div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono">{item.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">{getRoleBadge(item.role)}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-medium text-[var(--text-secondary)]">
                          {item.totalRegistered}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-500">
                          {item.attended}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-500">
                          {item.absent}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-amber-500">
                          {item.lateCount}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-teal-500">
                          {item.passQcCount}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-[var(--bg-hover)] rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${
                                  item.attendanceRate >= 80
                                    ? "bg-emerald-500"
                                    : item.attendanceRate >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${item.attendanceRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-semibold">{item.attendanceRate}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.totalRegistered === 0 ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                              Không có ca
                            </span>
                          ) : item.attendanceRate >= 85 ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-semibold">
                              Chuyên cần tốt
                            </span>
                          ) : item.attendanceRate >= 60 ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-500 border border-blue-500/30">
                              Bình thường
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30 font-semibold">
                              Cảnh báo nghỉ nhiều
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: TAB 3 - NHÂN SỰ NGHỈ / VẮNG */}
        {activeTab === "absent" && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-[var(--text-secondary)] font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">STT</th>
                    <th className="py-3.5 px-4">Nhân sự</th>
                    <th className="py-3.5 px-4">Chức vụ</th>
                    <th className="py-3.5 px-4">Trạng thái hồ sơ</th>
                    <th className="py-3.5 px-4 text-center">Số ca vắng</th>
                    <th className="py-3.5 px-4 text-center">Tổng ca đăng ký</th>
                    <th className="py-3.5 px-4">Đánh giá nguy cơ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                        <RefreshCw size={24} className="animate-spin mx-auto text-orange-500 mb-2" />
                        Đang nạp danh sách nhân sự nghỉ...
                      </td>
                    </tr>
                  ) : filteredAbsentList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-emerald-500 font-medium">
                        Không có nhân sự nào vắng ca hoặc không đi làm trong tháng!
                      </td>
                    </tr>
                  ) : (
                    filteredAbsentList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3.5 px-4 text-center text-[var(--text-muted)] font-mono text-xs">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[var(--text-primary)]">{item.fullName}</div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono">{item.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">{getRoleBadge(item.role)}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-500 text-base">
                          {item.absent}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-[var(--text-secondary)]">
                          {item.totalRegistered}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.absent >= 3 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                              <AlertTriangle size={12} /> Vắng quá quy định (≥3 ca)
                            </span>
                          ) : item.absent > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30">
                              Có ca vắng ({item.absent} ca)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                              Không đăng ký ca trong tháng
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
