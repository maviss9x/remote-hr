"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { confirmModal, alertModal, WeekPicker, MonthPicker, Modal } from "@/components/ui";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Building,
  Laptop,
  Clock,
  Users,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  FileCheck,
  Info,
  CalendarCheck2,
  UserCheck,
  Edit3,
  User,
  Filter,
} from "lucide-react";
import {
  getISOWeekAndYear,
  getWeekRange,
  getWeeksInMonth,
  MonthWeekOption,
} from "@/lib/dateUtils";

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING";
type WorkMode = "ONLINE" | "OFFLINE";
type ShiftStatus = "REGISTERED" | "APPROVED" | "REJECTED" | "COMPLETED" | "ABSENT" | "EXCUSED_ABSENT" | "UNEXCUSED_ABSENT" | "LOCKED";
type TeamFilterStatus = "ALL" | "PENDING" | "APPROVED" | "NOT_REGISTERED";

interface ShiftItem {
  id?: number;
  userId?: number;
  shiftDate: string; // ISO string
  shiftType: ShiftType;
  workMode: WorkMode;
  status: ShiftStatus;
  reopenedBy?: number | null;
  user?: {
    id: number;
    fullName: string;
    phone: string;
  };
}

interface TeamUser {
  id: number;
  fullName: string;
  phone: string;
  role: string;
  status: string;
}

interface WeekConfig {
  id: number;
  weekNumber: number;
  year: number;
  isLocked: boolean;
  isWeekLocked?: boolean;
  isReopenedUser?: boolean;
  isLockedForUser?: boolean;
  reopenedUserIds?: number[];
  approvedAt?: string | null;
  registrationCloseAt?: string;
  pendingCount?: number;
  pendingUsersCount?: number;
  approvedCount?: number;
  totalShiftsCount?: number;
  maxUsersPerShift?: number;
  shiftOccupancy?: Record<string, number>;
  personalStatus?: "NOT_REGISTERED" | "PENDING_APPROVAL" | "APPROVED";
  personalStats?: {
    total: number;
    pending: number;
    approved: number;
  };
  formattedCloseVN?: string;
  autoApproved?: boolean;
}

const SHIFT_INFO: Record<
  ShiftType,
  { label: string; time: string; icon: string; bgClass: string }
> = {
  MORNING: {
    label: "Ca Sáng",
    time: "08:30 - 12:30",
    icon: "☀️",
    bgClass: "rgba(234, 179, 8, 0.15)",
  },
  AFTERNOON: {
    label: "Ca Chiều",
    time: "13:30 - 17:30",
    icon: "🌤️",
    bgClass: "rgba(249, 115, 22, 0.15)",
  },
  EVENING: {
    label: "Ca Tối",
    time: "20:00 - 24:00",
    icon: "🌙",
    bgClass: "rgba(99, 102, 241, 0.15)",
  },
};

const SHIFT_ORDER: Record<ShiftType, number> = {
  MORNING: 1,
  AFTERNOON: 2,
  EVENING: 3,
};

const DAYS_OF_WEEK = [
  { dayIndex: 1, name: "Thứ Hai", short: "T2" },
  { dayIndex: 2, name: "Thứ Ba", short: "T3" },
  { dayIndex: 3, name: "Thứ Tư", short: "T4" },
  { dayIndex: 4, name: "Thứ Năm", short: "T5" },
  { dayIndex: 5, name: "Thứ Sáu", short: "T6" },
  { dayIndex: 6, name: "Thứ Bảy", short: "T7" },
  { dayIndex: 0, name: "Chủ Nhật", short: "CN" },
];

/**
 * Component hiển thị Badge trạng thái duyệt ca của từng nhân sự
 * Chuẩn hóa 3 trạng thái:
 * 1. Chưa đăng ký ca (totalShifts === 0)
 * 2. Chờ duyệt (pendingCount > 0)
 * 3. Đã duyệt (totalShifts > 0 && pendingCount === 0)
 */
function UserShiftStatusBadge({
  totalShifts,
  pendingCount,
  approvedCount,
}: {
  totalShifts: number;
  pendingCount: number;
  approvedCount: number;
}) {
  if (totalShifts === 0) {
    return (
      <span
        className="badge badge-neutral"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "0.75rem",
          padding: "3px 8px",
          color: "var(--text-muted)",
        }}
        title="Chưa đăng ký ca nào trong tuần"
      >
        <AlertCircle size={12} /> Chưa đăng ký ca
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span
        className="badge badge-warning"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "0.75rem",
          fontWeight: 700,
          padding: "3px 8px",
          background: "rgba(245, 158, 11, 0.18)",
          color: "#d97706",
          border: "1px solid rgba(245, 158, 11, 0.45)",
          boxShadow: "0 0 8px rgba(245, 158, 11, 0.15)",
        }}
        title={`Đang chờ quản lý duyệt ${pendingCount} ca`}
      >
        <Clock size={12} /> Chờ duyệt ({pendingCount})
      </span>
    );
  }

  if (approvedCount === totalShifts) {
    return (
      <span
        className="badge badge-success"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "3px 8px",
        }}
        title="Toàn bộ ca trong tuần đã được duyệt"
      >
        <ShieldCheck size={12} /> Đã duyệt ({approvedCount})
      </span>
    );
  }

  return (
    <span
      className="badge badge-success"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "0.75rem",
        fontWeight: 600,
        padding: "3px 8px",
      }}
      title={`${approvedCount}/${totalShifts} ca đã duyệt`}
    >
      <CheckCircle2 size={12} /> Đã duyệt ({approvedCount}/{totalShifts})
    </span>
  );
}

export default function CaLamViecPage() {
  // Helper tính tuần và năm theo offset (dành cho Tab Cá Nhân)
  const getWeekAndYearFromOffset = (offset: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offset * 7);

    const target = new Date(targetDate.valueOf());
    const dayNr = (targetDate.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const year = targetDate.getFullYear();
    return { weekNumber, year };
  };

  // Helper tính ISO week của thời điểm hiện tại thực tế
  const currentRealIso = useMemo(() => getISOWeekAndYear(new Date()), []);
  const currentRealWeek = currentRealIso.weekNumber;
  const currentRealYear = currentRealIso.year;
  const nextRealWeek = currentRealWeek + 1;

  // View mode
  const [viewMode, setViewMode] = useState<"STAFF" | "TEAM">("TEAM");
  const [viewModeInitialized, setViewModeInitialized] = useState(false);
  const [isManagerRole, setIsManagerRole] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [sessionUserName, setSessionUserName] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // ===================== STATE TAB TOÀN ĐỘI (TEAM) - BỘ LỌC THEO THÁNG & TUẦN =====================
  // ===================== STATE TAB TOÀN ĐỘI (TEAM) - BỘ LỌC THEO TUẦN (WEEKPICKER) =====================
  const [teamYear, setTeamYear] = useState<number>(currentRealYear);
  const [teamWeekNumber, setTeamWeekNumber] = useState<number>(currentRealWeek);

  const [teamWeekConfig, setTeamWeekConfig] = useState<WeekConfig | null>(null);
  const [teamWeekRange, setTeamWeekRange] = useState({ start: "", end: "" });
  const [teamShifts, setTeamShifts] = useState<ShiftItem[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFilterStatus, setTeamFilterStatus] = useState<TeamFilterStatus>("ALL");

  const teamWeekInfo = useMemo(() => {
    return { weekNumber: teamWeekNumber, year: teamYear };
  }, [teamWeekNumber, teamYear]);

  // Thống kê số lượng theo 3 trạng thái duyệt ca của toàn đội
  const teamStatusCounts = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let notRegisteredCount = 0;

    for (const user of teamUsers) {
      const userShifts = teamShifts.filter((s) => s.userId === user.id);
      if (userShifts.length === 0) {
        notRegisteredCount++;
      } else {
        const hasPending = userShifts.some((s) => s.status === "REGISTERED");
        if (hasPending) {
          pendingCount++;
        } else {
          approvedCount++;
        }
      }
    }

    return {
      all: teamUsers.length,
      pending: pendingCount,
      approved: approvedCount,
      notRegistered: notRegisteredCount,
    };
  }, [teamUsers, teamShifts]);

  // Lọc danh sách nhân sự theo bộ lọc trạng thái
  const filteredTeamUsers = useMemo(() => {
    if (teamFilterStatus === "PENDING") {
      return teamUsers.filter((u) => {
        const userShifts = teamShifts.filter((s) => s.userId === u.id);
        return userShifts.length > 0 && userShifts.some((s) => s.status === "REGISTERED");
      });
    }
    if (teamFilterStatus === "APPROVED") {
      return teamUsers.filter((u) => {
        const userShifts = teamShifts.filter((s) => s.userId === u.id);
        return userShifts.length > 0 && !userShifts.some((s) => s.status === "REGISTERED");
      });
    }
    if (teamFilterStatus === "NOT_REGISTERED") {
      return teamUsers.filter((u) => {
        const userShifts = teamShifts.filter((s) => s.userId === u.id);
        return userShifts.length === 0;
      });
    }
    return teamUsers;
  }, [teamUsers, teamShifts, teamFilterStatus]);

  // Về tuần hiện tại cho Tab Quản lý Toàn Đội
  const handleCurrentTeamWeek = () => {
    setTeamYear(currentRealYear);
    setTeamWeekNumber(currentRealWeek);
  };

  const teamWeekDays = useMemo(() => {
    if (!teamWeekRange.start) return [];
    const [y, m, d] = teamWeekRange.start.slice(0, 10).split("-").map(Number);
    return DAYS_OF_WEEK.map((dayItem, index) => {
      const date = new Date(Date.UTC(y, m - 1, d + index));
      const dateStr = date.toISOString().slice(0, 10);
      return {
        ...dayItem,
        date,
        dateStr,
        displayDate: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
      };
    });
  }, [teamWeekRange.start]);

  // ===================== STATE TAB CÁ NHÂN / SỬA CA (STAFF) =====================
  const [staffWeekOffset, setStaffWeekOffset] = useState(0);
  const [staffWeekConfig, setStaffWeekConfig] = useState<WeekConfig | null>(null);
  const [staffWeekRange, setStaffWeekRange] = useState({ start: "", end: "" });
  const [myShifts, setMyShifts] = useState<ShiftItem[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Chế độ xem cá nhân: "MATRIX" (Bảng ma trận tuần tối ưu Desktop) hoặc "DAY" (Thẻ lớn theo ngày - chuẩn Mobile & Tablet)
  const [staffViewType, setStaffViewType] = useState<"DAY" | "MATRIX">("MATRIX");

  // Tự động nhận diện thiết bị: Desktop (>= 1024px) mặc định MATRIX, Mobile & Tablet (< 1024px) mặc định DAY
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 1024) {
        setStaffViewType("DAY");
      } else {
        setStaffViewType("MATRIX");
      }
    }
  }, []);
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);
  const todayIsoStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const staffWeekInfo = useMemo(() => {
    return getWeekAndYearFromOffset(staffWeekOffset);
  }, [staffWeekOffset]);

  const staffWeekDays = useMemo(() => {
    if (!staffWeekRange.start) return [];
    const [y, m, d] = staffWeekRange.start.slice(0, 10).split("-").map(Number);
    return DAYS_OF_WEEK.map((dayItem, index) => {
      const date = new Date(Date.UTC(y, m - 1, d + index));
      const dateStr = date.toISOString().slice(0, 10);
      return {
        ...dayItem,
        date,
        dateStr,
        displayDate: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
      };
    });
  }, [staffWeekRange.start]);

  // Tự động nhảy đến ngày hôm nay nếu nằm trong tuần đang xem
  useEffect(() => {
    if (staffWeekDays.length > 0) {
      const foundIdx = staffWeekDays.findIndex((d) => d.dateStr === todayIsoStr);
      if (foundIdx !== -1) {
        setActiveDayIdx(foundIdx);
      } else {
        setActiveDayIdx(0);
      }
    }
  }, [staffWeekDays, todayIsoStr]);

  // ===================== STATE BỘ LỌC THÁNG CHO TAB SỬA CA (QUẢN LÝ) =====================
  const staffThursday = useMemo(() => {
    const monday = getWeekRange(staffWeekInfo.weekNumber, staffWeekInfo.year).monday;
    return new Date(monday.getTime() + 3 * 86400000);
  }, [staffWeekInfo]);

  const [staffFilterMonth, setStaffFilterMonth] = useState<number>(() => {
    const now = new Date();
    return now.getMonth() + 1;
  });
  const [staffFilterYear, setStaffFilterYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  // Tự động đồng bộ tháng/năm khi tuần thay đổi
  useEffect(() => {
    setStaffFilterMonth(staffThursday.getUTCMonth() + 1);
    setStaffFilterYear(staffThursday.getUTCFullYear());
  }, [staffThursday]);

  // Danh sách các tuần trong tháng đang chọn
  const weeksInStaffMonth = useMemo(() => {
    return getWeeksInMonth(staffFilterMonth, staffFilterYear);
  }, [staffFilterMonth, staffFilterYear]);

  // Chuyển nhanh đến tuần được chỉ định
  const handleSelectStaffWeek = useCallback(
    (targetWeek: number, targetYear: number) => {
      const targetMonday = getWeekRange(targetWeek, targetYear).monday;
      const currentRealMonday = getWeekRange(currentRealWeek, currentRealYear).monday;
      const diffDays = Math.round((targetMonday.getTime() - currentRealMonday.getTime()) / 86400000);
      const offset = Math.round(diffDays / 7);
      setStaffWeekOffset(offset);
    },
    [currentRealWeek, currentRealYear]
  );

  // Xử lý khi Quản lý đổi tháng ở MonthPicker
  const handleStaffMonthChange = useCallback(
    (newMonth: number, newYear: number) => {
      setStaffFilterMonth(newMonth);
      setStaffFilterYear(newYear);
      const weeks = getWeeksInMonth(newMonth, newYear);
      const exists = weeks.find((w) => w.weekNumber === staffWeekInfo.weekNumber && w.year === staffWeekInfo.year);
      if (exists) {
        handleSelectStaffWeek(exists.weekNumber, exists.year);
      } else if (weeks.length > 0) {
        const currentInMonth = weeks.find((w) => w.isCurrentWeek);
        const target = currentInMonth || weeks[0];
        handleSelectStaffWeek(target.weekNumber, target.year);
      }
    },
    [staffWeekInfo, handleSelectStaffWeek]
  );

  // Modals & UI states
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveShiftId, setLeaveShiftId] = useState<number | null>(null);
  const [leaveReason, setLeaveReason] = useState("");

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Khởi tạo Session User Info
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const sessionData = await res.json();
        if (sessionData?.user?.userId) {
          const myId = sessionData.user.userId;
          setCurrentUserId(myId);
          setSessionUserName(sessionData.user.fullName || "Nhân sự");
          if (!selectedStaffId) {
            setSelectedStaffId(myId);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải session:", err);
      }
    };
    initSession();
  }, [selectedStaffId]);

  // Thống kê & tính toán trạng thái cho Tab Cá Nhân / Sửa Ca
  const myTotalShifts = myShifts.length;
  const myPendingCount = useMemo(() => myShifts.filter((s) => s.status === "REGISTERED").length, [myShifts]);
  const myApprovedCount = useMemo(() => myShifts.filter((s) => s.status === "APPROVED").length, [myShifts]);

  const staffComputedStatus = useMemo(() => {
    if (myTotalShifts === 0) return "NOT_REGISTERED";
    if (myPendingCount > 0) return "PENDING";
    if (myApprovedCount > 0) return "APPROVED";
    return "NOT_REGISTERED";
  }, [myTotalShifts, myPendingCount, myApprovedCount]);

  // Fetch dữ liệu cho TAB TOÀN ĐỘI (TEAM)
  const fetchTeamShifts = useCallback(async (targetWeek = teamWeekNumber, targetYear = teamYear) => {
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/shifts?weekNumber=${targetWeek}&year=${targetYear}`);
      if (!res.ok) throw new Error("Không thể tải thông tin ca toàn đội");

      const data = await res.json();
      setTeamWeekConfig(data.config);
      setTeamWeekRange({ start: data.weekStartDate, end: data.weekEndDate });
      setIsManagerRole(data.isManager);

      if (data.isManager) {
        setTeamShifts(data.shifts || []);
        setTeamUsers(data.users || []);
        if (!viewModeInitialized) {
          setViewMode("TEAM");
          setViewModeInitialized(true);
        }
      } else {
        if (!viewModeInitialized) {
          setViewMode("STAFF");
          setViewModeInitialized(true);
        }
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setTeamLoading(false);
    }
  }, [teamWeekNumber, teamYear, viewModeInitialized]);

  // Fetch dữ liệu cho TAB CÁ NHÂN / SỬA CA (STAFF)
  const fetchStaffShifts = useCallback(async (targetOffset = staffWeekOffset, targetStaffId = selectedStaffId) => {
    setStaffLoading(true);
    try {
      const { weekNumber: calcWeek, year: calcYear } = getWeekAndYearFromOffset(targetOffset);
      const res = await fetch(`/api/shifts?weekNumber=${calcWeek}&year=${calcYear}`);
      if (!res.ok) throw new Error("Không thể tải lịch ca cá nhân");

      const data = await res.json();
      setStaffWeekConfig(data.config);
      setStaffWeekRange({ start: data.weekStartDate, end: data.weekEndDate });
      setIsManagerRole(data.isManager);

      if (data.isManager) {
        const effectiveId = targetStaffId || currentUserId;
        const filteredShifts = (data.shifts || []).filter((s: ShiftItem) => s.userId === effectiveId);
        setMyShifts(filteredShifts);
      } else {
        setMyShifts(data.shifts || []);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setStaffLoading(false);
    }
  }, [staffWeekOffset, selectedStaffId, currentUserId]);

  // Kích hoạt fetch khi tuần TEAM thay đổi
  useEffect(() => {
    fetchTeamShifts(teamWeekNumber, teamYear);
  }, [teamWeekNumber, teamYear, fetchTeamShifts]);

  // Kích hoạt fetch khi tuần STAFF hoặc người được chọn thay đổi
  useEffect(() => {
    fetchStaffShifts(staffWeekOffset, selectedStaffId);
  }, [staffWeekOffset, selectedStaffId, fetchStaffShifts]);

  // Quản lý chọn nhân sự khác để xem / sửa ca trong tab STAFF
  const handleSelectStaff = (userId: number) => {
    setSelectedStaffId(userId);
    const staffName = teamUsers.find((u) => u.id === userId)?.fullName || "nhân sự";
    showToast(`Đã chọn lịch ca của ${staffName}`, "success");
  };

  // Quản lý bấm "Sửa ca" trực tiếp từ Ma Trận Toàn Đội (TEAM)
  const handleEditStaffFromTeam = (userId: number) => {
    setSelectedStaffId(userId);
    // Đồng bộ tuần của Tab TEAM sang Tab STAFF để sửa đúng tuần Quản lý đang duyệt
    const targetDateOfTeamWeek = getWeekRange(teamWeekNumber, teamYear).monday;
    const currentDateOfRealWeek = getWeekRange(currentRealWeek, currentRealYear).monday;
    const diffDays = Math.round((targetDateOfTeamWeek.getTime() - currentDateOfRealWeek.getTime()) / 86400000);
    const offsetWeeks = Math.round(diffDays / 7);
    setStaffWeekOffset(offsetWeeks);

    setViewMode("STAFF");
    const staffName = teamUsers.find((u) => u.id === userId)?.fullName || "nhân sự";
    showToast(`Đang chỉnh sửa ca của ${staffName} (Tuần ${teamWeekInfo.weekNumber})`, "success");
  };

  // Handle Select / Deselect Shift in Staff View
  const handleToggleShift = (dateStr: string, shiftType: ShiftType) => {
    if (staffWeekConfig?.isLockedForUser && !isManagerRole) {
      showToast("Tuần này đã khóa đăng ký! Vui lòng liên hệ Quản lý để mở quyền.", "error");
      return;
    }

    const occupancyKey = `${dateStr}_${shiftType}`;
    const currentOccupancy = staffWeekConfig?.shiftOccupancy?.[occupancyKey] || 0;
    const maxUsers = staffWeekConfig?.maxUsersPerShift || 10;
    const isCurrentlySelected = myShifts.some(
      (s) => s.shiftDate.slice(0, 10) === dateStr && s.shiftType === shiftType
    );

    if (!isCurrentlySelected && !isManagerRole && currentOccupancy >= maxUsers) {
      const parts = dateStr.split("-");
      const displayDate = parts.length === 3 ? `${parseInt(parts[2])}/${parseInt(parts[1])}` : dateStr;
      const shiftName = SHIFT_INFO[shiftType]?.label || shiftType;
      showToast(`Rất tiếc! ${shiftName} ngày ${displayDate} đã đủ ${currentOccupancy}/${maxUsers} người. Vui lòng chọn ca hoặc ngày khác!`, "error");
      return;
    }

    setMyShifts((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.shiftDate.slice(0, 10) === dateStr && s.shiftType === shiftType
      );

      // Nếu đã chọn ca này -> bỏ chọn
      if (existingIndex >= 0) {
        return prev.filter((_, idx) => idx !== existingIndex);
      }

      const isBeforeSept2026 = dateStr < "2026-09-01";
      const sameDayShifts = prev.filter((s) => s.shiftDate.slice(0, 10) === dateStr);
      const targetUserId = isManagerRole && selectedStaffId ? selectedStaffId : currentUserId;

      // Tháng 8/2026 hoặc trước đó: Cho phép đăng ký nhiều ca trong 1 ngày (không giới hạn, tối đa 3 ca)
      if (isBeforeSept2026) {
        if (sameDayShifts.length >= 3) {
          showToast("Mỗi ngày tối đa 3 ca làm việc (Sáng, Chiều, Tối)!", "warning");
          return prev;
        }

        const newShift: ShiftItem = {
          shiftDate: dateStr,
          shiftType,
          workMode: "ONLINE",
          status: "REGISTERED",
          userId: targetUserId || undefined,
        };

        return [...prev, newShift];
      }

      // Từ Tháng 09/2026 trở đi: Áp dụng chính sách chuẩn 1 ca/ngày (chuyển đổi ca trong ngày)
      const sameDayShift = sameDayShifts[0];
      const filtered = prev.filter((s) => s.shiftDate.slice(0, 10) !== dateStr);

      const newShift: ShiftItem = {
        shiftDate: dateStr,
        shiftType,
        workMode: "ONLINE",
        status: "REGISTERED",
        userId: targetUserId || undefined,
      };

      return [...filtered, newShift];
    });
  };

  // Toggle Work Mode Online <-> Offline
  const handleToggleWorkMode = (e: React.MouseEvent, dateStr: string, shiftType: ShiftType) => {
    e.stopPropagation();
    if (staffWeekConfig?.isLockedForUser && !isManagerRole) return;

    setMyShifts((prev) =>
      prev.map((s) => {
        if (s.shiftDate.slice(0, 10) === dateStr && s.shiftType === shiftType) {
          return {
            ...s,
            workMode: s.workMode === "ONLINE" ? "OFFLINE" : "ONLINE",
          };
        }
        return s;
      })
    );
  };

  // Rule 1: Tối đa 1 ca / ngày
  const ruleMaxOnePerDay = useMemo(() => {
    const dates = myShifts.map((s) => s.shiftDate.slice(0, 10));
    return new Set(dates).size === dates.length;
  }, [myShifts]);

  // Rule 2: Số ca đăng ký (Đã bỏ quy định ca tối thiểu)
  const ruleMinShifts = myShifts.length > 0;

  // Rule 3: Hình thức làm việc theo quy định mới: 100% Online từ xa (không còn làm việc Offline tại văn phòng)
  const isAllOnline = useMemo(() => {
    return myShifts.every((s) => s.workMode === "ONLINE");
  }, [myShifts]);

  const isEditingOtherUser = Boolean(isManagerRole && selectedStaffId && selectedStaffId !== currentUserId);
  const isLockedForSubmit = isManagerRole ? false : staffWeekConfig?.isLockedForUser;
  // Cho phép lưu khi thỏa mãn tối đa 1 ca / ngày và đã chọn ít nhất 1 ca (các tiêu chí khác chỉ hiển thị theo dõi)
  const canSubmitShifts = ruleMaxOnePerDay && myShifts.length > 0 && !isLockedForSubmit;

  // Submit Shifts
  const handleSaveShifts = async () => {
    if (!canSubmitShifts) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shifts/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: staffWeekInfo.weekNumber,
          year: staffWeekInfo.year,
          targetUserId: isEditingOtherUser ? selectedStaffId : undefined,
          shifts: myShifts.map((s) => ({
            shiftDate: s.shiftDate.slice(0, 10),
            shiftType: s.shiftType,
            workMode: s.workMode,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.fullShifts && Array.isArray(data.fullShifts)) {
          await alertModal({
            title: "Không thể lưu ca làm việc",
            message: `⚠️ ĐÃ ĐỦ SỐ LƯỢNG NGƯỜI ĐĂNG KÝ:\n\n${data.error}\n\nVui lòng kiểm tra lại ma trận và chọn ca khác!`,
            type: "danger",
          });
        }
        throw new Error(data.error || "Không thể lưu ca");
      }

      showToast(data.message || "Đã lưu lịch ca thành công!");
      fetchStaffShifts();
      // Nếu tuần staff trùng tuần team thì cập nhật cả team
      if (staffWeekInfo.weekNumber === teamWeekInfo.weekNumber && staffWeekInfo.year === teamWeekInfo.year) {
        fetchTeamShifts();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Manager Action: Duyệt toàn bộ ca tuần
  const handleApproveWeek = async () => {
    const isConfirmed = await confirmModal({
      title: "Xác nhận duyệt ca tuần",
      message: `Xác nhận duyệt toàn bộ ca làm việc cho tuần ${teamWeekInfo.weekNumber}?`,
      confirmText: "Duyệt tất cả",
      cancelText: "Hủy",
      type: "primary",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch("/api/shifts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE_WEEK",
          weekNumber: teamWeekInfo.weekNumber,
          year: teamWeekInfo.year,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      fetchTeamShifts();
      if (staffWeekInfo.weekNumber === teamWeekInfo.weekNumber && staffWeekInfo.year === teamWeekInfo.year) {
        fetchStaffShifts();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Manager Action: Khóa / Mở form đăng ký tuần
  const handleToggleLock = async () => {
    try {
      const isCurrentlyLocked = Boolean(teamWeekConfig?.isWeekLocked ?? teamWeekConfig?.isLocked);
      const res = await fetch("/api/shifts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_LOCK",
          weekNumber: teamWeekInfo.weekNumber,
          year: teamWeekInfo.year,
          newLockState: !isCurrentlyLocked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      await fetchTeamShifts(teamWeekInfo.weekNumber, teamWeekInfo.year);
      if (staffWeekInfo.weekNumber === teamWeekInfo.weekNumber && staffWeekInfo.year === teamWeekInfo.year) {
        fetchStaffShifts();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Manager Action: Mở / Thu hồi quyền nộp bù cho nhân sự
  const handleToggleReopenUser = async (targetUserId: number, userName: string, isCurrentlyReopened: boolean) => {
    const confirmMessage = isCurrentlyReopened
      ? `Thu hồi quyền sửa ca / khóa lại tuần ${teamWeekInfo.weekNumber} của ${userName}?`
      : `Mở khóa cho phép ${userName} nộp bù / chỉnh sửa ca tuần ${teamWeekInfo.weekNumber}?`;

    const isConfirmed = await confirmModal({
      title: isCurrentlyReopened ? "Thu hồi quyền nộp bù" : "Mở quyền nộp bù ca",
      message: confirmMessage,
      confirmText: isCurrentlyReopened ? "Khóa lại" : "Mở nộp bù",
      cancelText: "Hủy",
      type: isCurrentlyReopened ? "danger" : "warning",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch("/api/shifts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REOPEN_USER",
          weekNumber: teamWeekInfo.weekNumber,
          year: teamWeekInfo.year,
          targetUserId,
          revoke: isCurrentlyReopened,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || "Thao tác thất bại"));
      showToast(data.message);
      fetchTeamShifts();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Submit Xin Nghỉ Phép Ca
  const handleConfirmLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveShiftId) return;

    try {
      const res = await fetch("/api/shifts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_LEAVE",
          shiftId: leaveShiftId,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message);
      if (data.warning) {
        await alertModal({
          title: "Cảnh báo chỉ tiêu",
          message: data.warning,
          type: "warning",
        });
      }

      setIsLeaveModalOpen(false);
      setLeaveShiftId(null);
      setLeaveReason("");
      fetchStaffShifts();
      if (staffWeekInfo.weekNumber === teamWeekInfo.weekNumber && staffWeekInfo.year === teamWeekInfo.year) {
        fetchTeamShifts();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className="app-toast-container">
          <div className={`app-toast ${toast.type}`}>
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header & Underline Tabs Navigation (Giống hình 2) */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "1.25rem",
          paddingBottom: "0.25rem",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ paddingBottom: "0.5rem" }}>
          <h1 className="page-title">Đăng Ký & Quản Lý Ca Làm Việc</h1>
          <p className="page-subtitle">
            Hệ thống Matrix ca tuần (Sáng - Chiều - Tối) với ràng buộc tự động & quy chuẩn Freetrip
          </p>
        </div>

        {/* Tab menu page-header chuẩn theo Hình 2 */}
        {isManagerRole && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "2rem",
            }}
          >
            {/* TAB 1: TOÀN BỘ NHÂN SỰ */}
            <button
              type="button"
              onClick={() => setViewMode("TEAM")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
                padding: "0.5rem 0.25rem 0.75rem 0.25rem",
                fontSize: "0.9375rem",
                fontWeight: viewMode === "TEAM" ? 700 : 500,
                color: viewMode === "TEAM" ? "var(--primary)" : "var(--text-secondary)",
                borderBottom: viewMode === "TEAM" ? "2.5px solid var(--primary)" : "2.5px solid transparent",
                transition: "all 0.2s ease",
                position: "relative",
                marginBottom: "-1px",
              }}
            >
              <Users size={18} color={viewMode === "TEAM" ? "var(--primary)" : "var(--text-secondary)"} />
              <span>Toàn bộ nhân sự</span>
              
              {/* Badge số nhân sự chờ duyệt ca */}
              {teamStatusCounts.pending > 0 ? (
                <span
                  style={{
                    background: "#f59e0b",
                    color: "#000",
                    fontWeight: 800,
                    fontSize: "0.6875rem",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    lineHeight: 1.2,
                    boxShadow: "0 0 8px rgba(245, 158, 11, 0.4)",
                  }}
                  title={`Có ${teamStatusCounts.pending} nhân sự đang chờ duyệt ca`}
                >
                  {teamStatusCounts.pending}
                </span>
              ) : teamWeekConfig?.approvedAt ? (
                <span
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "var(--success)",
                    fontWeight: 700,
                    fontSize: "0.6875rem",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    lineHeight: 1.2,
                  }}
                  title="Tuần này đã được duyệt chốt"
                >
                  ✓ Đã duyệt
                </span>
              ) : null}
            </button>

            {/* TAB 2: LỊCH ĐĂNG KÝ CÁ NHÂN / SỬA CA */}
            <button
              type="button"
              onClick={() => setViewMode("STAFF")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
                padding: "0.5rem 0.25rem 0.75rem 0.25rem",
                fontSize: "0.9375rem",
                fontWeight: viewMode === "STAFF" ? 700 : 500,
                color: viewMode === "STAFF" ? "var(--primary)" : "var(--text-secondary)",
                borderBottom: viewMode === "STAFF" ? "2.5px solid var(--primary)" : "2.5px solid transparent",
                transition: "all 0.2s ease",
                position: "relative",
                marginBottom: "-1px",
              }}
            >
              <Calendar size={18} color={viewMode === "STAFF" ? "var(--primary)" : "var(--text-secondary)"} />
              <span>Lịch Đăng Ký Cá Nhân / Sửa Ca</span>

              {/* Badge trạng thái ca cá nhân */}
              <span
                style={{
                  background:
                    staffComputedStatus === "APPROVED"
                      ? "rgba(34, 197, 94, 0.15)"
                      : staffComputedStatus === "PENDING"
                      ? "rgba(245, 158, 11, 0.15)"
                      : "rgba(148, 163, 184, 0.12)",
                  color:
                    staffComputedStatus === "APPROVED"
                      ? "var(--success)"
                      : staffComputedStatus === "PENDING"
                      ? "#f59e0b"
                      : "var(--text-muted)",
                  border: `1px solid ${
                    staffComputedStatus === "APPROVED"
                      ? "rgba(34, 197, 94, 0.3)"
                      : staffComputedStatus === "PENDING"
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(148, 163, 184, 0.2)"
                  }`,
                  fontWeight: 700,
                  fontSize: "0.6875rem",
                  padding: "1px 7px",
                  borderRadius: "999px",
                  lineHeight: 1.2,
                }}
                title={
                  staffComputedStatus === "APPROVED"
                    ? "Lịch đã được duyệt"
                    : staffComputedStatus === "PENDING"
                    ? `Lịch đang chờ duyệt (${myPendingCount} ca)`
                    : `Đã chọn ${myShifts.length} ca`
                }
              >
                {staffComputedStatus === "APPROVED"
                  ? `Đã duyệt (${myShifts.length} ca)`
                  : staffComputedStatus === "PENDING"
                  ? `Chờ duyệt (${myPendingCount} ca)`
                  : myShifts.length > 0
                  ? `${myShifts.length} ca`
                  : "Chưa đăng ký"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FILTER TUẦN CHUẨN PAGE KPI CHO TAB 1: TOÀN BỘ NHÂN SỰ (TEAM)              */}
      {/* ========================================================================= */}
      {viewMode === "TEAM" && (
        <div
          className="card"
          style={{
            padding: "0.875rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          {/* 1. Bộ lọc tuần chuẩn giống Page KPI */}
          <WeekPicker
            selectedWeek={teamWeekNumber}
            selectedYear={teamYear}
            onWeekChange={(week, year) => {
              setTeamWeekNumber(week);
              setTeamYear(year);
            }}
            onCurrentWeekClick={handleCurrentTeamWeek}
            onRefreshClick={() => fetchTeamShifts(teamWeekNumber, teamYear)}
            loading={teamLoading}
          />

          {/* 2. Action Toolbar Quản Lý (Trạng thái tuần, Khóa/Mở form, Duyệt chốt ca) */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {(!teamWeekConfig?.isWeekLocked && !teamWeekConfig?.isLocked) ? (
              <span className="badge badge-info" title={teamWeekConfig?.formattedCloseVN ? `Thời gian khóa form: ${teamWeekConfig.formattedCloseVN}` : undefined}>
                <Clock size={14} /> Đang mở đăng ký {teamWeekConfig?.formattedCloseVN ? `(đến ${teamWeekConfig.formattedCloseVN})` : ""}
              </span>
            ) : teamStatusCounts.pending > 0 ? (
              <span className="badge badge-warning">
                <Clock size={14} /> Có {teamStatusCounts.pending} nhân sự chờ duyệt
              </span>
            ) : teamWeekConfig?.approvedAt ? (
              <span className="badge badge-success" title="Lịch ca đã được duyệt (hoặc tự động duyệt khi hết hạn đăng ký)">
                <ShieldCheck size={14} /> Toàn đội đã duyệt {teamWeekConfig?.autoApproved ? "★ Tự động" : ""}
              </span>
            ) : (
              <span className="badge badge-danger" title={teamWeekConfig?.formattedCloseVN ? `Đã hết hạn đăng ký (${teamWeekConfig.formattedCloseVN})` : undefined}>
                <Lock size={14} /> Đã khóa đăng ký {teamWeekConfig?.formattedCloseVN ? `(${teamWeekConfig.formattedCloseVN})` : ""}
              </span>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleToggleLock}
              title="Khóa hoặc Mở khóa form đăng ký ca tuần"
            >
              {(teamWeekConfig?.isWeekLocked ?? teamWeekConfig?.isLocked) ? (
                <>
                  <Unlock size={15} color="var(--success)" /> Mở Khóa Đăng Ký
                </>
              ) : (
                <>
                  <Lock size={15} color="var(--danger)" /> Khóa Đăng Ký Ca
                </>
              )}
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleApproveWeek}
              title="Duyệt toàn bộ ca tuần"
            >
              <FileCheck size={15} /> Duyệt Toàn Bộ
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FILTER TUẦN RIÊNG BIỆT CHO TAB 2: LỊCH CÁ NHÂN / SỬA CA (STAFF)          */}
      {/* ========================================================================= */}
      {viewMode === "STAFF" && (
        <div className="card shift-week-toolbar">
          {isManagerRole ? (
            /* Dành cho Quản lý điều chỉnh tuần */
            <div className="shift-week-toolbar-top">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setStaffWeekOffset((prev) => prev - 1)}
                  title="Tuần trước"
                  style={{
                    height: "36px",
                    width: "36px",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setStaffWeekOffset((prev) => prev + 1)}
                  title="Tuần sau"
                  style={{
                    height: "36px",
                    width: "36px",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                  }}
                >
                  <ChevronRight size={16} />
                </button>

                <MonthPicker
                  selectedMonth={staffFilterMonth}
                  selectedYear={staffFilterYear}
                  onChange={handleStaffMonthChange}
                  disabled={staffLoading}
                />

                <select
                  className="input input-sm"
                  value={staffWeekInfo.weekNumber}
                  onChange={(e) => {
                    const targetWeekNum = Number(e.target.value);
                    const selectedOption = weeksInStaffMonth.find((w) => w.weekNumber === targetWeekNum);
                    if (selectedOption) {
                      handleSelectStaffWeek(selectedOption.weekNumber, selectedOption.year);
                    }
                  }}
                  style={{
                    height: "36px",
                    padding: "0 2rem 0 0.875rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    minWidth: "220px",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                  title="Chọn tuần trong tháng"
                >
                  {weeksInStaffMonth.map((w) => (
                    <option key={w.weekNumber} value={w.weekNumber}>
                      {w.label} {w.isCurrentWeek ? " ★ [Hiện tại]" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setStaffWeekOffset(0)}
                  className={`btn btn-sm ${staffWeekOffset === 0 ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    borderRadius: "8px",
                    borderColor: staffWeekOffset === 0 ? "var(--primary)" : "var(--border-color)",
                  }}
                  title="Chuyển nhanh về tuần làm việc hiện tại"
                >
                  <Calendar size={14} />
                  <span>Tuần này</span>
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span className="badge badge-info">
                  Tuần {staffWeekInfo.weekNumber} ({staffWeekDays[0]?.displayDate} → {staffWeekDays[6]?.displayDate})
                </span>
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => fetchStaffShifts(staffWeekOffset, selectedStaffId)}
                  title="Tải lại dữ liệu ca"
                >
                  <RefreshCw size={16} className={staffLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          ) : (
            /* Dành cho Nhân sự Remote (Tối ưu chuẩn UX Mobile & Tablet) */
            <>
              {/* Row 1: Điều hướng tuần chính */}
              <div className="shift-week-toolbar-top">
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setStaffWeekOffset((prev) => prev - 1)}
                      title="Xem tuần trước"
                      style={{
                        height: "34px",
                        padding: "0 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.8125rem",
                        borderRadius: "8px",
                      }}
                    >
                      <ChevronLeft size={15} /> <span>Tuần trước</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setStaffWeekOffset((prev) => prev + 1)}
                      title="Xem tuần kế tiếp"
                      style={{
                        height: "34px",
                        padding: "0 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.8125rem",
                        borderRadius: "8px",
                      }}
                    >
                      <span>Tuần kế</span> <ChevronRight size={15} />
                    </button>
                  </div>

                  {/* Thông tin tuần & Ngày */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                      Tuần {staffWeekInfo.weekNumber} / {staffWeekInfo.year}
                    </span>
                    {staffWeekOffset === 0 && (
                      <span className="badge badge-primary" style={{ fontSize: "0.6875rem", padding: "2px 7px" }}>
                        Hiện tại
                      </span>
                    )}
                    {staffWeekOffset === 1 && (
                      <span className="badge badge-info" style={{ fontSize: "0.6875rem", padding: "2px 7px" }}>
                        Mở đăng ký
                      </span>
                    )}
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      ({staffWeekDays[0]?.displayDate} → {staffWeekDays[6]?.displayDate})
                    </span>
                  </div>
                </div>

                {/* Quick Toggle Tuần Này / Tuần Tới */}
                <div
                  style={{
                    display: "inline-flex",
                    background: "var(--bg-secondary)",
                    padding: "3px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    gap: "4px",
                  }}
                >
                  <button
                    type="button"
                    className={`btn btn-sm ${staffWeekOffset === 0 ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setStaffWeekOffset(0)}
                    style={{ fontSize: "0.8125rem", padding: "4px 10px", borderRadius: "6px", fontWeight: 600 }}
                  >
                    Tuần Này (T{currentRealWeek})
                  </button>

                  <button
                    type="button"
                    className={`btn btn-sm ${staffWeekOffset === 1 ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setStaffWeekOffset(1)}
                    style={{
                      fontSize: "0.8125rem",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>Tuần Tới (T{nextRealWeek})</span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: staffWeekOffset === 1 ? "rgba(255,255,255,0.25)" : "rgba(59, 130, 246, 0.2)",
                        color: staffWeekOffset === 1 ? "#fff" : "var(--info)",
                      }}
                    >
                      Đăng ký
                    </span>
                  </button>
                </div>
              </div>

              {/* Row 2: Status Badges & Action Toolbar */}
              <div className="shift-week-toolbar-bottom">
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                  {/* Badge Trạng thái lịch ca */}
                  {staffComputedStatus === "APPROVED" ? (
                    <span className="badge badge-success">
                      <ShieldCheck size={14} /> Lịch đã duyệt ({myApprovedCount} ca)
                    </span>
                  ) : staffComputedStatus === "PENDING" ? (
                    <span className="badge badge-warning">
                      <Clock size={14} /> Đang chờ duyệt ({myPendingCount} ca)
                    </span>
                  ) : (
                    <span className="badge badge-neutral">
                      <AlertCircle size={14} /> Chưa đăng ký ca
                    </span>
                  )}

                  {/* Badge Trạng thái hạn tuần */}
                  {staffWeekConfig?.isReopenedUser && staffWeekConfig?.isWeekLocked ? (
                    <span className="badge badge-warning" title="Bạn được cấp quyền mở nộp bù / sửa ca">
                      <Unlock size={14} /> Đặc cách mở sửa
                    </span>
                  ) : staffWeekConfig?.isLockedForUser ? (
                    <span className="badge badge-danger" title={`Thời gian đăng ký ca cho tuần này đã kết thúc ${staffWeekConfig?.formattedCloseVN ? `(${staffWeekConfig.formattedCloseVN})` : ""}`}>
                      <Lock size={14} /> Tuần đã khóa {staffWeekConfig?.formattedCloseVN ? `(${staffWeekConfig.formattedCloseVN})` : ""}
                    </span>
                  ) : (
                    <span className="badge badge-info" title={staffWeekConfig?.formattedCloseVN ? `Form khóa đăng ký lúc ${staffWeekConfig.formattedCloseVN}` : "Form đăng ký đang mở"}>
                      <Clock size={14} /> Đang mở đăng ký {staffWeekConfig?.formattedCloseVN ? `(đến ${staffWeekConfig.formattedCloseVN})` : ""}
                    </span>
                  )}
                </div>

                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => fetchStaffShifts(staffWeekOffset, selectedStaffId)}
                  title="Tải lại dữ liệu ca"
                  style={{ width: "34px", height: "34px", borderRadius: "8px" }}
                >
                  <RefreshCw size={15} className={staffLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 1: STAFF MATRIX (Lịch Cá Nhân) */}
      {viewMode === "STAFF" && (
        <div className="shift-staff-layout">
          {/* Employee Selector for Manager */}
          {isManagerRole && (
            <div
              style={{
                gridColumn: "1 / -1",
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: "10px",
                padding: "0.875rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <UserCheck size={20} color="var(--primary)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                    {selectedStaffId && selectedStaffId !== currentUserId ? (
                      <>
                        Chế độ Quản lý điều chỉnh: Đang xem ca của{" "}
                        <span style={{ color: "var(--primary)" }}>
                          {teamUsers.find((u) => u.id === selectedStaffId)?.fullName || "Nhân sự"}
                        </span>
                      </>
                    ) : (
                      "Đang xem lịch ca cá nhân của bạn"
                    )}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Quản lý có thể chọn bất kỳ nhân sự nào để kiểm tra, bổ sung hoặc đổi ca (hệ thống sẽ tự động lưu log).
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Chọn nhân sự:</span>
                <select
                  className="input input-sm"
                  style={{ minWidth: "260px", fontWeight: 600 }}
                  value={selectedStaffId || currentUserId || ""}
                  onChange={(e) => handleSelectStaff(Number(e.target.value))}
                >
                  {currentUserId && (
                    <option value={currentUserId}>
                      👤 Cá nhân tôi ({sessionUserName || "Quản lý"})
                    </option>
                  )}
                  <optgroup label="Danh sách nhân sự Remote">
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.phone})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          )}

          {staffWeekConfig?.isReopenedUser && staffWeekConfig?.isWeekLocked && (
            <div
              style={{
                gridColumn: "1 / -1",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                color: "#d97706",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              <Unlock size={18} />
              <span>
                <strong>Đặc cách mở sửa lịch đăng ký ca:</strong> Quản lý đã cấp quyền cho phép bạn đăng ký hoặc điều chỉnh lịch ca tuần {staffWeekInfo.weekNumber}. <em>(Lưu ý: Quyền này chỉ áp dụng cho đăng ký lịch ca, không áp dụng cho nộp báo cáo link).</em> Vui lòng hoàn tất và bấm &quot;Lưu Lịch Đăng Ký Tuần&quot;!
              </span>
            </div>
          )}

          {/* Main Matrix / Day View Section */}
          <div className="card" style={{ padding: "1.25rem", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            {/* Header: Title & View Mode Switcher */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.125rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={18} color="var(--primary)" />
                  <span>Đăng Ký Ca Tuần {staffWeekInfo.weekNumber}</span>
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {staffViewType === "DAY"
                    ? "Chọn ngày và chạm trực tiếp vào ca để đăng ký / đổi chế độ làm việc"
                    : "Bảng tổng thể 7 ngày trong tuần"}
                </p>
              </div>

              {/* View Switcher: Theo ngày (Dễ bấm) vs Bảng ma trận */}
              <div
                style={{
                  display: "inline-flex",
                  background: "var(--bg-secondary)",
                  padding: "3px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  gap: "3px",
                }}
              >
                <button
                  type="button"
                  className={`btn btn-sm ${staffViewType === "DAY" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setStaffViewType("DAY")}
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  title="Chế độ theo ngày: Nút bấm to rõ, không cần cuộn ngang (chuẩn Mobile & Tablet)"
                >
                  <Calendar size={13} />
                  <span>Theo ngày (Dễ bấm)</span>
                </button>

                <button
                  type="button"
                  className={`btn btn-sm ${staffViewType === "MATRIX" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setStaffViewType("MATRIX")}
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  title="Chế độ ma trận tuần toàn diện"
                >
                  <Filter size={13} />
                  <span>Toàn tuần (Bảng)</span>
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* VIEW A: CHẾ ĐỘ LỊCH NGÀY THÔNG MINH (MOBILE & TABLET EXCELLENCE)         */}
            {/* ========================================================================= */}
            {staffViewType === "DAY" && (
              <div>
                {/* 1. Segmented Day Strip (7 Ngày trải ngang dàn đều) */}
                <div className="shift-day-strip">
                  {staffWeekDays.map((d, idx) => {
                    const isCurrentActive = activeDayIdx === idx;
                    const dayShifts = myShifts.filter((s) => s.shiftDate.slice(0, 10) === d.dateStr);
                    const hasRegistered = dayShifts.length > 0;

                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => setActiveDayIdx(idx)}
                        className={`shift-day-pill ${isCurrentActive ? "active" : ""} ${hasRegistered ? "has-shift" : ""}`}
                        title={`${d.name} (${d.displayDate}) - ${hasRegistered ? "Đã đăng ký ca" : "Chưa chọn ca"}`}
                      >
                        <span style={{ fontSize: "0.75rem", fontWeight: isCurrentActive ? 700 : 600 }}>
                          {d.short}
                        </span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, margin: "2px 0" }}>
                          {d.displayDate.split("/")[0]}
                        </span>
                        {hasRegistered ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "14px",
                              height: "14px",
                              borderRadius: "50%",
                              background: "var(--success)",
                              color: "#fff",
                              fontSize: "0.5625rem",
                              fontWeight: 800,
                            }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              background: isCurrentActive ? "var(--primary)" : "var(--text-dim)",
                              opacity: isCurrentActive ? 1 : 0.4,
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 2. Active Day Sub-header Navigation */}
                {staffWeekDays[activeDayIdx] && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.625rem 0.875rem",
                      background: "var(--bg-secondary)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-color)",
                      marginBottom: "1rem",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={activeDayIdx === 0}
                      onClick={() => setActiveDayIdx((prev) => Math.max(0, prev - 1))}
                      style={{ height: "32px", padding: "0 10px", display: "inline-flex", alignItems: "center", gap: "2px", borderRadius: "6px" }}
                      title="Xem ngày trước đó"
                    >
                      <ChevronLeft size={16} /> <span>Trước</span>
                    </button>

                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                        {staffWeekDays[activeDayIdx].name}, {staffWeekDays[activeDayIdx].displayDate}
                        {staffWeekDays[activeDayIdx].dateStr === todayIsoStr && (
                          <span className="badge badge-primary" style={{ marginLeft: "6px", fontSize: "0.625rem", padding: "1px 6px" }}>
                            Hôm nay
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color:
                            myShifts.some((s) => s.shiftDate.slice(0, 10) === staffWeekDays[activeDayIdx].dateStr)
                              ? "var(--success)"
                              : "var(--text-muted)",
                          marginTop: "1px",
                        }}
                      >
                        {myShifts.some((s) => s.shiftDate.slice(0, 10) === staffWeekDays[activeDayIdx].dateStr)
                          ? `✓ Đã đăng ký ca (${myShifts.find((s) => s.shiftDate.slice(0, 10) === staffWeekDays[activeDayIdx].dateStr)?.workMode})`
                          : "Chưa chọn ca cho ngày này (chạm bên dưới để chọn)"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={activeDayIdx === staffWeekDays.length - 1}
                      onClick={() => setActiveDayIdx((prev) => Math.min(staffWeekDays.length - 1, prev + 1))}
                      style={{ height: "32px", padding: "0 10px", display: "inline-flex", alignItems: "center", gap: "2px", borderRadius: "6px" }}
                      title="Xem ngày kế tiếp"
                    >
                      <span>Sau</span> <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {/* 3. 3 Thẻ Ca Lớn (Morning, Afternoon, Evening) */}
                {staffWeekDays[activeDayIdx] && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {(["MORNING", "AFTERNOON", "EVENING"] as ShiftType[]).map((type) => {
                      const activeDay = staffWeekDays[activeDayIdx];
                      const info = SHIFT_INFO[type];
                      const currentShift = myShifts.find(
                        (s) => s.shiftDate.slice(0, 10) === activeDay.dateStr && s.shiftType === type
                      );
                      const isSelected = !!currentShift;
                      const isOffline = currentShift?.workMode === "OFFLINE";
                      const isAbsent = currentShift?.status === "ABSENT";
                      const isApproved = currentShift?.status === "APPROVED";

                      const occupancyKey = `${activeDay.dateStr}_${type}`;
                      const occupancy = staffWeekConfig?.shiftOccupancy?.[occupancyKey] || 0;
                      const maxUsers = staffWeekConfig?.maxUsersPerShift || 10;
                      const isFull = !isSelected && !isManagerRole && occupancy >= maxUsers;
                      const isLocked = (staffWeekConfig?.isLockedForUser && !isManagerRole) || isFull;

                      return (
                        <div
                          key={type}
                          onClick={() => {
                            if (!isLocked) {
                              handleToggleShift(activeDay.dateStr, type);
                            }
                          }}
                          className={`large-shift-card ${
                            isSelected ? (isOffline ? "selected-offline" : "selected-online") : isFull ? "is-full" : ""
                          } ${isLocked ? "locked" : ""}`}
                          title={isLocked ? "Ca này đã bị khóa hoặc hết chỗ" : "Chạm để đăng ký hoặc chuyển đổi ONLINE/OFFLINE"}
                        >
                          {/* Left: Shift Icon & Information */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                            <div
                              style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "10px",
                                background: info.bgClass,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.375rem",
                                flexShrink: 0,
                                border: isSelected ? "1px solid var(--border-color)" : "none",
                              }}
                            >
                              {info.icon}
                            </div>

                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{info.label}</span>
                                {isApproved && (
                                  <span className="badge badge-success" style={{ fontSize: "0.625rem", padding: "1px 5px" }}>
                                    ✓ Đã duyệt
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "1px" }}>
                                {info.time}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: isFull ? "var(--danger)" : "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Users size={12} />
                                <span>{occupancy}/{maxUsers} đã đăng ký</span>
                                {isFull && <span style={{ fontWeight: 600 }}>• Đã đủ người</span>}
                              </div>
                            </div>
                          </div>

                          {/* Right: Big Touch Target Status Button */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {isSelected ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "8px 14px",
                                    borderRadius: "8px",
                                    background: isOffline ? "var(--primary)" : "var(--info)",
                                    color: "#fff",
                                    fontWeight: 700,
                                    fontSize: "0.8125rem",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                                  }}
                                >
                                  {isOffline ? <Building size={14} /> : <Laptop size={14} />}
                                  <span>{isOffline ? "OFFLINE" : "ONLINE"}</span>
                                  <Check size={14} />
                                </div>

                                {currentShift?.id && !staffWeekConfig?.isLockedForUser && !isAbsent && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLeaveShiftId(currentShift.id!);
                                      setIsLeaveModalOpen(true);
                                    }}
                                    title="Báo bận / Xin nghỉ ca"
                                    className="btn btn-danger btn-sm"
                                    style={{
                                      padding: "6px 10px",
                                      fontSize: "0.75rem",
                                      borderRadius: "6px",
                                    }}
                                  >
                                    Nghỉ
                                  </button>
                                )}
                              </div>
                            ) : isFull ? (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  background: "rgba(239, 68, 68, 0.12)",
                                  color: "var(--danger)",
                                  fontWeight: 600,
                                  fontSize: "0.75rem",
                                }}
                              >
                                <Lock size={13} />
                                <span>Hết chỗ</span>
                              </div>
                            ) : (
                              <div
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  fontWeight: 600,
                                  fontSize: "0.8125rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "var(--bg-secondary)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid var(--border-color)",
                                }}
                              >
                                <span>+ Chọn ca này</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW B: CHẾ ĐỘ MA TRẬN BẢNG TOÀN TUẦN (WEEKLY MATRIX TABLE)              */}
            {/* ========================================================================= */}
            {staffViewType === "MATRIX" && (
              <div
                className="custom-scroll"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehaviorX: "contain",
                  paddingBottom: "0.5rem",
                }}
              >
                {/* Scroll hint for mobile screens */}
                <div className="mobile-scroll-hint" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.625rem", alignItems: "center", gap: "6px" }}>
                  <span>👉</span>
                  <span>Kéo ngang để xem đầy đủ từ Thứ 2 đến Chủ Nhật (Cột Khung Ca luôn cố định)</span>
                </div>

                <div style={{ minWidth: "660px" }}>
                  {/* Header Days */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "115px repeat(7, minmax(0, 1fr))",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                      textAlign: "center",
                    }}
                  >
                    <div
                      className="shift-sticky-cell"
                      style={{
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        fontSize: "0.8125rem",
                        textAlign: "left",
                        paddingLeft: "10px",
                        display: "flex",
                        alignItems: "center",
                        background: "var(--bg-secondary)",
                        borderRadius: "10px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      Khung Ca
                    </div>
                    {staffWeekDays.map((d) => {
                      const isToday = d.dateStr === todayIsoStr;
                      const isWeekend = d.short === "T7" || d.short === "CN";
                      return (
                        <div
                          key={d.dateStr}
                          style={{
                            background: isToday
                              ? "rgba(249, 115, 22, 0.12)"
                              : isWeekend
                              ? "rgba(255, 255, 255, 0.03)"
                              : "var(--bg-secondary)",
                            padding: "0.625rem 0.25rem",
                            borderRadius: "10px",
                            border: isToday
                              ? "1.5px solid var(--primary)"
                              : "1px solid var(--border-color)",
                            boxShadow: isToday ? "0 0 12px rgba(249, 115, 22, 0.25)" : "none",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {isToday && (
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "0.625rem",
                                fontWeight: 800,
                                color: "var(--primary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                marginBottom: "2px",
                              }}
                            >
                              Hôm nay
                            </span>
                          )}
                          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: isToday ? "var(--primary)" : "var(--text-primary)" }}>
                            {d.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: isToday ? "var(--text-primary)" : "var(--text-muted)", marginTop: "1px" }}>
                            {d.displayDate}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rows: Morning, Afternoon, Evening */}
                  {(["MORNING", "AFTERNOON", "EVENING"] as ShiftType[]).map((type) => {
                    const info = SHIFT_INFO[type];
                    return (
                      <div
                        key={type}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "115px repeat(7, minmax(0, 1fr))",
                          gap: "0.5rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {/* Shift Label - STICKY COLUMN */}
                        <div
                          className="shift-sticky-cell"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            backgroundImage: `linear-gradient(${info.bgClass}, ${info.bgClass})`,
                            borderRadius: "10px",
                            padding: "0.875rem 0.625rem",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "0.875rem", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{info.icon}</span>
                            <span>{info.label}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px", whiteSpace: "nowrap", fontWeight: 500 }}>
                            {info.time}
                          </div>
                        </div>

                        {/* Day Cells */}
                        {staffWeekDays.map((day) => {
                          const currentShift = myShifts.find(
                            (s) => s.shiftDate.slice(0, 10) === day.dateStr && s.shiftType === type
                          );
                          const isSelected = !!currentShift;
                          const isOffline = currentShift?.workMode === "OFFLINE";
                          const isAbsent = currentShift?.status === "ABSENT";
                          const isApproved = currentShift?.status === "APPROVED";

                          const occupancyKey = `${day.dateStr}_${type}`;
                          const occupancy = staffWeekConfig?.shiftOccupancy?.[occupancyKey] || 0;
                          const maxUsers = staffWeekConfig?.maxUsersPerShift || 15;
                          const remainingSpots = Math.max(0, maxUsers - occupancy);
                          const isFull = !isSelected && !isManagerRole && occupancy >= maxUsers;
                          const isLocked = staffWeekConfig?.isLockedForUser && !isManagerRole;

                          return (
                            <div
                              key={day.dateStr}
                              onClick={() => handleToggleShift(day.dateStr, type)}
                              className={`shift-matrix-cell ${isSelected ? "selected" : isFull ? "is-full" : "empty"} ${isLocked ? "locked" : ""}`}
                              style={{
                                cursor: isLocked || isFull ? "not-allowed" : "pointer",
                                opacity: isAbsent ? 0.7 : (isFull ? 0.85 : 1),
                              }}
                              title={
                                isSelected
                                  ? `Đã chọn: ${info.label} (${day.name} ${day.displayDate}) - Click để hủy/đổi`
                                  : isFull
                                  ? `Ca đã đủ ${occupancy}/${maxUsers} nhân sự`
                                  : `Click để đăng ký ${info.label} (${day.name} ${day.displayDate}) - Còn ${remainingSpots} chỗ`
                              }
                            >
                              {isSelected ? (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px" }}>
                                    <span
                                      style={{
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        color: isOffline ? "var(--primary)" : "var(--info)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        background: isOffline ? "rgba(249, 115, 22, 0.16)" : "rgba(59, 130, 246, 0.16)",
                                        padding: "2px 6px",
                                        borderRadius: "5px",
                                      }}
                                    >
                                      {isOffline ? <Building size={11} /> : <Laptop size={11} />}
                                      {isOffline ? "OFFLINE" : "ONLINE"}
                                    </span>

                                    {isApproved ? (
                                      <span
                                        style={{
                                          background: "rgba(34, 197, 94, 0.2)",
                                          color: "var(--success)",
                                          padding: "1px 5px",
                                          borderRadius: "4px",
                                          fontSize: "0.6875rem",
                                          fontWeight: 700,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "2px",
                                        }}
                                        title="Đã được quản lý duyệt"
                                      >
                                        <Check size={11} /> Duyệt
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          background: "rgba(245, 158, 11, 0.18)",
                                          color: "#f59e0b",
                                          padding: "1px 5px",
                                          borderRadius: "4px",
                                          fontSize: "0.6875rem",
                                          fontWeight: 600,
                                        }}
                                        title="Đang chờ quản lý phê duyệt"
                                      >
                                        Chờ duyệt
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "4px" }}>
                                    <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                                      {occupancy}/{maxUsers}
                                    </span>

                                    {isAbsent ? (
                                      <span style={{ fontSize: "0.6875rem", color: "var(--danger)", fontWeight: 700 }}>
                                        ĐÃ NGHỈ
                                      </span>
                                    ) : currentShift?.id && !staffWeekConfig?.isLockedForUser ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLeaveShiftId(currentShift.id!);
                                          setIsLeaveModalOpen(true);
                                        }}
                                        title="Báo bận / Xin nghỉ ca"
                                        style={{
                                          fontSize: "0.6875rem",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          background: "rgba(239, 68, 68, 0.15)",
                                          border: "1px solid rgba(239, 68, 68, 0.3)",
                                          color: "var(--danger)",
                                          cursor: "pointer",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Nghỉ
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                        Bấm để hủy
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : isFull ? (
                                <div
                                  style={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--danger)",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    gap: "3px",
                                  }}
                                >
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <Lock size={12} /> Đã đủ
                                  </span>
                                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                    ({occupancy}/{maxUsers})
                                  </span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--text-muted)",
                                    fontSize: "0.75rem",
                                    gap: "2px",
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>+ Chọn ca</span>
                                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                                    {remainingSpots > 0 ? `Còn ${remainingSpots} chỗ` : `(${occupancy}/${maxUsers})`}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Rules & Validation Panel (Chuẩn hóa Rule nhân sự Freetrip) */}
          <div>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <CalendarCheck2 size={18} color="var(--primary)" /> Kiểm Tra Ràng Buộc Ca
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {/* Rule 1: Tối đa 1 ca / ngày */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  {ruleMaxOnePerDay ? (
                    <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  ) : (
                    <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  )}
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: ruleMaxOnePerDay ? "var(--text-primary)" : "var(--danger)" }}>
                      Tối đa 1 ca / ngày
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                      {ruleMaxOnePerDay ? "Hợp lệ (không trùng ca cùng ngày)" : "Lỗi: Có ngày đang chọn > 1 ca!"}
                    </div>
                  </div>
                </div>

                {/* Rule 2: Chỉ tiêu số ca tuần (Chuẩn Freetrip: Tối thiểu 5 ca/tuần) */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  {myShifts.length >= 5 ? (
                    <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  ) : myShifts.length > 0 ? (
                    <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: "2px" }} />
                  ) : (
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "2px solid var(--text-muted)",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: myShifts.length >= 5 ? "var(--text-primary)" : myShifts.length > 0 ? "#f59e0b" : "var(--text-muted)",
                      }}
                    >
                      Số ca đăng ký tuần: {myShifts.length}/5 ca
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                      {myShifts.length >= 5
                        ? "Đạt chỉ tiêu (≥ 5 ca/tuần, ≥ 20 ca/tháng)"
                        : myShifts.length > 0
                        ? "Chưa đủ 5 ca (vẫn có thể lưu nháp giữ chỗ)"
                        : "Chưa chọn ca làm việc nào trong tuần"}
                    </div>
                  </div>
                </div>

                {/* Rule 3: 100% Online từ xa */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      Hình thức: 100% Online từ xa
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                      Áp dụng quy chế làm việc từ xa Freetrip
                    </div>
                  </div>
                </div>

                {/* Rule 4: Thời hạn đăng ký ca */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <Clock size={18} color={staffWeekConfig?.isLockedForUser && !isManagerRole ? "var(--danger)" : "var(--primary)"} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: staffWeekConfig?.isLockedForUser && !isManagerRole ? "var(--danger)" : "var(--text-primary)" }}>
                      Hạn chót: 23:59 Chủ Nhật
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                      {staffWeekConfig?.isLockedForUser && !isManagerRole
                        ? "Tuần này đã đóng cổng đăng ký"
                        : "Cổng mở Thứ 6, tự động khóa vào 23:59 CN"}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", height: "42px", fontWeight: 700 }}
                  disabled={!canSubmitShifts || saving}
                  onClick={handleSaveShifts}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Đang lưu lịch ca...
                    </>
                  ) : (
                    <>
                      <Check size={16} />{" "}
                      {isEditingOtherUser
                        ? `Lưu Ca Cho ${teamUsers.find((u) => u.id === selectedStaffId)?.fullName || "Nhân sự"}`
                        : "Lưu Lịch Đăng Ký Tuần"}
                    </>
                  )}
                </button>
                {!isManagerRole && staffWeekConfig?.isLockedForUser && (
                  <div style={{ fontSize: "0.75rem", color: "var(--danger)", textAlign: "center", marginTop: "6px", fontWeight: 600 }}>
                    🔒 Form đăng ký tuần này đã bị khóa.
                  </div>
                )}
                {isEditingOtherUser && (
                  <div style={{ fontSize: "0.75rem", color: "var(--info)", textAlign: "center", marginTop: "6px" }}>
                    ⚡ Quyền Quản lý: Đang chỉnh sửa ca cho nhân viên (sẽ lưu log cập nhật).
                  </div>
                )}
              </div>
            </div>

            {/* Shift Rules & Policies Note */}
            <div
              className="card"
              style={{
                padding: "1rem",
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                background: "var(--bg-secondary)",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <Info size={16} color="var(--info)" /> Quy Định Ca Freetrip:
              </div>
              <ul style={{ paddingLeft: "1.25rem", lineHeight: "1.6", margin: 0 }}>
                <li>Mỗi ngày đăng ký tối đa <strong>1 ca làm việc</strong>.</li>
                <li>Chỉ tiêu tiêu chuẩn: Tối thiểu <strong>5 ca / tuần</strong> (≥ 20 ca / tháng).</li>
                <li>Cổng đăng ký mở <strong>Thứ 6</strong> và khóa vào <strong>23:59 Chủ Nhật</strong>.</li>
                <li>Nghỉ tối đa <strong>3 ca / tháng</strong> (báo bận trước ít nhất 1 ngày).</li>
                <li>Điểm danh Vào ca trong <strong>60 phút đầu ca</strong> tại trang Báo cáo.</li>
              </ul>
            </div>
          </div>

          {/* Floating Action Dock for Mobile Devices */}
          <div className="shift-mobile-dock">
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", fontWeight: 700 }}>
                <span>Đã chọn:</span>
                <span style={{ color: "var(--primary)" }}>{myShifts.length} ca</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>•</span>
                <span style={{ fontSize: "0.75rem", color: ruleMaxOnePerDay ? "var(--success)" : "var(--danger)", display: "flex", alignItems: "center", gap: "3px" }}>
                  {ruleMaxOnePerDay ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {ruleMaxOnePerDay ? "Hợp lệ" : "Trùng ca"}
                </span>
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                {staffWeekConfig?.isLockedForUser && !isManagerRole ? "Tuần này đã khóa" : "Tối đa 1 ca / ngày"}
              </div>
            </div>

            <button
              className="btn btn-primary btn-sm"
              style={{ padding: "8px 16px", fontWeight: 700, fontSize: "0.8125rem", borderRadius: "8px", minHeight: "38px" }}
              disabled={!canSubmitShifts || saving}
              onClick={handleSaveShifts}
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Lưu...
                </>
              ) : (
                <>
                  <Check size={14} /> Lưu Lịch Ca
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: TEAM MATRIX (Manager / Quản Lý Toàn Đội) */}
      {viewMode === "TEAM" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>
                Ma Trận Phân Bổ Ca Tuần {teamWeekInfo.weekNumber} - Toàn Đội Remote
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Tổng cộng {teamUsers.length} nhân sự | {teamShifts.length} ca đã đăng ký
              </p>
            </div>

            {/* Quick Filter: Lọc danh sách nhân sự theo 4 trạng thái */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn btn-sm ${teamFilterStatus === "ALL" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                onClick={() => setTeamFilterStatus("ALL")}
              >
                Tất cả ({teamStatusCounts.all})
              </button>
              
              <button
                type="button"
                className={`btn btn-sm ${teamFilterStatus === "PENDING" ? "btn-warning" : "btn-secondary"}`}
                style={{
                  fontSize: "0.75rem",
                  padding: "4px 10px",
                  background: teamFilterStatus === "PENDING" ? "rgba(245, 158, 11, 0.2)" : undefined,
                  color: teamFilterStatus === "PENDING" ? "#f59e0b" : undefined,
                  border: teamFilterStatus === "PENDING" ? "1px solid rgba(245, 158, 11, 0.5)" : undefined,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => setTeamFilterStatus("PENDING")}
                title="Lọc nhanh danh sách nhân sự đang có ca chờ duyệt"
              >
                <Clock size={13} /> Chờ duyệt ({teamStatusCounts.pending})
              </button>

              <button
                type="button"
                className={`btn btn-sm ${teamFilterStatus === "APPROVED" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  fontSize: "0.75rem",
                  padding: "4px 10px",
                  background: teamFilterStatus === "APPROVED" ? "rgba(34, 197, 94, 0.2)" : undefined,
                  color: teamFilterStatus === "APPROVED" ? "var(--success)" : undefined,
                  border: teamFilterStatus === "APPROVED" ? "1px solid rgba(34, 197, 94, 0.5)" : undefined,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => setTeamFilterStatus("APPROVED")}
                title="Lọc danh sách nhân sự đã được duyệt tất cả các ca"
              >
                <ShieldCheck size={13} /> Đã duyệt ({teamStatusCounts.approved})
              </button>

              <button
                type="button"
                className={`btn btn-sm ${teamFilterStatus === "NOT_REGISTERED" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  fontSize: "0.75rem",
                  padding: "4px 10px",
                  background: teamFilterStatus === "NOT_REGISTERED" ? "rgba(148, 163, 184, 0.2)" : undefined,
                  color: teamFilterStatus === "NOT_REGISTERED" ? "var(--text-muted)" : undefined,
                  border: teamFilterStatus === "NOT_REGISTERED" ? "1px solid rgba(148, 163, 184, 0.5)" : undefined,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => setTeamFilterStatus("NOT_REGISTERED")}
                title="Lọc danh sách nhân sự chưa đăng ký ca nào trong tuần"
              >
                <AlertCircle size={13} /> Chưa đăng ký ({teamStatusCounts.notRegistered})
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table" style={{ fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "180px" }}>Nhân sự</th>
                  {teamWeekDays.map((d) => (
                    <th key={d.dateStr} style={{ textAlign: "center", minWidth: "110px" }}>
                      <div>{d.name}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{d.displayDate}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: "center" }}>Tổng ca</th>
                  <th style={{ textAlign: "center", minWidth: "135px" }}>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeamUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={teamWeekDays.length + 4}
                      style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}
                    >
                      Không có nhân sự nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredTeamUsers.map((user) => {
                    const userShifts = teamShifts.filter((s) => s.userId === user.id);
                    const totalShifts = userShifts.length;
                    const pendingCount = userShifts.filter((s) => s.status === "REGISTERED").length;
                    const approvedCount = userShifts.filter((s) => s.status === "APPROVED").length;
                    const hasPending = pendingCount > 0;

                    return (
                      <tr
                        key={user.id}
                        style={{
                          background: hasPending ? "rgba(245, 158, 11, 0.05)" : undefined,
                          borderLeft: hasPending ? "3px solid #f59e0b" : "3px solid transparent",
                          transition: "background 0.2s ease",
                        }}
                      >
                        {/* Name */}
                        <td>
                          <div style={{ fontWeight: 600 }}>{user.fullName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{user.phone}</div>
                        </td>

                        {/* 7 Days Shifts */}
                        {teamWeekDays.map((day) => {
                          const dayShifts = userShifts
                            .filter((s) => s.shiftDate.slice(0, 10) === day.dateStr)
                            .sort((a, b) => (SHIFT_ORDER[a.shiftType] || 99) - (SHIFT_ORDER[b.shiftType] || 99));

                          if (dayShifts.length === 0) {
                            return (
                              <td key={day.dateStr} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={day.dateStr} style={{ textAlign: "center", padding: "6px 4px", verticalAlign: "middle" }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {dayShifts.map((shift) => {
                                  const info = SHIFT_INFO[shift.shiftType] || { label: shift.shiftType, icon: "📋" };
                                  const isOffline = shift.workMode === "OFFLINE";
                                  const isAbsent = shift.status === "ABSENT" || shift.status === "EXCUSED_ABSENT" || shift.status === "UNEXCUSED_ABSENT";
                                  const isPending = shift.status === "REGISTERED";
                                  const isApproved = shift.status === "APPROVED";

                                  return (
                                    <div
                                      key={shift.id || `${shift.shiftDate}_${shift.shiftType}`}
                                      style={{
                                        display: "inline-flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        padding: "3px 6px",
                                        width: "100%",
                                        maxWidth: "78px",
                                        borderRadius: "6px",
                                        background: isAbsent
                                          ? "rgba(239, 68, 68, 0.12)"
                                          : isPending
                                          ? "rgba(245, 158, 11, 0.14)"
                                          : isOffline
                                          ? "rgba(249, 115, 22, 0.12)"
                                          : "rgba(59, 130, 246, 0.12)",
                                        border: isAbsent
                                          ? "1px solid rgba(239, 68, 68, 0.35)"
                                          : isPending
                                          ? "1.5px dashed #f59e0b"
                                          : isApproved
                                          ? "1px solid rgba(34, 197, 94, 0.4)"
                                          : isOffline
                                          ? "1px solid rgba(249, 115, 22, 0.3)"
                                          : "1px solid rgba(59, 130, 246, 0.3)",
                                        transition: "transform 0.15s ease",
                                      }}
                                      title={`${info.label} (${isOffline ? "OFFLINE" : "ONLINE"}) - ${isPending ? "Đang chờ duyệt" : isAbsent ? "Vắng/Nghỉ" : "Đã duyệt"}`}
                                    >
                                      <span style={{ fontWeight: 600, fontSize: "0.71875rem", lineHeight: 1.2 }}>
                                        {info.icon} {info.label.replace("Ca ", "")}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.59375rem",
                                          color: isAbsent
                                            ? "var(--danger)"
                                            : isPending
                                            ? "#d97706"
                                            : isApproved
                                            ? "var(--success)"
                                            : isOffline
                                            ? "var(--primary)"
                                            : "var(--info)",
                                          fontWeight: 700,
                                          lineHeight: 1.2,
                                        }}
                                      >
                                        {isAbsent
                                          ? "NGHỈ"
                                          : isPending
                                          ? "CHỜ DUYỆT"
                                          : isOffline
                                          ? "OFFLINE"
                                          : "ONLINE"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}

                        {/* Summary */}
                        <td style={{ textAlign: "center" }}>
                          <span
                            className={`badge ${totalShifts > 0 ? "badge-success" : "badge-secondary"}`}
                            style={{ minWidth: "36px", fontWeight: 700 }}
                          >
                            {totalShifts}
                          </span>
                        </td>

                        {/* Trạng thái duyệt */}
                        <td style={{ textAlign: "center" }}>
                          <UserShiftStatusBadge
                            totalShifts={totalShifts}
                            pendingCount={pendingCount}
                            approvedCount={approvedCount}
                          />
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "6px" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "rgba(59, 130, 246, 0.12)",
                              color: "var(--info)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              cursor: "pointer",
                            }}
                            onClick={() => handleEditStaffFromTeam(user.id)}
                            title={`Chỉnh sửa lịch ca làm việc của ${user.fullName}`}
                          >
                            <Edit3 size={13} /> Sửa ca
                          </button>

                          {teamWeekConfig?.reopenedUserIds?.includes(user.id) ? (
                            <button
                              className="btn btn-icon"
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#f59e0b",
                                border: "1px solid rgba(245, 158, 11, 0.4)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                boxShadow: "0 0 10px rgba(245, 158, 11, 0.1)",
                              }}
                              onClick={() => handleToggleReopenUser(user.id, user.fullName, true)}
                              title="Nhân sự đang được mở quyền nộp bù/sửa ca. Nhấn để thu hồi quyền / khóa lại."
                            >
                              <Unlock size={13} color="#f59e0b" /> Đã mở sửa
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-icon"
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                borderRadius: "6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              onClick={() => handleToggleReopenUser(user.id, user.fullName, false)}
                              title="Mở nộp bù / Sửa ca cho nhân sự"
                            >
                              <Unlock size={13} /> Mở sửa
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
        </div>
      )}

      {/* MODAL: Xin Nghỉ Phép Ca */}
      {isLeaveModalOpen && (
        <Modal
          isOpen={isLeaveModalOpen}
          onClose={() => setIsLeaveModalOpen(false)}
          maxWidth="460px"
          closeOnOutsideClick={false}
        >
          <div className="modal-header">
            <div className="modal-title">Xin Nghỉ Phép Ca Làm Việc</div>
            <button
              type="button"
              className="btn-ghost btn-icon"
              onClick={() => setIsLeaveModalOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleConfirmLeave} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div className="modal-body">
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "8px",
                  padding: "0.875rem",
                  marginBottom: "1rem",
                  fontSize: "0.8125rem",
                  color: "var(--danger)",
                }}
              >
                ⚠️ <strong>Lưu ý quan trọng:</strong> Mỗi nhân sự chỉ được nghỉ tối đa{" "}
                <strong>3 ca / tháng</strong>. Vượt quá số ca nghỉ có thể dẫn đến việc không đủ điều kiện
                nghiệm thu lương tháng.
              </div>

              <div className="form-group">
                <label className="label">Lý do xin nghỉ ca *</label>
                <textarea
                  className="input"
                  rows={3}
                  required
                  placeholder="Nhập lý do bận, ốm, việc gia đình..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsLeaveModalOpen(false)}
              >
                Hủy
              </button>
              <button type="submit" className="btn btn-danger">
                Xác Nhận Nghỉ Ca
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
