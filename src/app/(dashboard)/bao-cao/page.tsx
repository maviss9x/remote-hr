"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { CustomDatePicker, Modal } from "@/components/ui";
import {
  FileText,
  Send,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  FolderOpen,
  Flame,
  Sparkles,
  RefreshCw,
  Eye,
  X,
  MessageSquare,
  ShieldCheck,
  XCircle,
  HelpCircle,
  Calendar as CalendarIcon,
  Filter,
  Unlock,
  Lock,
  Tag,
  ChevronDown,
  ChevronUp,
  Check,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { isUrlInList } from "@/lib/url-matcher";
import {
  evaluateSubmission,
  getShiftTimeRange,
  type SubmissionDecision,
  type SubmissionRules,
  type ShiftTime,
} from "@/lib/reportSubmissionPolicy";

export interface PostTagItem {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

interface EligibleShift {
  id: number;
  shiftDate: string;
  shiftType: "MORNING" | "AFTERNOON" | "EVENING";
  workMode: "ONLINE" | "OFFLINE";
  status: string;
  submissionDecision?: SubmissionDecision;
}

interface QcReviewData {
  id: number;
  result: "PENDING" | "PASS" | "FAIL";
  fbApproved: number;
  threadApproved: number;
  commentApproved: number;
  feedback?: string | null;
  invalidLinks?: string[];
  reviewedAt?: string | null;
  reviewer?: {
    id: number;
    fullName: string;
  } | null;
}

interface DailyReportItem {
  id: number;
  reportDate: string;
  shiftType: "MORNING" | "AFTERNOON" | "EVENING";
  submittedAt: string;
  fbLinks: string[];
  fbSupplementLinks: string[];
  threadLinks: string[];
  commentDriveLink?: string | null;
  femaleContentLinks: string[];
  viralPostLinks: string[];
  viralProposals?: Array<{
    url: string;
    likes: number;
    platform?: string;
    contentType?: string;
  }>;
  postTags?: Record<string, string>;
  endFbCount?: number | null;
  endThreadCount?: number | null;
  thresholdMet?: boolean | null;
  endSnapshotAt?: string | null;
  shiftRegistration?: {
    id: number;
    shiftDate: string;
    shiftType: string;
    workMode: string;
    status: string;
  };
  qcReview?: QcReviewData | null;
}

const SHIFT_LABEL_MAP: Record<string, { label: string; icon: string }> = {
  MORNING: { label: "Ca Sáng (08:30 - 12:30)", icon: "☀️" },
  AFTERNOON: { label: "Ca Chiều (13:30 - 17:30)", icon: "🌤️" },
  EVENING: { label: "Ca Tối (20:00 - 24:00)", icon: "🌙" },
};

// ============================================
// HẰNG SỐ & ĐỊNH NGHĨA CA
// ============================================
interface ShiftScheduleItem {
  id: number;
  shiftDate: string;
  shiftType: "MORNING" | "AFTERNOON" | "EVENING";
  workMode: "ONLINE" | "OFFLINE";
  status: string;
  reopenedBy?: number | null;
  reopenedUntil?: string | null;
  dailyReport?: DailyReportItem | null;
  loginSession?: {
    loginTime: string;
    isLate: boolean;
    lateMinutes: number;
  } | null;
  submissionDecision?: SubmissionDecision;
}

const STANDARD_SHIFTS: Array<{
  type: "MORNING" | "AFTERNOON" | "EVENING";
  title: string;
  timeRange: string;
  icon: string;
}> = [
  { type: "MORNING", title: "Ca Sáng", timeRange: "08:30 - 12:30", icon: "☀️" },
  { type: "AFTERNOON", title: "Ca Chiều", timeRange: "13:30 - 17:30", icon: "🌤️" },
  { type: "EVENING", title: "Ca Tối", timeRange: "20:00 - 24:00", icon: "🌙" },
];

// ============================================
// CƠ CHẾ LƯU LINK TẠM THỜI (DRAFT AUTO-SAVE)
// ============================================
const DRAFT_PREFIX = "seeding_draft_shift_";

interface ShiftDraftData {
  shiftId: string;
  savedAt: string;
  fbLinks: string[];
  fbSuppLinks: string[];
  threadLinks: string[];
  threadSuppLinks: string[];
  commentDriveLink: string;
  fbTags?: string[];
  fbHighlights?: boolean[];
  fbViralLikes?: (number | "")[];
  fbSuppTags?: string[];
  fbSuppHighlights?: boolean[];
  fbSuppViralLikes?: (number | "")[];
  threadTags?: string[];
  threadHighlights?: boolean[];
  threadViralLikes?: (number | "")[];
  threadSuppTags?: string[];
  threadSuppHighlights?: boolean[];
  threadSuppViralLikes?: (number | "")[];
}

function getShiftDraft(shiftId: string): ShiftDraftData | null {
  if (typeof window === "undefined" || !shiftId) return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${shiftId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveShiftDraft(shiftId: string, data: Omit<ShiftDraftData, "shiftId" | "savedAt">) {
  if (typeof window === "undefined" || !shiftId) return;
  try {
    const payload: ShiftDraftData = {
      shiftId,
      savedAt: new Date().toISOString(),
      ...data,
    };
    localStorage.setItem(`${DRAFT_PREFIX}${shiftId}`, JSON.stringify(payload));
  } catch (e) {
    console.error("Lỗi lưu draft:", e);
  }
}

function clearShiftDraft(shiftId: string) {
  if (typeof window === "undefined" || !shiftId) return;
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${shiftId}`);
  } catch (e) {}
}

function countDraftLinks(draft: ShiftDraftData | null): number {
  if (!draft) return 0;
  const fbCount = (draft.fbLinks || []).filter((l) => Boolean(l && l.trim())).length;
  const fbSuppCount = (draft.fbSuppLinks || []).filter((l) => Boolean(l && l.trim())).length;
  const threadCount = (draft.threadLinks || []).filter((l) => Boolean(l && l.trim())).length;
  const threadSuppCount = (draft.threadSuppLinks || []).filter((l) => Boolean(l && l.trim())).length;
  const driveCount = draft.commentDriveLink && draft.commentDriveLink.trim() ? 1 : 0;
  return fbCount + fbSuppCount + threadCount + threadSuppCount + driveCount;
}

// Component Dropdown gắn thẻ loại bài viết (Fix lỗi mũi tên đè text, responsive & hiện đại)
function PostTagSelect({
  value,
  onChange,
  disabled,
  title,
  availableTags,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
  title: string;
  availableTags: PostTagItem[];
}) {
  const currentTag = availableTags.find((t) => t.id === value);
  return (
    <div style={{ position: "relative", width: "155px", flexShrink: 0 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="select select-post-tag"
        style={{
          width: "100%",
          height: "38px",
          fontSize: "0.78rem",
          borderRadius: "8px",
          backgroundColor: currentTag
            ? `${currentTag.color}18`
            : disabled
            ? "var(--bg-card)"
            : "var(--bg-input)",
          borderColor: currentTag ? currentTag.color : "var(--border-color)",
          color: currentTag ? currentTag.color : "var(--text-muted)",
          fontWeight: currentTag ? 600 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.75 : 1,
        }}
        title={title}
      >
        <option value="">-- Loại bài --</option>
        {availableTags.map((tag) => (
          <option key={tag.id} value={tag.id} style={{ color: tag.color, fontWeight: 600 }}>
            {tag.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: "9px",
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: currentTag ? currentTag.color : "var(--text-muted)",
          opacity: disabled ? 0.45 : 0.85,
        }}
      />
    </div>
  );
}

// Component đếm ngược thời gian đóng ca / hạn nộp
function CountdownTimer({ targetDate, label }: { targetDate: Date | string | null; label?: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("Đã hết hạn");
        return;
      }
      const days = Math.floor(diff / (24 * 3600 * 1000));
      const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
      const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days} ngày ${hours} giờ ${minutes}p`);
      } else if (hours > 0) {
        setTimeLeft(`${hours} giờ ${minutes}p ${seconds}s`);
      } else {
        setTimeLeft(`${minutes} phút ${seconds} giây`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || !timeLeft) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontWeight: 600,
        color: timeLeft === "Đã hết hạn" ? "#ef4444" : "#f97316",
        backgroundColor: "rgba(249, 115, 22, 0.12)",
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "0.78rem",
      }}
    >
      <Clock size={12} /> {label ? `${label}: ` : "Hạn nộp: "}{timeLeft}
    </span>
  );
}

// Helper xác định trạng thái ca làm việc theo chính sách nộp bài chuẩn
function getShiftStatusInfo(
  shiftDateStr: string,
  shiftType: "MORNING" | "AFTERNOON" | "EVENING",
  reopenedBy?: number | null,
  reopenedUntil?: string | null,
  shiftItem?: ShiftScheduleItem | null,
  customRules?: SubmissionRules,
  kpi?: { fbPerShift: number; threadPerShift: number },
  customShiftTimes?: Record<string, ShiftTime>
) {
  let timeRangeStr = "08:30 - 12:30";
  let shiftTime: ShiftTime = { startTime: "08:30", endTime: "12:30" };
  if (customShiftTimes && customShiftTimes[shiftType]) {
    shiftTime = customShiftTimes[shiftType];
    timeRangeStr = `${shiftTime.startTime} - ${shiftTime.endTime}`;
  } else {
    if (shiftType === "AFTERNOON") {
      shiftTime = { startTime: "13:30", endTime: "17:30" };
      timeRangeStr = "13:30 - 17:30";
    } else if (shiftType === "EVENING") {
      shiftTime = { startTime: "20:00", endTime: "24:00" };
      timeRangeStr = "20:00 - 24:00";
    }
  }

  const rules: SubmissionRules = customRules || {
    lateCheckinMinutes: 60,
    postShiftEditMinutes: 60,
    participationThresholdPercent: 70,
  };

  const kpiData = kpi || { fbPerShift: 10, threadPerShift: 4 };
  const now = new Date();
  const shiftDate = new Date(`${shiftDateStr}T00:00:00.000Z`);

  const hasDailyReport = Boolean(shiftItem?.dailyReport);
  const submittedFbCount = Array.isArray(shiftItem?.dailyReport?.fbLinks)
    ? shiftItem.dailyReport.fbLinks.length
    : 0;
  const submittedThreadCount = Array.isArray(shiftItem?.dailyReport?.threadLinks)
    ? shiftItem.dailyReport.threadLinks.length
    : 0;

  const checkInAt = shiftItem?.loginSession?.loginTime
    ? new Date(shiftItem.loginSession.loginTime)
    : shiftItem?.dailyReport?.submittedAt
    ? new Date(shiftItem.dailyReport.submittedAt)
    : null;

  const isLate = Boolean(shiftItem?.loginSession?.isLate);
  const lateMinutes = shiftItem?.loginSession?.lateMinutes || 0;
  const linkCountsAtShiftEnd = shiftItem?.dailyReport?.endSnapshotAt
    ? {
        fb: shiftItem.dailyReport.endFbCount ?? 0,
        thread: shiftItem.dailyReport.endThreadCount ?? 0,
      }
    : hasDailyReport
    ? {
        fb: submittedFbCount,
        thread: submittedThreadCount,
      }
    : null;

  const specialReopen = reopenedBy
    ? { until: reopenedUntil ? new Date(reopenedUntil) : null }
    : null;

  const decision: SubmissionDecision = evaluateSubmission({
    shiftDate,
    shiftTime,
    checkInAt,
    linkCountsAtShiftEnd,
    hasSubmittedReport: hasDailyReport,
    specialReopen,
    now,
    rules,
    kpi: kpiData,
    isLate,
    lateMinutes,
  });

  let badgeText = "Chưa đến ca";
  let badgeColor = "#94a3b8";
  let badgeBg = "rgba(148, 163, 184, 0.12)";
  let badgeBorder = "rgba(148, 163, 184, 0.25)";

  switch (decision.phase) {
    case "BEFORE_SHIFT":
      badgeText = "Chưa đến ca";
      badgeColor = "#94a3b8";
      badgeBg = "rgba(148, 163, 184, 0.12)";
      badgeBorder = "rgba(148, 163, 184, 0.25)";
      break;
    case "AWAITING_CHECKIN":
      badgeText = "Chờ Vào ca";
      badgeColor = "#f59e0b";
      badgeBg = "rgba(245, 158, 11, 0.18)";
      badgeBorder = "rgba(245, 158, 11, 0.5)";
      break;
    case "IN_SHIFT":
      badgeText = "Trong ca";
      badgeColor = "#f97316";
      badgeBg = "rgba(249, 115, 22, 0.18)";
      badgeBorder = "rgba(249, 115, 22, 0.45)";
      break;
    case "POST_SHIFT_EDIT":
      badgeText = "Sửa sau ca (60p)";
      badgeColor = "#38bdf8";
      badgeBg = "rgba(56, 189, 248, 0.18)";
      badgeBorder = "rgba(56, 189, 248, 0.45)";
      break;
    case "WEEKLY_MAKEUP":
      badgeText = "Nộp bù tuần";
      badgeColor = "#a855f7";
      badgeBg = "rgba(168, 85, 247, 0.18)";
      badgeBorder = "rgba(168, 85, 247, 0.45)";
      break;
    case "SPECIAL_REOPEN":
      badgeText = "Mở bù đặc cách";
      badgeColor = "#10b981";
      badgeBg = "rgba(16, 185, 129, 0.18)";
      badgeBorder = "rgba(16, 185, 129, 0.45)";
      break;
    case "LATE_LOCKED":
      badgeText = "Vào muộn - Khóa";
      badgeColor = "#ef4444";
      badgeBg = "rgba(239, 68, 68, 0.15)";
      badgeBorder = "rgba(239, 68, 68, 0.4)";
      break;
    case "ABSENT":
      badgeText = "Vắng ca";
      badgeColor = "#ef4444";
      badgeBg = "rgba(239, 68, 68, 0.15)";
      badgeBorder = "rgba(239, 68, 68, 0.4)";
      break;
    case "BELOW_THRESHOLD":
      badgeText = "Dưới ngưỡng - Khóa";
      badgeColor = "#ef4444";
      badgeBg = "rgba(239, 68, 68, 0.15)";
      badgeBorder = "rgba(239, 68, 68, 0.4)";
      break;
    case "CLOSED":
    default:
      badgeText = "Đã khóa";
      badgeColor = "#ef4444";
      badgeBg = "rgba(239, 68, 68, 0.12)";
      badgeBorder = "rgba(239, 68, 68, 0.3)";
      break;
  }

  return {
    timeStatus: decision.phase,
    phase: decision.phase,
    canSubmit: decision.canSubmit,
    canDeleteApprovedLinks: decision.canDeleteApprovedLinks,
    canEditOldLinks: decision.canEditOldLinks,
    capAtKpi: decision.capAtKpi,
    closesAt: decision.closesAt,
    badgeText,
    badgeColor,
    badgeBg,
    badgeBorder,
    reason: decision.reason,
    timeRangeStr,
    reopenedUntil: specialReopen?.until?.toISOString() || null,
  };
}

export default function BaoCaoSeedingPage() {
  const [activeTab, setActiveTab] = useState<"SUBMIT" | "HISTORY">("SUBMIT");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligibleShifts, setEligibleShifts] = useState<EligibleShift[]>([]);
  const [monthShifts, setMonthShifts] = useState<ShiftScheduleItem[]>([]);
  const [reportsHistory, setReportsHistory] = useState<DailyReportItem[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [isRulesCollapsed, setIsRulesCollapsed] = useState<boolean>(false);
  const [isShiftSelectorOpenMobile, setIsShiftSelectorOpenMobile] = useState<boolean>(false);

  // Trạng thái lưu trữ link tạm thời (Draft State)
  const [draftState, setDraftState] = useState<{ active: boolean; savedAt: string; count: number }>({
    active: false,
    savedAt: "",
    count: 0,
  });
  const isRestoringRef = useRef<boolean>(false);
  const isBypassingUnloadRef = useRef<boolean>(false);

  // Popup cảnh báo rời trang khi form có link chưa lưu
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);
  const router = useRouter();

  // Toast notification
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Calendar State
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState<number>(now.getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState<number>(now.getFullYear());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  // KPI & Grace Config State (Lấy động từ Cài đặt Admin)
  const [kpiConfig, setKpiConfig] = useState<{ fbPerShift: number; threadPerShift: number; commentPerShift: number }>({
    fbPerShift: 10,
    threadPerShift: 4,
    commentPerShift: 50,
  });
  const [graceConfig, setGraceConfig] = useState<{ tagPostGraceDays: number; viralPostGraceDays: number }>({
    tagPostGraceDays: 7,
    viralPostGraceDays: 30,
  });

  const [shiftRulesState, setShiftRulesState] = useState<SubmissionRules>({
    lateCheckinMinutes: 60,
    postShiftEditMinutes: 60,
    participationThresholdPercent: 70,
  });
  const [customShiftTimes, setCustomShiftTimes] = useState<Record<string, ShiftTime>>({});
  const [checkingIn, setCheckingIn] = useState<boolean>(false);

  const targetFb = kpiConfig.fbPerShift || 10;
  const targetThread = kpiConfig.threadPerShift || 4;
  const targetComment = kpiConfig.commentPerShift || 50;

  // Thao tác bấm Vào ca cho nhân sự
  const handleCheckIn = async (shiftRegistrationId: number) => {
    try {
      setCheckingIn(true);
      const res = await fetch("/api/shifts/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftRegistrationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể điểm danh Vào ca");
      }
      showToast(data.message || "Vào ca thành công!", "success");
      await fetchData();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi điểm danh Vào ca", "error");
    } finally {
      setCheckingIn(false);
    }
  };

  // Form State
  const [fbLinks, setFbLinks] = useState<string[]>(Array(10).fill(""));
  const [fbSuppLinks, setFbSuppLinks] = useState<string[]>([]);
  const [threadLinks, setThreadLinks] = useState<string[]>(Array(4).fill(""));
  const [threadSuppLinks, setThreadSuppLinks] = useState<string[]>([]);
  const [commentDriveLink, setCommentDriveLink] = useState<string>("");

  // Post Tags, Highlights & Viral Proposals State
  const [availableTags, setAvailableTags] = useState<PostTagItem[]>([]);
  const [fbTags, setFbTags] = useState<string[]>(Array(10).fill(""));
  const [fbHighlights, setFbHighlights] = useState<boolean[]>(Array(10).fill(false));
  const [fbViralLikes, setFbViralLikes] = useState<(number | "")[]>(Array(10).fill(""));

  const [fbSuppTags, setFbSuppTags] = useState<string[]>([]);
  const [fbSuppHighlights, setFbSuppHighlights] = useState<boolean[]>([]);
  const [fbSuppViralLikes, setFbSuppViralLikes] = useState<(number | "")[]>([]);

  const [threadTags, setThreadTags] = useState<string[]>(Array(4).fill(""));
  const [threadHighlights, setThreadHighlights] = useState<boolean[]>(Array(4).fill(false));
  const [threadViralLikes, setThreadViralLikes] = useState<(number | "")[]>(Array(4).fill(""));

  const [threadSuppTags, setThreadSuppTags] = useState<string[]>([]);
  const [threadSuppHighlights, setThreadSuppHighlights] = useState<boolean[]>([]);
  const [threadSuppViralLikes, setThreadSuppViralLikes] = useState<(number | "")[]>([]);

  // Tự động đồng bộ số ô nhập liệu khi cấu hình KPI tải về
  useEffect(() => {
    setFbLinks((prev) => (prev.length < targetFb ? [...prev, ...Array(targetFb - prev.length).fill("")] : prev));
    setFbTags((prev) => (prev.length < targetFb ? [...prev, ...Array(targetFb - prev.length).fill("")] : prev));
    setFbHighlights((prev) => (prev.length < targetFb ? [...prev, ...Array(targetFb - prev.length).fill(false)] : prev));
    setFbViralLikes((prev) => (prev.length < targetFb ? [...prev, ...Array(targetFb - prev.length).fill("")] : prev));

    setThreadLinks((prev) => (prev.length < targetThread ? [...prev, ...Array(targetThread - prev.length).fill("")] : prev));
    setThreadTags((prev) => (prev.length < targetThread ? [...prev, ...Array(targetThread - prev.length).fill("")] : prev));
    setThreadHighlights((prev) => (prev.length < targetThread ? [...prev, ...Array(targetThread - prev.length).fill(false)] : prev));
    setThreadViralLikes((prev) => (prev.length < targetThread ? [...prev, ...Array(targetThread - prev.length).fill("")] : prev));
  }, [targetFb, targetThread]);

  // Tải danh mục Post Tags từ hệ thống
  useEffect(() => {
    fetch("/api/post-tags")
      .then((res) => res.json())
      .then((data) => {
        if (data.tags) setAvailableTags(data.tags);
      })
      .catch(console.error);
  }, []);

  // Tự động lưu bản nháp (Draft) vào LocalStorage với Debounce 600ms
  useEffect(() => {
    if (isRestoringRef.current || !selectedShiftId) return;

    // Tính tổng số link và nội dung đã nhập vào form
    const currentFbCount = fbLinks.filter((l) => l.trim()).length;
    const currentFbSuppCount = fbSuppLinks.filter((l) => l.trim()).length;
    const currentThreadCount = threadLinks.filter((l) => l.trim()).length;
    const currentThreadSuppCount = threadSuppLinks.filter((l) => l.trim()).length;
    const currentDriveCount = commentDriveLink.trim() ? 1 : 0;
    const totalFilled = currentFbCount + currentFbSuppCount + currentThreadCount + currentThreadSuppCount + currentDriveCount;

    const existingDraft = getShiftDraft(selectedShiftId);

    // Nếu form rỗng và chưa từng có bản nháp thì không lưu
    if (totalFilled === 0 && !existingDraft) return;

    // Nếu người dùng đã chủ động xóa sạch toàn bộ các ô và trước đó có draft, dọn dẹp draft
    if (totalFilled === 0 && existingDraft) {
      clearShiftDraft(selectedShiftId);
      setDraftState({ active: false, savedAt: "", count: 0 });
      return;
    }

    const timer = setTimeout(() => {
      saveShiftDraft(selectedShiftId, {
        fbLinks,
        fbSuppLinks,
        threadLinks,
        threadSuppLinks,
        commentDriveLink,
        fbTags,
        fbHighlights,
        fbViralLikes,
        fbSuppTags,
        fbSuppHighlights,
        fbSuppViralLikes,
        threadTags,
        threadHighlights,
        threadViralLikes,
        threadSuppTags,
        threadSuppHighlights,
        threadSuppViralLikes,
      });

      setDraftState({
        active: true,
        savedAt: new Date().toISOString(),
        count: totalFilled,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    selectedShiftId,
    fbLinks,
    fbSuppLinks,
    threadLinks,
    threadSuppLinks,
    commentDriveLink,
    fbTags,
    fbHighlights,
    fbViralLikes,
    fbSuppTags,
    fbSuppHighlights,
    fbSuppViralLikes,
    threadTags,
    threadHighlights,
    threadViralLikes,
    threadSuppTags,
    threadSuppHighlights,
    threadSuppViralLikes,
  ]);

  // Bộ lọc ngày trong Tab Lịch Sử
  const [historyDateFilter, setHistoryDateFilter] = useState<string>("");
  const [hasFilteredHistory, setHasFilteredHistory] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper format ngày YYYY-MM-DD
  const formatDateToKey = (date: Date | string) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Helper nạp dữ liệu báo cáo cũ vào Form (khi xem lại hoặc sửa/nộp bù)
  const loadReportToForm = (report: DailyReportItem, tFb = targetFb, tThread = targetThread) => {
    isRestoringRef.current = true;
    const postTags = report.postTags || {};
    const viralLinks = new Set(report.viralPostLinks || []);
    const qcInvalidList = report.qcReview?.invalidLinks;

    // Map số like bài viral đề xuất theo URL
    const viralPropMap = new Map<string, number>();
    (report.viralProposals || []).forEach((vp) => {
      if (vp.url && vp.likes > 0) {
        viralPropMap.set(vp.url, vp.likes);
      }
    });

    const paddedFb = [...(report.fbLinks || [])];
    while (paddedFb.length < tFb) paddedFb.push("");
    setFbLinks(paddedFb);
    setFbTags(paddedFb.map((l) => (l ? postTags[l] || "" : "")));
    // RULE: Link đã bị QC từ chối thì không cho phép gắn nổi bật/viral
    setFbHighlights(paddedFb.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralLinks.has(l) : false)));
    setFbViralLikes(paddedFb.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralPropMap.get(l) || "" : "")));

    const existingFbSupp = [...(report.fbSupplementLinks || [])];
    const invalidFbInMain = paddedFb.filter((l) => l.trim() && isUrlInList(l, qcInvalidList)).length;
    const hasEmptySlotInFbMain = paddedFb.some((l) => !l.trim());
    if (invalidFbInMain > 0 && !hasEmptySlotInFbMain && existingFbSupp.length === 0) {
      existingFbSupp.push("");
    }
    setFbSuppLinks(existingFbSupp);
    setFbSuppTags(existingFbSupp.map((l) => (l ? postTags[l] || "" : "")));
    setFbSuppHighlights(existingFbSupp.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralLinks.has(l) : false)));
    setFbSuppViralLikes(existingFbSupp.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralPropMap.get(l) || "" : "")));

    const paddedThread = [...(report.threadLinks || [])].slice(0, tThread);
    while (paddedThread.length < tThread) paddedThread.push("");
    setThreadLinks(paddedThread);
    setThreadTags(paddedThread.map((l) => (l ? postTags[l] || "" : "")));
    setThreadHighlights(paddedThread.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralLinks.has(l) : false)));
    setThreadViralLikes(paddedThread.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralPropMap.get(l) || "" : "")));

    const existingThreadSupp = [...(report.threadLinks && report.threadLinks.length > tThread ? report.threadLinks.slice(tThread) : [])];
    const invalidThreadInMain = paddedThread.filter((l) => l.trim() && isUrlInList(l, qcInvalidList)).length;
    const hasEmptySlotInThreadMain = paddedThread.some((l) => !l.trim());
    if (invalidThreadInMain > 0 && !hasEmptySlotInThreadMain && existingThreadSupp.length === 0) {
      existingThreadSupp.push("");
    }
    setThreadSuppLinks(existingThreadSupp);
    setThreadSuppTags(existingThreadSupp.map((l) => (l ? postTags[l] || "" : "")));
    setThreadSuppHighlights(existingThreadSupp.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralLinks.has(l) : false)));
    setThreadSuppViralLikes(existingThreadSupp.map((l) => (l && !isUrlInList(l, qcInvalidList) ? viralPropMap.get(l) || "" : "")));

    setCommentDriveLink(report.commentDriveLink || "");
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 400);
  };

  // Helper làm mới form nộp bài
  const resetForm = (tFb = targetFb, tThread = targetThread) => {
    isRestoringRef.current = true;
    setFbLinks(Array(tFb).fill(""));
    setFbTags(Array(tFb).fill(""));
    setFbHighlights(Array(tFb).fill(false));
    setFbViralLikes(Array(tFb).fill(""));

    setFbSuppLinks([]);
    setFbSuppTags([]);
    setFbSuppHighlights([]);
    setFbSuppViralLikes([]);

    setThreadLinks(Array(tThread).fill(""));
    setThreadTags(Array(tThread).fill(""));
    setThreadHighlights(Array(tThread).fill(false));
    setThreadViralLikes(Array(tThread).fill(""));

    setThreadSuppLinks([]);
    setThreadSuppTags([]);
    setThreadSuppHighlights([]);
    setThreadSuppViralLikes([]);

    setCommentDriveLink("");
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 400);
  };

  // Helper nạp dữ liệu bản nháp (Draft) vào form
  const applyDraftToForm = (draft: ShiftDraftData, tFb = targetFb, tThread = targetThread) => {
    isRestoringRef.current = true;

    const paddedFb = [...(draft.fbLinks || [])];
    while (paddedFb.length < tFb) paddedFb.push("");
    setFbLinks(paddedFb);

    const paddedFbTags = [...(draft.fbTags || [])];
    while (paddedFbTags.length < tFb) paddedFbTags.push("");
    setFbTags(paddedFbTags);

    const paddedFbHigh = [...(draft.fbHighlights || [])];
    while (paddedFbHigh.length < tFb) paddedFbHigh.push(false);
    setFbHighlights(paddedFbHigh);

    const paddedFbViral = [...(draft.fbViralLikes || [])];
    while (paddedFbViral.length < tFb) paddedFbViral.push("");
    setFbViralLikes(paddedFbViral);

    setFbSuppLinks(draft.fbSuppLinks || []);
    setFbSuppTags(draft.fbSuppTags || []);
    setFbSuppHighlights(draft.fbSuppHighlights || []);
    setFbSuppViralLikes(draft.fbSuppViralLikes || []);

    const paddedThread = [...(draft.threadLinks || [])];
    while (paddedThread.length < tThread) paddedThread.push("");
    setThreadLinks(paddedThread);

    const paddedThreadTags = [...(draft.threadTags || [])];
    while (paddedThreadTags.length < tThread) paddedThreadTags.push("");
    setThreadTags(paddedThreadTags);

    const paddedThreadHigh = [...(draft.threadHighlights || [])];
    while (paddedThreadHigh.length < tThread) paddedThreadHigh.push(false);
    setThreadHighlights(paddedThreadHigh);

    const paddedThreadViral = [...(draft.threadViralLikes || [])];
    while (paddedThreadViral.length < tThread) paddedThreadViral.push("");
    setThreadViralLikes(paddedThreadViral);

    setThreadSuppLinks(draft.threadSuppLinks || []);
    setThreadSuppTags(draft.threadSuppTags || []);
    setThreadSuppHighlights(draft.threadSuppHighlights || []);
    setThreadSuppViralLikes(draft.threadSuppViralLikes || []);

    setCommentDriveLink(draft.commentDriveLink || "");

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 400);
  };

  // Helper nạp dữ liệu ca làm việc (Ưu tiên: Bản nháp tạm thời -> Báo cáo đã nộp -> Biểu mẫu trống)
  const loadShiftData = (targetShift: ShiftScheduleItem | null, curTargetFb = targetFb, curTargetThread = targetThread) => {
    if (!targetShift) {
      setSelectedShiftId("");
      resetForm(curTargetFb, curTargetThread);
      setDraftState({ active: false, savedAt: "", count: 0 });
      return;
    }

    const shiftIdStr = String(targetShift.id);
    setSelectedShiftId(shiftIdStr);

    const draft = getShiftDraft(shiftIdStr);
    const draftCount = countDraftLinks(draft);

    if (draft && draftCount > 0) {
      applyDraftToForm(draft, curTargetFb, curTargetThread);
      setDraftState({
        active: true,
        savedAt: draft.savedAt,
        count: draftCount,
      });
      showToast(`Đã tự động khôi phục ${draftCount} link tạm thời chưa submit của ca này!`, "success");
    } else if (targetShift.dailyReport) {
      loadReportToForm(targetShift.dailyReport, curTargetFb, curTargetThread);
      setDraftState({ active: false, savedAt: "", count: 0 });
    } else {
      resetForm(curTargetFb, curTargetThread);
      setDraftState({ active: false, savedAt: "", count: 0 });
    }
  };

  // Helper hủy/xóa bản nháp tạm thời và khôi phục form
  const handleDiscardDraft = () => {
    if (!selectedShiftId) return;
    clearShiftDraft(selectedShiftId);
    setDraftState({ active: false, savedAt: "", count: 0 });
    if (selectedShift?.dailyReport) {
      loadReportToForm(selectedShift.dailyReport);
      showToast("Đã hủy bản nháp tạm thời và khôi phục báo cáo đã lưu trước đó!", "success");
    } else {
      resetForm();
      showToast("Đã xóa toàn bộ link tạm thời khỏi biểu mẫu!", "success");
    }
  };

  // Fetch initial data theo tháng cho Lịch & Ca trực (Tab Nộp báo cáo)
  const fetchData = useCallback(
    async (month = calendarMonth, year = calendarYear) => {
      setLoading(true);
      try {
        const url = `/api/reports?month=${month}&year=${year}&limit=50`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Không thể tải dữ liệu ca làm việc");

        const data = await res.json();
        let curTargetFb = targetFb;
        let curTargetThread = targetThread;
        if (data.kpiConfig) {
          setKpiConfig(data.kpiConfig);
          curTargetFb = data.kpiConfig.fbPerShift || 10;
          curTargetThread = data.kpiConfig.threadPerShift || 4;
        }
        if (data.graceConfig) {
          setGraceConfig(data.graceConfig);
        }
        if (data.shiftRules) {
          setShiftRulesState(data.shiftRules);
        }
        if (data.shiftTimes) {
          setCustomShiftTimes(data.shiftTimes);
        }

        if (data.eligibleShifts) {
          setEligibleShifts(data.eligibleShifts);
        }
        const loadedMonthShifts: ShiftScheduleItem[] = data.monthShifts || [];
        if (loadedMonthShifts.length > 0) {
          setMonthShifts(loadedMonthShifts);
        }

        const curMonthShifts = loadedMonthShifts.length > 0 ? loadedMonthShifts : monthShifts;
        const shiftsOnCurrentSelectedDate = curMonthShifts.filter(
          (s) => formatDateToKey(s.shiftDate) === selectedDateStr
        );

        let targetShift = shiftsOnCurrentSelectedDate.find((s) => {
          const isAllowedStatus =
            ["REGISTERED", "APPROVED", "COMPLETED"].includes(s.status) ||
            (s.status === "ABSENT" && Boolean(s.reopenedBy));
          if (!isAllowedStatus) return false;
          const statusInfo = getShiftStatusInfo(
            selectedDateStr,
            s.shiftType,
            s.reopenedBy,
            s.reopenedUntil,
            s,
            data.shiftRules || shiftRulesState,
            data.kpiConfig || kpiConfig,
            data.shiftTimes || customShiftTimes
          );
          return (
            (!s.dailyReport && statusInfo.canSubmit) ||
            (Boolean(s.dailyReport) && statusInfo.canSubmit)
          );
        });

        if (!targetShift) {
          targetShift = shiftsOnCurrentSelectedDate.find((s) => Boolean(s.dailyReport));
        }

        if (!targetShift) {
          targetShift = shiftsOnCurrentSelectedDate.find((s) =>
            ["REGISTERED", "APPROVED", "COMPLETED"].includes(s.status)
          );
        }

        loadShiftData(targetShift || null, curTargetFb, curTargetThread);
      } catch (err: any) {
        showToast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [calendarMonth, calendarYear, selectedDateStr, monthShifts]
  );

  // Xử lý lọc dữ liệu lịch sử báo cáo khi user chọn ngày và bấm Lọc
  const handleFilterHistory = async (overrideDate?: string) => {
    const targetDate = overrideDate !== undefined ? overrideDate : historyDateFilter;
    if (!targetDate) {
      showToast("Vui lòng chọn ngày trước khi nhấn Lọc", "error");
      return;
    }

    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/reports?date=${targetDate}&limit=50`);
      if (!res.ok) throw new Error("Không thể tải dữ liệu báo cáo");

      const data = await res.json();
      setReportsHistory(data.reports || []);
      setHasFilteredHistory(true);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Đặt lại bộ lọc lịch sử về trạng thái ban đầu (chưa lọc)
  const handleResetHistory = () => {
    setHistoryDateFilter("");
    setHasFilteredHistory(false);
    setReportsHistory([]);
  };

  useEffect(() => {
    fetchData(calendarMonth, calendarYear);
  }, [calendarMonth, calendarYear]);

  // Xử lý chuyển tháng trên Calendar
  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  // Map ngày với các ca trong tháng để hiển thị dots trên calendar
  const dateShiftMap = useMemo(() => {
    const map = new Map<string, { hasSubmitted: boolean; hasPending: boolean }>();
    for (const shift of monthShifts) {
      const dateKey = formatDateToKey(shift.shiftDate);
      const current = map.get(dateKey) || { hasSubmitted: false, hasPending: false };
      const statusInfo = getShiftStatusInfo(
        dateKey,
        shift.shiftType,
        shift.reopenedBy,
        shift.reopenedUntil,
        shift,
        shiftRulesState,
        kpiConfig,
        customShiftTimes
      );
      const isReopened =
        statusInfo.phase === "SPECIAL_REOPEN" ||
        statusInfo.phase === "WEEKLY_MAKEUP" ||
        statusInfo.phase === "POST_SHIFT_EDIT";

      if (isReopened) {
        current.hasPending = true;
      } else if (shift.dailyReport) {
        current.hasSubmitted = true;
      } else if (
        ["REGISTERED", "APPROVED", "COMPLETED"].includes(shift.status) ||
        (shift.status === "ABSENT" && Boolean(shift.reopenedBy))
      ) {
        current.hasPending = true;
      }
      map.set(dateKey, current);
    }
    return map;
  }, [monthShifts]);

  // Danh sách các ca trong ngày đang chọn
  const shiftsOnSelectedDay = useMemo(() => {
    const shifts = monthShifts.filter((s) => formatDateToKey(s.shiftDate) === selectedDateStr);
    return STANDARD_SHIFTS.map((std) => {
      const matched = shifts.find((s) => s.shiftType === std.type);
      return {
        ...std,
        timeRange: customShiftTimes[std.type]
          ? `${customShiftTimes[std.type].startTime} - ${customShiftTimes[std.type].endTime}`
          : std.timeRange,
        registration: matched || null,
      };
    });
  }, [monthShifts, selectedDateStr, customShiftTimes]);

  // Kiểm tra ngày đang chọn có ca nào đang chờ nộp báo cáo không
  const hasPendingShiftOnSelectedDate = useMemo(() => {
    return shiftsOnSelectedDay.some((s) => {
      if (!s.registration) return false;
      const reg = s.registration;
      const isAllowed =
        ["REGISTERED", "APPROVED", "COMPLETED"].includes(reg.status) ||
        (reg.status === "ABSENT" && Boolean(reg.reopenedBy));
      if (!isAllowed) return false;
      const statusInfo = getShiftStatusInfo(
        selectedDateStr,
        s.type,
        reg.reopenedBy,
        reg.reopenedUntil,
        reg,
        shiftRulesState,
        kpiConfig,
        customShiftTimes
      );
      return (
        (!reg.dailyReport && statusInfo.canSubmit) ||
        (Boolean(reg.dailyReport) && statusInfo.canSubmit)
      );
    });
  }, [shiftsOnSelectedDay, selectedDateStr, shiftRulesState, kpiConfig, customShiftTimes]);

  // Thông tin ca đang được chọn để nộp báo cáo
  const selectedShift = useMemo(() => {
    if (!selectedShiftId) return null;
    return monthShifts.find((s) => String(s.id) === selectedShiftId) || null;
  }, [selectedShiftId, monthShifts]);

  const selectedShiftStatusInfo = useMemo(() => {
    if (!selectedShift) return null;
    return getShiftStatusInfo(
      formatDateToKey(selectedShift.shiftDate),
      selectedShift.shiftType,
      selectedShift.reopenedBy,
      selectedShift.reopenedUntil,
      selectedShift,
      shiftRulesState,
      kpiConfig,
      customShiftTimes
    );
  }, [selectedShift, shiftRulesState, kpiConfig, customShiftTimes]);

  // Khi click chọn một ca làm việc ở Cột 1: Luôn fill data lên form
  const handleSelectShift = (shiftItem: { type: "MORNING" | "AFTERNOON" | "EVENING"; registration: ShiftScheduleItem | null }) => {
    if (!shiftItem.registration) {
      showToast("Bạn không đăng ký ca làm việc này!", "error");
      return;
    }

    const reg = shiftItem.registration;
    const statusInfo = getShiftStatusInfo(
      selectedDateStr,
      shiftItem.type,
      reg.reopenedBy,
      reg.reopenedUntil,
      reg,
      shiftRulesState,
      kpiConfig,
      customShiftTimes
    );

    loadShiftData(reg);
    setIsShiftSelectorOpenMobile(false);

    const hasDraft = Boolean(getShiftDraft(String(reg.id)) && countDraftLinks(getShiftDraft(String(reg.id))) > 0);
    if (!hasDraft) {
      if (reg.dailyReport) {
        if (statusInfo.canSubmit) {
          showToast(`Đã mở quyền sửa (${statusInfo.badgeText}). Đã tải thông tin báo cáo cũ để bạn chỉnh sửa!`, "success");
        } else {
          showToast("Đã tải dữ liệu báo cáo của ca làm việc lên biểu mẫu!", "success");
        }
      } else if (!statusInfo.canSubmit) {
        showToast(statusInfo.reason, "error");
      }
    }
  };

  // Khi click chọn ngày trên lịch
  const handleSelectDate = (dateKey: string) => {
    setSelectedDateStr(dateKey);
    const dayShifts = monthShifts.filter((s) => formatDateToKey(s.shiftDate) === dateKey);

    let targetShift = dayShifts.find((s) => {
      const isAllowedStatus =
        ["REGISTERED", "APPROVED", "COMPLETED"].includes(s.status) ||
        (s.status === "ABSENT" && Boolean(s.reopenedBy));
      if (!isAllowedStatus) return false;
      const statusInfo = getShiftStatusInfo(
        dateKey,
        s.shiftType,
        s.reopenedBy,
        s.reopenedUntil,
        s,
        shiftRulesState,
        kpiConfig,
        customShiftTimes
      );
      return (
        (!s.dailyReport && statusInfo.canSubmit) ||
        (Boolean(s.dailyReport) && statusInfo.canSubmit)
      );
    });

    if (!targetShift) {
      targetShift = dayShifts.find((s) => Boolean(s.dailyReport));
    }

    if (!targetShift) {
      targetShift = dayShifts.find((s) =>
        ["REGISTERED", "APPROVED", "COMPLETED"].includes(s.status)
      );
    }

    loadShiftData(targetShift || null);
  };

  // KPI Progress Counters
  const filledFbCount = useMemo(() => fbLinks.filter((l) => l.trim().length > 0).length, [fbLinks]);
  const filledThreadCount = useMemo(
    () => threadLinks.filter((l) => l.trim().length > 0).length,
    [threadLinks]
  );
  const isDriveFilled = useMemo(
    () => commentDriveLink.trim().length > 0,
    [commentDriveLink]
  );

  // Kiểm tra từng card có thực sự chứa link đã nhập để hiển thị badge "Lưu tạm" riêng biệt (theo yêu cầu)
  const hasFbDraftLinks = useMemo(
    () => draftState.active && (fbLinks.some((l) => l.trim().length > 0) || fbSuppLinks.some((l) => l.trim().length > 0)),
    [draftState.active, fbLinks, fbSuppLinks]
  );

  const hasThreadDraftLinks = useMemo(
    () => draftState.active && (threadLinks.some((l) => l.trim().length > 0) || threadSuppLinks.some((l) => l.trim().length > 0)),
    [draftState.active, threadLinks, threadSuppLinks]
  );

  const hasDriveDraftLink = useMemo(
    () => draftState.active && commentDriveLink.trim().length > 0,
    [draftState.active, commentDriveLink]
  );

  // Kiểm tra form có dữ liệu link chưa lưu để kích hoạt cảnh báo rời trang
  const hasUnsavedData = useMemo(() => {
    if (!selectedShiftId || !selectedShiftStatusInfo?.canSubmit || submitting) return false;
    const filledFb = fbLinks.some((l) => l.trim().length > 0) || fbSuppLinks.some((l) => l.trim().length > 0);
    const filledThread = threadLinks.some((l) => l.trim().length > 0) || threadSuppLinks.some((l) => l.trim().length > 0);
    const filledDrive = commentDriveLink.trim().length > 0;
    return draftState.active || filledFb || filledThread || filledDrive;
  }, [selectedShiftId, selectedShiftStatusInfo, submitting, draftState.active, fbLinks, fbSuppLinks, threadLinks, threadSuppLinks, commentDriveLink]);

  // 1. Cảnh báo bảo vệ phòng tuyến cuối cùng khi người dùng đóng tab hoặc bấm nút reload của trình duyệt
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isBypassingUnloadRef.current) return;
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedData]);

  // 2. Chặn các phím tắt reload (F5, Ctrl+R, Cmd+R, Ctrl+Shift+R, Cmd+Shift+R) để hiển thị Custom Modal thay vì native alert mặc định
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasUnsavedData) return;

      const isReloadKey =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"));

      if (isReloadKey) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigationUrl("RELOAD");
        setShowUnsavedModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hasUnsavedData]);

  // 3. Cảnh báo khi người dùng chuyển sang page khác trong hệ thống (Sidebar, Topbar, Link điều hướng)
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (!hasUnsavedData) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      // Bỏ qua các link mở tab mới, anchor hash hoặc link javascript/external
      if (!href || target.target === "_blank" || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      // Nếu bấm vào các trang khác trong dashboard (không phải trang /bao-cao hiện tại)
      if (href !== "/bao-cao" && !href.startsWith("/bao-cao?")) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigationUrl(href);
        setShowUnsavedModal(true);
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedData]);

  const handleConfirmLeave = () => {
    isBypassingUnloadRef.current = true;
    setShowUnsavedModal(false);
    if (pendingNavigationUrl === "RELOAD") {
      window.location.reload();
    } else if (pendingNavigationUrl === "TAB_HISTORY") {
      setActiveTab("HISTORY");
      setPendingNavigationUrl(null);
    } else if (pendingNavigationUrl) {
      router.push(pendingNavigationUrl);
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedModal(false);
    setPendingNavigationUrl(null);
  };

  // Danh sách các link bị QC đánh dấu không hợp lệ trong ca đang chọn
  const currentShiftQcReview = selectedShift?.dailyReport?.qcReview;
  const currentInvalidLinks = useMemo(() => {
    if (!currentShiftQcReview?.invalidLinks) return [];
    return Array.isArray(currentShiftQcReview.invalidLinks) ? currentShiftQcReview.invalidLinks : [];
  }, [currentShiftQcReview]);

  const isFormLinkInvalid = useCallback(
    (url: string) => {
      return isUrlInList(url, currentInvalidLinks);
    },
    [currentInvalidLinks]
  );

  // Helper kiểm tra xem 1 URL có phải link cũ đã được nộp từ trước hay không
  const isOldReportLink = useCallback(
    (url: string) => {
      if (!url || !url.trim() || !selectedShift?.dailyReport) return false;
      const rep = selectedShift.dailyReport;
      const allOld = [
        ...(rep.fbLinks || []),
        ...(rep.fbSupplementLinks || []),
        ...(rep.threadLinks || []),
      ];
      return isUrlInList(url, allOld);
    },
    [selectedShift]
  );

  const fbInvalidFormCount = useMemo(() => {
    return fbLinks.filter((l) => l.trim() && isFormLinkInvalid(l)).length;
  }, [fbLinks, isFormLinkInvalid]);

  const fbSuppInvalidFormCount = useMemo(() => {
    return fbSuppLinks.filter((l) => l.trim() && isFormLinkInvalid(l)).length;
  }, [fbSuppLinks, isFormLinkInvalid]);

  const threadInvalidFormCount = useMemo(() => {
    return threadLinks.filter((l) => l.trim() && isFormLinkInvalid(l)).length;
  }, [threadLinks, isFormLinkInvalid]);

  // State lưu trạng thái đang cập nhật riêng thẻ Loại bài & Nổi bật
  const [updatingTags, setUpdatingTags] = useState<boolean>(false);

  // Kiểm tra thời hạn cho phép gắn loại bài (tagGrace) và đề xuất viral (viralGrace)
  const taggingGraceInfo = useMemo(() => {
    if (!selectedShift?.dailyReport?.submittedAt) {
      return {
        isWithinTagGrace: false,
        isWithinViralGrace: false,
        tagRemainingDays: 0,
        viralRemainingDays: 0,
        tagDeadlineStr: "",
        viralDeadlineStr: "",
      };
    }
    const submittedTime = new Date(selectedShift.dailyReport.submittedAt).getTime();
    const tagDays = graceConfig.tagPostGraceDays || 7;
    const viralDays = graceConfig.viralPostGraceDays || 30;
    const tagDeadlineTime = submittedTime + tagDays * 24 * 60 * 60 * 1000;
    const viralDeadlineTime = submittedTime + viralDays * 24 * 60 * 60 * 1000;
    const nowTime = Date.now();

    const isWithinTagGrace = nowTime <= tagDeadlineTime;
    const isWithinViralGrace = nowTime <= viralDeadlineTime;
    const tagRemainingDays = Math.max(0, Math.ceil((tagDeadlineTime - nowTime) / (24 * 60 * 60 * 1000)));
    const viralRemainingDays = Math.max(0, Math.ceil((viralDeadlineTime - nowTime) / (24 * 60 * 60 * 1000)));

    const formatDt = (ts: number) =>
      new Date(ts).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

    return {
      isWithinTagGrace,
      isWithinViralGrace,
      tagRemainingDays,
      viralRemainingDays,
      tagDeadlineStr: formatDt(tagDeadlineTime),
      viralDeadlineStr: formatDt(viralDeadlineTime),
    };
  }, [selectedShift, graceConfig]);

  // canUpdatePostMetaOnly: Ca đã đóng, nhưng còn trong hạn gắn thẻ Loại bài HOẶC gắn cờ Viral
  const canUpdatePostMetaOnly = useMemo(() => {
    if (!selectedShift || !selectedShift.dailyReport) return false;
    if (selectedShiftStatusInfo?.canSubmit) return false;
    return taggingGraceInfo.isWithinTagGrace || taggingGraceInfo.isWithinViralGrace;
  }, [selectedShift, selectedShiftStatusInfo, taggingGraceInfo]);

  const canUpdateTagsOnly = useMemo(() => {
    if (!selectedShift || !selectedShift.dailyReport) return false;
    if (selectedShiftStatusInfo?.canSubmit) return false;
    return taggingGraceInfo.isWithinTagGrace;
  }, [selectedShift, selectedShiftStatusInfo, taggingGraceInfo]);

  const canUpdateViralOnly = useMemo(() => {
    if (!selectedShift || !selectedShift.dailyReport) return false;
    if (selectedShiftStatusInfo?.canSubmit) return false;
    return taggingGraceInfo.isWithinViralGrace;
  }, [selectedShift, selectedShiftStatusInfo, taggingGraceInfo]);

  // Kiểm tra biểu mẫu có bị khóa/vô hiệu hóa không (chưa chọn ca, hoặc ca đã qua giờ / hết hạn nộp bù)
  const isFormDisabled = useMemo(() => {
    return !selectedShiftId || !selectedShiftStatusInfo?.canSubmit;
  }, [selectedShiftId, selectedShiftStatusInfo]);

  // Bộ đếm link HỢP LỆ (không rỗng và không bị QC từ chối)
  const validMainFbCount = useMemo(
    () => fbLinks.filter((l) => l.trim() && !isFormLinkInvalid(l)).length,
    [fbLinks, isFormLinkInvalid]
  );
  const validSuppFbCount = useMemo(
    () => fbSuppLinks.filter((l) => l.trim() && !isFormLinkInvalid(l)).length,
    [fbSuppLinks, isFormLinkInvalid]
  );
  const totalValidFbCount = validMainFbCount + validSuppFbCount;

  const validMainThreadCount = useMemo(
    () => threadLinks.filter((l) => l.trim() && !isFormLinkInvalid(l)).length,
    [threadLinks, isFormLinkInvalid]
  );
  const validSuppThreadCount = useMemo(
    () => threadSuppLinks.filter((l) => l.trim() && !isFormLinkInvalid(l)).length,
    [threadSuppLinks, isFormLinkInvalid]
  );
  const totalValidThreadCount = validMainThreadCount + validSuppThreadCount;

  const hasEmptySlotInMainFb = useMemo(() => fbLinks.some((l) => !l.trim()), [fbLinks]);
  const hasEmptySlotInMainThread = useMemo(() => threadLinks.some((l) => !l.trim()), [threadLinks]);

  // Handle cập nhật Loại bài viết và Bài viết nổi bật sau ca (trong hạn 7 ngày)
  const handleUpdateTagsOnly = async () => {
    if (!selectedShift?.dailyReport?.id) {
      showToast("Không tìm thấy báo cáo ca làm việc để cập nhật", "error");
      return;
    }

    setUpdatingTags(true);
    try {
      const postTagsMap: Record<string, string> = {};
      const userViralLinks: string[] = [];
      const userViralProposals: Array<{ url: string; likes: number }> = [];

      fbLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (fbTags[idx]) postTagsMap[trimmed] = fbTags[idx];
          // RULE: Link bị QC từ chối thì không cho phép gắn nổi bật
          if (fbHighlights[idx] && !isFormLinkInvalid(trimmed)) {
            userViralLinks.push(trimmed);
          }
          const likesVal = parseInt(String(fbViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      fbSuppLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (fbSuppTags[idx]) postTagsMap[trimmed] = fbSuppTags[idx];
          if (fbSuppHighlights[idx] && !isFormLinkInvalid(trimmed)) {
            userViralLinks.push(trimmed);
          }
          const likesVal = parseInt(String(fbSuppViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      threadLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (threadTags[idx]) postTagsMap[trimmed] = threadTags[idx];
          if (threadHighlights[idx] && !isFormLinkInvalid(trimmed)) {
            userViralLinks.push(trimmed);
          }
          const likesVal = parseInt(String(threadViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      threadSuppLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (threadSuppTags[idx]) postTagsMap[trimmed] = threadSuppTags[idx];
          if (threadSuppHighlights[idx] && !isFormLinkInvalid(trimmed)) {
            userViralLinks.push(trimmed);
          }
          const likesVal = parseInt(String(threadSuppViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      const res = await fetch(`/api/reports/${selectedShift.dailyReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postTags: postTagsMap,
          viralPostLinks: userViralLinks,
          viralProposals: userViralProposals,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật thẻ & nổi bật");

      showToast(data.message || "Cập nhật loại bài viết, bài nổi bật và đề xuất viral thành công!");
      await fetchData(calendarMonth, calendarYear);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setUpdatingTags(false);
    }
  };

  // Handle Submit Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShiftId || !selectedShiftStatusInfo) {
      showToast("Vui lòng chọn ca làm việc hợp lệ để gửi báo cáo", "error");
      return;
    }

    if (!selectedShiftStatusInfo.canSubmit) {
      showToast(selectedShiftStatusInfo.reason, "error");
      return;
    }

    if (filledFbCount === 0 && filledThreadCount === 0) {
      showToast("Vui lòng nhập ít nhất 1 link bài viết để nộp", "error");
      return;
    }

    // Bắt buộc bổ sung link mới nếu có link bị QC từ chối
    if (fbInvalidFormCount > 0 && totalValidFbCount < targetFb) {
      showToast(
        `Bạn có ${fbInvalidFormCount} link Facebook bị QC từ chối (gạch đỏ). Bắt buộc phải bổ sung link mới hợp lệ (hiện đạt ${totalValidFbCount}/${targetFb} bài hợp lệ) trước khi nộp!`,
        "error"
      );
      return;
    }

    if (threadInvalidFormCount > 0 && totalValidThreadCount < targetThread) {
      showToast(
        `Bạn có ${threadInvalidFormCount} link Threads bị QC từ chối (gạch đỏ). Bắt buộc phải bổ sung link mới hợp lệ (hiện đạt ${totalValidThreadCount}/${targetThread} bài hợp lệ) trước khi nộp!`,
        "error"
      );
      return;
    }

    setSubmitting(true);
    try {
      // Thu thập postTags, bài viết nổi bật và đề xuất viral do user gắn
      const postTagsMap: Record<string, string> = {};
      const userViralLinks: string[] = [];
      const userViralProposals: Array<{ url: string; likes: number }> = [];

      fbLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (fbTags[idx]) postTagsMap[trimmed] = fbTags[idx];
          // RULE: Link bị QC từ chối thì không cho phép gắn nổi bật
          if (fbHighlights[idx] && !isFormLinkInvalid(trimmed)) userViralLinks.push(trimmed);
          const likesVal = parseInt(String(fbViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      fbSuppLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (fbSuppTags[idx]) postTagsMap[trimmed] = fbSuppTags[idx];
          if (fbSuppHighlights[idx] && !isFormLinkInvalid(trimmed)) userViralLinks.push(trimmed);
          const likesVal = parseInt(String(fbSuppViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      threadLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (threadTags[idx]) postTagsMap[trimmed] = threadTags[idx];
          if (threadHighlights[idx] && !isFormLinkInvalid(trimmed)) userViralLinks.push(trimmed);
          const likesVal = parseInt(String(threadViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      threadSuppLinks.forEach((link, idx) => {
        const trimmed = link.trim();
        if (trimmed) {
          if (threadSuppTags[idx]) postTagsMap[trimmed] = threadSuppTags[idx];
          if (threadSuppHighlights[idx] && !isFormLinkInvalid(trimmed)) userViralLinks.push(trimmed);
          const likesVal = parseInt(String(threadSuppViralLikes[idx] || 0), 10);
          if (likesVal > 0 && !isFormLinkInvalid(trimmed)) {
            userViralProposals.push({ url: trimmed, likes: likesVal });
          }
        }
      });

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftRegistrationId: parseInt(selectedShiftId),
          fbLinks,
          fbSupplementLinks: fbSuppLinks,
          threadLinks: [...threadLinks.slice(0, targetThread), ...threadSuppLinks],
          commentDriveLink,
          femaleContentLinks: [],
          viralPostLinks: userViralLinks,
          viralProposals: userViralProposals,
          postTags: postTagsMap,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu báo cáo");

      showToast(data.message || "Nộp báo cáo thành công!");

      // Dọn dẹp bản nháp tạm thời của ca vừa nộp thành công
      clearShiftDraft(selectedShiftId);
      setDraftState({ active: false, savedAt: "", count: 0 });

      // Reset form
      resetForm();

      // Refresh dữ liệu
      await fetchData(calendarMonth, calendarYear);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Render các ngày trong ma trận Calendar
  const renderCalendarDays = () => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon...
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Số ngày của tháng trước để bù đầu tuần
    const prevMonthLastDay = new Date(calendarYear, calendarMonth - 1, 0).getDate();

    const days = [];

    // Ngày của tháng trước
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(calendarYear, calendarMonth - 2, dayNum);
      const dateKey = formatDateToKey(prevDate);
      days.push({
        dayNum,
        dateKey,
        isCurrentMonth: false,
      });
    }

    // Ngày của tháng hiện tại
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const curDate = new Date(calendarYear, calendarMonth - 1, dayNum);
      const dateKey = formatDateToKey(curDate);
      days.push({
        dayNum,
        dateKey,
        isCurrentMonth: true,
      });
    }

    // Ngày của tháng tiếp theo để làm tròn bội số 7
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let dayNum = 1; dayNum <= remainingDays; dayNum++) {
        const nextDate = new Date(calendarYear, calendarMonth, dayNum);
        const dateKey = formatDateToKey(nextDate);
        days.push({
          dayNum,
          dateKey,
          isCurrentMonth: false,
        });
      }
    }

    return days.map((d, index) => {
      const isSelected = d.dateKey === selectedDateStr;
      const shiftStatus = dateShiftMap.get(d.dateKey);

      return (
        <div
          key={index}
          onClick={() => handleSelectDate(d.dateKey)}
          style={{
            minHeight: "38px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            cursor: "pointer",
            position: "relative",
            fontSize: "0.8125rem",
            fontWeight: isSelected ? 700 : 500,
            color: isSelected
              ? "#ffffff"
              : d.isCurrentMonth
              ? "var(--text-primary)"
              : "var(--text-muted)",
            background: isSelected
              ? "linear-gradient(135deg, rgba(249, 115, 22, 0.9) 0%, rgba(234, 88, 12, 0.95) 100%)"
              : "transparent",
            border: isSelected
              ? "1px solid #ea580c"
              : "1px solid transparent",
            boxShadow: isSelected ? "0 0 12px rgba(249, 115, 22, 0.4)" : "none",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          <span>{d.dayNum}</span>

          {/* Dots biểu thị trạng thái nộp báo cáo */}
          <div style={{ display: "flex", gap: "3px", marginTop: "2px", height: "4px" }}>
            {shiftStatus?.hasSubmitted && (
              <span
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                }}
                title="Đã nộp báo cáo"
              />
            )}
            {shiftStatus?.hasPending && (
              <span
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  backgroundColor: "#f97316",
                }}
                title="Có ca chưa nộp báo cáo"
              />
            )}
          </div>
        </div>
      );
    });
  };

  // Format ngày hiển thị tiếng Việt (VD: 17/09/2026)
  const displaySelectedDateVN = useMemo(() => {
    if (!selectedDateStr) return "";
    const [y, m, d] = selectedDateStr.split("-");
    return `${d}/${m}/${y}`;
  }, [selectedDateStr]);

  return (
    <div className="animate-fadeIn" style={{ margin: "0 auto" }}>
      {/* Toast Notification */}
      {toast && (
        <div className="app-toast-container">
          <div className={`app-toast ${toast.type}`}>
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 className="page-title" style={{ fontSize: "1.625rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Báo Cáo Seeding Hàng Ngày
          </h1>
          <p className="page-subtitle" style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Nộp link bài viết Facebook, Threads và ảnh minh chứng 50 comment theo từng ca làm việc
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button
            className={`btn btn-sm ${activeTab === "SUBMIT" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("SUBMIT")}
            style={{
              padding: "0.5rem 1rem",
              fontWeight: 600,
              boxShadow: activeTab === "SUBMIT" ? "0 0 16px rgba(249, 115, 22, 0.3)" : "none",
            }}
          >
            <Send size={15} /> Nộp Báo Cáo Ca Mới
          </button>
          <button
            className={`btn btn-sm ${activeTab === "HISTORY" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              if (activeTab === "SUBMIT" && hasUnsavedData) {
                setPendingNavigationUrl("TAB_HISTORY");
                setShowUnsavedModal(true);
              } else {
                setActiveTab("HISTORY");
              }
            }}
            style={{ padding: "0.5rem 1rem", fontWeight: 600 }}
          >
            <History size={15} /> Lịch Sử & QC Chấm Điểm
          </button>
        </div>
      </div>

      {/* TAB 1: FORM NỘP BÁO CÁO THEO 3 CỘT DESIGN */}
      {activeTab === "SUBMIT" && (
        <form onSubmit={handleSubmitReport}>
          <div className="seeding-report-layout">
            {/* CỘT 1: CHỌN NGÀY & CA LÀM VIỆC */}
            <div className="seeding-col-shifts">
              {/* MOBILE COMPACT SHIFT BAR: Chỉ hiển thị trên mobile/tablet <= 900px */}
              <div className="seeding-mobile-shift-bar">
                <div className="seeding-mobile-shift-info">
                  <div className="seeding-mobile-shift-date">
                    <CalendarIcon size={14} />
                    <span>{displaySelectedDateVN}</span>
                  </div>
                  <div className="seeding-mobile-shift-name">
                    {selectedShift ? (
                      <>
                        <span className="shift-title">
                          {STANDARD_SHIFTS.find((s) => s.type === selectedShift.shiftType)?.title || selectedShift.shiftType}
                        </span>
                        <span className="shift-time">
                          ({STANDARD_SHIFTS.find((s) => s.type === selectedShift.shiftType)?.timeRange})
                        </span>
                        {selectedShift.dailyReport ? (
                          <span
                            className="shift-badge"
                            style={{
                              backgroundColor: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              border: "1px solid rgba(16, 185, 129, 0.35)",
                            }}
                          >
                            <CheckCircle2 size={11} /> Đã nộp
                          </span>
                        ) : selectedShiftStatusInfo ? (
                          <span
                            className="shift-badge"
                            style={{
                              backgroundColor: selectedShiftStatusInfo.badgeBg,
                              color: selectedShiftStatusInfo.badgeColor,
                              border: `1px solid ${selectedShiftStatusInfo.badgeBorder}`,
                            }}
                          >
                            {selectedShiftStatusInfo.badgeText}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="shift-none">Chưa chọn ca</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="seeding-mobile-shift-toggle-btn"
                  onClick={() => setIsShiftSelectorOpenMobile((prev) => !prev)}
                >
                  <span>{isShiftSelectorOpenMobile ? "Thu gọn" : "Đổi ca / Lịch"}</span>
                  <ChevronDown
                    size={15}
                    style={{
                      transform: isShiftSelectorOpenMobile ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
              </div>

              {/* KHỐI LỊCH & DANH SÁCH CA (Collapsible trên Mobile, hiển thị đầy đủ trên Desktop) */}
              <div className={`seeding-shift-picker-container ${isShiftSelectorOpenMobile ? "is-expanded" : ""}`}>
                <div
                  className="card"
                  style={{
                    padding: "1.25rem",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "14px",
                  }}
                >
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                  1. Chọn ngày & ca làm việc nộp báo cáo <span style={{ color: "var(--danger)" }}>*</span>
                </div>

                {/* MINI CALENDAR */}
                <div
                  style={{
                    background: "var(--bg-surface)",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    padding: "0.75rem",
                  }}
                >
                  {/* Calendar Header: Tháng MM - YYYY */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="btn-ghost btn-icon"
                      style={{ padding: "4px 8px", color: "var(--text-secondary)", cursor: "pointer" }}
                      title="Tháng trước"
                    >
                      &lt;
                    </button>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      Tháng {String(calendarMonth).padStart(2, "0")} - {calendarYear}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="btn-ghost btn-icon"
                      style={{ padding: "4px 8px", color: "var(--text-secondary)", cursor: "pointer" }}
                      title="Tháng sau"
                    >
                      &gt;
                    </button>
                  </div>

                  {/* Day of Week Headers */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      textAlign: "center",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: "0.375rem",
                    }}
                  >
                    <div>Su</div>
                    <div>Mo</div>
                    <div>Tu</div>
                    <div>We</div>
                    <div>Th</div>
                    <div>Fr</div>
                    <div>Sa</div>
                  </div>

                  {/* Days Matrix */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: "3px",
                    }}
                  >
                    {renderCalendarDays()}
                  </div>

                  {/* Legend */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "1.25rem",
                      marginTop: "0.75rem",
                      paddingTop: "0.625rem",
                      borderTop: "1px solid var(--border-color)",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                      <span>Đã nộp</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#f97316" }} />
                      <span>Sắp tới</span>
                    </div>
                  </div>
                </div>

                {/* DANH SÁCH CA THEO NGÀY ĐÃ CHỌN */}
                <div style={{ marginTop: "1.25rem" }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Ngày đã chọn: {displaySelectedDateVN}
                  </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {shiftsOnSelectedDay.map((shiftItem) => {
                      const reg = shiftItem.registration;
                      const hasReport = Boolean(reg?.dailyReport);
                      const isRegistered = Boolean(reg);
                      const isSelectedToSubmit = reg && String(reg.id) === selectedShiftId;

                      // Xác định trạng thái thời gian và quyền nộp
                      const statusInfo = reg
                        ? getShiftStatusInfo(
                            selectedDateStr,
                            shiftItem.type,
                            reg.reopenedBy,
                            reg.reopenedUntil,
                            reg,
                            shiftRulesState,
                            kpiConfig,
                            customShiftTimes
                          )
                        : null;

                      const isReopened =
                        statusInfo?.phase === "SPECIAL_REOPEN" ||
                        statusInfo?.phase === "WEEKLY_MAKEUP" ||
                        statusInfo?.phase === "POST_SHIFT_EDIT";

                      let badgeText = "Không ĐK";
                      let badgeColor = "var(--text-muted)";
                      let badgeBg = "var(--bg-hover)";
                      let badgeBorder = "var(--border-subtle)";
                      let dotColor = "var(--text-muted)";
                      let isClickable = false;

                      // Ưu tiên cao nhất: nếu Quản lý đã mở bù -> hiện badge [Mở nộp bù] tím và cho phép click nộp
                      if (isReopened) {
                        badgeText = statusInfo.badgeText;
                        badgeColor = statusInfo.badgeColor;
                        badgeBg = statusInfo.badgeBg;
                        badgeBorder = statusInfo.badgeBorder;
                        dotColor = statusInfo.badgeColor;
                        isClickable = true;
                      } else if (hasReport) {
                        badgeText = "Đã nộp";
                        badgeColor = "#10b981";
                        badgeBg = "rgba(16, 185, 129, 0.12)";
                        badgeBorder = "rgba(16, 185, 129, 0.35)";
                        dotColor = "#10b981";
                        isClickable = true;
                      } else if (isRegistered && statusInfo) {
                        badgeText = statusInfo.badgeText;
                        badgeColor = statusInfo.badgeColor;
                        badgeBg = statusInfo.badgeBg;
                        badgeBorder = statusInfo.badgeBorder;
                        dotColor = statusInfo.badgeColor;
                        isClickable = true;
                      }

                      const submittedTimeStr = reg?.dailyReport?.submittedAt
                        ? new Date(reg.dailyReport.submittedAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";

                      const shiftDraft = reg ? getShiftDraft(String(reg.id)) : null;
                      const hasDraft = Boolean(shiftDraft && countDraftLinks(shiftDraft) > 0);

                      return (
                        <div
                          key={shiftItem.type}
                          onClick={() => isClickable && handleSelectShift(shiftItem)}
                          style={{
                            padding: "1rem",
                            borderRadius: "10px",
                            backgroundColor: isSelectedToSubmit
                              ? "rgba(249, 115, 22, 0.12)"
                              : isRegistered
                              ? "var(--bg-card)"
                              : "var(--bg-surface)",
                            border: isSelectedToSubmit
                              ? "1.5px solid var(--primary)"
                              : isReopened
                              ? "1px solid rgba(168, 85, 247, 0.5)"
                              : isRegistered
                              ? "1px solid var(--border-color)"
                              : "1px dashed var(--border-color)",
                            cursor: isClickable ? "pointer" : "not-allowed",
                            opacity: isRegistered ? 1 : 0.75,
                            transition: "all 0.15s ease",
                            position: "relative",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          {/* Dòng 1: Tiêu đề Ca làm việc */}
                          <div
                            style={{
                              fontSize: "0.9375rem",
                              fontWeight: 700,
                              color: isRegistered ? "var(--text-primary)" : "var(--text-secondary)",
                              marginBottom: "0.5rem",
                            }}
                          >
                            {shiftItem.title} ({shiftItem.timeRange})
                          </div>

                          {/* Dòng 2: Hàng các Badge trạng thái */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "0.75rem",
                              flexWrap: "wrap",
                            }}
                          >
                            {/* Badge bản nháp lưu tạm */}
                            {hasDraft && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                  borderRadius: "5px",
                                  backgroundColor: "rgba(245, 158, 11, 0.18)",
                                  color: "#f59e0b",
                                  border: "1px solid rgba(245, 158, 11, 0.45)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Ca làm việc này đang có liên kết lưu tạm thời chưa nộp"
                              >
                                <Clock size={12} /> [Có nháp]
                              </span>
                            )}

                            {/* Badge nộp báo cáo */}
                            {isReopened ? (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                  borderRadius: "5px",
                                  backgroundColor: "rgba(168, 85, 247, 0.18)",
                                  color: "#a855f7",
                                  border: "1px solid rgba(168, 85, 247, 0.45)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Unlock size={13} /> [Mở nộp bù]
                              </span>
                            ) : hasReport ? (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                  borderRadius: "5px",
                                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                                  color: "#10b981",
                                  border: "1px solid rgba(16, 185, 129, 0.4)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <CheckCircle2 size={13} /> Đã Nộp{submittedTimeStr ? `: ${submittedTimeStr}` : ""}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                  borderRadius: "5px",
                                  backgroundColor: badgeBg,
                                  color: badgeColor,
                                  border: `1px solid ${badgeBorder}`,
                                }}
                              >
                                [{badgeText}]
                              </span>
                            )}

                            {/* Nút xem lại bài cũ nếu ca này đã từng nộp và đang được mở bù */}
                            {Boolean(reg?.dailyReport) && isReopened && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "2px 8px",
                                  borderRadius: "5px",
                                  color: "var(--text-secondary)",
                                  border: "1px solid rgba(255, 255, 255, 0.12)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectShift(shiftItem);
                                }}
                                title="Tải lại báo cáo đã nộp lên biểu mẫu"
                              >
                                <Eye size={12} /> Xem bài cũ
                              </button>
                            )}

                            {/* Badge trạng thái QC duyệt cho ca đã nộp */}
                            {hasReport && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "3px 8px",
                                  borderRadius: "5px",
                                  backgroundColor:
                                    reg?.dailyReport?.qcReview?.result === "PASS"
                                      ? "rgba(16, 185, 129, 0.12)"
                                      : reg?.dailyReport?.qcReview?.result === "FAIL"
                                      ? "rgba(239, 68, 68, 0.12)"
                                      : "rgba(245, 158, 11, 0.12)",
                                  color:
                                    reg?.dailyReport?.qcReview?.result === "PASS"
                                      ? "#10b981"
                                      : reg?.dailyReport?.qcReview?.result === "FAIL"
                                      ? "#ef4444"
                                      : "#f59e0b",
                                  border:
                                    reg?.dailyReport?.qcReview?.result === "PASS"
                                      ? "1px solid rgba(16, 185, 129, 0.4)"
                                      : reg?.dailyReport?.qcReview?.result === "FAIL"
                                      ? "1px solid rgba(239, 68, 68, 0.4)"
                                      : "1px solid rgba(245, 158, 11, 0.4)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {reg?.dailyReport?.qcReview?.result === "PASS" ? (
                                  <>
                                    <CheckCircle2 size={13} /> QC: Đã duyệt
                                  </>
                                ) : reg?.dailyReport?.qcReview?.result === "FAIL" ? (
                                  <>
                                    <XCircle size={13} /> QC: Không đạt
                                  </>
                                ) : (
                                  <>
                                    <Clock size={13} /> QC: Chờ duyệt
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Dòng 3, 4, 5: Sub-info thụt lề */}
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-secondary)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                              paddingLeft: "16px",
                            }}
                          >
                            {hasReport ? (
                              <>
                                {/* Dòng link FB & Threads */}
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    📘 {reg?.dailyReport?.fbLinks.length || 0}/{targetFb} FB
                                  </span>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    🧵 {reg?.dailyReport?.threadLinks.length || 0}/{targetThread} Threads
                                  </span>
                                </div>

                                {/* Dòng Drive */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-primary)" }}>
                                  <span>📁 Drive: {reg?.dailyReport?.commentDriveLink ? "Đã nộp" : "Chưa nộp"}</span>
                                </div>

                                {/* Dòng kết quả thẩm định QC */}
                                {reg?.dailyReport?.qcReview?.result === "PASS" ? (
                                  <div style={{ color: "#10b981", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span>✓</span> Đạt ({reg?.dailyReport?.qcReview?.fbApproved ?? targetFb} FB, {reg?.dailyReport?.qcReview?.threadApproved ?? targetThread} TH)
                                  </div>
                                ) : reg?.dailyReport?.qcReview?.result === "FAIL" ? (
                                  <div style={{ color: "#ef4444", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span>✕</span> Ca làm việc chưa đạt yêu cầu QC
                                  </div>
                                ) : (
                                  <div style={{ color: "#f59e0b", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span>⏳</span> Đang chờ QC duyệt
                                  </div>
                                )}

                                {reg?.dailyReport?.qcReview?.feedback && (
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "2px" }}>
                                    QC nhận xét: &ldquo;{reg?.dailyReport?.qcReview?.feedback}&rdquo;
                                  </div>
                                )}
                              </>
                            ) : !isRegistered ? (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Không có lịch đăng ký</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* CỘT 2: FORM NHẬP LINK BÀI VIẾT FACEBOOK & THREADS */}
            <div className="seeding-col-links">
              {/* BANNER THÔNG TIN BÁO CÁO & THẨM ĐỊNH QC CỦA CA ĐÃ NỘP */}
              {selectedShift?.dailyReport && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor:
                      selectedShift.dailyReport.qcReview?.result === "PASS"
                        ? "rgba(16, 185, 129, 0.1)"
                        : selectedShift.dailyReport.qcReview?.result === "FAIL"
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(245, 158, 11, 0.1)",
                    border:
                      selectedShift.dailyReport.qcReview?.result === "PASS"
                        ? "1px solid rgba(16, 185, 129, 0.35)"
                        : selectedShift.dailyReport.qcReview?.result === "FAIL"
                        ? "1px solid rgba(239, 68, 68, 0.35)"
                        : "1px solid rgba(245, 158, 11, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor:
                        selectedShift.dailyReport.qcReview?.result === "PASS"
                          ? "rgba(16, 185, 129, 0.2)"
                          : selectedShift.dailyReport.qcReview?.result === "FAIL"
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(245, 158, 11, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color:
                        selectedShift.dailyReport.qcReview?.result === "PASS"
                          ? "#10b981"
                          : selectedShift.dailyReport.qcReview?.result === "FAIL"
                          ? "#ef4444"
                          : "#f59e0b",
                      flexShrink: 0,
                    }}
                  >
                    {selectedShift.dailyReport.qcReview?.result === "PASS" ? (
                      <CheckCircle2 size={20} />
                    ) : selectedShift.dailyReport.qcReview?.result === "FAIL" ? (
                      <XCircle size={20} />
                    ) : (
                      <Clock size={20} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.9375rem",
                          color:
                            selectedShift.dailyReport.qcReview?.result === "PASS"
                              ? "#10b981"
                              : selectedShift.dailyReport.qcReview?.result === "FAIL"
                              ? "#f87171"
                              : "#f59e0b",
                        }}
                      >
                        {selectedShift.dailyReport.qcReview?.result === "PASS"
                          ? "QC: ĐÃ DUYỆT (ĐẠT YÊU CẦU)"
                          : selectedShift.dailyReport.qcReview?.result === "FAIL"
                          ? "QC: CHƯA ĐẠT YÊU CẦU"
                          : "QC: ĐANG CHỜ DUYỆT"}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Nộp lúc: {new Date(selectedShift.dailyReport.submittedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                        {new Date(selectedShift.dailyReport.submittedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      {selectedShift.dailyReport.qcReview?.result === "PASS" ? (
                        <div>
                          Kiểm duyệt viên chấp nhận: <strong>{selectedShift.dailyReport.qcReview.fbApproved}/{targetFb} FB</strong>,{" "}
                          <strong>{selectedShift.dailyReport.qcReview.threadApproved}/{targetThread} Threads</strong>.
                        </div>
                      ) : selectedShift.dailyReport.qcReview?.result === "FAIL" ? (
                        <div>
                          Báo cáo ca làm việc chưa đạt tiêu chuẩn kiểm duyệt chất lượng. Vui lòng xem phản hồi từ QC.
                        </div>
                      ) : (
                        <div>
                          Báo cáo ca làm việc đang trong hàng đợi kiểm duyệt. Kết quả thẩm định sẽ được cập nhật tại đây.
                        </div>
                      )}

                      {selectedShift.dailyReport.qcReview?.feedback && (
                        <div style={{ marginTop: "6px", fontStyle: "italic", color: "var(--text-primary)" }}>
                          QC nhận xét: &ldquo;{selectedShift.dailyReport.qcReview.feedback}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* R6: Nhắc nhở nộp bù cuối tuần nếu còn link lỗi chưa thay */}
              {(() => {
                const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
                const vnDay = vnNow.getUTCDay(); // 6 is Saturday, 0 is Sunday
                const vnHour = vnNow.getUTCHours();
                const isWeekendReminderTime = (vnDay === 6 && vnHour >= 18) || vnDay === 0;
                if (!isWeekendReminderTime) return null;

                const shiftsWithInvalid = monthShifts.filter((s) => {
                  const invalidList = s.dailyReport?.qcReview?.invalidLinks;
                  return Array.isArray(invalidList) && invalidList.length > 0;
                });

                if (shiftsWithInvalid.length > 0) {
                  return (
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "10px",
                        backgroundColor: "rgba(249, 115, 22, 0.12)",
                        border: "1px solid rgba(249, 115, 22, 0.4)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(249, 115, 22, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#f97316",
                          flexShrink: 0,
                        }}
                      >
                        <Bell size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#f97316" }}>
                          NHẮC NHỞ NỘP BÙ CUỐI TUẦN (HẠN CHÓT 23:59 CHỦ NHẬT)
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                          Hệ thống ghi nhận bạn có <strong>{shiftsWithInvalid.length} ca làm việc</strong> trong tháng chứa liên kết bị QC/Quản lý đánh dấu lỗi chưa được nộp link bù.
                          Vui lòng kiểm tra và nộp bổ sung link mới vào phần dự phòng trước <strong>23:59 Chủ Nhật</strong> tuần này để đảm bảo chỉ tiêu KPI ca!
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* BANNER 1: CHỜ VÀO CA (AWAITING_CHECKIN) */}
              {selectedShift && selectedShiftStatusInfo?.phase === "AWAITING_CHECKIN" && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#f59e0b",
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#f59e0b" }}>
                        BẠN CHƯA BẤM VÀO CA LÀM VIỆC
                      </div>
                      <CountdownTimer targetDate={selectedShiftStatusInfo.closesAt} label="Hạn Vào ca còn" />
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      Ca làm việc đã bắt đầu ({selectedShiftStatusInfo.timeRangeStr}). Quy định: Nhân sự phải bấm <strong>&ldquo;Vào ca&rdquo;</strong> trong vòng {shiftRulesState.lateCheckinMinutes} phút đầu ca trước khi nộp link báo cáo. Nếu quá thời hạn này, ca sẽ tự động bị khóa!
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        onClick={() => handleCheckIn(selectedShift.id)}
                        disabled={checkingIn}
                        className="btn"
                        style={{
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          border: "none",
                          cursor: checkingIn ? "not-allowed" : "pointer",
                          boxShadow: "0 2px 10px rgba(245, 158, 11, 0.35)",
                        }}
                      >
                        {checkingIn ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Đang ghi nhận Vào ca...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} /> Bấm Vào Ca Ngay
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER 2: ĐANG TRONG CA (IN_SHIFT) */}
              {selectedShift && selectedShiftStatusInfo?.phase === "IN_SHIFT" && (
                <div
                  style={{
                    padding: "0.875rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(249, 115, 22, 0.1)",
                    border: "1px solid rgba(249, 115, 22, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(249, 115, 22, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f97316",
                      }}
                    >
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f97316" }}>
                        ĐANG TRONG GIỜ CA LÀM VIỆC ({selectedShiftStatusInfo.timeRangeStr})
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {selectedShift.loginSession?.loginTime ? (
                          <>
                            Đã điểm danh Vào ca lúc:{" "}
                            <strong>
                              {new Date(selectedShift.loginSession.loginTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </strong>
                            {selectedShift.loginSession.isLate && (
                              <span style={{ color: "#ef4444", marginLeft: "4px" }}>
                                (Vào muộn {selectedShift.loginSession.lateMinutes} phút)
                              </span>
                            )}
                            . Bạn có thể tự do thêm, sửa, xóa link trong giờ ca.
                          </>
                        ) : (
                          "Hãy hoàn thành nộp đủ link KPI trước khi hết giờ ca."
                        )}
                      </div>
                    </div>
                  </div>
                  <CountdownTimer targetDate={selectedShiftStatusInfo.closesAt} label="Hết ca sau" />
                </div>
              )}

              {/* R6: Cảnh báo khẩn cấp 30 phút cuối ca nếu chưa đạt ngưỡng tham gia ca */}
              {selectedShift && selectedShiftStatusInfo?.phase === "IN_SHIFT" && selectedShiftStatusInfo.closesAt && (() => {
                const msRemaining = new Date(selectedShiftStatusInfo.closesAt).getTime() - Date.now();
                const isLast30Minutes = msRemaining > 0 && msRemaining <= 30 * 60 * 1000;
                const thresholdPercent = shiftRulesState.participationThresholdPercent || 70;
                const thresholdFb = Math.ceil((targetFb * thresholdPercent) / 100);
                const thresholdThread = Math.ceil((targetThread * thresholdPercent) / 100);
                const currentFbCount = fbLinks.filter((l) => l.trim().length > 0).length + fbSuppLinks.filter((l) => l.trim().length > 0).length;
                const currentThreadCount = threadLinks.filter((l) => l.trim().length > 0).length + threadSuppLinks.filter((l) => l.trim().length > 0).length;
                const isBelowThreshold = currentFbCount < thresholdFb || currentThreadCount < thresholdThread;

                if (isLast30Minutes && isBelowThreshold) {
                  return (
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "10px",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        border: "1.5px solid var(--danger)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(239, 68, 68, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ef4444",
                          flexShrink: 0,
                        }}
                      >
                        <AlertTriangle size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#f87171" }}>
                          CẢNH BÁO: SẮP HẾT GIỜ CA (CÒN DƯỚI 30 PHÚT) - CHƯA ĐẠT NGƯỠNG THAM GIA CA!
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                          Bạn hiện mới nhập <strong>{currentFbCount}/{thresholdFb} FB</strong> và <strong>{currentThreadCount}/{thresholdThread} Threads</strong> (yêu cầu tối thiểu {thresholdPercent}% KPI ca).
                          <div style={{ color: "#fca5a5", marginTop: "4px", fontWeight: 600 }}>
                            ⚠️ Nếu hết giờ ca mà không đạt ngưỡng này, ca sẽ bị đóng hoàn toàn và KHÔNG được quyền Nộp bù tuần! Hãy khẩn trương hoàn thành bài nộp ngay.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* BANNER 3: CỬA SỔ SỬA SAU CA (POST_SHIFT_EDIT) */}
              {selectedShift && selectedShiftStatusInfo?.phase === "POST_SHIFT_EDIT" && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(56, 189, 248, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#38bdf8",
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#38bdf8" }}>
                        CỬA SỔ SỬA SAU CA (TRONG VÒNG {shiftRulesState.postShiftEditMinutes} PHÚT)
                      </div>
                      <CountdownTimer targetDate={selectedShiftStatusInfo.closesAt} label="Đóng sửa sau" />
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      Ca đã kết thúc và bạn <strong>đạt Ngưỡng tham gia ca</strong>! Bạn được phép bổ sung hoặc thay thế link trong vòng {shiftRulesState.postShiftEditMinutes} phút sau ca. <strong>Lưu ý:</strong> Không được xóa các link đã được duyệt hợp lệ.
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER 4: NỘP BÙ TUẦN (WEEKLY_MAKEUP) */}
              {selectedShift && selectedShiftStatusInfo?.phase === "WEEKLY_MAKEUP" && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(168, 85, 247, 0.12)",
                    border: "1px solid rgba(168, 85, 247, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(168, 85, 247, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#c084fc",
                      flexShrink: 0,
                    }}
                  >
                    <Unlock size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#c084fc" }}>
                        GIAI ĐOẠN NỘP BÙ TUẦN (ĐẾN CHỦ NHẬT 23:59)
                      </div>
                      <CountdownTimer targetDate={selectedShiftStatusInfo.closesAt} label="Hạn bù tuần còn" />
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      Ca làm việc đạt Ngưỡng tham gia ca. Toàn bộ link cũ đã nộp được <strong>khóa chỉnh sửa</strong>. Bạn <strong>được phép thêm link dự phòng</strong> hoặc bổ sung link còn thiếu đến hết Chủ nhật tuần này.
                      <div style={{ marginTop: "4px", color: "var(--text-primary)" }}>
                        🛡️ <strong>Quy định:</strong> Link cũ đã chốt được bảo lưu cố định. Nhân sự được tự do thêm Link dự phòng (+B, +T) để đảm bảo đủ chỉ tiêu KPI ca khi QC kiểm duyệt.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER 5: MỞ BÙ ĐẶC CÁCH (SPECIAL_REOPEN) */}
              {selectedShift && selectedShiftStatusInfo?.phase === "SPECIAL_REOPEN" && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#10b981",
                      flexShrink: 0,
                    }}
                  >
                    <Unlock size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#10b981" }}>
                        MỞ BÙ ĐẶC CÁCH TỪ QUẢN LÝ / QC
                      </div>
                      {selectedShiftStatusInfo.closesAt && (
                        <CountdownTimer targetDate={selectedShiftStatusInfo.closesAt} label="Hạn mở bù còn" />
                      )}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      {selectedShiftStatusInfo.reason}
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER 6: CÁC TRẠNG THÁI KHÓA (LATE_LOCKED, BELOW_THRESHOLD, CLOSED) */}
              {selectedShift && !selectedShiftStatusInfo?.canSubmit && selectedShiftStatusInfo?.phase !== "AWAITING_CHECKIN" && selectedShiftStatusInfo?.phase !== "BEFORE_SHIFT" && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(239, 68, 68, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ef4444",
                      flexShrink: 0,
                    }}
                  >
                    <Lock size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#f87171" }}>
                      {selectedShiftStatusInfo?.phase === "ABSENT"
                        ? "CA ĐÃ ĐÓNG (VẮNG CA)"
                        : selectedShiftStatusInfo?.phase === "LATE_LOCKED"
                        ? "CA ĐÃ KHÓA DO VÀO CA MUỘN"
                        : selectedShiftStatusInfo?.phase === "BELOW_THRESHOLD"
                        ? "CA CHƯA ĐẠT NGƯỠNG NỘP"
                        : selectedShiftStatusInfo?.badgeText.toUpperCase() || "CA ĐÃ BỊ KHÓA"}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.5" }}>
                      {selectedShiftStatusInfo?.reason || "Ca làm việc đã kết thúc và không còn trong thời gian nộp bù."}
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER CHO PHÉP GẮN THẺ & NỔI BẬT SAU CA (THEO PHƯƠNG ÁN A) */}
              {selectedShift && selectedShift.dailyReport && canUpdatePostMetaOnly && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    border: "1px solid rgba(59, 130, 246, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(59, 130, 246, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#60a5fa",
                      flexShrink: 0,
                    }}
                  >
                    <Flame size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#60a5fa" }}>
                      CHẾ ĐỘ GẮN LOẠI BÀI VIẾT & ĐỀ XUẤT BÀI VIRAL SAU CA
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.5" }}>
                      Ca làm việc đã kết thúc. Bạn có thể cập nhật thông tin cho các link đã nộp theo quy định:
                      <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div>
                          {taggingGraceInfo.isWithinTagGrace ? (
                            <span>🏷️ <strong>Loại bài viết:</strong> Còn hạn <strong>{taggingGraceInfo.tagRemainingDays} ngày</strong> (hạn đến {taggingGraceInfo.tagDeadlineStr}).</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>🏷️ <strong>Loại bài viết:</strong> Đã hết hạn gắn loại bài (quá {graceConfig.tagPostGraceDays || 7} ngày).</span>
                          )}
                        </div>
                        <div>
                          {taggingGraceInfo.isWithinViralGrace ? (
                            <span style={{ color: "#f97316" }}>🔥 <strong>Đề xuất Bài viết Viral:</strong> Còn hạn <strong>{taggingGraceInfo.viralRemainingDays} ngày</strong> (hạn đến {taggingGraceInfo.viralDeadlineStr}).</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>🔥 <strong>Đề xuất Bài viết Viral:</strong> Đã hết hạn đề xuất viral (quá {graceConfig.viralPostGraceDays || 30} ngày).</span>
                          )}
                        </div>
                      </div>
                      <div style={{ color: "#f87171", fontSize: "0.78rem", marginTop: "5px" }}>
                        🔒 <strong>Quy định:</strong> Không có quyền chỉnh sửa URL bài viết hoặc nộp bổ sung. Mọi yêu cầu sửa link hoặc nộp bù phải xin cấp Quản lý mở quyền.
                      </div>
                      {currentInvalidLinks.length > 0 && (
                        <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "2px" }}>
                          ⛔ Các link bị QC từ chối (gạch đỏ) đã bị khóa, không được phép gắn nổi bật/viral.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER TRẠNG THÁI LINK TẠM THỜI (BẢN NHÁP CHƯA NỘP) */}
              {selectedShift && draftState.active && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: "12px",
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#f59e0b",
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#f59e0b" }}>
                          TRẠNG THÁI: ĐANG HIỂN THỊ LINK TẠM THỜI (CHƯA NỘP)
                        </span>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "rgba(245, 158, 11, 0.2)",
                            color: "#f59e0b",
                            border: "1px solid rgba(245, 158, 11, 0.4)",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                          }}
                        >
                          Bản nháp tự lưu
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleDiscardDraft}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--danger)",
                          height: "28px",
                          padding: "0 8px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          borderRadius: "6px",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          backgroundColor: "rgba(239, 68, 68, 0.08)",
                          cursor: "pointer",
                        }}
                        title="Xóa bỏ các link tạm thời và khôi phục form ban đầu"
                      >
                        <Trash2 size={13} /> Xóa bản nháp
                      </button>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.5" }}>
                      Hệ thống đã tự động khôi phục <strong>{draftState.count} liên kết/dữ liệu</strong> bạn đã gắn lên form trước khi tải lại trang{" "}
                      {draftState.savedAt && (
                        <span>
                          (lưu lúc{" "}
                          <strong>
                            {new Date(draftState.savedAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                            , {new Date(draftState.savedAt).toLocaleDateString("vi-VN")}
                          </strong>
                          )
                        </span>
                      )}
                      . Dữ liệu này <strong style={{ color: "#f59e0b" }}>chưa được gửi chính thức</strong> lên hệ thống. Hãy kiểm tra và nhấn <strong>&quot;Nộp Báo Cáo Ca Này&quot;</strong> để QC thẩm định!
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: LINK FACEBOOK */}
              <div
                className="card"
                style={{
                  padding: "1.25rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                      📘 2. Link Bài Viết Facebook ({selectedShift ? `${totalValidFbCount}/${targetFb}` : `0/${targetFb}`} bài hợp lệ)
                      {hasFbDraftLinks && (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "rgba(245, 158, 11, 0.15)",
                            color: "#f59e0b",
                            border: "1px solid rgba(245, 158, 11, 0.35)",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "2px 6px",
                          }}
                          title="Đang hiển thị từ bản nháp tạm thời"
                        >
                          Lưu tạm
                        </span>
                      )}
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Nhập đúng định dạng link bài đăng công khai trên Group hoặc FanPage
                    </p>
                    {fbInvalidFormCount > 0 && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          fontSize: "0.78rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", gap: "6px" }}>
                          <XCircle size={14} /> Có <strong>{fbInvalidFormCount}</strong> link bị QC từ chối (gạch đỏ) và đã khóa không cho sửa:
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {hasEmptySlotInMainFb ? (
                            <span>👉 <strong>Chưa nộp đủ {targetFb} link ở bài chính:</strong> Vui lòng nhập link mới vào các <strong>ô còn trống</strong> trong danh sách bài chính phía trên để bù đủ {targetFb} bài.</span>
                          ) : (
                            <span>👉 <strong>Đã nộp đủ {targetFb} link bài chính:</strong> Bắt buộc nhập link mới thay thế vào phần <strong>&quot;Link Facebook Dự Phòng&quot;</strong> bên dưới để bù đủ {targetFb} bài!</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {!selectedShift ? (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(148, 163, 184, 0.12)",
                        color: "#94a3b8",
                        border: "1px solid rgba(148, 163, 184, 0.25)",
                      }}
                    >
                      Chưa chọn ca
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        backgroundColor: totalValidFbCount >= targetFb ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: totalValidFbCount >= targetFb ? "#10b981" : "#ef4444",
                        border: `1px solid ${totalValidFbCount >= targetFb ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                      }}
                    >
                      {totalValidFbCount >= targetFb
                        ? validSuppFbCount > 0
                          ? `Đủ ${targetFb} bài (+${validSuppFbCount} bù)`
                          : `Đủ ${targetFb} bài hợp lệ`
                        : `Thiếu ${targetFb - totalValidFbCount} bài hợp lệ`}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {fbLinks.map((link, idx) => {
                    const isInvalid = isFormLinkInvalid(link);
                    const isOldLink = isOldReportLink(link);
                    const isOldLinkLocked = isOldLink && !selectedShiftStatusInfo?.canEditOldLinks;
                    const isInputDisabled = isInvalid || isFormDisabled || canUpdatePostMetaOnly || isOldLinkLocked;
                    const isTagDisabled = !link.trim() || (!selectedShiftStatusInfo?.canSubmit && !canUpdateTagsOnly);
                    // RULE: Link đã bị QC từ chối thì không cho phép gắn nổi bật/viral
                    const isHighlightDisabled = !link.trim() || isInvalid || (!selectedShiftStatusInfo?.canSubmit && !canUpdateViralOnly);

                    return (
                      <div key={idx} className="seeding-link-row">
                        <div className="seeding-link-input-group">
                          <span
                            style={{
                              width: "30px",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: isInvalid ? "#ef4444" : "var(--text-muted)",
                              textAlign: "right",
                              flexShrink: 0,
                            }}
                          >
                            #{idx + 1}
                          </span>

                          <input
                            type="url"
                            className="input"
                            disabled={isInputDisabled}
                            readOnly={isInputDisabled}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: "38px",
                              fontSize: "0.8125rem",
                              backgroundColor: isInvalid ? "rgba(239, 68, 68, 0.08)" : isInputDisabled ? "var(--bg-card)" : "var(--bg-input)",
                              borderRadius: "8px",
                              border: isInvalid ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                              color: isInvalid ? "#ef4444" : undefined,
                              textDecoration: isInvalid ? "line-through" : "none",
                              textDecorationColor: isInvalid ? "#ef4444" : undefined,
                              fontWeight: isInvalid ? 600 : undefined,
                              cursor: isInputDisabled ? "not-allowed" : "text",
                              opacity: isInputDisabled ? 0.75 : 1,
                            }}
                            placeholder={isInvalid ? "Link này đã bị khóa (QC từ chối)" : isOldLinkLocked ? "Link cũ đã chốt (Quy định: Không thể sửa link)" : canUpdatePostMetaOnly ? "Ca đã kết thúc (Không thể sửa link)" : isFormDisabled ? "Biểu mẫu đã bị khóa" : `Dán link bài viết Facebook #${idx + 1}...`}
                            title={isInvalid ? "Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa, không thể chỉnh sửa" : isOldLinkLocked ? "Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự" : canUpdatePostMetaOnly ? "Ca đã kết thúc: Không thể sửa URL link (Chỉ được phép gắn loại bài / đề xuất viral)" : undefined}
                            value={link}
                            onChange={(e) => {
                              if (isInputDisabled) return;
                              const newLinks = [...fbLinks];
                              newLinks[idx] = e.target.value;
                              setFbLinks(newLinks);
                            }}
                          />

                          {isInvalid && (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                padding: "4px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                              title="Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa, không thể chỉnh sửa"
                            >
                              <Lock size={12} /> Không hợp lệ (Đã khóa)
                            </span>
                          )}

                          {isOldLinkLocked && !isInvalid && (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: "rgba(148, 163, 184, 0.12)",
                                color: "var(--text-secondary)",
                                border: "1px solid rgba(148, 163, 184, 0.3)",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                padding: "4px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                              title="Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự"
                            >
                              <Lock size={12} /> Link cũ (Đã khóa)
                            </span>
                          )}

                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-icon"
                              style={{ height: "38px", width: "38px", minWidth: "38px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", flexShrink: 0 }}
                              title="Mở liên kết"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>

                        {/* Controls loại bài, nổi bật, viral */}
                        <div className="seeding-link-meta-group">
                          {/* Chọn Tag loại bài */}
                          <PostTagSelect
                            value={fbTags[idx] || ""}
                            onChange={(val) => {
                              if (isTagDisabled) return;
                              const copy = [...fbTags];
                              copy[idx] = val;
                              setFbTags(copy);
                            }}
                            disabled={isTagDisabled}
                            title={!link.trim() ? "Vui lòng nhập link trước khi chọn thẻ" : "Gắn thẻ loại bài viết"}
                            availableTags={availableTags}
                          />

                          {/* Toggle Bài nổi bật */}
                          <button
                            type="button"
                            disabled={isHighlightDisabled}
                            onClick={() => {
                              if (isHighlightDisabled) return;
                              const copy = [...fbHighlights];
                              copy[idx] = !copy[idx];
                              setFbHighlights(copy);
                            }}
                            style={{
                              height: "38px",
                              padding: "0 8px",
                              borderRadius: "8px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              cursor: isHighlightDisabled ? "not-allowed" : "pointer",
                              transition: "all 0.15s ease",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              opacity: isHighlightDisabled ? 0.6 : 1,
                              border: fbHighlights[idx] ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                              backgroundColor: fbHighlights[idx] ? "rgba(249, 115, 22, 0.15)" : isHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                              color: fbHighlights[idx] ? "var(--primary)" : "var(--text-muted)",
                            }}
                            title={
                              isInvalid
                                ? "Link đã bị QC từ chối, không được phép gắn nổi bật"
                                : !link.trim()
                                ? "Vui lòng nhập link trước khi gắn nổi bật"
                                : "Tích chọn nếu là Bài viết nổi bật trong ca làm việc"
                            }
                          >
                            <Flame size={13} color={fbHighlights[idx] ? "var(--primary)" : "var(--text-muted)"} />
                            <span>Nổi bật</span>
                          </button>

                          {/* Toggle Đề xuất Viral & Nhập số Like (Ẩn toàn bộ mức tiền thưởng) */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                            <button
                              type="button"
                              disabled={isHighlightDisabled}
                              onClick={() => {
                                if (isHighlightDisabled) return;
                                const copy = [...fbViralLikes];
                                if (copy[idx] !== "" && Number(copy[idx]) > 0) {
                                  copy[idx] = "";
                                } else {
                                  copy[idx] = 1000;
                                }
                                setFbViralLikes(copy);
                              }}
                              style={{
                                height: "38px",
                                padding: "0 8px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: isHighlightDisabled ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                                opacity: isHighlightDisabled ? 0.6 : 1,
                                border: fbViralLikes[idx] !== "" && Number(fbViralLikes[idx]) > 0 ? "1px solid #8b5cf6" : "1px solid var(--border-color)",
                                backgroundColor: fbViralLikes[idx] !== "" && Number(fbViralLikes[idx]) > 0 ? "rgba(139, 92, 246, 0.15)" : isHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                color: fbViralLikes[idx] !== "" && Number(fbViralLikes[idx]) > 0 ? "#8b5cf6" : "var(--text-muted)",
                              }}
                              title={
                                isInvalid
                                  ? "Link đã bị QC từ chối, không được phép đề xuất viral"
                                  : !link.trim()
                                  ? "Vui lòng nhập link trước khi đề xuất viral"
                                  : "Tích chọn nếu là bài viết viral và tự điền số like (Quản lý sẽ kiểm tra đối soát)"
                              }
                            >
                              <Sparkles size={13} color={fbViralLikes[idx] !== "" && Number(fbViralLikes[idx]) > 0 ? "#8b5cf6" : "var(--text-muted)"} />
                              <span>Viral</span>
                            </button>

                            {fbViralLikes[idx] !== "" && Number(fbViralLikes[idx]) > 0 && (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "rgba(139, 92, 246, 0.08)",
                                  border: "1px solid rgba(139, 92, 246, 0.4)",
                                  borderRadius: "8px",
                                  padding: "0 6px",
                                  height: "38px",
                                }}
                                title="Tự điền số lượt like thực tế của bài viết viral này"
                              >
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  disabled={isHighlightDisabled}
                                  value={fbViralLikes[idx]}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0);
                                    const copy = [...fbViralLikes];
                                    copy[idx] = val;
                                    setFbViralLikes(copy);
                                  }}
                                  placeholder="Lượt like"
                                  style={{
                                    width: "72px",
                                    height: "28px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    color: "var(--text-primary)",
                                    outline: "none",
                                    padding: "0 2px",
                                  }}
                                />
                                <span style={{ fontSize: "0.7rem", color: "#8b5cf6", fontWeight: 700 }}>like</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Supplement Links */}
                {fbSuppLinks.length > 0 && (
                  <div style={{ marginTop: "0.875rem", paddingTop: "0.875rem", borderTop: "1px dashed var(--border-color)" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--warning)", marginBottom: "0.5rem" }}>
                      🛡️ Link Facebook Dự Phòng (Dùng để bù bài bị từ chối / quét xóa):
                    </div>
                    {fbSuppLinks.map((supp, sIdx) => {
                      const isSuppInvalid = isFormLinkInvalid(supp);
                      const isOldSupp = isOldReportLink(supp);
                      const isOldSuppLocked = isOldSupp && !selectedShiftStatusInfo?.canEditOldLinks;
                      const isSuppInputDisabled = isSuppInvalid || isFormDisabled || canUpdatePostMetaOnly || isOldSuppLocked;
                      const isSuppTagDisabled = !supp.trim() || (!selectedShiftStatusInfo?.canSubmit && !canUpdateTagsOnly);
                      const isSuppHighlightDisabled = !supp.trim() || isSuppInvalid || (!selectedShiftStatusInfo?.canSubmit && !canUpdateViralOnly);

                      return (
                        <div key={sIdx} className="seeding-link-row" style={{ marginBottom: "0.5rem" }}>
                          <div className="seeding-link-input-group">
                            <span style={{ fontSize: "0.75rem", color: isSuppInvalid ? "#ef4444" : "var(--warning)", width: "30px", textAlign: "right", flexShrink: 0 }}>
                              +B{sIdx + 1}
                            </span>
                            <input
                              type="url"
                              className="input"
                              disabled={isSuppInputDisabled}
                              readOnly={isSuppInputDisabled}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: "38px",
                                fontSize: "0.8125rem",
                                backgroundColor: isSuppInvalid ? "rgba(239, 68, 68, 0.08)" : isSuppInputDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                border: isSuppInvalid ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                                color: isSuppInvalid ? "#ef4444" : undefined,
                                textDecoration: isSuppInvalid ? "line-through" : "none",
                                textDecorationColor: isSuppInvalid ? "#ef4444" : undefined,
                                fontWeight: isSuppInvalid ? 600 : undefined,
                                cursor: isSuppInputDisabled ? "not-allowed" : "text",
                                opacity: isSuppInputDisabled ? 0.75 : 1,
                              }}
                              placeholder={isSuppInvalid ? "Link này đã bị khóa (QC từ chối)" : isOldSuppLocked ? "Link cũ đã chốt (Quy định: Không thể sửa link)" : canUpdatePostMetaOnly ? "Ca đã kết thúc (Không thể sửa link)" : isFormDisabled ? "Biểu mẫu đã bị khóa" : "Dán link bài viết bổ sung..."}
                              title={isSuppInvalid ? "Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa" : isOldSuppLocked ? "Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự" : canUpdatePostMetaOnly ? "Ca đã kết thúc: Không thể sửa URL link (Chỉ được phép gắn loại bài / đề xuất viral)" : undefined}
                              value={supp}
                              onChange={(e) => {
                                if (isSuppInputDisabled) return;
                                const copy = [...fbSuppLinks];
                                copy[sIdx] = e.target.value;
                                setFbSuppLinks(copy);
                              }}
                            />

                            {isSuppInvalid ? (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  padding: "4px 8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  flexShrink: 0,
                                }}
                                title="Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa"
                              >
                                <Lock size={12} /> Không hợp lệ (Đã khóa)
                              </span>
                            ) : isOldSuppLocked ? (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: "rgba(148, 163, 184, 0.12)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid rgba(148, 163, 184, 0.3)",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  padding: "4px 8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  flexShrink: 0,
                                }}
                                title="Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự"
                              >
                                <Lock size={12} /> Link cũ (Đã khóa)
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                style={{ height: "38px", width: "38px", minWidth: "38px", padding: 0, flexShrink: 0 }}
                                disabled={isFormDisabled || canUpdateTagsOnly}
                                onClick={() => {
                                  if (isFormDisabled || canUpdateTagsOnly) return;
                                  setFbSuppLinks(fbSuppLinks.filter((_, i) => i !== sIdx));
                                  setFbSuppTags(fbSuppTags.filter((_, i) => i !== sIdx));
                                  setFbSuppHighlights(fbSuppHighlights.filter((_, i) => i !== sIdx));
                                }}
                                title={canUpdateTagsOnly ? "Ca đã kết thúc, không thể xóa link" : "Xóa link dự phòng này"}
                              >
                                <Trash2 size={14} color="var(--danger)" />
                              </button>
                            )}
                          </div>

                          {/* Controls loại bài, nổi bật, viral */}
                          <div className="seeding-link-meta-group">
                            {/* Chọn Tag loại bài */}
                            <PostTagSelect
                              value={fbSuppTags[sIdx] || ""}
                              onChange={(val) => {
                                if (isSuppTagDisabled) return;
                                const copy = [...fbSuppTags];
                                copy[sIdx] = val;
                                setFbSuppTags(copy);
                              }}
                              disabled={isSuppTagDisabled}
                              title={!supp.trim() ? "Vui lòng nhập link trước khi chọn thẻ" : "Gắn thẻ loại bài viết"}
                              availableTags={availableTags}
                            />

                            {/* Toggle Bài nổi bật */}
                            <button
                              type="button"
                              disabled={isSuppHighlightDisabled}
                              onClick={() => {
                                if (isSuppHighlightDisabled) return;
                                const copy = [...fbSuppHighlights];
                                copy[sIdx] = !copy[sIdx];
                                setFbSuppHighlights(copy);
                              }}
                              style={{
                                height: "38px",
                                padding: "0 8px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: isSuppHighlightDisabled ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                                opacity: isSuppHighlightDisabled ? 0.6 : 1,
                                border: fbSuppHighlights[sIdx] ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                                backgroundColor: fbSuppHighlights[sIdx] ? "rgba(249, 115, 22, 0.15)" : isSuppHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                color: fbSuppHighlights[sIdx] ? "var(--primary)" : "var(--text-muted)",
                              }}
                              title={
                                isSuppInvalid
                                  ? "Link đã bị QC từ chối, không được phép gắn nổi bật"
                                  : !supp.trim()
                                  ? "Vui lòng nhập link trước khi gắn nổi bật"
                                  : "Tích chọn nếu là Bài viết nổi bật trong ca làm việc"
                              }
                            >
                              <Flame size={13} color={fbSuppHighlights[sIdx] ? "var(--primary)" : "var(--text-muted)"} />
                              <span>Nổi bật</span>
                            </button>

                            {/* Toggle Đề xuất Viral & Nhập số Like (Ẩn toàn bộ mức tiền thưởng) */}
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              <button
                                type="button"
                                disabled={isSuppHighlightDisabled}
                                onClick={() => {
                                  if (isSuppHighlightDisabled) return;
                                  const copy = [...fbSuppViralLikes];
                                  if (copy[sIdx] !== "" && Number(copy[sIdx]) > 0) {
                                    copy[sIdx] = "";
                                  } else {
                                    copy[sIdx] = 1000;
                                  }
                                  setFbSuppViralLikes(copy);
                                }}
                                style={{
                                  height: "38px",
                                  padding: "0 8px",
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  cursor: isSuppHighlightDisabled ? "not-allowed" : "pointer",
                                  transition: "all 0.15s ease",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                  opacity: isSuppHighlightDisabled ? 0.6 : 1,
                                  border: fbSuppViralLikes[sIdx] !== "" && Number(fbSuppViralLikes[sIdx]) > 0 ? "1px solid #8b5cf6" : "1px solid var(--border-color)",
                                  backgroundColor: fbSuppViralLikes[sIdx] !== "" && Number(fbSuppViralLikes[sIdx]) > 0 ? "rgba(139, 92, 246, 0.15)" : isSuppHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                  color: fbSuppViralLikes[sIdx] !== "" && Number(fbSuppViralLikes[sIdx]) > 0 ? "#8b5cf6" : "var(--text-muted)",
                                }}
                                title={
                                  isSuppInvalid
                                    ? "Link đã bị QC từ chối, không được phép đề xuất viral"
                                    : !supp.trim()
                                    ? "Vui lòng nhập link trước khi đề xuất viral"
                                    : "Tích chọn nếu là bài viết viral và tự điền số like (Quản lý sẽ kiểm tra đối soát)"
                                }
                              >
                                <Sparkles size={13} color={fbSuppViralLikes[sIdx] !== "" && Number(fbSuppViralLikes[sIdx]) > 0 ? "#8b5cf6" : "var(--text-muted)"} />
                                <span>Viral</span>
                              </button>

                              {fbSuppViralLikes[sIdx] !== "" && Number(fbSuppViralLikes[sIdx]) > 0 && (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    background: "rgba(139, 92, 246, 0.08)",
                                    border: "1px solid rgba(139, 92, 246, 0.4)",
                                    borderRadius: "8px",
                                    padding: "0 6px",
                                    height: "38px",
                                  }}
                                  title="Tự điền số lượt like thực tế của bài viết viral này"
                                >
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    disabled={isSuppHighlightDisabled}
                                    value={fbSuppViralLikes[sIdx]}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0);
                                      const copy = [...fbSuppViralLikes];
                                      copy[sIdx] = val;
                                      setFbSuppViralLikes(copy);
                                    }}
                                    placeholder="Lượt like"
                                    style={{
                                      width: "72px",
                                      height: "28px",
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      borderRadius: "4px",
                                      border: "none",
                                      backgroundColor: "transparent",
                                      color: "var(--text-primary)",
                                      outline: "none",
                                      padding: "0 2px",
                                    }}
                                  />
                                  <span style={{ fontSize: "0.7rem", color: "#8b5cf6", fontWeight: 700 }}>like</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isFormDisabled || canUpdatePostMetaOnly}
                  style={{
                    marginTop: "0.875rem",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: isFormDisabled || canUpdatePostMetaOnly ? "not-allowed" : "pointer",
                    opacity: isFormDisabled || canUpdatePostMetaOnly ? 0.6 : 1,
                  }}
                  title={canUpdatePostMetaOnly ? "Ca đã kết thúc: Không được phép thêm link bổ sung (Cần Quản lý mở quyền)" : undefined}
                  onClick={() => {
                    if (isFormDisabled || canUpdatePostMetaOnly) return;
                    setFbSuppLinks([...fbSuppLinks, ""]);
                    setFbSuppTags([...fbSuppTags, ""]);
                    setFbSuppHighlights([...fbSuppHighlights, false]);
                  }}
                >
                  <Plus size={14} /> Thêm Link Facebook Dự Phòng
                </button>
              </div>

              {/* SECTION 3: LINK THREADS */}
              <div
                className="card"
                style={{
                  padding: "1.25rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                      🧵 3. Link Bài Viết Threads ({selectedShift ? `${totalValidThreadCount}/${targetThread}` : `0/${targetThread}`} bài hợp lệ)
                      {hasThreadDraftLinks && (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "rgba(245, 158, 11, 0.15)",
                            color: "#f59e0b",
                            border: "1px solid rgba(245, 158, 11, 0.35)",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "2px 6px",
                          }}
                          title="Đang hiển thị từ bản nháp tạm thời"
                        >
                          Lưu tạm
                        </span>
                      )}
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Nhập link bài viết trên nền tảng Threads (threads.net)
                    </p>
                    {threadInvalidFormCount > 0 && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          fontSize: "0.78rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", gap: "6px" }}>
                          <XCircle size={14} /> Có <strong>{threadInvalidFormCount}</strong> link bị QC từ chối (gạch đỏ) và đã khóa không cho sửa:
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {hasEmptySlotInMainThread ? (
                            <span>👉 <strong>Chưa nộp đủ {targetThread} link ở bài chính:</strong> Vui lòng nhập link mới vào các <strong>ô còn trống</strong> trong danh sách bài chính phía trên để bù đủ {targetThread} bài.</span>
                          ) : (
                            <span>👉 <strong>Đã nộp đủ {targetThread} link bài chính:</strong> Bắt buộc nhập link mới thay thế vào phần <strong>&quot;Link Threads Dự Phòng&quot;</strong> bên dưới để bù đủ {targetThread} bài!</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {!selectedShift ? (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(148, 163, 184, 0.12)",
                        color: "#94a3b8",
                        border: "1px solid rgba(148, 163, 184, 0.25)",
                      }}
                    >
                      Chưa chọn ca
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        backgroundColor: totalValidThreadCount >= targetThread ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: totalValidThreadCount >= targetThread ? "#10b981" : "#ef4444",
                        border: `1px solid ${totalValidThreadCount >= targetThread ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                      }}
                    >
                      {totalValidThreadCount >= targetThread
                        ? validSuppThreadCount > 0
                          ? `Đủ ${targetThread} bài (+${validSuppThreadCount} bù)`
                          : `Đủ ${targetThread} bài hợp lệ`
                        : `Thiếu ${targetThread - totalValidThreadCount} bài hợp lệ`}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {threadLinks.map((link, idx) => {
                    const isInvalid = isFormLinkInvalid(link);
                    const isOldLink = isOldReportLink(link);
                    const isOldLinkLocked = isOldLink && !selectedShiftStatusInfo?.canEditOldLinks;
                    const isInputDisabled = isInvalid || isFormDisabled || canUpdatePostMetaOnly || isOldLinkLocked;
                    const isTagDisabled = !link.trim() || (!selectedShiftStatusInfo?.canSubmit && !canUpdateTagsOnly);
                    // RULE: Link đã bị QC từ chối thì không cho phép gắn nổi bật/viral
                    const isHighlightDisabled = !link.trim() || isInvalid || (!selectedShiftStatusInfo?.canSubmit && !canUpdateViralOnly);

                    return (
                      <div key={idx} className="seeding-link-row">
                        <div className="seeding-link-input-group">
                          <span
                            style={{
                              width: "30px",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: isInvalid ? "#ef4444" : "var(--text-muted)",
                              textAlign: "right",
                              flexShrink: 0,
                            }}
                          >
                            #{idx + 1}
                          </span>

                          <input
                            type="url"
                            className="input"
                            disabled={isInputDisabled}
                            readOnly={isInputDisabled}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: "38px",
                              fontSize: "0.8125rem",
                              backgroundColor: isInvalid ? "rgba(239, 68, 68, 0.08)" : isInputDisabled ? "var(--bg-card)" : "var(--bg-input)",
                              borderRadius: "8px",
                              border: isInvalid ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                              color: isInvalid ? "#ef4444" : undefined,
                              textDecoration: isInvalid ? "line-through" : "none",
                              textDecorationColor: isInvalid ? "#ef4444" : undefined,
                              fontWeight: isInvalid ? 600 : undefined,
                              cursor: isInputDisabled ? "not-allowed" : "text",
                              opacity: isInputDisabled ? 0.75 : 1,
                            }}
                            placeholder={isInvalid ? "Link này đã bị khóa (QC từ chối)" : isOldLinkLocked ? "Link cũ đã chốt (Quy định: Không thể sửa link)" : canUpdatePostMetaOnly ? "Ca đã kết thúc (Không thể sửa link)" : isFormDisabled ? "Biểu mẫu đã bị khóa" : `Dán link bài viết Threads #${idx + 1}...`}
                            title={isInvalid ? "Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa, không thể chỉnh sửa" : isOldLinkLocked ? "Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự" : canUpdatePostMetaOnly ? "Ca đã kết thúc: Không thể sửa URL link (Chỉ được phép gắn loại bài / đề xuất viral)" : undefined}
                            value={link}
                            onChange={(e) => {
                              if (isInputDisabled) return;
                              const newLinks = [...threadLinks];
                              newLinks[idx] = e.target.value;
                              setThreadLinks(newLinks);
                            }}
                          />

                          {isInvalid && (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                padding: "4px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                              title="Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa, không thể chỉnh sửa"
                            >
                              <Lock size={12} /> Không hợp lệ (Đã khóa)
                            </span>
                          )}

                          {isOldLinkLocked && !isInvalid && (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: "rgba(148, 163, 184, 0.12)",
                                color: "var(--text-secondary)",
                                border: "1px solid rgba(148, 163, 184, 0.3)",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                padding: "4px 8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                              title="Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự"
                            >
                              <Lock size={12} /> Link cũ (Đã khóa)
                            </span>
                          )}

                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-icon"
                              style={{ height: "38px", width: "38px", minWidth: "38px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", flexShrink: 0 }}
                              title="Mở liên kết"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>

                        {/* Controls loại bài, nổi bật, viral */}
                        <div className="seeding-link-meta-group">
                          {/* Chọn Tag loại bài */}
                          <PostTagSelect
                            value={threadTags[idx] || ""}
                            onChange={(val) => {
                              if (isTagDisabled) return;
                              const copy = [...threadTags];
                              copy[idx] = val;
                              setThreadTags(copy);
                            }}
                            disabled={isTagDisabled}
                            title={!link.trim() ? "Vui lòng nhập link trước khi chọn thẻ" : "Gắn thẻ loại bài viết"}
                            availableTags={availableTags}
                          />

                          {/* Toggle Bài nổi bật */}
                          <button
                            type="button"
                            disabled={isHighlightDisabled}
                            onClick={() => {
                              if (isHighlightDisabled) return;
                              const copy = [...threadHighlights];
                              copy[idx] = !copy[idx];
                              setThreadHighlights(copy);
                            }}
                            style={{
                              height: "38px",
                              padding: "0 8px",
                              borderRadius: "8px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              cursor: isHighlightDisabled ? "not-allowed" : "pointer",
                              transition: "all 0.15s ease",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              opacity: isHighlightDisabled ? 0.6 : 1,
                              border: threadHighlights[idx] ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                              backgroundColor: threadHighlights[idx] ? "rgba(249, 115, 22, 0.15)" : isHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                              color: threadHighlights[idx] ? "var(--primary)" : "var(--text-muted)",
                            }}
                            title={
                              isInvalid
                                ? "Link đã bị QC từ chối, không được phép gắn nổi bật"
                                : !link.trim()
                                ? "Vui lòng nhập link trước khi gắn nổi bật"
                                : "Tích chọn nếu là Bài viết nổi bật trong ca làm việc"
                            }
                          >
                            <Flame size={13} color={threadHighlights[idx] ? "var(--primary)" : "var(--text-muted)"} />
                            <span>Nổi bật</span>
                          </button>

                          {/* Toggle Đề xuất Viral & Nhập số Like (Ẩn toàn bộ mức tiền thưởng) */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                            <button
                              type="button"
                              disabled={isHighlightDisabled}
                              onClick={() => {
                                if (isHighlightDisabled) return;
                                const copy = [...threadViralLikes];
                                if (copy[idx] !== "" && Number(copy[idx]) > 0) {
                                  copy[idx] = "";
                                } else {
                                  copy[idx] = 1000;
                                }
                                setThreadViralLikes(copy);
                              }}
                              style={{
                                height: "38px",
                                padding: "0 8px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: isHighlightDisabled ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                                opacity: isHighlightDisabled ? 0.6 : 1,
                                border: threadViralLikes[idx] !== "" && Number(threadViralLikes[idx]) > 0 ? "1px solid #8b5cf6" : "1px solid var(--border-color)",
                                backgroundColor: threadViralLikes[idx] !== "" && Number(threadViralLikes[idx]) > 0 ? "rgba(139, 92, 246, 0.15)" : isHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                color: threadViralLikes[idx] !== "" && Number(threadViralLikes[idx]) > 0 ? "#8b5cf6" : "var(--text-muted)",
                              }}
                              title={
                                isInvalid
                                  ? "Link đã bị QC từ chối, không được phép đề xuất viral"
                                  : !link.trim()
                                  ? "Vui lòng nhập link trước khi đề xuất viral"
                                  : "Tích chọn nếu là bài viết viral và tự điền số like (Quản lý sẽ kiểm tra đối soát)"
                              }
                            >
                              <Sparkles size={13} color={threadViralLikes[idx] !== "" && Number(threadViralLikes[idx]) > 0 ? "#8b5cf6" : "var(--text-muted)"} />
                              <span>Viral</span>
                            </button>

                            {threadViralLikes[idx] !== "" && Number(threadViralLikes[idx]) > 0 && (
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  background: "rgba(139, 92, 246, 0.08)",
                                  border: "1px solid rgba(139, 92, 246, 0.4)",
                                  borderRadius: "8px",
                                  padding: "0 6px",
                                  height: "38px",
                                }}
                                title="Tự điền số lượt like thực tế của bài viết viral này"
                              >
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  disabled={isHighlightDisabled}
                                  value={threadViralLikes[idx]}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0);
                                    const copy = [...threadViralLikes];
                                    copy[idx] = val;
                                    setThreadViralLikes(copy);
                                  }}
                                  placeholder="Lượt like"
                                  style={{
                                    width: "72px",
                                    height: "28px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    color: "var(--text-primary)",
                                    outline: "none",
                                    padding: "0 2px",
                                  }}
                                />
                                <span style={{ fontSize: "0.7rem", color: "#8b5cf6", fontWeight: 700 }}>like</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Supplement Links for Threads */}
                {threadSuppLinks.length > 0 && (
                  <div style={{ marginTop: "0.875rem", paddingTop: "0.875rem", borderTop: "1px dashed var(--border-color)" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--warning)", marginBottom: "0.5rem" }}>
                      🛡️ Link Threads Dự Phòng (Dùng để bù bài bị từ chối):
                    </div>
                    {threadSuppLinks.map((supp, sIdx) => {
                      const isSuppInvalid = isFormLinkInvalid(supp);
                      const isOldSupp = isOldReportLink(supp);
                      const isOldSuppLocked = isOldSupp && !selectedShiftStatusInfo?.canEditOldLinks;
                      const isSuppInputDisabled = isSuppInvalid || isFormDisabled || canUpdatePostMetaOnly || isOldSuppLocked;
                      const isSuppTagDisabled = !supp.trim() || (!selectedShiftStatusInfo?.canSubmit && !canUpdateTagsOnly);
                      const isSuppHighlightDisabled = !supp.trim() || isSuppInvalid || (!selectedShiftStatusInfo?.canSubmit && !canUpdateViralOnly);

                      return (
                        <div key={sIdx} className="seeding-link-row" style={{ marginBottom: "0.5rem" }}>
                          <div className="seeding-link-input-group">
                            <span style={{ fontSize: "0.75rem", color: isSuppInvalid ? "#ef4444" : "var(--warning)", width: "30px", textAlign: "right", flexShrink: 0 }}>
                              +T{sIdx + 1}
                            </span>
                            <input
                              type="url"
                              className="input"
                              disabled={isSuppInputDisabled}
                              readOnly={isSuppInputDisabled}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: "38px",
                                fontSize: "0.8125rem",
                                backgroundColor: isSuppInvalid ? "rgba(239, 68, 68, 0.08)" : isSuppInputDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                border: isSuppInvalid ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                                color: isSuppInvalid ? "#ef4444" : undefined,
                                textDecoration: isSuppInvalid ? "line-through" : "none",
                                textDecorationColor: isSuppInvalid ? "#ef4444" : undefined,
                                fontWeight: isSuppInvalid ? 600 : undefined,
                                cursor: isSuppInputDisabled ? "not-allowed" : "text",
                                opacity: isSuppInputDisabled ? 0.75 : 1,
                              }}
                              placeholder={isSuppInvalid ? "Link này đã bị khóa (QC từ chối)" : isOldSuppLocked ? "Link cũ đã chốt (Quy định: Không thể sửa link)" : canUpdatePostMetaOnly ? "Ca đã kết thúc (Không thể sửa link)" : isFormDisabled ? "Biểu mẫu đã bị khóa" : "Dán link Threads bổ sung..."}
                              title={isSuppInvalid ? "Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa" : isOldSuppLocked ? "Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự" : canUpdatePostMetaOnly ? "Ca đã kết thúc: Không thể sửa URL link (Chỉ được phép gắn loại bài / đề xuất viral)" : undefined}
                              value={supp}
                              onChange={(e) => {
                                if (isSuppInputDisabled) return;
                                const copy = [...threadSuppLinks];
                                copy[sIdx] = e.target.value;
                                setThreadSuppLinks(copy);
                              }}
                            />

                            {isSuppInvalid ? (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  padding: "4px 8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  flexShrink: 0,
                                }}
                                title="Link bị Quản lý/QC đánh dấu không hợp lệ và đã bị khóa"
                              >
                                <Lock size={12} /> Không hợp lệ (Đã khóa)
                              </span>
                            ) : isOldSuppLocked ? (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: "rgba(148, 163, 184, 0.12)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid rgba(148, 163, 184, 0.3)",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  padding: "4px 8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  flexShrink: 0,
                                }}
                                title="Link cũ đã nộp từ trước và đã được khóa cố định theo quy định nhân sự"
                              >
                                <Lock size={12} /> Link cũ (Đã khóa)
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                style={{ height: "38px", width: "38px", minWidth: "38px", padding: 0, flexShrink: 0 }}
                                disabled={isFormDisabled || canUpdateTagsOnly}
                                onClick={() => {
                                  if (isFormDisabled || canUpdateTagsOnly) return;
                                  setThreadSuppLinks(threadSuppLinks.filter((_, i) => i !== sIdx));
                                  setThreadSuppTags(threadSuppTags.filter((_, i) => i !== sIdx));
                                  setThreadSuppHighlights(threadSuppHighlights.filter((_, i) => i !== sIdx));
                                }}
                                title={canUpdateTagsOnly ? "Ca đã kết thúc, không thể xóa link" : "Xóa link dự phòng"}
                              >
                                <Trash2 size={14} color="var(--danger)" />
                              </button>
                            )}
                          </div>

                          {/* Controls loại bài, nổi bật, viral */}
                          <div className="seeding-link-meta-group">
                            {/* Chọn Tag loại bài */}
                            <PostTagSelect
                              value={threadSuppTags[sIdx] || ""}
                              onChange={(val) => {
                                if (isSuppTagDisabled) return;
                                const copy = [...threadSuppTags];
                                copy[sIdx] = val;
                                setThreadSuppTags(copy);
                              }}
                              disabled={isSuppTagDisabled}
                              title={!supp.trim() ? "Vui lòng nhập link trước khi chọn thẻ" : "Gắn thẻ loại bài viết"}
                              availableTags={availableTags}
                            />

                            {/* Toggle Bài nổi bật */}
                            <button
                              type="button"
                              disabled={isSuppHighlightDisabled}
                              onClick={() => {
                                if (isSuppHighlightDisabled) return;
                                const copy = [...threadSuppHighlights];
                                copy[sIdx] = !copy[sIdx];
                                setThreadSuppHighlights(copy);
                              }}
                              style={{
                                height: "38px",
                                padding: "0 8px",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                cursor: isSuppHighlightDisabled ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                                opacity: isSuppHighlightDisabled ? 0.6 : 1,
                                border: threadSuppHighlights[sIdx] ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                                backgroundColor: threadSuppHighlights[sIdx] ? "rgba(249, 115, 22, 0.15)" : isSuppHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                color: threadSuppHighlights[sIdx] ? "var(--primary)" : "var(--text-muted)",
                              }}
                              title={
                                isSuppInvalid
                                  ? "Link đã bị QC từ chối, không được phép gắn nổi bật"
                                  : !supp.trim()
                                  ? "Vui lòng nhập link trước khi gắn nổi bật"
                                  : "Tích chọn nếu là Bài viết nổi bật trong ca làm việc"
                              }
                            >
                              <Flame size={13} color={threadSuppHighlights[sIdx] ? "var(--primary)" : "var(--text-muted)"} />
                              <span>Nổi bật</span>
                            </button>

                            {/* Toggle Đề xuất Viral & Nhập số Like (Ẩn toàn bộ mức tiền thưởng) */}
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              <button
                                type="button"
                                disabled={isSuppHighlightDisabled}
                                onClick={() => {
                                  if (isSuppHighlightDisabled) return;
                                  const copy = [...threadSuppViralLikes];
                                  if (copy[sIdx] !== "" && Number(copy[sIdx]) > 0) {
                                    copy[sIdx] = "";
                                  } else {
                                    copy[sIdx] = 1000;
                                  }
                                  setThreadSuppViralLikes(copy);
                                }}
                                style={{
                                  height: "38px",
                                  padding: "0 8px",
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  cursor: isSuppHighlightDisabled ? "not-allowed" : "pointer",
                                  transition: "all 0.15s ease",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                  opacity: isSuppHighlightDisabled ? 0.6 : 1,
                                  border: threadSuppViralLikes[sIdx] !== "" && Number(threadSuppViralLikes[sIdx]) > 0 ? "1px solid #8b5cf6" : "1px solid var(--border-color)",
                                  backgroundColor: threadSuppViralLikes[sIdx] !== "" && Number(threadSuppViralLikes[sIdx]) > 0 ? "rgba(139, 92, 246, 0.15)" : isSuppHighlightDisabled ? "var(--bg-card)" : "var(--bg-input)",
                                  color: threadSuppViralLikes[sIdx] !== "" && Number(threadSuppViralLikes[sIdx]) > 0 ? "#8b5cf6" : "var(--text-muted)",
                                }}
                                title={
                                  isSuppInvalid
                                    ? "Link đã bị QC từ chối, không được phép đề xuất viral"
                                    : !supp.trim()
                                    ? "Vui lòng nhập link trước khi đề xuất viral"
                                    : "Tích chọn nếu là bài viết viral và tự điền số like (Quản lý sẽ kiểm tra đối soát)"
                                }
                              >
                                <Sparkles size={13} color={threadSuppViralLikes[sIdx] !== "" && Number(threadSuppViralLikes[sIdx]) > 0 ? "#8b5cf6" : "var(--text-muted)"} />
                                <span>Viral</span>
                              </button>

                              {threadSuppViralLikes[sIdx] !== "" && Number(threadSuppViralLikes[sIdx]) > 0 && (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    background: "rgba(139, 92, 246, 0.08)",
                                    border: "1px solid rgba(139, 92, 246, 0.4)",
                                    borderRadius: "8px",
                                    padding: "0 6px",
                                    height: "38px",
                                  }}
                                  title="Tự điền số lượt like thực tế của bài viết viral này"
                                >
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    disabled={isSuppHighlightDisabled}
                                    value={threadSuppViralLikes[sIdx]}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0);
                                      const copy = [...threadSuppViralLikes];
                                      copy[sIdx] = val;
                                      setThreadSuppViralLikes(copy);
                                    }}
                                    placeholder="Lượt like"
                                    style={{
                                      width: "72px",
                                      height: "28px",
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      borderRadius: "4px",
                                      border: "none",
                                      backgroundColor: "transparent",
                                      color: "var(--text-primary)",
                                      outline: "none",
                                      padding: "0 2px",
                                    }}
                                  />
                                  <span style={{ fontSize: "0.7rem", color: "#8b5cf6", fontWeight: 700 }}>like</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isFormDisabled || canUpdatePostMetaOnly}
                  style={{
                    marginTop: "0.875rem",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: isFormDisabled || canUpdatePostMetaOnly ? "not-allowed" : "pointer",
                    opacity: isFormDisabled || canUpdatePostMetaOnly ? 0.6 : 1,
                  }}
                  title={canUpdatePostMetaOnly ? "Ca đã kết thúc: Không được phép thêm link bổ sung (Cần Quản lý mở quyền)" : undefined}
                  onClick={() => {
                    if (isFormDisabled || canUpdatePostMetaOnly) return;
                    setThreadSuppLinks([...threadSuppLinks, ""]);
                    setThreadSuppTags([...threadSuppTags, ""]);
                    setThreadSuppHighlights([...threadSuppHighlights, false]);
                  }}
                >
                  <Plus size={14} /> Thêm Link Threads Dự Phòng
                </button>
              </div>

              {/* SECTION 4: LINK GOOGLE DRIVE COMMENTS */}
              <div
                className="card"
                style={{
                  padding: "1.25rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                }}
              >
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  📁 4. Link Google Drive Ảnh Chụp 50 Comments <span style={{ color: "var(--danger)" }}>*</span>
                  {hasDriveDraftLink && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "rgba(245, 158, 11, 0.15)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        padding: "2px 6px",
                      }}
                      title="Đang hiển thị từ bản nháp tạm thời"
                    >
                      Lưu tạm
                    </span>
                  )}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  Dán link thư mục Google Drive chứa đầy đủ ảnh chụp minh chứng bình luận trong ca
                </p>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="url"
                    className="input"
                    disabled={isFormDisabled || canUpdateTagsOnly}
                    readOnly={isFormDisabled || canUpdateTagsOnly}
                    style={{
                      flex: 1,
                      height: "40px",
                      backgroundColor: isFormDisabled || canUpdateTagsOnly ? "var(--bg-card)" : "var(--bg-input)",
                      borderRadius: "8px",
                      cursor: isFormDisabled || canUpdateTagsOnly ? "not-allowed" : "text",
                      opacity: isFormDisabled || canUpdateTagsOnly ? 0.75 : 1,
                    }}
                    placeholder={canUpdateTagsOnly ? "Ca đã kết thúc (Không thể sửa link Drive)" : isFormDisabled ? "Biểu mẫu đã bị khóa" : "https://drive.google.com/drive/folders/..."}
                    title={canUpdateTagsOnly ? "Ca đã kết thúc: Không thể sửa link Drive" : undefined}
                    value={commentDriveLink}
                    onChange={(e) => {
                      if (isFormDisabled || canUpdateTagsOnly) return;
                      setCommentDriveLink(e.target.value);
                    }}
                  />
                  {commentDriveLink && (
                    <a
                      href={commentDriveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-icon"
                      style={{ height: "40px", width: "40px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}
                      title="Mở Google Drive"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* CỘT 3: CHECKLIST & QUY ĐỊNH DUYỆT QC */}
            <div className="seeding-col-summary">
              {/* CARD: KIỂM TRA CHUẨN BÁO CÁO */}
              <div
                className="card seeding-desktop-checklist"
                style={{
                  padding: "1.25rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <ShieldCheck size={18} color="var(--primary)" /> Kiểm Tra Chuẩn Báo Cáo
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {filledFbCount >= targetFb ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : (
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #f97316", display: "inline-block" }} />
                    )}
                    <span style={{ fontSize: "0.8125rem", color: filledFbCount >= targetFb ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {targetFb} bài viết Facebook ({filledFbCount}/{targetFb})
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {filledThreadCount >= targetThread ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : (
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #f97316", display: "inline-block" }} />
                    )}
                    <span style={{ fontSize: "0.8125rem", color: filledThreadCount >= targetThread ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {targetThread} bài viết Threads ({filledThreadCount}/{targetThread})
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {isDriveFilled ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : (
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #f97316", display: "inline-block" }} />
                    )}
                    <span style={{ fontSize: "0.8125rem", color: isDriveFilled ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      Link Drive {targetComment} Comments
                    </span>
                  </div>
                </div>

                {/* NÚT SUBMIT TO NỔI BẬT */}
                <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
                  {selectedShiftStatusInfo?.phase === "AWAITING_CHECKIN" ? (
                    <button
                      type="button"
                      onClick={() => selectedShift && handleCheckIn(selectedShift.id)}
                      disabled={checkingIn}
                      className="btn"
                      style={{
                        width: "100%",
                        height: "44px",
                        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        color: "#ffffff",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        borderRadius: "10px",
                        boxShadow: "0 4px 16px rgba(245, 158, 11, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        border: "none",
                        cursor: checkingIn ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {checkingIn ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Đang ghi nhận Vào ca...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Bấm Vào Ca Để Bắt Đầu Nộp Link
                        </>
                      )}
                    </button>
                  ) : canUpdatePostMetaOnly ? (
                    <button
                      type="button"
                      onClick={handleUpdateTagsOnly}
                      className="btn"
                      disabled={updatingTags}
                      style={{
                        width: "100%",
                        height: "44px",
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        color: "#ffffff",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        borderRadius: "10px",
                        boxShadow: "0 4px 16px rgba(59, 130, 246, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        border: "none",
                        cursor: updatingTags ? "not-allowed" : "pointer",
                        opacity: updatingTags ? 0.7 : 1,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {updatingTags ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Đang lưu cập nhật...
                        </>
                      ) : (
                        <>
                          <Flame size={16} /> Lưu Thẻ Loại Bài & Đề Xuất Viral
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn"
                      style={{
                        width: "100%",
                        height: "44px",
                        background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                        color: "#ffffff",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        borderRadius: "10px",
                        boxShadow: "0 4px 16px rgba(249, 115, 22, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        border: "none",
                        cursor:
                          submitting || !selectedShiftId || !selectedShiftStatusInfo?.canSubmit
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          submitting || !selectedShiftId || !selectedShiftStatusInfo?.canSubmit
                            ? 0.5
                            : 1,
                        transition: "all 0.2s ease",
                      }}
                      disabled={submitting || !selectedShiftId || !selectedShiftStatusInfo?.canSubmit}
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Đang gửi báo cáo...
                        </>
                      ) : selectedShift?.dailyReport && !selectedShiftStatusInfo?.canSubmit ? (
                        <>
                          <CheckCircle2 size={16} /> Đã Nộp Báo Cáo Ca Này
                        </>
                      ) : selectedShiftStatusInfo && !selectedShiftStatusInfo.canSubmit ? (
                        <>
                          <Lock size={16} /> {selectedShiftStatusInfo.badgeText} (Không thể nộp)
                        </>
                      ) : !selectedShiftId ? (
                        <>
                          <Lock size={16} /> Vui Lòng Chọn Ca
                        </>
                      ) : selectedShiftStatusInfo?.phase === "POST_SHIFT_EDIT" ? (
                        <>
                          <Send size={16} /> Lưu Sửa Báo Cáo (Cửa Sổ 60p)
                        </>
                      ) : selectedShiftStatusInfo?.phase === "WEEKLY_MAKEUP" ? (
                        <>
                          <Send size={16} /> Nộp Bù Tuần Ca Này
                        </>
                      ) : selectedShiftStatusInfo?.phase === "SPECIAL_REOPEN" ? (
                        <>
                          <Send size={16} /> Nộp Bù Đặc Cách Ca Này
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Nộp Báo Cáo Ca Này
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* CARD: TIÊU CHUẨN DUYỆT QC & QUY ĐỊNH NHÂN SỰ */}
              <div
                className="card"
                style={{
                  padding: "1.25rem",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                  lineHeight: "1.5",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                }}
              >
                {/* Header card */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: isRulesCollapsed ? "none" : "1px solid var(--border-color)",
                    paddingBottom: isRulesCollapsed ? 0 : "0.625rem",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={() => setIsRulesCollapsed(!isRulesCollapsed)}
                  title={isRulesCollapsed ? "Bấm để mở xem chi tiết quy định QC & nhân sự" : "Bấm để thu gọn quy định"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(249, 115, 22, 0.15)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                        Tiêu Chuẩn Duyệt Của QC
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        Quy định bắt buộc đối với nhân sự khi nộp ca
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost btn-sm"
                    style={{ color: "var(--text-muted)", width: "26px", height: "26px", padding: 0 }}
                    aria-label="Toggle rules"
                  >
                    {isRulesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>

                {!isRulesCollapsed && (
                  <>
                    {/* Phần 1: Từ khóa bắt buộc trong bài viết */}
                    <div
                      style={{
                        padding: "0.75rem",
                        borderRadius: "10px",
                        backgroundColor: "rgba(59, 130, 246, 0.06)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#60a5fa", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Tag size={13} /> TỪ KHÓA BẮT BUỘC TRONG BÀI:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            color: "#60a5fa",
                            border: "1px solid rgba(59, 130, 246, 0.35)",
                          }}
                        >
                          Freetrip
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            color: "#3b82f6",
                            border: "1px solid rgba(59, 130, 246, 0.35)",
                          }}
                        >
                          Nạp thẻ điện thoại
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.35)",
                          }}
                        >
                          Fastdate
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(236, 72, 153, 0.15)",
                            color: "#ec4899",
                            border: "1px solid rgba(236, 72, 153, 0.35)",
                          }}
                        >
                          Secret Chat
                        </span>
                      </div>
                    </div>

                    {/* Phần 2: Lưu ý nộp bài */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ marginTop: "2px", color: "#a855f7", flexShrink: 0 }}>
                          <Lock size={14} />
                        </div>
                        <div style={{ fontSize: "0.78rem" }}>
                          <strong>Quy định nộp bù:</strong> Khi kết thúc ca (sau 1h nộp bù/sửa ngay sau ca), toàn bộ link cũ được khóa cố định. Nhân sự vẫn được phép nộp bổ sung hoặc thêm link dự phòng (+B, +T) đến hết tuần (23:59 Chủ Nhật) để đảm bảo chỉ tiêu KPI ca.
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ marginTop: "2px", color: "#ef4444", flexShrink: 0 }}>
                          <AlertCircle size={14} />
                        </div>
                        <div style={{ fontSize: "0.78rem" }}>
                          Link bài bị xóa/lỗi: Bù bằng link dự phòng tương ứng (+B, +T) để đạt tiêu chuẩn ca.
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ marginTop: "2px", color: "#f59e0b", flexShrink: 0 }}>
                          <XCircle size={14} />
                        </div>
                        <div style={{ fontSize: "0.78rem" }}>
                          Không nhắc tên thương hiệu hay ứng dụng đối thủ trong nội dung bài viết.
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ marginTop: "2px", color: "var(--primary)", flexShrink: 0 }}>
                          <Flame size={14} />
                        </div>
                        <div style={{ fontSize: "0.78rem" }}>
                          Hạn gắn thẻ loại bài trong <strong>7 ngày</strong>, đề xuất bài Viral trong <strong>30 ngày</strong> sau ca.
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ marginTop: "2px", color: "#10b981", flexShrink: 0 }}>
                          <CheckCircle2 size={14} />
                        </div>
                        <div style={{ fontSize: "0.78rem" }}>
                          Hệ thống tự động lưu nháp. Bạn hãy bấm <strong>Nộp Báo Cáo</strong> trước khi kết thúc ca để QC chấm điểm.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* MOBILE FLOATING ACTION BAR (STICKY DOCK) */}
          <div className="seeding-mobile-dock">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1, overflow: "hidden" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "3px 7px",
                  borderRadius: "6px",
                  backgroundColor: totalValidFbCount >= targetFb ? "rgba(16, 185, 129, 0.15)" : "rgba(249, 115, 22, 0.15)",
                  color: totalValidFbCount >= targetFb ? "#10b981" : "var(--primary)",
                  border: `1px solid ${totalValidFbCount >= targetFb ? "rgba(16, 185, 129, 0.3)" : "rgba(249, 115, 22, 0.3)"}`,
                  whiteSpace: "nowrap",
                }}
                title="Tiến độ bài viết Facebook"
              >
                FB: {totalValidFbCount}/{targetFb}
              </span>

              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "3px 7px",
                  borderRadius: "6px",
                  backgroundColor: totalValidThreadCount >= targetThread ? "rgba(16, 185, 129, 0.15)" : "rgba(249, 115, 22, 0.15)",
                  color: totalValidThreadCount >= targetThread ? "#10b981" : "var(--primary)",
                  border: `1px solid ${totalValidThreadCount >= targetThread ? "rgba(16, 185, 129, 0.3)" : "rgba(249, 115, 22, 0.3)"}`,
                  whiteSpace: "nowrap",
                }}
                title="Tiến độ bài viết Threads"
              >
                TH: {totalValidThreadCount}/{targetThread}
              </span>

              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "3px 7px",
                  borderRadius: "6px",
                  backgroundColor: isDriveFilled ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: isDriveFilled ? "#10b981" : "var(--text-muted)",
                  border: `1px solid ${isDriveFilled ? "rgba(16, 185, 129, 0.3)" : "rgba(100, 116, 139, 0.2)"}`,
                  whiteSpace: "nowrap",
                }}
                title="Link Google Drive minh chứng"
              >
                Drive: {isDriveFilled ? "✓" : "—"}
              </span>
            </div>

              {selectedShiftStatusInfo?.phase === "AWAITING_CHECKIN" ? (
                <button
                  type="button"
                  onClick={() => selectedShift && handleCheckIn(selectedShift.id)}
                  disabled={checkingIn}
                  className="btn btn-sm"
                  style={{
                    height: "36px",
                    padding: "0 14px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#ffffff",
                    boxShadow: "0 2px 10px rgba(245, 158, 11, 0.35)",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    border: "none",
                    cursor: checkingIn ? "not-allowed" : "pointer",
                  }}
                >
                  {checkingIn ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Vào ca...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} /> Vào ca
                    </>
                  )}
                </button>
              ) : canUpdatePostMetaOnly ? (
                <button
                  type="button"
                  onClick={handleUpdateTagsOnly}
                  className="btn btn-primary btn-sm"
                  disabled={updatingTags}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    borderRadius: "8px",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {updatingTags ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Lưu...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Lưu thẻ
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !selectedShiftId || !selectedShiftStatusInfo?.canSubmit}
                  className="btn btn-primary btn-sm"
                  style={{
                    height: "36px",
                    padding: "0 14px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    borderRadius: "8px",
                    boxShadow: "0 2px 10px rgba(249, 115, 22, 0.35)",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Đang gửi...
                    </>
                  ) : selectedShift?.dailyReport && !selectedShiftStatusInfo?.canSubmit ? (
                    <>
                      <CheckCircle2 size={14} /> Đã nộp ca
                    </>
                  ) : selectedShiftStatusInfo && !selectedShiftStatusInfo.canSubmit ? (
                    <>
                      <Lock size={14} /> Ca đã khóa
                    </>
                  ) : !selectedShiftId ? (
                    <>
                      <Lock size={14} /> Chọn ca
                    </>
                  ) : selectedShiftStatusInfo?.phase === "POST_SHIFT_EDIT" ? (
                    <>
                      <Send size={14} /> Lưu sửa
                    </>
                  ) : selectedShiftStatusInfo?.phase === "WEEKLY_MAKEUP" || selectedShiftStatusInfo?.phase === "SPECIAL_REOPEN" ? (
                    <>
                      <Send size={14} /> Nộp bù
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Nộp ca
                    </>
                  )}
                </button>
              )}
          </div>
        </form>
      )}

      {/* TAB 2: LỊCH SỬ BÁO CÁO & QC REVIEW */}
      {activeTab === "HISTORY" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Lịch Sử Báo Cáo Seeding Của Bạn</h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Theo dõi kết quả kiểm duyệt QC và số lượng link đạt chuẩn
              </p>
            </div>

            {/* BỘ LỌC NGÀY (MỞ CALENDAR VÀ CHỌN NGÀY CẦN LỌC) */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ width: "190px" }}>
                <CustomDatePicker
                  value={historyDateFilter}
                  onChange={(dateStr) => setHistoryDateFilter(dateStr)}
                  placeholder="Chọn ngày lọc..."
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{
                  height: "42px",
                  padding: "0 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
                onClick={() => handleFilterHistory()}
                title="Nhấn để lọc danh sách báo cáo theo ngày đã chọn"
              >
                <Filter size={15} /> Lọc
              </button>

              {hasFilteredHistory && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    height: "42px",
                    padding: "0 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.8125rem",
                  }}
                  onClick={handleResetHistory}
                  title="Đặt lại bộ lọc"
                >
                  <X size={14} /> Đặt lại
                </button>
              )}

              <button
                className="btn btn-secondary btn-icon"
                style={{ height: "42px", width: "42px" }}
                onClick={() => {
                  if (hasFilteredHistory && historyDateFilter) {
                    handleFilterHistory();
                  } else {
                    showToast("Vui lòng chọn ngày và nhấn Lọc để xem báo cáo", "error");
                  }
                }}
                title="Làm mới danh sách"
              >
                <RefreshCw size={16} className={loadingHistory ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày & Ca</th>
                  <th>Thời gian nộp</th>
                  <th>Link FB</th>
                  <th>Link Threads</th>
                  <th>Drive Ảnh</th>
                  <th>Kết Quả QC</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                      <RefreshCw size={18} className="animate-spin" style={{ margin: "0 auto" }} />
                    </td>
                  </tr>
                ) : !hasFilteredHistory ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "10px",
                          color: "var(--text-muted)",
                        }}
                      >
                        <CalendarIcon size={34} style={{ opacity: 0.35, color: "var(--primary)" }} />
                        <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                          Vui lòng chọn ngày và nhấn <strong style={{ color: "var(--primary)" }}>&quot;Lọc&quot;</strong> để xem dữ liệu báo cáo.
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                          Hệ thống chỉ hiển thị danh sách báo cáo sau khi bạn chọn ngày và xác nhận lọc.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : reportsHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <AlertCircle size={28} style={{ opacity: 0.4 }} />
                        <div>
                          Không có báo cáo nào trong ngày{" "}
                          <strong>{historyDateFilter.split("-").reverse().join("/")}</strong>.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reportsHistory.map((report) => {
                    const shiftInfo = SHIFT_LABEL_MAP[report.shiftType] || {
                      label: report.shiftType,
                      icon: "⏰",
                    };
                    const review = report.qcReview;

                    return (
                      <tr key={report.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(report.reportDate).toLocaleDateString("vi-VN")}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {shiftInfo.icon} {shiftInfo.label.split(" ")[1]}
                          </div>
                        </td>

                        <td style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {new Date(report.submittedAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td>
                          <span className={`badge ${report.fbLinks.length >= 10 ? "badge-success" : "badge-warning"}`}>
                            {report.fbLinks.length}/10
                          </span>
                        </td>

                        <td>
                          <span className={`badge ${report.threadLinks.length >= 4 ? "badge-success" : "badge-warning"}`}>
                            {report.threadLinks.length}/4
                          </span>
                        </td>

                        <td>
                          {report.commentDriveLink ? (
                            <a
                              href={report.commentDriveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-icon"
                              style={{ padding: "4px 8px" }}
                              title="Mở Google Drive"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>-</span>
                          )}
                        </td>

                        <td>
                          {!review || review.result === "PENDING" ? (
                            <span className="badge badge-warning">
                              <Clock size={12} /> Chờ QC duyệt
                            </span>
                          ) : review.result === "PASS" ? (
                            <span className="badge badge-success">
                              <CheckCircle2 size={12} /> ĐẠT ({review.fbApproved} FB, {review.threadApproved} TH)
                            </span>
                          ) : (
                            <span className="badge badge-danger">
                              <XCircle size={12} /> KHÔNG ĐẠT
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ padding: "6px" }}
                            onClick={() => {
                              setActiveTab("SUBMIT");
                              const dateKey = formatDateToKey(report.reportDate);
                              setSelectedDateStr(dateKey);
                              setSelectedShiftId(String(report.shiftRegistration?.id || report.id));
                              loadReportToForm(report);
                              showToast("Đã tải dữ liệu báo cáo lên biểu mẫu!", "success");
                            }}
                            title="Xem lại báo cáo trên biểu mẫu"
                          >
                            <Eye size={16} />
                          </button>
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

      {/* MODAL CẢNH BÁO TẢI LẠI TRANG HOẶC RỜI TRANG KHI FORM CÓ LINK CHƯA NỘP */}
      <Modal
        isOpen={showUnsavedModal}
        onClose={handleCancelLeave}
        maxWidth="500px"
        title={
          pendingNavigationUrl === "RELOAD" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "var(--warning-bg)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--warning)",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.15)",
                }}
              >
                <RefreshCw size={20} />
              </div>
              <div>
                <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25 }}>
                  Tải lại trang web?
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "3px" }}>
                  Xác nhận làm mới giao diện biểu mẫu báo cáo
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "var(--warning-bg)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--warning)",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.15)",
                }}
              >
                <AlertCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25 }}>
                  Bạn chưa nộp báo cáo ca này!
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "3px" }}>
                  Biểu mẫu đang có liên kết chưa gửi lên hệ thống
                </div>
              </div>
            </div>
          )
        }
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", width: "100%" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelLeave}
              style={{
                padding: "0.55rem 1.15rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              {pendingNavigationUrl === "RELOAD" ? "Huỷ" : "Ở lại nộp bài"}
            </button>

            <button
              type="button"
              onClick={handleConfirmLeave}
              style={{
                padding: "0.55rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "8px",
                background:
                  pendingNavigationUrl === "RELOAD"
                    ? "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)"
                    : "var(--danger)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow:
                  pendingNavigationUrl === "RELOAD"
                    ? "0 2px 10px var(--primary-glow)"
                    : "0 2px 10px rgba(244, 63, 94, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              {pendingNavigationUrl === "RELOAD" ? (
                <>
                  <RefreshCw size={15} />
                  <span>Tải lại</span>
                </>
              ) : (
                "Tiếp tục rời đi"
              )}
            </button>
          </div>
        }
      >
        <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          <p style={{ marginBottom: "0.875rem", color: "var(--text-primary)" }}>
            {pendingNavigationUrl === "RELOAD"
              ? "Các thay đổi bạn đã thực hiện có thể chưa được lưu chính thức lên máy chủ."
              : "Biểu mẫu đang có dữ liệu liên kết bài viết đã gắn nhưng chưa được gửi lên hệ thống."}
          </p>

          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "10px",
              backgroundColor: "var(--warning-bg)",
              border: "1px solid rgba(245, 158, 11, 0.28)",
              color: "var(--text-primary)",
              fontSize: "0.8125rem",
              lineHeight: "1.5",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "0.5rem",
            }}
          >
            <ShieldCheck size={18} style={{ color: "var(--warning)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--warning)", marginBottom: "2px" }}>
                Bảo vệ dữ liệu an toàn
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                Hệ thống đã tự động lưu tạm các link bài viết vào bộ nhớ máy này. Sau khi tải lại hoặc quay lại ca này, dữ liệu sẽ được khôi phục tự động.
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
