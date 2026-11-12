"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MonthPicker } from "@/components/ui";
import {
  Users,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Clock,
  Award,
  RefreshCw,
  ArrowUpRight,
  BellRing,
  Sparkles,
  CheckCircle2,
  XCircle,
  UserCheck,
  ShieldAlert,
  Briefcase,
  Layers,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
interface ManagerDashboardData {
  isManager: true;
  role: string;
  month?: number;
  year?: number;
  user: {
    id: number;
    fullName: string;
    role: string;
  };
  stats: {
    totalStaff: number;
    activeStaff: number;
    pendingReviews: number;
    expiringContracts: number;
    shiftsThisWeek: number;
    totalReportsToday: number;
    avgKpiRate: number;
    totalViralBonus: number;
  };
  shiftDistributionToday: {
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
  };
  recentActivities: Array<{
    time: string;
    user: string;
    action: string;
    role: string;
    type: string;
    accent: string;
  }>;
}

interface StaffDashboardData {
  isManager: false;
  role: string;
  user: {
    id: number;
    fullName: string;
    phone: string;
    role: string;
    status: string;
    startDate: string;
  };
  contract: {
    id: number;
    contractType: string;
    startDate: string;
    endDate: string;
    status: string;
    daysRemaining: number | null;
    isExpiringSoon: boolean;
  } | null;
  stats: {
    shiftsCountThisWeek: number;
    shiftsApprovedThisWeek: number;
    monthlyReportsSubmitted: number;
    monthlyReportsPass: number;
    monthlyReportsPending: number;
    monthlyReportsFail: number;
    totalFbApproved: number;
    totalThreadApproved: number;
    totalCommentApproved: number;
  };
  todayShifts: Array<{
    id: number;
    shiftDate: string;
    shiftType: "MORNING" | "AFTERNOON" | "EVENING";
    workMode: "ONLINE" | "OFFLINE";
    status: string;
    hasSubmittedReport: boolean;
    qcResult: "PASS" | "FAIL" | "PENDING" | null;
  }>;
  shiftsThisWeekList: Array<{
    id: number;
    shiftDate: string;
    shiftType: "MORNING" | "AFTERNOON" | "EVENING";
    workMode: "ONLINE" | "OFFLINE";
    status: string;
    hasSubmittedReport: boolean;
  }>;
  recentActivities: Array<{
    time: string;
    action: string;
    type: string;
    accent: string;
  }>;
}

type DashboardResponse = ManagerDashboardData | StaffDashboardData;

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
export default function DashboardPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(
    async (showRefreshingState = false, m?: number, y?: number) => {
      if (showRefreshingState) setIsRefreshing(true);
      try {
        const targetMonth = m ?? selectedMonth;
        const targetYear = y ?? selectedYear;
        const res = await fetch(`/api/dashboard?month=${targetMonth}&year=${targetYear}`);
        if (!res.ok) {
          throw new Error(`Lỗi kết nối máy chủ (${res.status})`);
        }
        const json: DashboardResponse = await res.json();
        setData(json);
        if (json.isManager && json.month && json.year) {
          setSelectedMonth(json.month);
          setSelectedYear(json.year);
        }
        setError(null);
      } catch (err: any) {
        console.error("Lỗi khi tải dashboard:", err);
        setError(err.message || "Không thể tải dữ liệu Dashboard");
      } finally {
        setLoading(false);
        if (showRefreshingState) {
          setTimeout(() => setIsRefreshing(false), 400);
        }
      }
    },
    [selectedMonth, selectedYear]
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData(true, selectedMonth, selectedYear);
  };

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    fetchDashboardData(true, newMonth, newYear);
  };

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1rem 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ height: "32px", width: "240px", background: "var(--bg-card)", borderRadius: "var(--radius-sm)" }} />
          <div style={{ height: "36px", width: "120px", background: "var(--bg-card)", borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="grid-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                height: "120px",
                background: "var(--bg-card)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          ))}
        </div>
        <div style={{ height: "260px", background: "var(--bg-card)", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  // Error State
  if (error || !data) {
    return (
      <div
        className="card-flat"
        style={{
          padding: "3rem 2rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <ShieldAlert size={44} style={{ color: "var(--danger)" }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Không thể tải bảng điều khiển</h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: "400px", fontSize: "0.875rem" }}>
          {error || "Đã xảy ra lỗi khi truy xuất dữ liệu từ máy chủ. Vui lòng thử lại."}
        </p>
        <button className="btn btn-primary" onClick={handleRefresh}>
          <RefreshCw size={16} />
          <span>Thử tải lại</span>
        </button>
      </div>
    );
  }

  // Render view tương ứng theo quyền được bảo vệ từ server
  if (data.isManager) {
    return (
      <ManagerDashboardView
        data={data}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={handleMonthChange}
      />
    );
  }

  return (
    <StaffDashboardView
      data={data}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

// ============================================================================
// 1. CẤP NHÂN SỰ HYBRID: CHỈ XEM DATA CỦA CHÍNH TÀI KHOẢN LOGIN
// ============================================================================
function StaffDashboardView({
  data,
  isRefreshing,
  onRefresh,
}: {
  data: StaffDashboardData;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { user, contract, stats, todayShifts, shiftsThisWeekList, recentActivities } = data;

  const shiftNameMap: Record<string, string> = {
    MORNING: "Ca Sáng (08:30 - 12:30)",
    AFTERNOON: "Ca Chiều (13:30 - 17:30)",
    EVENING: "Ca Tối (20:00 - 24:00)",
  };

  const statusMap: Record<string, { label: string; class: string }> = {
    REGISTERED: { label: "Chờ duyệt", class: "badge-warning" },
    APPROVED: { label: "Đã duyệt ca", class: "badge-success" },
    REJECTED: { label: "Từ chối", class: "badge-danger" },
    COMPLETED: { label: "Hoàn thành", class: "badge-success" },
    ABSENT: { label: "Vắng mặt", class: "badge-danger" },
  };

  return (
    <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Welcome Banner Cá Nhân Hóa */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, var(--bg-card) 100%)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-color)",
          padding: "1.5rem 1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1.25rem",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(249, 115, 22, 0.35)",
            }}
          >
            {user.fullName.split(" ").pop()?.slice(0, 1) || "U"}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Xin chào, {user.fullName}!
              </h1>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
              SĐT: <strong style={{ color: "var(--text-primary)" }}>{user.phone}</strong> • Đây là không gian làm việc cá nhân của bạn.
            </p>
          </div>
        </div>
      </div>

      {/* Cảnh báo riêng cho nhân sự nếu HĐ sắp hết hạn */}
      {contract?.isExpiringSoon && (
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <AlertTriangle size={18} style={{ color: "#f43f5e", flexShrink: 0 }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
              Hợp đồng làm việc của bạn còn <strong style={{ color: "#e11d48" }}>{contract.daysRemaining} ngày</strong> nữa sẽ hết hạn (đến ngày{" "}
              {new Date(contract.endDate).toLocaleDateString("vi-VN")}). Vui lòng liên hệ bộ phận HR để làm thủ tục gia hạn.
            </span>
          </div>
          <span className="badge badge-danger">Cần gia hạn</span>
        </div>
      )}

      {/* 4 Thẻ chỉ số cá nhân - Style chuẩn hóa đồng bộ cấp Quản lý */}
      <div className="grid-4">
        {(
          [
            {
              label: "Ca làm việc tuần này",
              value: stats.shiftsCountThisWeek,
              unit: "ca",
              icon: <Calendar size={22} />,
              color: "#38bdf8",
              bgColor: "rgba(56, 189, 248, 0.12)",
              borderColor: "rgba(56, 189, 248, 0.25)",
              change: `Đã duyệt ${stats.shiftsApprovedThisWeek}`,
              subtext: "kế hoạch tuần",
              changeType: "up",
            },
            {
              label: "Báo cáo tháng này",
              value: stats.monthlyReportsSubmitted,
              unit: "báo cáo",
              icon: <FileText size={22} />,
              color: "#a855f7",
              bgColor: "rgba(168, 85, 247, 0.12)",
              borderColor: "rgba(168, 85, 247, 0.25)",
              change: `Đạt ${stats.monthlyReportsPass}`,
              subtext: `Chờ: ${stats.monthlyReportsPending} • Lỗi: ${stats.monthlyReportsFail}`,
              changeType: "up",
            },
            {
              label: "Sản lượng QC duyệt đạt",
              value: stats.totalFbApproved + stats.totalThreadApproved,
              unit: "bài viết",
              icon: <Award size={22} />,
              color: "#10b981",
              bgColor: "rgba(16, 185, 129, 0.12)",
              borderColor: "rgba(16, 185, 129, 0.25)",
              change: "Chất lượng",
              subtext: `FB: ${stats.totalFbApproved} • Threads: ${stats.totalThreadApproved} • Cmt: ${stats.totalCommentApproved}`,
              changeType: "up",
            },
            {
              label: "Tỷ lệ QC Đạt yêu cầu",
              value: stats.monthlyReportsSubmitted > 0
                ? `${Math.round((stats.monthlyReportsPass / stats.monthlyReportsSubmitted) * 100)}%`
                : "100%",
              unit: "chất lượng",
              icon: <TrendingUp size={22} />,
              color: "#f97316",
              bgColor: "rgba(249, 115, 22, 0.12)",
              borderColor: "rgba(249, 115, 22, 0.25)",
              change: "Đạt chuẩn",
              subtext: "chất lượng nghiệm thu",
              changeType: "up",
            },
          ] as Array<{
            label: string;
            value: string | number;
            unit: string;
            icon: React.ReactNode;
            color: string;
            bgColor: string;
            borderColor: string;
            change: string;
            subtext: string;
            changeType: "up" | "down" | "warning";
          }>
        ).map((stat, idx) => (
          <div
            key={idx}
            className="stat-card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "140px",
              background: "var(--bg-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
              <div>
                <span className="stat-label">{stat.label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", marginTop: "0.35rem" }}>
                  <span className="stat-value" style={{ color: "var(--text-primary)" }}>
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {stat.unit}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="stat-icon"
                style={{
                  background: stat.bgColor,
                  color: stat.color,
                  borderColor: stat.borderColor,
                }}
              >
                {stat.icon}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.625rem",
                borderTop: "1px solid var(--border-subtle)",
                marginTop: "0.75rem",
                fontSize: "0.75rem",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color:
                    stat.changeType === "up"
                      ? "#34d399"
                      : stat.changeType === "down"
                      ? "#fb7185"
                      : "#fbbf24",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                }}
              >
                {stat.changeType === "up" && "↗"}
                {stat.changeType === "down" && "↘"}
                {stat.changeType === "warning" && "•"}
                {stat.change}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{stat.subtext}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Ca làm việc hôm nay của nhân sự & Thao tác nhanh */}
      <div className="grid-2">
        {/* Cột trái: Lịch ca làm hôm nay của tôi */}
        <div className="card-flat" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={18} style={{ color: "var(--primary)" }} />
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Lịch làm việc hôm nay của bạn
              </h2>
            </div>
            <span className="badge badge-neutral">Hôm nay</span>
          </div>

          {todayShifts.length === 0 ? (
            <div
              style={{
                padding: "2rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border-color)",
              }}
            >
              <CheckCircle2 size={32} style={{ color: "#10b981", opacity: 0.8 }} />
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Hôm nay bạn không có ca làm việc</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Hãy kiểm tra lại lịch tuần hoặc vào mục Đăng ký ca nếu cần đăng ký bổ sung.
                </p>
              </div>
              <Link href="/ca-lam-viec" className="btn btn-secondary btn-sm" style={{ marginTop: "0.25rem" }}>
                <Calendar size={15} />
                <span>Xem lịch làm việc tuần</span>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {todayShifts.map((shift) => (
                <div
                  key={shift.id}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "0.9375rem" }}>
                        {shiftNameMap[shift.shiftType] || shift.shiftType}
                      </strong>
                      <span className={`badge ${statusMap[shift.status]?.class || "badge-neutral"}`}>
                        {statusMap[shift.status]?.label || shift.status}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Hình thức: <strong>{shift.workMode === "OFFLINE" ? "Tại văn phòng (Offline)" : "Làm từ xa (Online)"}</strong>
                    </p>
                  </div>

                  <div>
                    {shift.hasSubmittedReport ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className="badge badge-success" style={{ gap: "0.3rem" }}>
                          <CheckCircle2 size={12} />
                          Đã nộp báo cáo
                        </span>
                        {shift.qcResult === "PASS" && (
                          <span className="badge badge-success">QC: Đạt</span>
                        )}
                        {shift.qcResult === "FAIL" && (
                          <span className="badge badge-danger">QC: Không đạt</span>
                        )}
                        {shift.qcResult === "PENDING" && (
                          <span className="badge badge-warning">QC: Đang duyệt</span>
                        )}
                      </div>
                    ) : (
                      <Link href="/bao-cao" className="btn btn-primary btn-sm">
                        <FileText size={14} />
                        <span>Nộp báo cáo ngay</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cột phải: Thao tác nhanh & Các ca trong tuần */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Thao tác nhanh */}
          <div className="card-flat">
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-primary)" }}>
              Thao tác nhanh của bạn
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Link
                href="/bao-cao"
                className="btn btn-primary"
                style={{ justifyContent: "flex-start", padding: "0.875rem 1rem" }}
              >
                <FileText size={18} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Nộp báo cáo ca</div>
                  <div style={{ fontSize: "0.6875rem", opacity: 0.85 }}>Nhập link FB & Threads</div>
                </div>
              </Link>

              <Link
                href="/ca-lam-viec"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.875rem 1rem" }}
              >
                <Calendar size={18} style={{ color: "var(--info)" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Đăng ký ca làm</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Chọn ca tuần này/tới</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Danh sách các ca trong tuần này */}
          <div className="card-flat">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Danh sách ca tuần này ({shiftsThisWeekList.length} ca)
              </h3>
              <Link href="/ca-lam-viec" className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem", color: "var(--primary)" }}>
                Xem chi tiết <ArrowUpRight size={13} />
              </Link>
            </div>

            {shiftsThisWeekList.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem" }}>
                Chưa có ca làm nào được đăng ký trong tuần này.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
                {shiftsThisWeekList.map((s) => {
                  const dateFormatted = new Date(s.shiftDate).toLocaleDateString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  });
                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 600 }}>{dateFormatted}</span>
                        <span style={{ color: "var(--text-secondary)" }}>•</span>
                        <span>{s.shiftType === "MORNING" ? "Sáng" : s.shiftType === "AFTERNOON" ? "Chiều" : "Tối"}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>({s.workMode})</span>
                      </div>
                      <span className={`badge ${statusMap[s.status]?.class || "badge-neutral"}`} style={{ fontSize: "0.6875rem" }}>
                        {statusMap[s.status]?.label || s.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nhật ký hoạt động của riêng tài khoản login */}
      <div className="card-flat">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={17} style={{ color: "var(--primary)" }} />
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Nhật ký hoạt động của tài khoản
            </h2>
          </div>
          <span className="badge badge-neutral">Dữ liệu cá nhân</span>
        </div>

        {recentActivities.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center", padding: "1.5rem" }}>
            Chưa có hoạt động nào được ghi nhận gần đây.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {recentActivities.map((act, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: act.accent,
                      boxShadow: `0 0 8px ${act.accent}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{act.action}</span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>{act.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. CẤP QUẢN LÝ: XEM TOÀN BỘ SỐ LIỆU ĐIỀU HÀNH CÔNG TY
// ============================================================================
function ManagerDashboardView({
  data,
  isRefreshing,
  onRefresh,
  selectedMonth,
  selectedYear,
  onMonthChange,
}: {
  data: ManagerDashboardData;
  isRefreshing: boolean;
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}) {
  const { stats, shiftDistributionToday, recentActivities } = data;

  const statCards = [
    {
      label: "Tổng nhân sự",
      value: stats.totalStaff,
      unit: "người",
      icon: <Users size={22} />,
      color: "#6366f1",
      bgColor: "rgba(99, 102, 241, 0.12)",
      borderColor: "rgba(99, 102, 241, 0.25)",
      change: "Toàn hệ thống",
      subtext: "nhân sự Remote",
      changeType: "up" as const,
    },
    {
      label: "Nhân sự hoạt động",
      value: stats.activeStaff,
      unit: `/${stats.totalStaff}`,
      icon: <TrendingUp size={22} />,
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.25)",
      change: `${stats.totalStaff > 0 ? Math.round((stats.activeStaff / stats.totalStaff) * 100) : 0}%`,
      subtext: "tỉ lệ kích hoạt",
      changeType: "up" as const,
    },
    {
      label: "Ca chờ duyệt QC",
      value: stats.pendingReviews,
      unit: "ca",
      icon: <ClipboardCheck size={22} />,
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.25)",
      change: stats.pendingReviews > 0 ? "Cần xử lý" : "Đã xong",
      subtext: "hạn SLA 3 ngày",
      changeType: stats.pendingReviews > 0 ? ("warning" as const) : ("up" as const),
    },
    {
      label: "HĐ sắp hết hạn",
      value: stats.expiringContracts,
      unit: "hợp đồng",
      icon: <AlertTriangle size={22} />,
      color: "#f43f5e",
      bgColor: "rgba(244, 63, 94, 0.12)",
      borderColor: "rgba(244, 63, 94, 0.25)",
      change: stats.expiringContracts > 0 ? "Cần gia hạn" : "Bình thường",
      subtext: "trong 14 ngày tới",
      changeType: stats.expiringContracts > 0 ? ("down" as const) : ("up" as const),
    },
    {
      label: "Ca tuần này",
      value: stats.shiftsThisWeek,
      unit: "ca",
      icon: <Calendar size={22} />,
      color: "#38bdf8",
      bgColor: "rgba(56, 189, 248, 0.12)",
      borderColor: "rgba(56, 189, 248, 0.25)",
      change: "Toàn công ty",
      subtext: "kế hoạch tuần",
      changeType: "up" as const,
    },
    {
      label: "Báo cáo hôm nay",
      value: stats.totalReportsToday,
      unit: "báo cáo",
      icon: <FileText size={22} />,
      color: "#a855f7",
      bgColor: "rgba(168, 85, 247, 0.12)",
      borderColor: "rgba(168, 85, 247, 0.25)",
      change: "Đã nộp",
      subtext: "trong ngày",
      changeType: "up" as const,
    },
    {
      label: "KPI trung bình",
      value: `${stats.avgKpiRate}%`,
      unit: "",
      icon: <Award size={22} />,
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.25)",
      change: "Đạt chuẩn",
      subtext: "chất lượng nghiệm thu",
      changeType: "up" as const,
    },
    {
      label: "Thưởng Viral tháng",
      value: new Intl.NumberFormat("vi-VN").format(stats.totalViralBonus),
      unit: "đ",
      icon: <Sparkles size={22} />,
      color: "#f97316",
      bgColor: "rgba(249, 115, 22, 0.12)",
      borderColor: "rgba(249, 115, 22, 0.25)",
      change: "Dự kiến",
      subtext: "cập nhật theo ca",
      changeType: "up" as const,
    },
  ];

  const alerts = [
    ...(stats.expiringContracts > 0
      ? [
          {
            type: "warning",
            title: "Hợp đồng lao động sắp hết hạn",
            message: `Có ${stats.expiringContracts} nhân sự sắp hết hạn hợp đồng trong vòng 14 ngày tới. Cần gia hạn hoặc thanh lý.`,
            action: "Xử lý hồ sơ",
            href: "/nhan-su",
            icon: <AlertTriangle size={17} style={{ color: "#fbbf24" }} />,
            badge: "Cần chú ý",
            badgeClass: "badge-warning",
          },
        ]
      : []),
    ...(stats.pendingReviews > 0
      ? [
          {
            type: "info",
            title: "Hàng đợi kiểm duyệt QC tồn đọng",
            message: `Có ${stats.pendingReviews} ca làm việc đang chờ kiểm duyệt kết quả seeding.`,
            action: "Kiểm duyệt ngay",
            href: "/kiem-duyet",
            icon: <ClipboardCheck size={17} style={{ color: "#38bdf8" }} />,
            badge: "Chờ duyệt",
            badgeClass: "badge-info",
          },
        ]
      : []),
    {
      type: "success",
      title: "Tổng hợp bảng công tuần",
      message: "Dữ liệu ca và sản lượng tuần đang sẵn sàng để tổng hợp nghiệm thu và tính thù lao chi trả.",
      action: "Xem báo cáo",
      href: "/kpi",
      icon: <CheckCircle2 size={17} style={{ color: "#10b981" }} />,
      badge: "Sẵn sàng",
      badgeClass: "badge-success",
    },
  ];

  return (
    <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
            <h1 className="page-title">Bảng điều khiển Quản lý</h1>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                background: "rgba(16, 185, 129, 0.14)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              Live Data
            </span>
          </div>
          <p className="page-subtitle">
            Hệ thống quản lý nhân sự Remote Seeding & Điều phối vận hành Freetrip
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Bộ lọc tháng cho quản lý */}
          <MonthPicker
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChange={onMonthChange}
            disabled={isRefreshing}
          />

          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            title="Làm mới dữ liệu"
            style={{ padding: "0.5rem 0.875rem" }}
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-orange-400" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 8 Stat Cards Grid */}
      <div className="grid-4">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className="stat-card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "140px",
              background: "var(--bg-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
              <div>
                <span className="stat-label">{stat.label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", marginTop: "0.35rem" }}>
                  <span className="stat-value" style={{ color: "var(--text-primary)" }}>
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {stat.unit}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="stat-icon"
                style={{
                  background: stat.bgColor,
                  color: stat.color,
                  borderColor: stat.borderColor,
                }}
              >
                {stat.icon}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.625rem",
                borderTop: "1px solid var(--border-subtle)",
                marginTop: "0.75rem",
                fontSize: "0.75rem",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color:
                    stat.changeType === "up"
                      ? "#34d399"
                      : stat.changeType === "down"
                      ? "#fb7185"
                      : "#fbbf24",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                }}
              >
                {stat.changeType === "up" && "↗"}
                {stat.changeType === "down" && "↘"}
                {stat.changeType === "warning" && "•"}
                {stat.change}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{stat.subtext}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Smart Alerts Feed */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.125rem" }}>
            <BellRing size={16} style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
              Thông báo & Cảnh báo điều hành
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.875rem" }}>
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  padding: "1rem 1.125rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all var(--transition-fast)",
                }}
                className="hover:border-slate-600"
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ marginTop: "2px", flexShrink: 0 }}>{alert.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {alert.title}
                      </span>
                      <span className={`badge ${alert.badgeClass}`} style={{ fontSize: "0.6875rem" }}>
                        {alert.badge}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.35rem",
                        lineHeight: 1.5,
                      }}
                    >
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Link
                    href={alert.href}
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: "var(--primary)",
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      gap: "0.25rem",
                    }}
                  >
                    <span>{alert.action}</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Recent Activities & Quick Operations */}
      <div className="grid-2">
        {/* Left: Recent Activity Feed */}
        <div className="card-flat">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <Clock size={18} style={{ color: "var(--primary)" }} />
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Nhật ký hoạt động hệ thống
              </h2>
            </div>
            <span className="badge badge-neutral">Mới nhất</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {recentActivities.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center", padding: "1.5rem" }}>
                Chưa có hoạt động nào được ghi nhận hôm nay.
              </p>
            ) : (
              recentActivities.map((act, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.875rem",
                    padding: "0.75rem 0.875rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "var(--radius-sm)",
                      background: `${act.accent}20`,
                      border: `1px solid ${act.accent}40`,
                      color: act.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {act.user.split(" ").pop()?.slice(0, 1) || "U"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {act.user}
                      </div>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                        {act.time}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.78125rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.2rem",
                        lineHeight: 1.45,
                      }}
                    >
                      {act.action}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Quick Actions & Today's Shift Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Quick Actions Card */}
          <div className="card-flat">
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-primary)" }}>
              Thao tác nhanh Quản lý
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Link
                href="/nhan-su"
                className="btn btn-primary"
                style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
              >
                <Users size={17} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Quản lý Nhân sự</div>
                </div>
              </Link>

              <Link
                href="/ca-lam-viec"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
              >
                <Calendar size={17} style={{ color: "var(--info)" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Điều phối ca làm</div>
                </div>
              </Link>

              <Link
                href="/kiem-duyet"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
              >
                <ClipboardCheck size={17} style={{ color: "var(--warning)" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Kiểm duyệt QC</div>
                </div>
              </Link>

              <Link
                href="/kpi"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
              >
                <TrendingUp size={17} style={{ color: "var(--success)" }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Đánh giá KPI</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Today's Shifts Progress Card */}
          <div className="card-flat">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Điều phối ca làm việc hôm nay
              </h3>
              <span className="badge badge-primary">
                {shiftDistributionToday.total} ca đã phân bổ
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {[
                {
                  label: "Ca Sáng (08:30 - 12:30)",
                  count: shiftDistributionToday.morning,
                  total: Math.max(10, shiftDistributionToday.morning),
                  color: "#f97316",
                  progressColor: "linear-gradient(90deg, #fb923c, #ea580c)",
                },
                {
                  label: "Ca Chiều (13:30 - 17:30)",
                  count: shiftDistributionToday.afternoon,
                  total: Math.max(10, shiftDistributionToday.afternoon),
                  color: "#38bdf8",
                  progressColor: "linear-gradient(90deg, #38bdf8, #0284c7)",
                },
                {
                  label: "Ca Tối (20:00 - 24:00)",
                  count: shiftDistributionToday.evening,
                  total: Math.max(8, shiftDistributionToday.evening),
                  color: "#a855f7",
                  progressColor: "linear-gradient(90deg, #c084fc, #7e22ce)",
                },
              ].map((shift) => {
                const percent = Math.min(100, Math.round((shift.count / shift.total) * 100));
                return (
                  <div
                    key={shift.label}
                    style={{
                      padding: "0.875rem 1rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {shift.label}
                      </span>
                      <div style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                        <strong style={{ color: shift.color, fontSize: "0.9375rem" }}>{shift.count}</strong>
                        <span style={{ color: "var(--text-muted)" }}> nhân sự trực ({percent}%)</span>
                      </div>
                    </div>

                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "var(--bg-input)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background: shift.progressColor,
                          borderRadius: 999,
                          transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
