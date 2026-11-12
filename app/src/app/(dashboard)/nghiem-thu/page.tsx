"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { confirmModal, Modal } from "@/components/ui";
import {
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Lock,
  Unlock,
  Users,
  Award,
  Layers,
  FileText,
  Clock,
  ExternalLink,
  X,
  Flame,
  Check,
  Building,
} from "lucide-react";
import { exportAcceptanceExcel } from "@/lib/exportAcceptanceExcel";

interface AcceptanceItem {
  stt: number;
  user: {
    id: number;
    fullName: string;
    phone: string;
    status: string;
    avatarUrl?: string | null;
  };
  totalShifts: number;
  totalShiftsPassed: number;
  morningPassed?: number;
  afternoonPassed?: number;
  eveningPassed?: number;
  morningHours?: number;
  afternoonHours?: number;
  eveningHours?: number;
  totalWorkHours?: number;
  totalBaseSalary?: number;
  totalSalaryAndBonus?: number;
  totalPosts: number;
  totalFbPosts: number;
  totalThreadPosts: number;
  totalComments: number;
  totalPackages: number;
  viralBonus: number;
  absentShifts: number;
  conditionStatus: "QUALIFIED" | "BELOW_MIN" | "EXCESS_ABSENT";
  statusNote: string;
  status: "DRAFT" | "CONFIRMED" | "EXPORTED";
  confirmedAt?: string | null;
}

interface AcceptanceSummary {
  totalStaff: number;
  totalShifts: number;
  totalShiftsPassed: number;
  totalPosts: number;
  totalComments: number;
  totalPackages: number;
  totalViralBonus: number;
  totalWorkHours?: number;
  totalMorningHours?: number;
  totalAfternoonHours?: number;
  totalEveningHours?: number;
  totalBaseSalary?: number;
  totalSalaryAndBonus?: number;
  confirmedCount: number;
}

interface ShiftDetail {
  id: number;
  shiftDate: string;
  shiftType: string;
  workMode: string;
  status: string;
  loginSession: {
    loginTime: string;
    isLate: boolean;
    lateMinutes: number;
    autoMarkedAbsent: boolean;
  } | null;
  dailyReport: {
    id: number;
    submittedAt: string;
    fbCount: number;
    threadCount: number;
    hasCommentDrive: boolean;
    viralCount: number;
    femaleCount: number;
    qcReview: {
      id: number;
      result: "PASS" | "FAIL" | "PENDING";
      fbApproved: number;
      threadApproved: number;
      commentApproved: number;
      feedback?: string | null;
      reviewerName: string;
      reviewedAt?: string | null;
    } | null;
  } | null;
}

export default function NghiemThuPage() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [items, setItems] = useState<AcceptanceItem[]>([]);
  const [summary, setSummary] = useState<AcceptanceSummary | null>(null);
  const [overallStatus, setOverallStatus] = useState<string>("DRAFT");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterCondition, setFilterCondition] = useState<string>("ALL");

  // Modal xem chi tiết ca của 1 nhân sự
  const [selectedUser, setSelectedUser] = useState<AcceptanceItem | null>(null);
  const [userShifts, setUserShifts] = useState<ShiftDetail[]>([]);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Dialog thông báo
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch dữ liệu nghiệm thu
  const fetchAcceptanceData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nghiem-thu?month=${month}&year=${year}`);
      if (!res.ok) {
        throw new Error("Không thể tải dữ liệu nghiệm thu");
      }
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || null);
      setOverallStatus(data.overallStatus || "DRAFT");
    } catch (err: any) {
      showToast("error", err?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchAcceptanceData();
  }, [fetchAcceptanceData]);

  // Xem chi tiết ca làm việc của 1 nhân sự
  const handleOpenDetailModal = async (item: AcceptanceItem) => {
    setSelectedUser(item);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/nghiem-thu/${item.user.id}?month=${month}&year=${year}`);
      if (!res.ok) {
        throw new Error("Không thể tải chi tiết ca làm việc");
      }
      const data = await res.json();
      setUserShifts(data.shifts || []);
    } catch (err: any) {
      showToast("error", err?.message || "Lỗi tải chi tiết ca");
    } finally {
      setModalLoading(false);
    }
  };

  // Chốt biên bản nghiệm thu (Snapshot Freeze)
  const handleConfirmAcceptance = async () => {
    const isConfirmed = await confirmModal({
      title: "Chốt biên bản nghiệm thu",
      message: `Bạn có chắc chắn muốn CHỐT BIÊN BẢN NGHIỆM THU Tháng ${month}/${year}?\nSau khi chốt, số liệu công và ca sẽ được đóng băng snapshot.`,
      confirmText: "Chốt biên bản",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!isConfirmed) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/nghiem-thu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Chốt biên bản thất bại");
      }
      showToast("success", data.message || "Đã chốt biên bản nghiệm thu thành công");
      await fetchAcceptanceData();
    } catch (err: any) {
      showToast("error", err?.message || "Lỗi chốt biên bản");
    } finally {
      setActionLoading(false);
    }
  };

  // Mở khóa biên bản nghiệm thu
  const handleUnlockAcceptance = async () => {
    const isConfirmed = await confirmModal({
      title: "Mở khóa biên bản nghiệm thu",
      message: `Bạn có chắc chắn muốn MỞ KHÓA biên bản Tháng ${month}/${year} để cập nhật lại số liệu?`,
      confirmText: "Mở khóa",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!isConfirmed) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/nghiem-thu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Mở khóa thất bại");
      }
      showToast("success", data.message || "Đã mở khóa biên bản nghiệm thu");
      await fetchAcceptanceData();
    } catch (err: any) {
      showToast("error", err?.message || "Lỗi mở khóa");
    } finally {
      setActionLoading(false);
    }
  };

  // Xuất file Excel (.xlsx) chuẩn biểu mẫu Nghiệm Thu Freetrip (Đầy đủ Background, Color, Border, Styling)
  const handleExportExcel = async () => {
    const exportList = filteredItems.length > 0 ? filteredItems : items;
    if (!exportList.length) {
      showToast("error", "Không có dữ liệu để xuất Excel");
      return;
    }

    try {
      // Tính toán tổng cộng cho danh sách xuất chuẩn biểu mẫu mới
      const exportSummary = {
        totalPosts: exportList.reduce((sum, it) => sum + (it.totalPosts || 0), 0),
        totalComments: exportList.reduce((sum, it) => sum + (it.totalComments || 0), 0),
        totalShiftsPassed: exportList.reduce((sum, it) => sum + (it.totalShiftsPassed || 0), 0),
        totalMorningHours: exportList.reduce((sum, it) => sum + (it.morningHours || 0), 0),
        totalAfternoonHours: exportList.reduce((sum, it) => sum + (it.afternoonHours || 0), 0),
        totalEveningHours: exportList.reduce((sum, it) => sum + (it.eveningHours || 0), 0),
        totalBaseSalary: exportList.reduce((sum, it) => sum + (it.totalBaseSalary || 0), 0),
        totalViralBonus: exportList.reduce((sum, it) => sum + (it.viralBonus || 0), 0),
        totalSalaryAndBonus: exportList.reduce((sum, it) => sum + (it.totalSalaryAndBonus || 0), 0),
      };

      await exportAcceptanceExcel({
        month,
        year,
        items: exportList,
        summary: exportSummary,
      });

      showToast("success", "Đã xuất file Excel nghiệm thu thành công!");
    } catch (err: any) {
      showToast("error", "Lỗi khi xuất file Excel: " + (err?.message || err));
    }
  };

  // In / Xuất PDF (A4 Landscape)
  const handlePrint = () => {
    window.print();
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchSearch =
        it.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.user.phone.includes(searchTerm);

      if (filterCondition === "QUALIFIED") {
        return matchSearch && it.conditionStatus === "QUALIFIED";
      }
      if (filterCondition === "WARNING") {
        return matchSearch && (it.conditionStatus === "BELOW_MIN" || it.conditionStatus === "EXCESS_ABSENT");
      }
      return matchSearch;
    });
  }, [items, searchTerm, filterCondition]);

  return (
    <div className="animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="app-toast-container">
          <div className={`app-toast ${toastMessage.type}`}>
            {toastMessage.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* HEADER WEB: Tiêu đề & Chọn thời gian */}
      <div
        className="page-header print:hidden"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Nghiệm Thu Công Việc
            </h1>
            <span className="badge badge-primary">Freetrip Remote</span>
            {overallStatus === "CONFIRMED" ? (
              <span
                className="badge badge-success"
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Lock size={12} /> Đã chốt số liệu
              </span>
            ) : (
              <span
                className="badge badge-warning"
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Clock size={12} /> Bản dự thảo (Chưa chốt)
              </span>
            )}
          </div>
          <p className="page-subtitle">
            Tổng hợp công, ca ĐẠT và sản lượng bài viết/bình luận theo chuẩn biểu mẫu Freetrip
          </p>
        </div>

        {/* Nút công cụ & Bộ chọn tháng/năm */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {/* Chọn Tháng / Năm */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "2px 6px",
              gap: "4px",
            }}
          >
            <button
              onClick={() => {
                if (month === 1) {
                  setMonth(12);
                  setYear((y) => y - 1);
                } else {
                  setMonth((m) => m - 1);
                }
              }}
              className="btn-icon btn-ghost"
              style={{ width: "28px", height: "28px" }}
              title="Tháng trước"
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ textAlign: "center", padding: "0 8px" }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "0.03em",
                }}
              >
                THÁNG {String(month).padStart(2, "0")}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                Năm {year}
              </div>
            </div>
            <button
              onClick={() => {
                if (month === 12) {
                  setMonth(1);
                  setYear((y) => y + 1);
                } else {
                  setMonth((m) => m + 1);
                }
              }}
              className="btn-icon btn-ghost"
              style={{ width: "28px", height: "28px" }}
              title="Tháng sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={fetchAcceptanceData}
            disabled={loading}
            className="btn btn-secondary btn-icon btn-sm"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Nút Chốt biên bản / Mở khóa */}
          {overallStatus === "CONFIRMED" ? (
            <button
              onClick={handleUnlockAcceptance}
              disabled={actionLoading}
              className="btn btn-secondary btn-sm"
              style={{ color: "var(--warning)", borderColor: "rgba(234, 179, 8, 0.3)" }}
            >
              <Unlock size={14} /> Mở khóa biên bản
            </button>
          ) : (
            <button
              onClick={handleConfirmAcceptance}
              disabled={actionLoading || items.length === 0}
              className="btn btn-primary btn-sm"
            >
              <Lock size={14} /> Chốt nghiệm thu
            </button>
          )}

          {/* Nút Xuất Excel */}
          <button
            onClick={handleExportExcel}
            className="btn btn-secondary btn-sm"
          >
            <FileSpreadsheet size={15} color="var(--success)" /> Xuất Excel
          </button>

          {/* Nút In / Xuất PDF */}
          <button
            onClick={handlePrint}
            className="btn btn-secondary btn-sm"
          >
            <Printer size={15} /> In / Xuất PDF
          </button>
        </div>
      </div>

      {/* OVERVIEW CARDS: Thống kê nhanh */}
      {summary && (
        <div
          className="print:hidden"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Card 1: Nhân sự */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--info)" }}
            >
              <Users size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">{summary.totalStaff}</div>
              <div className="stat-label">Tổng nhân sự</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Đã chốt:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {summary.confirmedCount}
                </strong>{" "}
                / {summary.totalStaff}
              </div>
            </div>
          </div>


          {/* Card 3: Tổng số ca Đạt */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(34, 197, 94, 0.15)", color: "var(--success)" }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value" style={{ color: "var(--success)" }}>
                {summary.totalShiftsPassed}
              </div>
              <div className="stat-label">Tổng số ca Đạt</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Tỷ lệ đạt:{" "}
                <strong style={{ color: "var(--success)" }}>
                  {summary.totalShifts > 0
                    ? `${Math.round(
                        (summary.totalShiftsPassed / summary.totalShifts) * 100
                      )}%`
                    : "0%"}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 4: Bài viết duyệt ĐẠT */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8" }}
            >
              <FileText size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">
                {summary.totalPosts.toLocaleString("vi-VN")}
              </div>
              <div className="stat-label">Bài viết duyệt ĐẠT</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Facebook & Threads
              </div>
            </div>
          </div>

          {/* Card 5: Bình luận duyệt ĐẠT */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(234, 179, 8, 0.15)", color: "var(--warning)" }}
            >
              <Layers size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">
                {summary.totalComments.toLocaleString("vi-VN")}
              </div>
              <div className="stat-label">Bình luận duyệt ĐẠT</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Đủ bằng chứng Drive
              </div>
            </div>
          </div>

          {/* Card 6: Tổng lương & thưởng */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}
            >
              <Flame size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value" style={{ color: "#10b981" }}>
                {(summary.totalSalaryAndBonus || 0).toLocaleString("vi-VN")} đ
              </div>
              <div className="stat-label">Tổng lương & thưởng</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Lương: {(summary.totalBaseSalary || 0).toLocaleString("vi-VN")} đ • Thưởng: {(summary.totalViralBonus || 0).toLocaleString("vi-VN")} đ
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div
        className="card print:hidden"
        style={{
          padding: "1rem",
          marginBottom: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: "280px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: "36px" }}
              placeholder="Tìm theo tên hoặc số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            Lọc tình trạng:
          </span>
          <select
            className="select"
            style={{ width: "auto" }}
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
          >
            <option value="ALL">Tất cả ({items.length})</option>
            <option value="QUALIFIED">Đạt điều kiện nghiệm thu</option>
            <option value="WARNING">Cần lưu ý / Chưa đủ điều kiện</option>
          </select>
        </div>
      </div>

      {/* ============================================================ */}
      {/* KHU VỰC HIỂN THỊ CHÍNH (KHỚP BIỂU MẪU FREETRIP CẢ WEB & IN ẤN) */}
      {/* ============================================================ */}
      <div
        id="print-acceptance-sheet"
        className="table-container print:border-none print:shadow-none print:bg-white print:p-0"
        style={{ marginBottom: "2rem" }}
      >
        {/* Header trên bản in */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid var(--border-color)",
            textAlign: "center",
          }}
          className="print:border-none print:pb-2"
        >
          <div className="hidden print:block text-xs uppercase tracking-wider text-gray-600 font-semibold mb-1">
            CÔNG TY CỔ PHẦN FREETRIP - HỆ THỐNG QUẢN LÝ NHÂN SỰ REMOTE
          </div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: "var(--text-primary)",
              margin: 0,
            }}
            className="print:text-black"
          >
            BIÊN BẢN NGHIỆM THU CÔNG VIỆC - REMOTE
          </h2>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginTop: "0.25rem",
              marginBottom: 0,
            }}
            className="print:text-gray-700"
          >
            Tháng {String(month).padStart(2, "0")} / Năm {year}
          </p>
        </div>

        {/* BẢNG NGHIỆM THU CHUẨN 11 CỘT (2 TẦNG HEADER) */}
        <div className="overflow-x-auto">
          <table className="table print:text-black">
            <thead>
              <tr className="print:bg-gray-100 print:text-black print:border-black">
                <th
                  rowSpan={2}
                  style={{ width: "50px", textAlign: "center", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  STT
                </th>
                <th
                  rowSpan={2}
                  style={{ minWidth: "170px", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  Họ và tên
                </th>
                <th
                  rowSpan={2}
                  style={{ textAlign: "center", minWidth: "105px", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  Số lượng<br />bài viết
                </th>
                <th
                  rowSpan={2}
                  style={{ textAlign: "center", minWidth: "105px", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  Số lượng<br />bình luận
                </th>
                <th
                  rowSpan={2}
                  style={{ textAlign: "center", minWidth: "95px", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  Tổng số<br />ca làm
                </th>
                <th
                  colSpan={3}
                  style={{ textAlign: "center", minWidth: "210px" }}
                  className="print:border-black"
                >
                  Tổng giờ làm việc
                </th>
                <th
                  rowSpan={2}
                  style={{ textAlign: "right", minWidth: "115px", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  Thù lao
                </th>
                <th
                  rowSpan={2}
                  style={{ textAlign: "right", minWidth: "105px", verticalAlign: "middle" }}
                  className="print:border-black"
                >
                  Thưởng
                </th>
                <th
                  rowSpan={2}
                  style={{ textAlign: "right", minWidth: "125px", verticalAlign: "middle", paddingRight: "1rem" }}
                  className="print:border-black"
                >
                  Thực nhận
                </th>
              </tr>
              <tr className="print:bg-gray-100 print:text-black print:border-black print:border-b-2">
                <th
                  style={{ textAlign: "center", width: "70px", fontSize: "0.8125rem" }}
                  className="print:border-black"
                >
                  Ca sáng
                </th>
                <th
                  style={{ textAlign: "center", width: "70px", fontSize: "0.8125rem" }}
                  className="print:border-black"
                >
                  Ca chiều
                </th>
                <th
                  style={{ textAlign: "center", width: "70px", fontSize: "0.8125rem" }}
                  className="print:border-black"
                >
                  Ca tối
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <RefreshCw size={18} className="animate-spin" /> Đang tổng hợp dữ
                      liệu ca và công tháng {month}/{year}...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    Không tìm thấy dữ liệu nhân sự phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={item.user.id}
                    className="cursor-pointer group print:hover:bg-transparent"
                    onClick={() => handleOpenDetailModal(item)}
                    title="Bấm để xem chi tiết ca làm việc của nhân sự"
                  >
                    {/* 1. STT */}
                    <td
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}
                      className="print:border-black print:text-black"
                    >
                      {idx + 1}
                    </td>

                    {/* 2. Họ và tên */}
                    <td className="print:border-black">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 600,
                            fontSize: "0.8125rem",
                            flexShrink: 0,
                          }}
                          className="print:hidden"
                        >
                          {item.user.fullName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div
                            style={{ fontWeight: 600, color: "var(--text-primary)" }}
                            className="print:text-black group-hover:text-[var(--primary)] transition-colors flex items-center gap-1.5"
                          >
                            <span>{item.user.fullName}</span>
                            <ExternalLink
                              size={12}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--primary)] print:hidden"
                            />
                          </div>
                          <div
                            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
                            className="print:text-gray-600"
                          >
                            {item.user.phone}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 3. Số lượng bài viết */}
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                      className="print:border-black print:text-black"
                    >
                      {item.totalPosts.toLocaleString("vi-VN")}
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--text-muted)",
                          fontWeight: 400,
                        }}
                        className="print:hidden"
                      >
                        FB: {item.totalFbPosts} | Th: {item.totalThreadPosts}
                      </div>
                    </td>

                    {/* 4. Số lượng bình luận */}
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                      className="print:border-black print:text-black"
                    >
                      {item.totalComments.toLocaleString("vi-VN")}
                    </td>

                    {/* 5. Tổng số ca làm */}
                    <td style={{ textAlign: "center" }} className="print:border-black">
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.9375rem",
                          color: "var(--text-primary)",
                        }}
                        className="print:text-black"
                      >
                        {item.totalShiftsPassed ?? 0}
                      </span>
                    </td>

                    {/* 6. Ca sáng */}
                    <td
                      style={{ textAlign: "center", fontSize: "0.875rem" }}
                      className="print:border-black print:text-black"
                    >
                      {item.morningHours && item.morningHours > 0 ? (
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.morningHours}h
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>-</span>
                      )}
                    </td>

                    {/* 7. Ca chiều */}
                    <td
                      style={{ textAlign: "center", fontSize: "0.875rem" }}
                      className="print:border-black print:text-black"
                    >
                      {item.afternoonHours && item.afternoonHours > 0 ? (
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.afternoonHours}h
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>-</span>
                      )}
                    </td>

                    {/* 8. Ca tối */}
                    <td
                      style={{ textAlign: "center", fontSize: "0.875rem" }}
                      className="print:border-black print:text-black"
                    >
                      {item.eveningHours && item.eveningHours > 0 ? (
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.eveningHours}h
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>-</span>
                      )}
                    </td>

                    {/* 9. Thù lao */}
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                      }}
                      className="print:border-black print:text-black"
                    >
                      {item.totalBaseSalary && item.totalBaseSalary > 0 ? (
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.totalBaseSalary.toLocaleString("vi-VN")} đ
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>-</span>
                      )}
                    </td>

                    {/* 10. Thưởng */}
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                      }}
                      className="print:border-black print:text-black"
                    >
                      {item.viralBonus && item.viralBonus > 0 ? (
                        <span
                          style={{ fontWeight: 600, color: "#fbbf24" }}
                          className="print:text-black"
                        >
                          {item.viralBonus.toLocaleString("vi-VN")} đ
                        </span>
                      ) : (
                        <span
                          style={{ color: "var(--text-muted)" }}
                          className="print:text-black"
                        >
                          -
                        </span>
                      )}
                    </td>

                    {/* 11. Thực nhận */}
                    <td
                      style={{
                        textAlign: "right",
                        paddingRight: "1rem",
                        fontFamily: "monospace",
                      }}
                      className="print:border-black print:text-black"
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.9375rem",
                          color: "#10b981",
                        }}
                        className="print:text-black"
                      >
                        {(item.totalSalaryAndBonus || 0).toLocaleString("vi-VN")} đ
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* HÀNG TỔNG CỘNG */}
            {summary && (
              <tfoot>
                <tr
                  style={{
                    background: "var(--bg-secondary)",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    borderTop: "2px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  className="print:bg-gray-100 print:text-black print:border-black"
                >
                  <td
                    colSpan={2}
                    style={{
                      textAlign: "center",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                    className="print:border-black"
                  >
                    Tổng cộng ({summary.totalStaff} nhân sự)
                  </td>
                  <td
                    style={{ textAlign: "center", fontFamily: "monospace" }}
                    className="print:border-black"
                  >
                    {summary.totalPosts.toLocaleString("vi-VN")}
                  </td>
                  <td
                    style={{ textAlign: "center", fontFamily: "monospace" }}
                    className="print:border-black"
                  >
                    {summary.totalComments.toLocaleString("vi-VN")}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      color: "var(--text-primary)",
                      fontFamily: "monospace",
                    }}
                    className="print:border-black print:text-black"
                  >
                    {summary.totalShiftsPassed.toLocaleString("vi-VN")}
                  </td>
                  <td
                    style={{ textAlign: "center", fontFamily: "monospace" }}
                    className="print:border-black print:text-black"
                  >
                    {summary.totalMorningHours && summary.totalMorningHours > 0
                      ? `${summary.totalMorningHours}h`
                      : "-"}
                  </td>
                  <td
                    style={{ textAlign: "center", fontFamily: "monospace" }}
                    className="print:border-black print:text-black"
                  >
                    {summary.totalAfternoonHours && summary.totalAfternoonHours > 0
                      ? `${summary.totalAfternoonHours}h`
                      : "-"}
                  </td>
                  <td
                    style={{ textAlign: "center", fontFamily: "monospace" }}
                    className="print:border-black print:text-black"
                  >
                    {summary.totalEveningHours && summary.totalEveningHours > 0
                      ? `${summary.totalEveningHours}h`
                      : "-"}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "monospace",
                      color: "var(--text-primary)",
                    }}
                    className="print:border-black print:text-black"
                  >
                    {summary.totalBaseSalary && summary.totalBaseSalary > 0
                      ? `${summary.totalBaseSalary.toLocaleString("vi-VN")} đ`
                      : "-"}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: "#fbbf24",
                      fontFamily: "monospace",
                    }}
                    className="print:border-black print:text-black"
                  >
                    {summary.totalViralBonus && summary.totalViralBonus > 0
                      ? `${summary.totalViralBonus.toLocaleString("vi-VN")} đ`
                      : "-"}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingRight: "1rem",
                      color: "#10b981",
                      fontWeight: 800,
                      fontSize: "0.9375rem",
                      fontFamily: "monospace",
                    }}
                    className="print:border-black print:text-black"
                  >
                    {(summary.totalSalaryAndBonus || 0).toLocaleString("vi-VN")} đ
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL CHI TIẾT CA LÀM VIỆC CỦA NHÂN SỰ KHI CLICK DÒNG BẢNG */}
      {/* ============================================================ */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          maxWidth="1280px"
          closeOnOutsideClick={false}
          showCloseButton={true}
          headerLeft={
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  flexShrink: 0,
                }}
              >
                {selectedUser.user.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3
                  className="modal-title"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  {selectedUser.user.fullName}
                  <span className="badge badge-primary" style={{ fontSize: "0.6875rem" }}>
                    {selectedUser.user.phone}
                  </span>
                </h3>
                <p className="modal-subtitle">
                  Chi tiết ca làm việc Tháng {month}/{year} • Tổng ca đạt:{" "}
                  <strong style={{ color: "var(--success)" }}>
                    {selectedUser.totalShiftsPassed}
                  </strong>
                  /{selectedUser.totalShifts} ca
                </p>
              </div>
            </div>
          }
          footer={
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="btn btn-secondary btn-sm"
            >
              Đóng
            </button>
          }
        >
              {modalLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <RefreshCw
                    size={24}
                    className="animate-spin"
                    style={{ margin: "0 auto 8px auto", color: "var(--primary)" }}
                  />
                  <div>Đang tải danh sách ca làm việc...</div>
                </div>
              ) : userShifts.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--text-muted)",
                  }}
                >
                  Không có ca làm việc nào trong tháng {month}/{year}
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Ca</th>
                        <th>Hình thức</th>
                        <th style={{ textAlign: "center" }}>FB Duyệt</th>
                        <th style={{ textAlign: "center" }}>Threads Duyệt</th>
                        <th style={{ textAlign: "center" }}>Comment</th>
                        <th style={{ textAlign: "center" }}>Kết quả QC</th>
                        <th>Feedback QC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userShifts.map((s) => {
                        const shiftDateStr = new Date(s.shiftDate).toLocaleDateString(
                          "vi-VN",
                          {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                          }
                        );

                        const shiftTypeLabel =
                          s.shiftType === "MORNING"
                            ? "Sáng (8h30 - 12h30)"
                            : s.shiftType === "AFTERNOON"
                            ? "Chiều (13h30 - 17h30)"
                            : "Tối (20h00 - 24h00)";

                        const qc = s.dailyReport?.qcReview;
                        const isPass = qc?.result === "PASS";
                        const isFail = qc?.result === "FAIL";

                        return (
                          <tr key={s.id}>
                            <td
                              style={{
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {shiftDateStr}
                            </td>
                            <td style={{ color: "var(--text-secondary)" }}>
                              {shiftTypeLabel}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  s.workMode === "OFFLINE"
                                    ? "badge-primary"
                                    : "badge-info"
                                }`}
                              >
                                {s.workMode}
                              </span>
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                fontFamily: "monospace",
                              }}
                            >
                              {qc ? (
                                <span
                                  style={{
                                    color:
                                      qc.fbApproved >= 10
                                        ? "var(--success)"
                                        : "var(--warning)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {qc.fbApproved}/10
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                fontFamily: "monospace",
                              }}
                            >
                              {qc ? (
                                <span
                                  style={{
                                    color:
                                      qc.threadApproved >= 4
                                        ? "var(--success)"
                                        : "var(--warning)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {qc.threadApproved}/4
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                fontFamily: "monospace",
                              }}
                            >
                              {qc ? (
                                <span
                                  style={{
                                    color:
                                      qc.commentApproved >= 50
                                        ? "var(--success)"
                                        : "var(--warning)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {qc.commentApproved}/50
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {isPass ? (
                                <span className="badge badge-success">ĐẠT</span>
                              ) : isFail ? (
                                <span className="badge badge-danger">
                                  KHÔNG ĐẠT
                                </span>
                              ) : (
                                <span className="badge badge-warning">CHỜ QC</span>
                              )}
                            </td>
                            <td
                              style={{
                                color: "var(--text-muted)",
                                maxWidth: "260px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {qc?.feedback || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
        </Modal>
      )}

      {/* STYLES CHO CHẾ ĐỘ IN ẤN A4 LANDSCAPE CHUYÊN DỤNG */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          aside,
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }
          #print-acceptance-sheet {
            display: block !important;
            border: 1px solid black !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th,
          td {
            border: 1px solid black !important;
            color: black !important;
            padding: 6px 8px !important;
          }
          th {
            background-color: #f3f4f6 !important;
            font-weight: bold !important;
          }
        }
      `}</style>
    </div>
  );
}
