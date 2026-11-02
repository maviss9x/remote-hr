"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { Modal } from "@/components/ui/Modal";
import {
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Unlock,
  Lock,
  ShieldCheck,
  Check,
  X,
  FileText,
  Building,
  Laptop,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  FolderOpen,
} from "lucide-react";

interface ShiftMonitoringItem {
  id: number;
  userId: number;
  userName: string;
  userPhone: string;
  userRole: string;
  workMode: string;
  shiftType: string;
  shiftLabel: string;
  shiftTime: {
    startTime: string;
    endTime: string;
  };
  shiftDate: string;
  status: string;
  note: string | null;

  timeContext: {
    isBeforeShift: boolean;
    isInShift: boolean;
    isAfterShift: boolean;
    shiftStart: string;
    shiftEnd: string;
    checkInDeadline: string;
  };

  checkIn: {
    hasLogin: boolean;
    loginTime: string | null;
    status: "ON_TIME" | "LATE" | "PENDING" | "LATE_RISK" | "LOCKED" | "BEFORE_SHIFT";
    isLate: boolean;
    lateMinutes: number;
    autoMarkedAbsent: boolean;
  };

  reopen: {
    isReopened: boolean;
    isExpired: boolean;
    reopenedBy: number | null;
    reopenedUntil: string | null;
    remainingSeconds: number | null;
    canQuickReopen: boolean;
  };

  report: {
    id: number;
    submittedAt: string;
    updatedAt: string;
    linksSummary: {
      fbCount: number;
      fbSuppCount: number;
      threadCount: number;
      commentCount: number;
      commentDriveLink: string | null;
      viralCount: number;
      total: number;
    };
    rawLinks: {
      fbLinks: string[];
      fbSupplementLinks: string[];
      threadLinks: string[];
      femaleContentLinks: string[];
      viralPostLinks: string[];
    };
    thresholdMet: boolean | null;
    endSnapshotAt: string | null;
  } | null;

  qc: {
    status: "NO_REPORT" | "PENDING" | "PASS" | "FAIL" | "CONDITIONAL";
    id: number | null;
    fbApproved: number;
    threadApproved: number;
    commentApproved: number;
    invalidLinks: string[];
    feedback: string | null;
    reviewedAt: string | null;
    reviewerName: string | null;
  };
}

interface MonitoringSummary {
  totalRegistered: number;
  checkedInCount: number;
  onTimeCount: number;
  lateCount: number;
  notCheckedInCount: number;
  lateRiskCount: number;
  lockedOrAbsentCount: number;
  reportedCount: number;
  reopenedCount: number;
  qcPendingCount: number;
  qcPassedCount: number;
  qcFailedCount: number;
  links: {
    fb: number;
    thread: number;
    comment: number;
    viral: number;
    total: number;
  };
}

/** Lấy chuỗi ngày YYYY-MM-DD theo giờ Việt Nam */
function getTodayVNString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** Format giờ:phút từ ISO String */
function formatTimeHHmm(isoString?: string | null): string {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

/** Format số giây còn lại thành X giờ Y phút */
function formatRemainingTime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || seconds <= 0) return "Hết hạn";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}p`;
  return `${minutes} phút`;
}

function isFbUrl(url: string): boolean {
  return url.includes("facebook.com") || url.includes("fb.watch") || url.includes("fb.com");
}

function isThreadUrl(url: string): boolean {
  return url.includes("threads.net") || url.includes("threads.com");
}

export default function TheoDoiCaPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayVNString());
  const [shiftTypeFilter, setShiftTypeFilter] = useState<string>("ALL");
  const [workModeFilter, setWorkModeFilter] = useState<string>("ALL");
  const [statusTab, setStatusTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const [summary, setSummary] = useState<MonitoringSummary>({
    totalRegistered: 0,
    checkedInCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    notCheckedInCount: 0,
    lateRiskCount: 0,
    lockedOrAbsentCount: 0,
    reportedCount: 0,
    reopenedCount: 0,
    qcPendingCount: 0,
    qcPassedCount: 0,
    qcFailedCount: 0,
    links: { fb: 0, thread: 0, comment: 0, viral: 0, total: 0 },
  });

  const [shifts, setShifts] = useState<ShiftMonitoringItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal Mở nộp bù
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenTargetShifts, setReopenTargetShifts] = useState<ShiftMonitoringItem[]>([]);
  const [reopenMode, setReopenMode] = useState<"PRESET" | "CUSTOM">("PRESET");
  const [reopenPresetMinutes, setReopenPresetMinutes] = useState<number>(120);
  const [reopenCustomDateTime, setReopenCustomDateTime] = useState<string>("");
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Slide-over Drawer Kiểm duyệt QC (WF-04)
  const [qcDrawerOpen, setQcDrawerOpen] = useState(false);
  const [qcActiveShiftId, setQcActiveShiftId] = useState<number | null>(null);
  const [qcTab, setQcTab] = useState<"ALL" | "FB" | "THREADS" | "COMMENT">("ALL");
  const [qcInvalidLinks, setQcInvalidLinks] = useState<Set<string>>(new Set());
  const [qcFbApproved, setQcFbApproved] = useState<number>(0);
  const [qcThreadApproved, setQcThreadApproved] = useState<number>(0);
  const [qcCommentApproved, setQcCommentApproved] = useState<number>(0);
  const [qcFeedback, setQcFeedback] = useState<string>("");
  const [submittingQc, setSubmittingQc] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch dữ liệu giám sát ca
  const fetchData = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      try {
        const params = new URLSearchParams({
          date: selectedDate,
          shiftType: shiftTypeFilter,
          workMode: workModeFilter,
        });

        const res = await fetch(`/api/shifts/monitoring?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Không thể tải dữ liệu giám sát ca");
        }

        setSummary(data.summary);
        setShifts(data.shifts || []);
        setLastRefreshedAt(new Date());
      } catch (err: any) {
        showToast(err.message, "error");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate, shiftTypeFilter, workModeFilter, showToast]
  );

  useEffect(() => {
    fetchData(false);
    setSelectedIds(new Set());
  }, [fetchData]);

  // Bộ đếm chu kỳ tự động làm mới (Auto Refresh 30 giây)
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchData(true);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [autoRefresh, fetchData]);

  // Điều hướng ngày nhanh: Hôm qua, Hôm nay, Ngày mai
  const handleJumpDay = (offsetDays: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + offsetDays);
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Lọc dữ liệu danh sách theo statusTab và searchQuery (Real-time in memory)
  const filteredShifts = useMemo(() => {
    return shifts.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = item.userName.toLowerCase().includes(q);
        const matchPhone = item.userPhone.toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }

      switch (statusTab) {
        case "CHECKED_IN":
          return item.checkIn.hasLogin;
        case "ON_TIME":
          return item.checkIn.status === "ON_TIME";
        case "LATE":
          return item.checkIn.status === "LATE" || item.checkIn.status === "LATE_RISK";
        case "NOT_CHECKED_IN":
          return !item.checkIn.hasLogin;
        case "LOCKED":
          return item.checkIn.status === "LOCKED" || item.status === "ABSENT";
        case "REPORTED":
          return item.report !== null;
        case "NOT_REPORTED":
          return item.report === null;
        case "REOPENED":
          return item.reopen.isReopened;
        case "QC_PENDING":
          return item.qc.status === "PENDING";
        default:
          return true;
      }
    });
  }, [shifts, searchQuery, statusTab]);

  // Checkbox chọn tất cả các dòng đang lọc
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredShifts.length && filteredShifts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShifts.map((s) => s.id)));
    }
  };

  // Checkbox chọn 1 dòng
  const handleToggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ============================================
  // CÁC HÀNH ĐỘNG MỞ / ĐÓNG NỘP BÙ (WF-03)
  // ============================================

  const handleOpenReopenSingle = (shift: ShiftMonitoringItem) => {
    setReopenTargetShifts([shift]);
    setReopenMode("PRESET");
    setReopenPresetMinutes(120);

    const defaultDate = new Date(Date.now() + 120 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localIso = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(
      defaultDate.getDate()
    )}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;
    setReopenCustomDateTime(localIso);
    setReopenModalOpen(true);
  };

  const handleOpenReopenBatch = () => {
    const selectedItems = shifts.filter((s) => selectedIds.has(s.id));
    if (selectedItems.length === 0) return;
    setReopenTargetShifts(selectedItems);
    setReopenMode("PRESET");
    setReopenPresetMinutes(120);

    const defaultDate = new Date(Date.now() + 120 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localIso = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(
      defaultDate.getDate()
    )}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;
    setReopenCustomDateTime(localIso);
    setReopenModalOpen(true);
  };

  const handleSelectEndOfDay = () => {
    setReopenMode("CUSTOM");
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const endOfDayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}T23:59`;
    setReopenCustomDateTime(endOfDayIso);
  };

  const handleConfirmReopen = async () => {
    if (reopenTargetShifts.length === 0) return;
    setSubmittingReopen(true);
    try {
      const payload: any = { action: "REOPEN_SHIFT" };

      if (reopenTargetShifts.length === 1) {
        payload.shiftRegistrationId = reopenTargetShifts[0].id;
      } else {
        payload.shiftRegistrationIds = reopenTargetShifts.map((s) => s.id);
      }

      if (reopenMode === "CUSTOM") {
        if (!reopenCustomDateTime) {
          showToast("Vui lòng chọn thời gian hết hạn nộp bù", "error");
          setSubmittingReopen(false);
          return;
        }
        const targetDate = new Date(reopenCustomDateTime);
        if (targetDate.getTime() <= Date.now()) {
          showToast("Thời gian hết hạn nộp bù phải lớn hơn thời điểm hiện tại", "error");
          setSubmittingReopen(false);
          return;
        }
        payload.reopenedUntil = targetDate.toISOString();
      } else {
        payload.durationMinutes = reopenPresetMinutes;
      }

      const res = await fetch("/api/qc/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi mở nộp bù");

      showToast(data.message, "success");
      setReopenModalOpen(false);
      setSelectedIds(new Set());
      await fetchData(true);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingReopen(false);
    }
  };

  const handleCloseReopen = async (shiftIds: number[]) => {
    if (shiftIds.length === 0) return;
    try {
      const payload: any = { action: "CLOSE_REOPEN_SHIFT" };
      if (shiftIds.length === 1) {
        payload.shiftRegistrationId = shiftIds[0];
      } else {
        payload.shiftRegistrationIds = shiftIds;
      }

      const res = await fetch("/api/qc/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi đóng nộp bù");

      showToast(data.message, "success");
      setSelectedIds(new Set());
      await fetchData(true);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // ============================================
  // CÁC HÀNH ĐỘNG KIỂM DUYỆT QC DRAWER (WF-04)
  // ============================================

  // Nhân sự đang mở trong Drawer
  const activeQcShift = useMemo(() => {
    if (!qcActiveShiftId) return null;
    return shifts.find((s) => s.id === qcActiveShiftId) || null;
  }, [qcActiveShiftId, shifts]);

  // Vị trí index hiện tại trong filteredShifts để điều hướng Trước/Sau
  const activeQcIndex = useMemo(() => {
    if (!qcActiveShiftId) return -1;
    return filteredShifts.findIndex((s) => s.id === qcActiveShiftId);
  }, [qcActiveShiftId, filteredShifts]);

  // Khởi tạo state khi mở QC Drawer cho 1 ca
  const handleOpenQcDrawer = (shift: ShiftMonitoringItem) => {
    if (!shift.report) {
      showToast("Nhân sự này chưa nộp báo cáo ca để kiểm duyệt QC", "error");
      return;
    }

    setQcActiveShiftId(shift.id);
    setQcTab("ALL");

    // Khởi tạo invalid links từ DB
    const existingInvalid = new Set<string>(shift.qc.invalidLinks || []);
    setQcInvalidLinks(existingInvalid);

    // Tính toán số lượng duyệt
    const fbTotal =
      (shift.report.linksSummary.fbCount || 0) + (shift.report.linksSummary.fbSuppCount || 0);
    const thTotal = shift.report.linksSummary.threadCount || 0;
    const cmtTotal = shift.report.linksSummary.commentDriveLink ? 50 : 0;

    if (shift.qc.id && shift.qc.status !== "PENDING") {
      setQcFbApproved(shift.qc.fbApproved);
      setQcThreadApproved(shift.qc.threadApproved);
      setQcCommentApproved(shift.qc.commentApproved);
      setQcFeedback(shift.qc.feedback || "");
    } else {
      // Tự động trừ link lỗi nếu có
      const fbInvalid = Array.from(existingInvalid).filter((u) => isFbUrl(u)).length;
      const thInvalid = Array.from(existingInvalid).filter((u) => isThreadUrl(u)).length;

      setQcFbApproved(Math.max(0, fbTotal - fbInvalid));
      setQcThreadApproved(Math.max(0, thTotal - thInvalid));
      setQcCommentApproved(cmtTotal);
      setQcFeedback("");
    }

    setQcDrawerOpen(true);
  };

  // Chuyển ca kế tiếp hoặc ca trước trong Drawer
  const handleNavigateQc = (offset: number) => {
    const nextIdx = activeQcIndex + offset;
    if (nextIdx >= 0 && nextIdx < filteredShifts.length) {
      const nextShift = filteredShifts[nextIdx];
      handleOpenQcDrawer(nextShift);
    }
  };

  // Toggle link không hợp lệ (Invalid) và tự động tính lại số lượng duyệt
  const handleToggleInvalidLink = (url: string) => {
    if (!activeQcShift || !activeQcShift.report) return;

    const next = new Set(qcInvalidLinks);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setQcInvalidLinks(next);

    // Tự động tính lại số bài đạt
    const fbTotal =
      activeQcShift.report.linksSummary.fbCount + activeQcShift.report.linksSummary.fbSuppCount;
    const thTotal = activeQcShift.report.linksSummary.threadCount;

    const fbInvalid = Array.from(next).filter((u) => isFbUrl(u)).length;
    const thInvalid = Array.from(next).filter((u) => isThreadUrl(u)).length;

    setQcFbApproved(Math.max(0, fbTotal - fbInvalid));
    setQcThreadApproved(Math.max(0, thTotal - thInvalid));
  };

  // Sao chép link vào Clipboard
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 1500);
  };

  // Sao chép toàn bộ link đang xem
  const handleCopyAllLinks = (links: string[]) => {
    if (links.length === 0) return;
    navigator.clipboard.writeText(links.join("\n"));
    setCopiedLink("ALL");
    showToast(`Đã sao chép ${links.length} link vào clipboard!`, "success");
    setTimeout(() => setCopiedLink(null), 1500);
  };

  // Xác nhận Duyệt QC (PASS / FAIL / CONDITIONAL)
  const handleConfirmQcReview = async (result: "PASS" | "FAIL" | "CONDITIONAL") => {
    if (!activeQcShift || !activeQcShift.report) return;

    setSubmittingQc(true);
    try {
      const payload = {
        dailyReportId: activeQcShift.report.id,
        fbApproved: Number(qcFbApproved) || 0,
        threadApproved: Number(qcThreadApproved) || 0,
        commentApproved: Number(qcCommentApproved) || 0,
        result,
        feedback: qcFeedback.trim(),
        invalidLinks: Array.from(qcInvalidLinks),
      };

      const res = await fetch("/api/qc/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi lưu kết quả duyệt QC");

      showToast(
        result === "PASS"
          ? `Đã DUYỆT ĐẠT báo cáo của ${activeQcShift.userName}!`
          : result === "FAIL"
          ? `Đã đánh dấu KHÔNG ĐẠT báo cáo của ${activeQcShift.userName}!`
          : `Đã duyệt có điều kiện cho ${activeQcShift.userName}!`,
        "success"
      );

      // Cập nhật ngay lập tức vào state local shifts để không bị khựng UI
      setShifts((prev) =>
        prev.map((s) => {
          if (s.id === activeQcShift.id) {
            return {
              ...s,
              qc: {
                ...s.qc,
                status: result,
                fbApproved: Number(qcFbApproved),
                threadApproved: Number(qcThreadApproved),
                commentApproved: Number(qcCommentApproved),
                invalidLinks: Array.from(qcInvalidLinks),
                feedback: qcFeedback.trim(),
                reviewedAt: new Date().toISOString(),
              },
            };
          }
          return s;
        })
      );

      // Tự động chuyển sang ca kế tiếp nếu còn
      if (activeQcIndex < filteredShifts.length - 1) {
        const nextShift = filteredShifts[activeQcIndex + 1];
        if (nextShift && nextShift.report) {
          handleOpenQcDrawer(nextShift);
        } else {
          setQcDrawerOpen(false);
        }
      } else {
        setQcDrawerOpen(false);
      }

      await fetchData(true);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingQc(false);
    }
  };

  // Gom nhóm danh sách link của ca đang mở QC Drawer
  const activeLinks = useMemo(() => {
    if (!activeQcShift || !activeQcShift.report) {
      return { fb: [], th: [], all: [], commentDrive: null };
    }
    const raw = activeQcShift.report.rawLinks;
    const fb = [...raw.fbLinks, ...raw.fbSupplementLinks];
    const th = raw.threadLinks;
    const all = [...fb, ...th];
    return {
      fb,
      th,
      all,
      commentDrive: activeQcShift.report.linksSummary.commentDriveLink,
    };
  }, [activeQcShift]);

  return (
    <div className="space-y-6 pb-24">
      {/* Toast thông báo */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all transform animate-in fade-in slide-in-from-top-3 ${
            toast.type === "success"
              ? "bg-emerald-600/95 text-white border border-emerald-400"
              : "bg-rose-600/95 text-white border border-rose-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER: Tiêu đề, chọn ngày, Auto Refresh */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <Clock size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Theo Dõi & Giám Sát Ca Làm Việc
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Theo dõi thời gian thực vào ca, trạng thái nộp bài, mở nộp bù và kiểm duyệt QC nhanh
              </p>
            </div>
          </div>
        </div>

        {/* Thanh công cụ chọn ngày & nút làm mới */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick jump ngày */}
          <div className="flex items-center bg-[var(--bg-surface)] rounded-xl p-1 border border-[var(--border-color)]">
            <button
              onClick={() => handleJumpDay(-1)}
              className="p-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition"
              title="Hôm qua"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setSelectedDate(getTodayVNString())}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                selectedDate === getTodayVNString()
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => handleJumpDay(1)}
              className="p-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition"
              title="Ngày mai"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Date Picker */}
          <div className="w-40">
            <CustomDatePicker value={selectedDate} onChange={(d) => setSelectedDate(d)} />
          </div>

          {/* Toggle Auto Refresh */}
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            title={autoRefresh ? "Tự động cập nhật mỗi 30s đang bật" : "Tự động cập nhật đang tắt"}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
              }`}
            />
            <span>Auto Refresh: {autoRefresh ? "30s" : "Tắt"}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs font-medium transition disabled:opacity-50"
            title="Làm mới dữ liệu ngay lập tức"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-orange-500" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI STATS CARDS: 6 Thẻ số liệu tức thì */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Tổng đăng ký ca</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {summary.totalRegistered}
            </span>
            <span className="text-xs text-[var(--text-muted)]">nhân sự</span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Đã vào ca</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{summary.checkedInCount}</span>
            <span className="text-xs text-[var(--text-muted)]">
              Đúng giờ: <b className="text-emerald-400">{summary.onTimeCount}</b> | Trễ:{" "}
              <b className="text-amber-400">{summary.lateCount}</b>
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Chưa vào ca</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">{summary.notCheckedInCount}</span>
            <span className="text-xs text-[var(--text-muted)]">
              Khóa (&gt;1h): <b className="text-rose-400">{summary.lockedOrAbsentCount}</b>
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Đã nộp báo cáo</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-400">{summary.reportedCount}</span>
            <span className="text-xs text-[var(--text-muted)]">
              Tỷ lệ:{" "}
              <b>
                {summary.totalRegistered > 0
                  ? Math.round((summary.reportedCount / summary.totalRegistered) * 100)
                  : 0}
                %
              </b>
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Đang mở nộp bù</span>
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Unlock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-orange-400">{summary.reopenedCount}</span>
            <span className="text-xs text-[var(--text-muted)]">ca đang mở</span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Tổng link nộp</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-teal-400">{summary.links.total}</span>
            <span className="text-xs text-[var(--text-muted)]">
              FB: <b>{summary.links.fb}</b> | TH: <b>{summary.links.thread}</b>
            </span>
          </div>
        </div>
      </div>

      {/* FILTER BAR: Chọn Ca, Hình thức, Tab trạng thái, Tìm kiếm */}
      <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)]">
              {[
                { id: "ALL", label: "Tất cả ca" },
                { id: "MORNING", label: "Ca Sáng (08:30)" },
                { id: "AFTERNOON", label: "Ca Chiều (13:30)" },
                { id: "EVENING", label: "Ca Tối (20:00)" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setShiftTypeFilter(c.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    shiftTypeFilter === c.id
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)]">
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "ONLINE", label: "Online" },
                { id: "OFFLINE", label: "Offline" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setWorkModeFilter(m.id)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                    workModeFilter === m.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-w-[260px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo họ tên, số điện thoại..."
              className="w-full pl-9 pr-8 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-[var(--border-color)] pt-3 text-xs">
          <span className="text-[var(--text-muted)] font-medium mr-1 flex items-center gap-1 shrink-0">
            <Filter size={13} /> Lọc nhanh:
          </span>
          {[
            { id: "ALL", label: "Tất cả", count: shifts.length },
            { id: "CHECKED_IN", label: "Đã vào ca", count: summary.checkedInCount },
            { id: "NOT_CHECKED_IN", label: "Chưa vào ca", count: summary.notCheckedInCount },
            { id: "LATE", label: "Vào muộn", count: summary.lateCount },
            { id: "LOCKED", label: "Quá hạn / Khóa", count: summary.lockedOrAbsentCount },
            { id: "REPORTED", label: "Đã nộp bài", count: summary.reportedCount },
            { id: "REOPENED", label: "Đang nộp bù", count: summary.reopenedCount },
            { id: "QC_PENDING", label: "Chờ QC", count: summary.qcPendingCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                statusTab === tab.id
                  ? "bg-[var(--bg-hover)] text-orange-400 border border-orange-500/40 shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusTab === tab.id
                    ? "bg-orange-500 text-white"
                    : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* DATA TABLE: Bảng Giám Sát Ca & Tình Hình Nộp Bài */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-[var(--text-secondary)] font-semibold">
                <th className="py-3 px-3.5 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                    title={
                      selectedIds.size === filteredShifts.length && filteredShifts.length > 0
                        ? "Bỏ chọn tất cả"
                        : "Chọn tất cả"
                    }
                  >
                    {selectedIds.size === filteredShifts.length && filteredShifts.length > 0 ? (
                      <CheckSquare size={16} className="text-orange-500" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Nhân sự</th>
                <th className="py-3 px-3">Ca & Hình thức</th>
                <th className="py-3 px-3">Trạng thái Vào ca</th>
                <th className="py-3 px-3">Trạng thái Báo cáo</th>
                <th className="py-3 px-3">Số link đã nộp</th>
                <th className="py-3 px-3">Nộp bù ca</th>
                <th className="py-3 px-3">Kiểm duyệt QC</th>
                <th className="py-3 px-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[var(--text-muted)]">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-orange-500" />
                    <span>Đang tải danh sách ca làm việc...</span>
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[var(--text-muted)]">
                    <Users size={32} className="mx-auto mb-2 text-[var(--text-dim)]" />
                    <p className="font-medium text-sm text-[var(--text-secondary)]">
                      Không tìm thấy ca làm việc nào
                    </p>
                    <p className="text-xs mt-1">
                      Thử thay đổi bộ lọc ngày, ca hoặc kiểm tra lại lịch đăng ký.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => {
                  const isSelected = selectedIds.has(shift.id);

                  return (
                    <tr
                      key={shift.id}
                      className={`hover:bg-[var(--bg-hover)] transition cursor-pointer ${
                        isSelected ? "bg-orange-500/5" : ""
                      }`}
                      onClick={() => {
                        if (shift.report) handleOpenQcDrawer(shift);
                      }}
                    >
                      {/* Checkbox chọn */}
                      <td
                        className="py-3.5 px-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleToggleSelectOne(shift.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-orange-500" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Thông tin Nhân sự */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                            {shift.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text-primary)] hover:text-orange-400 transition">
                              {shift.userName}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                              <span>{shift.userPhone}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                                {shift.userRole}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ca làm việc & Hình thức */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-[var(--text-primary)]">
                              {shift.shiftLabel}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              ({shift.shiftTime.startTime} - {shift.shiftTime.endTime})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {shift.workMode === "ONLINE" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                <Laptop size={11} /> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                <Building size={11} /> Offline
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Trạng thái Vào ca */}
                      <td className="py-3.5 px-3">
                        {shift.checkIn.hasLogin ? (
                          <div className="space-y-0.5">
                            {shift.checkIn.isLate ? (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                <Clock size={12} />
                                <span>Vào trễ {shift.checkIn.lateMinutes}p</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                                <span>Đúng giờ</span>
                              </div>
                            )}
                            <div className="text-[10px] text-[var(--text-muted)]">
                              Điểm danh lúc: <b>{formatTimeHHmm(shift.checkIn.loginTime)}</b>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {shift.checkIn.status === "BEFORE_SHIFT" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                                <Clock size={11} /> Chưa đến giờ ca
                              </span>
                            ) : shift.checkIn.status === "PENDING" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                                <AlertCircle size={11} /> Đang mở điểm danh
                              </span>
                            ) : shift.checkIn.status === "LATE_RISK" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <AlertTriangle size={11} /> Chưa vào (Trễ {shift.checkIn.lateMinutes}p)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                <Lock size={11} /> Khóa (&gt;60p chưa vào)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Trạng thái Báo cáo */}
                      <td className="py-3.5 px-3">
                        {shift.report ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <CheckCircle2 size={12} /> Đã nộp bài
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              Nộp lúc: <b>{formatTimeHHmm(shift.report.submittedAt)}</b>
                            </div>
                          </div>
                        ) : shift.timeContext.isInShift ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            <Clock size={11} /> Đang làm việc
                          </span>
                        ) : shift.timeContext.isAfterShift ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <XCircle size={11} /> Chưa nộp báo cáo
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">Chưa đến ca</span>
                        )}
                      </td>

                      {/* Số lượng Link đã nộp */}
                      <td className="py-3.5 px-3">
                        {shift.report ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold"
                              title="Facebook Post"
                            >
                              FB:{" "}
                              {shift.report.linksSummary.fbCount +
                                shift.report.linksSummary.fbSuppCount}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-bold"
                              title="Threads Post"
                            >
                              TH: {shift.report.linksSummary.threadCount}
                            </span>
                            {shift.report.linksSummary.commentDriveLink ? (
                              <span
                                className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold"
                                title="Đã nộp link Drive Comment"
                              >
                                CMT: 50
                              </span>
                            ) : null}
                            <span className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">
                              = {shift.report.linksSummary.total} link
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[var(--text-dim)]">0 link</span>
                        )}
                      </td>

                      {/* Trạng thái Nộp bù ca */}
                      <td className="py-3.5 px-3">
                        {shift.reopen.isReopened ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-md border border-orange-500/30 animate-pulse">
                              <Unlock size={11} /> Đang mở nộp bù
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              Còn: <b>{formatRemainingTime(shift.reopen.remainingSeconds)}</b>
                            </div>
                          </div>
                        ) : shift.reopen.isExpired ? (
                          <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                            Đã hết hạn nộp bù
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-dim)]">--</span>
                        )}
                      </td>

                      {/* Trạng thái QC */}
                      <td className="py-3.5 px-3">
                        {!shift.report ? (
                          <span className="text-[10px] text-[var(--text-dim)]">Chưa nộp</span>
                        ) : shift.qc.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                            <Clock size={11} /> Chờ QC duyệt
                          </span>
                        ) : shift.qc.status === "PASS" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 size={11} /> QC Đạt
                          </span>
                        ) : shift.qc.status === "FAIL" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <XCircle size={11} /> Không đạt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                            <AlertCircle size={11} /> Duyệt có ĐK
                          </span>
                        )}
                      </td>

                      {/* Cột Hành động */}
                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Mở nộp bù nhanh inline */}
                          {shift.reopen.canQuickReopen && (
                            <button
                              onClick={() => handleOpenReopenSingle(shift)}
                              className="px-2.5 py-1 bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white rounded-lg text-[10px] font-bold border border-orange-500/30 transition flex items-center gap-1 shadow-sm"
                              title="Mở nộp bù nhanh cho ca này"
                            >
                              <Unlock size={11} />
                              <span>Mở nộp bù</span>
                            </button>
                          )}

                          {/* Nếu ca đang mở nộp bù -> Nút Đóng nộp bù hoặc Gia hạn */}
                          {shift.reopen.isReopened && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenReopenSingle(shift)}
                                className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-[10px] font-semibold border border-orange-500/25 transition"
                                title="Gia hạn thời gian nộp bù"
                              >
                                Gia hạn
                              </button>
                              <button
                                onClick={() => handleCloseReopen([shift.id])}
                                className="p-1 hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 rounded-lg border border-[var(--border-color)] transition"
                                title="Đóng nộp bù ca này ngay"
                              >
                                <Lock size={12} />
                              </button>
                            </div>
                          )}

                          {/* Nút Kiểm duyệt QC (Slide-over Drawer) */}
                          {shift.report && (
                            <button
                              onClick={() => handleOpenQcDrawer(shift)}
                              className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[10px] font-bold border border-blue-500/30 transition flex items-center gap-1 shadow-sm"
                              title="Mở bảng kiểm duyệt QC nhanh"
                            >
                              <ShieldCheck size={12} />
                              <span>Duyệt QC</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer của bảng */}
        <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div>
            Hiển thị <b>{filteredShifts.length}</b> / <b>{shifts.length}</b> ca làm việc
            {selectedIds.size > 0 && (
              <span className="ml-3 text-orange-400 font-semibold">
                (Đã chọn {selectedIds.size} ca)
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Cập nhật lần cuối: <b>{formatTimeHHmm(lastRefreshedAt.toISOString())}</b>
          </div>
        </div>
      </div>

      {/* FLOATING BATCH ACTION BAR: Cố định đáy màn hình */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--bg-card)]/95 backdrop-blur-md border border-orange-500/40 shadow-2xl px-5 py-3 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {selectedIds.size}
            </div>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Đã chọn {selectedIds.size} ca làm việc
            </span>
          </div>

          <div className="h-4 w-px bg-[var(--border-color)]" />

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenReopenBatch}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 transition active:scale-95"
            >
              <Unlock size={14} />
              <span>Mở nộp bù ({selectedIds.size})</span>
            </button>

            <button
              onClick={() => handleCloseReopen(Array.from(selectedIds))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-400 border border-[var(--border-color)] text-xs font-semibold rounded-xl transition"
              title="Đóng quyền nộp bù cho các ca đang chọn"
            >
              <Lock size={14} />
              <span>Đóng nộp bù</span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition"
              title="Bỏ chọn tất cả"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL MỞ NỘP BÙ CA */}
      <Modal
        isOpen={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <div className="p-2 rounded-xl bg-orange-500/15 text-orange-500">
              <Unlock size={18} />
            </div>
            <span>
              {reopenTargetShifts.length > 1
                ? `Mở Nộp Bù Hàng Loạt Cho ${reopenTargetShifts.length} Nhân Sự`
                : `Mở Nộp Bù Ca: ${reopenTargetShifts[0]?.userName || ""}`}
            </span>
          </div>
        }
        subtitle="Cấp quyền cho nhân sự vào muộn sau 1h hoặc quá giờ ca được tiếp tục vào ca và nộp link báo cáo"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-[var(--text-muted)]">
              Hệ thống sẽ gửi thông báo chuông đến từng nhân sự
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReopenModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                disabled={submittingReopen}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md shadow-orange-500/20 transition disabled:opacity-50"
              >
                {submittingReopen ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Unlock size={14} />
                )}
                <span>Xác nhận Mở nộp bù</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs text-[var(--text-primary)]">
          <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
            <span className="text-[var(--text-secondary)] font-medium">Nhân sự áp dụng:</span>
            <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {reopenTargetShifts.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-primary)]"
                >
                  <span>{s.userName}</span>
                  <span className="text-[var(--text-muted)]">({s.shiftLabel})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-xs text-[var(--text-primary)]">
              Chọn thời hạn cho phép nộp bù:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { min: 60, label: "+1 Giờ (60p)" },
                { min: 120, label: "+2 Giờ (120p)" },
                { min: 240, label: "+4 Giờ (240p)" },
              ].map((p) => (
                <button
                  key={p.min}
                  type="button"
                  onClick={() => {
                    setReopenMode("PRESET");
                    setReopenPresetMinutes(p.min);
                  }}
                  className={`py-2 px-3 rounded-xl font-semibold text-center border transition ${
                    reopenMode === "PRESET" && reopenPresetMinutes === p.min
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <button
                type="button"
                onClick={handleSelectEndOfDay}
                className={`py-2 px-3 rounded-xl font-semibold text-center border transition ${
                  reopenMode === "CUSTOM" && reopenCustomDateTime.endsWith("23:59")
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Cuối ngày (23:59)
              </button>
            </div>

            <div className="pt-2">
              <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                Hoặc chọn mốc thời gian hết hạn chính xác:
              </label>
              <input
                type="datetime-local"
                value={reopenCustomDateTime}
                onChange={(e) => {
                  setReopenMode("CUSTOM");
                  setReopenCustomDateTime(e.target.value);
                }}
                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* SLIDE-OVER DRAWER KIỂM DUYỆT QC NHANH (WF-04)            */}
      {/* ========================================================= */}
      {qcDrawerOpen && activeQcShift && activeQcShift.report && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          {/* Backdrop mờ che nền */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setQcDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              {/* DRAWER HEADER */}
              <div className="p-4 bg-[var(--bg-surface)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                    {activeQcShift.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">
                        {activeQcShift.userName}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-semibold border border-orange-500/30">
                        {activeQcShift.shiftLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      SĐT: {activeQcShift.userPhone} | Nộp lúc:{" "}
                      <b>{formatTimeHHmm(activeQcShift.report.submittedAt)}</b>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Điều hướng Trước / Sau */}
                  <div className="flex items-center bg-[var(--bg-card)] rounded-lg p-0.5 border border-[var(--border-color)]">
                    <button
                      onClick={() => handleNavigateQc(-1)}
                      disabled={activeQcIndex <= 0}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded disabled:opacity-30 transition"
                      title="Ca trước đó"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 font-semibold">
                      {activeQcIndex + 1}/{filteredShifts.length}
                    </span>
                    <button
                      onClick={() => handleNavigateQc(1)}
                      disabled={activeQcIndex >= filteredShifts.length - 1}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded disabled:opacity-30 transition"
                      title="Ca kế tiếp"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Nút Đóng */}
                  <button
                    onClick={() => setQcDrawerOpen(false)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition"
                    title="Đóng bảng QC"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* DRAWER TABS & THỐNG KÊ NHANH */}
              <div className="px-4 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
                {/* Tabs nền tảng */}
                <div className="flex items-center gap-1">
                  {[
                    { id: "ALL", label: "Tất cả", count: activeLinks.all.length },
                    { id: "FB", label: "Facebook", count: activeLinks.fb.length },
                    { id: "THREADS", label: "Threads", count: activeLinks.th.length },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setQcTab(t.id as any)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        qcTab === t.id
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {t.label} ({t.count})
                    </button>
                  ))}
                  {activeLinks.commentDrive && (
                    <button
                      onClick={() => setQcTab("COMMENT")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        qcTab === "COMMENT"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Comment Drive (50)
                    </button>
                  )}
                </div>

                {/* Nút Sao chép toàn bộ link */}
                <button
                  onClick={() => {
                    const linksToCopy =
                      qcTab === "FB"
                        ? activeLinks.fb
                        : qcTab === "THREADS"
                        ? activeLinks.th
                        : activeLinks.all;
                    handleCopyAllLinks(linksToCopy);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition text-[11px] font-medium"
                >
                  <Copy size={12} />
                  <span>{copiedLink === "ALL" ? "Đã chép!" : "Chép link tab này"}</span>
                </button>
              </div>

              {/* DRAWER BODY: DANH SÁCH LINK */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {qcTab === "COMMENT" && activeLinks.commentDrive ? (
                  <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={16} className="text-amber-400" />
                        <span className="font-bold text-xs text-[var(--text-primary)]">
                          Link Google Drive chứa ảnh Comment Seeding:
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                        KPI: 50 cmt
                      </span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                      <a
                        href={activeLinks.commentDrive}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:underline truncate flex-1"
                      >
                        {activeLinks.commentDrive}
                      </a>
                      <a
                        href={activeLinks.commentDrive}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded"
                        title="Mở Google Drive"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ) : (
                  (qcTab === "FB"
                    ? activeLinks.fb
                    : qcTab === "THREADS"
                    ? activeLinks.th
                    : activeLinks.all
                  ).map((url, idx) => {
                    const isInvalid = qcInvalidLinks.has(url);
                    const isFb = isFbUrl(url);

                    return (
                      <div
                        key={`${url}-${idx}`}
                        className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-2 text-xs ${
                          isInvalid
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                            : "bg-[var(--bg-surface)] border-[var(--border-color)] hover:border-[var(--border-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] text-[var(--text-muted)] w-5 shrink-0 font-mono">
                            {idx + 1}.
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              isFb
                                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                            }`}
                          >
                            {isFb ? "FB" : "TH"}
                          </span>

                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className={`truncate hover:underline ${
                              isInvalid
                                ? "line-through text-rose-400 font-medium"
                                : "text-[var(--text-primary)]"
                            }`}
                            title={url}
                          >
                            {url}
                          </a>
                        </div>

                        {/* Thao tác trên từng link */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Nút Toggle Báo Lỗi */}
                          <button
                            onClick={() => handleToggleInvalidLink(url)}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition flex items-center gap-1 ${
                              isInvalid
                                ? "bg-rose-600 text-white shadow-sm"
                                : "bg-[var(--bg-card)] hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 border border-[var(--border-color)]"
                            }`}
                            title={isInvalid ? "Hủy báo lỗi" : "Đánh dấu link này không hợp lệ"}
                          >
                            {isInvalid ? <XCircle size={11} /> : <AlertTriangle size={11} />}
                            <span>{isInvalid ? "Link lỗi" : "Báo lỗi"}</span>
                          </button>

                          {/* Nút Sao chép */}
                          <button
                            onClick={() => handleCopyText(url, url)}
                            className="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition"
                            title="Sao chép link"
                          >
                            {copiedLink === url ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>

                          {/* Nút Mở tab mới */}
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition"
                            title="Mở bài viết trong tab mới"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DRAWER FOOTER: FORM CHẤM ĐIỂM & HÀNH ĐỘNG DUYỆT */}
              <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-color)] shrink-0 space-y-3">
                {/* 3 Ô số lượng bài duyệt Đạt */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-[var(--bg-card)] p-2 rounded-xl border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">
                      FB Duyệt Đạt
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={qcFbApproved}
                      onChange={(e) => setQcFbApproved(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full mt-1 bg-transparent font-bold text-sm text-blue-400 focus:outline-none"
                    />
                  </div>

                  <div className="bg-[var(--bg-card)] p-2 rounded-xl border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">
                      Thread Duyệt Đạt
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={qcThreadApproved}
                      onChange={(e) =>
                        setQcThreadApproved(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="w-full mt-1 bg-transparent font-bold text-sm text-purple-400 focus:outline-none"
                    />
                  </div>

                  <div className="bg-[var(--bg-card)] p-2 rounded-xl border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-muted)] block font-medium">
                      CMT Duyệt Đạt
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={qcCommentApproved}
                      onChange={(e) =>
                        setQcCommentApproved(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="w-full mt-1 bg-transparent font-bold text-sm text-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Nhập Feedback */}
                <div>
                  <textarea
                    rows={2}
                    value={qcFeedback}
                    onChange={(e) => setQcFeedback(e.target.value)}
                    placeholder="Góp ý hoặc lý do không đạt (sẽ gửi thông báo cho nhân sự)..."
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition resize-none"
                  />
                </div>

                {/* 3 Nút quyết định Duyệt QC */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {qcInvalidLinks.size > 0 ? (
                      <span className="text-rose-400 font-bold">
                        Đã chọn {qcInvalidLinks.size} link lỗi
                      </span>
                    ) : (
                      <span>Chưa phát hiện link lỗi</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Nút Không Đạt */}
                    <button
                      type="button"
                      disabled={submittingQc}
                      onClick={() => handleConfirmQcReview("FAIL")}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 transition disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      <span>Không Đạt (FAIL)</span>
                    </button>

                    {/* Nút Duyệt có ĐK */}
                    <button
                      type="button"
                      disabled={submittingQc}
                      onClick={() => handleConfirmQcReview("CONDITIONAL")}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-500/15 hover:bg-purple-600 text-purple-400 hover:text-white rounded-xl text-xs font-bold border border-purple-500/30 transition disabled:opacity-50"
                    >
                      <AlertCircle size={14} />
                      <span>Duyệt có ĐK</span>
                    </button>

                    {/* Nút Duyệt Đạt */}
                    <button
                      type="button"
                      disabled={submittingQc}
                      onClick={() => handleConfirmQcReview("PASS")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
                    >
                      {submittingQc ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      <span>Duyệt Đạt (PASS)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
