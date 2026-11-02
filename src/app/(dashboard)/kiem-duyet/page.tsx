"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { confirmModal, CustomDateTimePicker, Modal } from "@/components/ui";
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  Send,
  Bell,
  MessageSquare,
  ShieldCheck,
  UserX,
  Unlock,
  Lock,
  RefreshCw,
  FolderOpen,
  Calendar,
  Flame,
  Phone,
  User,
  Check,
  AlertOctagon,
  Camera,
  Eye,
  Maximize2,
  X,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
} from "lucide-react";
import {
  getQCScanFromIndexedDB,
  saveQCScanToIndexedDB,
  clearAllQCIndexedDBCache,
} from "@/lib/qcCacheIndexedDB";

interface QueueItem {
  id: number;
  userId: number;
  shiftRegistrationId: number;
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
  makeupUrls?: string[];
  slaRemainingDays: number;
  slaStatus: "SAFE" | "WARNING" | "OVERDUE";
  isUnsubmitted?: boolean;
  user: {
    id: number;
    fullName: string;
    phone: string;
    role: string;
    avatarUrl?: string;
  };
  shiftRegistration: {
    id: number;
    shiftDate: string;
    shiftType: string;
    workMode: string;
    status: string;
    reopenedBy?: number | null;
    reopenedUntil?: string | null;
    loginSession?: {
      isLate: boolean;
      lateMinutes: number;
      autoMarkedAbsent: boolean;
    } | null;
  };
  qcReview?: {
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
  } | null;
  viralPosts?: Array<{
    id: number;
    postUrl: string;
    contentType: string;
    likes: number;
    bonusAmount: number;
  }>;
}

interface ScanResultItem {
  url: string;
  platform: string;
  index: number;
  isValid: boolean;
  httpCode?: number;
  title?: string | null;
  description?: string | null;
  ogImage?: string | null;
  errorMessage?: string | null;
  hasScreenshot?: boolean;
  screenshotUrl?: string | null;
  localBlobUrl?: string | null;
  imageBlob?: Blob;
  inspectedAt?: number;
}

interface Stats {
  totalPending: number;
  totalUrgent: number;
  reviewedToday: number;
  totalPassed: number;
  totalUnsubmitted?: number;
}

interface ViralTierItem {
  id: number;
  platform: string;
  contentType: string;
  minLikes: number;
  bonusAmount: number;
}

const SHIFT_MAP: Record<string, { label: string; icon: string }> = {
  MORNING: { label: "Ca Sáng", icon: "☀️" },
  AFTERNOON: { label: "Ca Chiều", icon: "🌤️" },
  EVENING: { label: "Ca Tối", icon: "🌙" },
};

function decodeHtmlEntities(str?: string | null): string {
  if (!str) return "";
  let text = str;
  if (typeof window !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(text, "text/html");
      text = doc.body.textContent || text;
    } catch {
      // Fallback below
    }
  }
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getSafeImageUrl(scan?: ScanResultItem): string | null {
  if (!scan || !scan.isValid) return null;
  if (scan.localBlobUrl) return scan.localBlobUrl;
  if (scan.screenshotUrl) return scan.screenshotUrl;
  if (scan.ogImage) {
    return `/api/qc/image-proxy?url=${encodeURIComponent(scan.ogImage)}`;
  }
  return null;
}

function parseSafeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface PostTagItem {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

function sanitizeReport(rep: any): QueueItem {
  if (!rep) return rep;
  return {
    ...rep,
    fbLinks: parseSafeArray(rep.fbLinks),
    fbSupplementLinks: parseSafeArray(rep.fbSupplementLinks),
    threadLinks: parseSafeArray(rep.threadLinks),
    femaleContentLinks: parseSafeArray(rep.femaleContentLinks),
    viralPostLinks: parseSafeArray(rep.viralPostLinks),
    postTags: rep.postTags && typeof rep.postTags === "object" ? rep.postTags : {},
  };
}

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getShiftTimeState(
  shiftDateStr: string,
  shiftType: string,
  now: Date = new Date()
): { timeState: "UPCOMING" | "IN_SHIFT" | "ENDED"; startText: string; endText: string } {
  let startHour = 8, startMin = 0, endHour = 12, endMin = 30;
  let startText = "08:00", endText = "12:00";

  if (shiftType === "AFTERNOON") {
    startHour = 13; startMin = 30; endHour = 17; endMin = 30;
    startText = "13:30"; endText = "17:30";
  } else if (shiftType === "EVENING") {
    startHour = 18; startMin = 0; endHour = 22; endMin = 0;
    startText = "18:00"; endText = "22:00";
  }

  const dateOnly = shiftDateStr.slice(0, 10);
  const start = new Date(`${dateOnly}T${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}:00+07:00`);
  const end = new Date(`${dateOnly}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00+07:00`);

  if (now < start) return { timeState: "UPCOMING", startText, endText };
  if (now <= end) return { timeState: "IN_SHIFT", startText, endText };
  return { timeState: "ENDED", startText, endText };
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function formatDateTimeVN(str: string): string {
  if (!str) return "";
  const [dPart, tPart = "00:00:00"] = str.replace("T", " ").trim().split(" ");
  const dTokens = dPart.split("-");
  const dateVN = dTokens.length === 3 ? `${dTokens[2]}/${dTokens[1]}/${dTokens[0]}` : dPart;
  return `${dateVN} ${tPart}`;
}

// Helper chuẩn hóa URL để so khớp linh hoạt giữa link bài viết thường và link bài nổi bật/dự phòng
function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let clean = rawUrl.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^(web|m|mobile|touch|l|lm)\.facebook\.com/, "facebook.com");
  clean = clean.replace(/^www\.facebook\.com/, "facebook.com");
  clean = clean.replace(/^fb\.com/, "facebook.com");
  clean = clean.replace(/^www\.threads\.net/, "threads.net");
  clean = clean.replace(/^(www\.)?threads\.com/, "threads.net");

  const questionIndex = clean.indexOf("?");
  if (questionIndex !== -1) clean = clean.substring(0, questionIndex);
  const hashIndex = clean.indexOf("#");
  if (hashIndex !== -1) clean = clean.substring(0, hashIndex);

  clean = clean.replace(/\/+$/, "");
  return clean;
}

function matchUrls(urlA: string, urlB: string): boolean {
  if (!urlA || !urlB) return false;
  if (urlA.trim() === urlB.trim()) return true;
  const normA = normalizeUrl(urlA);
  const normB = normalizeUrl(urlB);
  if (normA && normB && normA === normB) return true;

  const idMatchA = normA.match(/\/(?:p|posts|reel|share\/p)\/([a-zA-Z0-9_-]+)/);
  const idMatchB = normB.match(/\/(?:p|posts|reel|share\/p)\/([a-zA-Z0-9_-]+)/);
  if (idMatchA && idMatchB && idMatchA[1] === idMatchB[1]) return true;

  return false;
}

export default function KiemDuyetQcPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPending: 0,
    totalUrgent: 0,
    reviewedToday: 0,
    totalPassed: 0,
    totalUnsubmitted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QueueItem | null>(null);

  // Lazy Loading / Infinite Scroll cho cột hàng đợi bên trái
  const PAGE_SIZE = 20;
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const pageRef = useRef<number>(1);
  const hasMoreRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);
  const queueScrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Filters: DateTime Range (Từ ngày - Đến ngày kèm HH:mm:ss)
  const [fromSelectedDate, setFromSelectedDate] = useState<string>(() => `${getLocalDateString()} 00:00:00`);
  const [toSelectedDate, setToSelectedDate] = useState<string>(() => `${getLocalDateString()} 23:59:59`);
  const [appliedFromDate, setAppliedFromDate] = useState<string>(() => `${getLocalDateString()} 00:00:00`);
  const [appliedToDate, setAppliedToDate] = useState<string>(() => `${getLocalDateString()} 23:59:59`);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [slaUrgentFilter, setSlaUrgentFilter] = useState(false);

  // AbortController ref để hủy request cũ khi có filter mới, chống race condition và crash khi tải data lớn
  const abortControllerRef = useRef<AbortController | null>(null);

  // Xử lý thay đổi "Từ ngày" — chỉ cập nhật state, validation chạy khi nhấn Search
  const handleFromDateChange = (val: string) => {
    setFromSelectedDate(val);
  };

  // Xử lý thay đổi "Đến ngày" — chỉ cập nhật state, validation chạy khi nhấn Search
  const handleToDateChange = (val: string) => {
    setToSelectedDate(val);
  };

  // Áp dụng khoảng ngày lọc kèm kiểm tra ràng buộc chéo (Cross-validation)
  const handleApplyDateRange = (from?: string, to?: string) => {
    const nextFrom = from !== undefined ? from : fromSelectedDate;
    const nextTo = to !== undefined ? to : toSelectedDate;

    // Ràng buộc chéo: Từ ngày không được lớn hơn Đến ngày
    if (nextFrom && nextTo && nextFrom > nextTo) {
      showToast(
        `Khoảng thời gian không hợp lệ: "Từ thời gian" (${formatDateTimeVN(nextFrom)}) phải trước hoặc bằng "Đến thời gian" (${formatDateTimeVN(nextTo)})! Vui lòng chọn lại.`,
        "error"
      );
      return;
    }

    setFromSelectedDate(nextFrom);
    setToSelectedDate(nextTo);
    setAppliedFromDate(nextFrom);
    setAppliedToDate(nextTo);
  };

  const handleClearDateRange = () => {
    handleApplyDateRange("", "");
  };

  // Kiểm tra trạng thái lỗi khoảng ngày
  const isDateRangeInvalid = Boolean(
    fromSelectedDate && toSelectedDate && fromSelectedDate > toSelectedDate
  );

  // Grading form state for selected report
  const [fbApproved, setFbApproved] = useState<number>(10);
  const [threadApproved, setThreadApproved] = useState<number>(4);
  const [commentApproved, setCommentApproved] = useState<number>(50);
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [feedback, setFeedback] = useState<string>("");
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState<boolean>(false);
  const feedbackRef = useRef<string>("");

  // Số lượng ca đang chờ duyệt (PENDING) và vị trí của ca đang mở
  const pendingCount = useMemo(() => {
    return queue.filter((item) => item.qcReview?.result === "PENDING").length;
  }, [queue]);

  const currentPendingIndex = useMemo(() => {
    if (!selectedReport) return -1;
    const pendingItems = queue.filter((item) => item.qcReview?.result === "PENDING");
    return pendingItems.findIndex((item) => item.id === selectedReport.id);
  }, [queue, selectedReport]);

  const handleFeedbackChange = (val: string) => {
    setFeedback(val);
    feedbackRef.current = val;
  };

  const handleSetResult = (newResult: "PASS" | "FAIL") => {
    setResult(newResult);
    if (newResult === "FAIL") {
      if (feedback === "Nội dung đạt chuẩn quy định Freetrip." || !feedback) {
        const failDefault = "Chưa đạt yêu cầu: số lượng bài hoặc minh chứng không hợp lệ.";
        setFeedback(failDefault);
        feedbackRef.current = failDefault;
      }
    } else {
      if (feedback.startsWith("Chưa đạt yêu cầu") || !feedback) {
        const passDefault = "Nội dung đạt chuẩn quy định Freetrip.";
        setFeedback(passDefault);
        feedbackRef.current = passDefault;
      }
    }
  };

  // Tự động đồng bộ Kết luận QC theo rule quản lý Freetrip
  // Chuẩn: FB >= 10, Threads >= 4, Drive Comments >= 50
  const syncQcDecision = (fb: number, th: number, cmt: number) => {
    const isPass = fb >= 10 && th >= 4 && cmt >= 50;
    setResult(isPass ? "PASS" : "FAIL");

    const currentFb = feedbackRef.current;
    const isSystemDefault =
      !currentFb ||
      currentFb === "Nội dung đạt chuẩn quy định Freetrip." ||
      currentFb === "Chưa đạt yêu cầu: số lượng bài hoặc minh chứng không hợp lệ." ||
      currentFb.startsWith("Chưa đạt chỉ tiêu:");

    if (isSystemDefault) {
      if (isPass) {
        const passMsg = "Nội dung đạt chuẩn quy định Freetrip.";
        setFeedback(passMsg);
        feedbackRef.current = passMsg;
      } else {
        const reasons: string[] = [];
        if (fb < 10) reasons.push(`thiếu bài FB (${fb}/10)`);
        if (th < 4) reasons.push(`thiếu bài TH (${th}/4)`);
        if (cmt < 50) reasons.push(`thiếu comment Drive (${cmt}/50)`);
        const failMsg = `Chưa đạt chỉ tiêu: ${reasons.join(", ")}.`;
        setFeedback(failMsg);
        feedbackRef.current = failMsg;
      }
    }
  };

  // Danh sách các liên kết bị QC tích chọn không hợp lệ
  const [invalidLinks, setInvalidLinks] = useState<Set<string>>(new Set());

  const isLinkInvalid = (link: string) => {
    if (!link) return false;
    return invalidLinks.has(link) || Array.from(invalidLinks).some((l) => matchUrls(l, link));
  };

  // Bật/tắt trạng thái không hợp lệ của link và tự động tính lại số bài đạt
  // Khi link chính bị tích không hợp lệ, hệ thống tự động nhận diện và tính bù link dự phòng hợp lệ (nếu có)
  const toggleInvalidLink = (link: string, platform: "facebook" | "threads") => {
    if (!selectedReport) return;
    const nextSet = new Set(invalidLinks);
    const existing = Array.from(nextSet).find((l) => matchUrls(l, link) || l.trim() === link.trim());
    if (existing) {
      nextSet.delete(existing);
      nextSet.delete(link);
    } else {
      nextSet.add(link);
    }
    setInvalidLinks(nextSet);

    let nextFb = fbApproved;
    let nextTh = threadApproved;

    if (platform === "facebook") {
      const totalFbMain = (selectedReport.fbLinks || []).length;
      const invalidMainCount = (selectedReport.fbLinks || []).filter((l) => nextSet.has(l) || Array.from(nextSet).some((nl) => matchUrls(nl, l))).length;
      const validMain = Math.max(0, totalFbMain - invalidMainCount);

      const suppList = selectedReport.fbSupplementLinks || [];
      const validSuppCount = suppList.filter((l) => !nextSet.has(l) && !Array.from(nextSet).some((nl) => matchUrls(nl, l))).length;

      // Bù link dự phòng vào các bài chính bị lỗi (chỉ bù nếu bài chính < 10)
      const needed = Math.max(0, 10 - validMain);
      const usedSupp = Math.min(needed, validSuppCount);
      // Số bài đạt thực tế bằng số bài chính hợp lệ cộng số bài bù dự phòng (không giới hạn cứng min 10)
      nextFb = validMain + usedSupp;

      setFbApproved(nextFb);
    } else {
      const totalThread = (selectedReport.threadLinks || []).length;
      const invalidCount = (selectedReport.threadLinks || []).filter((l) => nextSet.has(l) || Array.from(nextSet).some((nl) => matchUrls(nl, l))).length;
      nextTh = Math.max(0, totalThread - invalidCount);
      setThreadApproved(nextTh);
    }

    syncQcDecision(nextFb, nextTh, commentApproved);
  };

  // Thống kê số link không hợp lệ trong ca đang chọn
  const fbInvalidCount = selectedReport
    ? (selectedReport.fbLinks || []).filter((l) => isLinkInvalid(l)).length
    : 0;
  const fbSuppInvalidCount = selectedReport
    ? (selectedReport.fbSupplementLinks || []).filter((l) => isLinkInvalid(l)).length
    : 0;
  const validSuppFb = selectedReport
    ? (selectedReport.fbSupplementLinks || []).filter((l) => !isLinkInvalid(l)).length
    : 0;
  const validMainFb = selectedReport
    ? Math.max(0, (selectedReport.fbLinks || []).length - fbInvalidCount)
    : 0;
  const fbReplacementsUsed = Math.min(Math.max(0, 10 - validMainFb), validSuppFb);
  const threadInvalidCount = selectedReport
    ? (selectedReport.threadLinks || []).filter((l) => isLinkInvalid(l)).length
    : 0;

  // Quét link và capture screen thủ công
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResults, setScanResults] = useState<Record<string, ScanResultItem>>({});
  const [fromCache, setFromCache] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Cấp quản lý duyệt bài Viral
  const [viralApprovedLinks, setViralApprovedLinks] = useState<string[]>([]);
  const [viralLikes, setViralLikes] = useState<Record<string, number>>({});
  const [viralContentTypes, setViralContentTypes] = useState<Record<string, "POST" | "COMMENT">>({});
  const [viralBonusAmount, setViralBonusAmount] = useState<number>(0);
  const [viralTiers, setViralTiers] = useState<ViralTierItem[]>([]);
  const [availableTags, setAvailableTags] = useState<PostTagItem[]>([]);

  // Quản lý Modal & Thời gian mở nộp bù
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenDurationMinutes, setReopenDurationMinutes] = useState<number>(120);
  const [reopenCustomDateTime, setReopenCustomDateTime] = useState<string>("");
  const [reopenMode, setReopenMode] = useState<"PRESET" | "CUSTOM">("PRESET");
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Tra cứu tiền thưởng cho link dựa trên cấu hình Admin (viralTiers)
  const getBonusForLink = useCallback(
    (
      platform: "FACEBOOK" | "THREADS",
      contentType: "POST" | "COMMENT",
      likes: number
    ): number => {
      if (!viralTiers || viralTiers.length === 0) return 0;

      // 1. Khớp chính xác nền tảng (FACEBOOK/THREADS) và loại nội dung (POST/COMMENT)
      const matched = viralTiers
        .filter((t) => t.platform === platform && t.contentType === contentType && likes >= t.minLikes)
        .sort((a, b) => b.minLikes - a.minLikes)[0];
      if (matched) return matched.bonusAmount;

      // 2. Fallback nếu chỉ có tier cho platform mà không phân biệt contentType
      const fallbackMatched = viralTiers
        .filter((t) => t.platform === platform && likes >= t.minLikes)
        .sort((a, b) => b.minLikes - a.minLikes)[0];
      if (fallbackMatched) return fallbackMatched.bonusAmount;

      return 0;
    },
    [viralTiers]
  );

  // Tự động tính tiền thưởng viral theo số bài, lượt like và loại nội dung
  const recalculateViralBonus = useCallback(
    (
      approvedList: string[],
      likesMap: Record<string, number>,
      typesMap: Record<string, "POST" | "COMMENT"> = viralContentTypes
    ) => {
      let total = 0;
      approvedList.forEach((link) => {
        const isFb = link.includes("facebook.com") || link.includes("fb.watch");
        const platform: "FACEBOOK" | "THREADS" = isFb ? "FACEBOOK" : "THREADS";
        const contentType = typesMap[link] || "POST";
        const likes = likesMap[link] ?? 500;
        total += getBonusForLink(platform, contentType, likes);
      });
      setViralBonusAmount(total);
    },
    [getBonusForLink, viralContentTypes]
  );

  // Bật / tắt duyệt Viral cho từng link
  const toggleViralApproval = (link: string) => {
    const isApproved = viralApprovedLinks.some((l) => matchUrls(l, link));
    const updated = isApproved
      ? viralApprovedLinks.filter((l) => !matchUrls(l, link))
      : [...viralApprovedLinks, link];
    setViralApprovedLinks(updated);

    let nextTypes = viralContentTypes;
    if (!isApproved && !viralContentTypes[link]) {
      nextTypes = { ...viralContentTypes, [link]: "POST" };
      setViralContentTypes(nextTypes);
    }
    recalculateViralBonus(updated, viralLikes, nextTypes);
  };

  // Cập nhật lượt like cho bài viral
  const handleUpdateViralLikes = (link: string, likes: number) => {
    const nextLikes = { ...viralLikes, [link]: Math.max(0, likes) };
    setViralLikes(nextLikes);
    recalculateViralBonus(viralApprovedLinks, nextLikes, viralContentTypes);
  };

  // Cập nhật loại nội dung (Bài viết vs Bình luận)
  const handleUpdateViralContentType = (link: string, type: "POST" | "COMMENT") => {
    const nextTypes = { ...viralContentTypes, [link]: type };
    setViralContentTypes(nextTypes);
    recalculateViralBonus(viralApprovedLinks, viralLikes, nextTypes);
  };

  // Fetch queue data với cơ chế AbortController và hỗ trợ Infinite Scroll (lazy load khi cuộn)
  const fetchQueue = useCallback(async (isLoadMore: boolean = false) => {
    if (isLoadMore) {
      if (isFetchingRef.current || !hasMoreRef.current) return;
    }

    isFetchingRef.current = true;
    const targetPage = isLoadMore ? pageRef.current + 1 : 1;

    if (!isLoadMore) {
      // Hủy bỏ request trước đó nếu còn đang chờ xử lý
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search,
        slaUrgent: slaUrgentFilter ? "true" : "false",
        page: targetPage.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (appliedFromDate) {
        params.append("fromDate", appliedFromDate);
      }
      if (appliedToDate) {
        params.append("toDate", appliedToDate);
      }

      const res = await fetch(`/api/qc/queue?${params.toString()}`, {
        signal: abortControllerRef.current?.signal,
      });
      if (!res.ok) throw new Error("Không thể tải danh sách hàng đợi QC");

      const data = await res.json();
      const rawReports = Array.isArray(data.reports) ? data.reports : [];
      const cleanReports = rawReports.map(sanitizeReport);

      const totalPages = data.pagination?.totalPages || 1;
      const nextHasMore = targetPage < totalPages;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
      pageRef.current = targetPage;
      setPage(targetPage);

      if (isLoadMore) {
        setQueue((prev) => {
          const existingKeys = new Set(
            prev.map((item) => (item.isUnsubmitted ? `u_${item.shiftRegistrationId}` : `r_${item.id}`))
          );
          const uniqueReports = cleanReports.filter((item: QueueItem) => {
            const key = item.isUnsubmitted ? `u_${item.shiftRegistrationId}` : `r_${item.id}`;
            return !existingKeys.has(key);
          });
          return [...prev, ...uniqueReports];
        });
      } else {
        setQueue(cleanReports);
        // Khi nạp trang 1, cuộn lại lên đầu danh sách
        if (queueScrollRef.current) {
          queueScrollRef.current.scrollTop = 0;
        }

        // Select first item by default if none selected or if previous selected is no longer in list
        if (cleanReports.length > 0) {
          setSelectedReport((prev) => {
            if (!prev || !cleanReports.some((r: QueueItem) => r.id === prev.id)) {
              const first = cleanReports[0];
              handleSelectReport(first);
              return first;
            }
            return prev;
          });
        } else {
          setSelectedReport(null);
        }
      }

      setStats(
        data.stats || {
          totalPending: 0,
          totalUrgent: 0,
          reviewedToday: 0,
          totalPassed: 0,
        }
      );

      // Nạp cấu hình mức thưởng viral từ Admin
      if (Array.isArray(data.viralTiers)) {
        setViralTiers(data.viralTiers);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Request bị hủy bởi thao tác lọc mới, không thông báo lỗi
        return;
      }
      showToast(err.message, "error");
    } finally {
      isFetchingRef.current = false;
      if (!isLoadMore) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [statusFilter, search, slaUrgentFilter, appliedFromDate, appliedToDate]);

  useEffect(() => {
    fetchQueue(false);
    fetch("/api/post-tags")
      .then((res) => res.json())
      .then((data) => {
        if (data.tags) setAvailableTags(data.tags);
      })
      .catch(console.error);
  }, [fetchQueue]);

  // Lắng nghe sự kiện chạm đáy container để tự động tải thêm ca (Infinite Scroll)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = queueScrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreRef.current && !isFetchingRef.current) {
          fetchQueue(true);
        }
      },
      {
        root: container,
        rootMargin: "150px",
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchQueue]);

  const handleQueueScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      if (hasMoreRef.current && !isFetchingRef.current) {
        fetchQueue(true);
      }
    }
  }, [fetchQueue]);

  // Khi chọn một ca làm việc từ hàng đợi
  const handleSelectReport = (rawRep: QueueItem) => {
    const rep = sanitizeReport(rawRep);
    setSelectedReport(rep);
    setScanResults({});
    setFromCache(false);
    const savedInvalid = rep.qcReview?.invalidLinks ? parseSafeArray(rep.qcReview.invalidLinks) : [];
    setInvalidLinks(new Set(savedInvalid));

    // Tính toán số lượng bài đạt thực tế từ danh sách link nộp và link lỗi
    const invalidSet = new Set(savedInvalid);
    const totalFbMain = (rep.fbLinks || []).length;
    const invalidMainFb = (rep.fbLinks || []).filter((l) => invalidSet.has(l) || Array.from(invalidSet).some((nl) => matchUrls(nl, l))).length;
    const validMain = Math.max(0, totalFbMain - invalidMainFb);

    const suppList = rep.fbSupplementLinks || [];
    const validSuppCount = suppList.filter((l) => !invalidSet.has(l) && !Array.from(invalidSet).some((nl) => matchUrls(nl, l))).length;
    const needed = Math.max(0, 10 - validMain);
    const usedSupp = Math.min(needed, validSuppCount);
    const calculatedFb = validMain + usedSupp;

    const totalThread = (rep.threadLinks || []).length;
    const invalidTh = (rep.threadLinks || []).filter((l) => invalidSet.has(l) || Array.from(invalidSet).some((nl) => matchUrls(nl, l))).length;
    const calculatedTh = Math.max(0, totalThread - invalidTh);

    const calculatedComment = rep.commentDriveLink ? 50 : 0;

    // Điền dữ liệu chấm điểm
    if (rep.qcReview && rep.qcReview.result !== "PENDING") {
      // Nếu số fbApproved đã lưu trong DB thấp hơn do lỗi ép trần min(10) cũ trong khi calculatedFb > 10, tự động lấy số calculatedFb chuẩn xác
      const finalFb = (rep.qcReview.fbApproved !== undefined && rep.qcReview.fbApproved !== calculatedFb && rep.qcReview.fbApproved <= 10 && calculatedFb > 10)
        ? calculatedFb
        : rep.qcReview.fbApproved;
      setFbApproved(finalFb);
      setThreadApproved(rep.qcReview.threadApproved !== undefined ? rep.qcReview.threadApproved : calculatedTh);
      setCommentApproved(rep.qcReview.commentApproved !== undefined ? rep.qcReview.commentApproved : calculatedComment);
      setResult(rep.qcReview.result);
      const fbText = rep.qcReview.feedback || "";
      setFeedback(fbText);
      feedbackRef.current = fbText;
    } else {
      setFbApproved(calculatedFb);
      setThreadApproved(calculatedTh);
      setCommentApproved(calculatedComment);
      syncQcDecision(calculatedFb, calculatedTh, calculatedComment);
    }

    // Nạp danh sách bài viral đã được Cấp Quản lý phê duyệt trước đó (từ bảng viral_posts)
    // Lưu ý: rep.viralPostLinks là bài viết NỔI BẬT do nhân sự tự gắn, KHÔNG PHẢI bài viral đã duyệt.
    const existingViralApproved = (rep.viralPosts && Array.isArray(rep.viralPosts))
      ? rep.viralPosts.map((vp) => vp.postUrl)
      : [];
    setViralApprovedLinks(existingViralApproved);
    const initialLikes: Record<string, number> = {};
    const initialTypes: Record<string, "POST" | "COMMENT"> = {};

    // Nếu trong ca này đã có bài viral lưu trong database, đọc đúng thông số đã lưu
    const savedPostsMap = new Map<string, { contentType: string; likes: number }>();
    if (rep.viralPosts && Array.isArray(rep.viralPosts)) {
      rep.viralPosts.forEach((vp) => {
        savedPostsMap.set(vp.postUrl, {
          contentType: vp.contentType === "POST" ? "POST" : "COMMENT",
          likes: vp.likes ?? 500,
        });
      });
    }

    existingViralApproved.forEach((l) => {
      const saved = savedPostsMap.get(l);
      initialLikes[l] = saved ? saved.likes : 500;
      initialTypes[l] = (saved ? saved.contentType : "POST") as "POST" | "COMMENT";
    });
    setViralLikes(initialLikes);
    setViralContentTypes(initialTypes);
    recalculateViralBonus(existingViralApproved, initialLikes, initialTypes);

    // Thử load cache quét trước đó nếu có (forceRefresh = false)
    loadScanCacheSilently(rep);
  };

  // Thử load kết quả quét từ bộ nhớ đệm IndexedDB trên máy QC
  const loadScanCacheSilently = async (rawRep: QueueItem) => {
    try {
      const rep = sanitizeReport(rawRep);
      if (!rep.id) return;
      const cached = await getQCScanFromIndexedDB(rep.id);
      if (cached && Object.keys(cached).length > 0) {
        setScanResults(cached as Record<string, ScanResultItem>);
        setFromCache(true);
      }
    } catch {
      // Bỏ qua lỗi ngầm khi load cache tự động
    }
  };

  // Kích hoạt quét link (Server proxy Node.js siêu nhẹ + lưu cache máy QC)
  const handleTriggerScan = async (forceRefresh = false) => {
    if (!selectedReport) return;

    // Nếu không forceRefresh và máy QC đã có sẵn cache, load ngay lập tức từ IndexedDB (0ms)
    if (!forceRefresh) {
      const localCache = await getQCScanFromIndexedDB(selectedReport.id);
      if (localCache && Object.keys(localCache).length > 0) {
        setScanResults(localCache as Record<string, ScanResultItem>);
        setFromCache(true);
        showToast("Đã tải dữ liệu kiểm tra từ bộ nhớ đệm máy của bạn!");
        return;
      }
    }

    setScanLoading(true);
    try {
      const rep = sanitizeReport(selectedReport);
      const allLinks = [
        ...rep.fbLinks.map((url, i) => ({ url, platform: "facebook", index: i + 1 })),
        ...rep.fbSupplementLinks.map((url, i) => ({ url, platform: "facebook", index: i + 11 })),
        ...rep.threadLinks.map((url, i) => ({ url, platform: "threads", index: i + 1 })),
      ];

      const res = await fetch("/api/qc/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selectedReport.id,
          links: allLinks,
          forceRefresh,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể quét bài viết");

      const scannedItems: ScanResultItem[] = data.results || [];
      const map: Record<string, ScanResultItem> = {};
      scannedItems.forEach((r: ScanResultItem) => {
        map[r.url] = r;
      });

      setScanResults(map);
      setFromCache(false);

      // Lưu kết quả và nạp Blob ảnh vào IndexedDB của máy QC ngầm
      saveQCScanToIndexedDB(selectedReport.id, scannedItems as any).catch((e) =>
        console.warn("Lỗi lưu cache IndexedDB:", e)
      );

      const invalidScannedUrls = Object.values(map)
        .filter((r) => !r.isValid)
        .map((r) => r.url);

      const nextInvalid = new Set([...Array.from(invalidLinks), ...invalidScannedUrls]);
      if (invalidScannedUrls.length > 0) {
        setInvalidLinks(nextInvalid);
      }

      const totalFb = rep.fbLinks.length;
      const invalidFb = rep.fbLinks.filter((l) => nextInvalid.has(l) || Array.from(nextInvalid).some((nl) => matchUrls(nl, l))).length;
      const validMain = Math.max(0, totalFb - invalidFb);
      const validSupp = (rep.fbSupplementLinks || []).filter((l) => !nextInvalid.has(l) && !Array.from(nextInvalid).some((nl) => matchUrls(nl, l))).length;
      const usedSupp = Math.min(Math.max(0, 10 - validMain), validSupp);
      const newFb = validMain + usedSupp;
      setFbApproved(newFb);

      const totalThread = rep.threadLinks.length;
      const invalidThread = rep.threadLinks.filter((l) => nextInvalid.has(l) || Array.from(nextInvalid).some((nl) => matchUrls(nl, l))).length;
      const newTh = Math.max(0, totalThread - invalidThread);
      setThreadApproved(newTh);

      syncQcDecision(newFb, newTh, commentApproved);

      if (invalidScannedUrls.length > 0) {
        showToast(
          `Cảnh báo: Phát hiện ${invalidScannedUrls.length} liên kết BỊ LỖI / BỊ GỠ! Đã tự động tích chọn và trừ số bài đạt.`,
          "error"
        );
      } else {
        showToast(data.message || "Đã kiểm tra thành công và cập nhật bộ đếm!");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setScanLoading(false);
    }
  };

  // Xóa toàn bộ bộ nhớ đệm máy QC
  const handleClearLocalCache = async () => {
    const ok = await confirmModal({
      title: "Dọn dẹp bộ nhớ đệm máy QC",
      message: "Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ đệm bài viết đã lưu trên trình duyệt máy này? Thao tác này giúp giải phóng dung lượng của trình duyệt.",
      confirmText: "Xác nhận xóa",
      type: "danger",
    });
    if (ok) {
      await clearAllQCIndexedDBCache();
      setScanResults({});
      setFromCache(false);
      showToast("Đã dọn dẹp sạch bộ nhớ đệm trên máy!");
    }
  };

  // Submit Grading kèm danh sách bài Viral do Quản lý duyệt
  const handleSaveReview = async (autoNext: boolean = false) => {
    if (!selectedReport) return;
    setSaving(true);
    try {
      const res = await fetch("/api/qc/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyReportId: selectedReport.id,
          fbApproved,
          threadApproved,
          commentApproved,
          result,
          feedback: feedbackRef.current,
          invalidLinks: Array.from(invalidLinks),
          viralApprovedLinks,
          viralBonusAmount,
          viralLikes,
          viralContentTypes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu kết quả kiểm duyệt");

      showToast(data.message || "Lưu kết quả kiểm duyệt thành công!");

      if (autoNext) {
        const currentId = selectedReport.id;
        const currentIndex = queue.findIndex((item) => item.id === currentId);

        // Tìm ca tiếp theo đang chờ duyệt (ưu tiên PENDING phía sau -> PENDING đầu danh sách -> ca kế tiếp bất kỳ)
        const nextPending =
          queue.slice(currentIndex + 1).find((item) => item.id !== currentId && item.qcReview?.result === "PENDING") ||
          queue.find((item) => item.id !== currentId && item.qcReview?.result === "PENDING") ||
          (currentIndex + 1 < queue.length ? queue[currentIndex + 1] : null);

        if (nextPending) {
          handleSelectReport(nextPending);
          window.scrollTo({ top: 80, behavior: "smooth" });
        } else {
          showToast("🎉 Đã hoàn tất duyệt toàn bộ hàng đợi!");
        }
      }

      fetchQueue();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Action: Đánh vắng ca (Vào muộn > 60 phút hoặc bỏ ca)
  const handleMarkAbsent = async () => {
    if (!selectedReport) return;
    const isConfirmed = await confirmModal({
      title: "Xác nhận đánh vắng ca",
      message: `Xác nhận đánh VẮNG CA cho nhân sự "${selectedReport.user.fullName}" ngày ${new Date(selectedReport.reportDate).toLocaleDateString("vi-VN")}?`,
      confirmText: "Đánh vắng",
      cancelText: "Hủy",
      type: "danger",
    });

    if (!isConfirmed) {
      return;
    }

    try {
      const res = await fetch("/api/qc/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftRegistrationId: selectedReport.shiftRegistrationId,
          action: "MARK_ABSENT",
          reason: "QC ghi nhận vào muộn quá 60 phút hoặc vi phạm tiêu chuẩn làm việc",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message);
      setSelectedReport((prev) =>
        prev
          ? {
              ...prev,
              shiftRegistration: {
                ...prev.shiftRegistration,
                status: "ABSENT",
              },
            }
          : null
      );
      fetchQueue();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Helper format thời gian còn lại của nộp bù
  const formatRemainingTime = (reopenedUntilStr?: string | null) => {
    if (!reopenedUntilStr) return null;
    const target = new Date(reopenedUntilStr).getTime();
    const diff = target - Date.now();
    if (diff <= 0) return { isExpired: true, text: "Đã hết hạn" };
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return { isExpired: false, text: `Còn ${days} ngày ${hours % 24} giờ` };
    }
    if (hours > 0) {
      return { isExpired: false, text: `Còn ${hours} giờ ${remainingMinutes} phút` };
    }
    return { isExpired: false, text: `Còn ${remainingMinutes} phút` };
  };

  // Action: Mở modal thiết lập thời gian nộp bù
  const handleOpenReopenModal = () => {
    if (!selectedReport) return;
    const currentUntil = selectedReport.shiftRegistration.reopenedUntil;
    if (currentUntil) {
      const d = new Date(currentUntil);
      const pad = (n: number) => String(n).padStart(2, "0");
      const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setReopenCustomDateTime(localIso);
      setReopenMode("CUSTOM");
    } else {
      setReopenMode("PRESET");
      setReopenDurationMinutes(120);
      const defaultDate = new Date(Date.now() + 120 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const localIso = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;
      setReopenCustomDateTime(localIso);
    }
    setReopenModalOpen(true);
  };

  // Xác nhận Mở / Gia hạn thời gian nộp bù ca
  const handleConfirmReopenShift = async () => {
    if (!selectedReport) return;
    setSubmittingReopen(true);
    try {
      const payload: any = {
        shiftRegistrationId: selectedReport.shiftRegistrationId,
        action: "REOPEN_SHIFT",
      };

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
        payload.durationMinutes = reopenDurationMinutes;
      }

      const res = await fetch("/api/qc/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message);
      setReopenModalOpen(false);
      setSelectedReport((prev) =>
        prev
          ? {
              ...prev,
              shiftRegistration: {
                ...prev.shiftRegistration,
                status: "APPROVED",
                reopenedBy: 1,
                reopenedUntil: data.reopenedUntil || null,
              },
            }
          : null
      );
      fetchQueue();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingReopen(false);
    }
  };

  // Action: Đóng / Thu hồi quyền nộp bù ca (Cấp quản lý chủ động đóng)
  const handleCloseReopenShift = async () => {
    if (!selectedReport) return;
    const isConfirmed = await confirmModal({
      title: "Đóng quyền nộp bù ca",
      message: `Bạn có chắc chắn muốn ĐÓNG quyền nộp bù ca của nhân sự "${selectedReport.user.fullName}"? Sau khi đóng, nhân sự sẽ không thể nộp hoặc chỉnh sửa báo cáo ca này.`,
      confirmText: "Đóng nộp bù",
      cancelText: "Hủy",
      type: "danger",
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch("/api/qc/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftRegistrationId: selectedReport.shiftRegistrationId,
          action: "CLOSE_REOPEN_SHIFT",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message);
      setSelectedReport((prev) =>
        prev
          ? {
              ...prev,
              shiftRegistration: {
                ...prev.shiftRegistration,
                reopenedBy: null,
                reopenedUntil: null,
              },
            }
          : null
      );
      fetchQueue();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Action: Gửi thông báo nhắc nhở nộp báo cáo ca
  const handleSendReminder = async () => {
    if (!selectedReport) return;
    try {
      const res = await fetch("/api/qc/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftRegistrationId: selectedReport.shiftRegistrationId,
          action: "REMIND",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message || "Đã gửi thông báo nhắc nhở thành công!");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div
      className="animate-fadeIn"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px - 3.5rem)",
        maxHeight: "calc(100vh - 64px - 3.5rem)",
        overflow: "hidden",
      }}
    >
      {/* Toast Notification */}
      {toast && (
        <div className="app-toast-container">
          <div className={`app-toast ${toast.type}`}>
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
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
          marginBottom: "1rem",
          flexShrink: 0,
        }}
      >
        <div>
          <h1 className="page-title">Kiểm Duyệt QC (Quality Control)</h1>
          <p className="page-subtitle">
            Hàng đợi thẩm định chất lượng bài đăng, quản lý SLA 7 ngày và nghiệm thu ca làm việc
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => fetchQueue(false)} title="Làm mới hàng đợi">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm mới hàng đợi
        </button>
      </div>

      {/* Main Split Layout: 2 Columns (Viewport Locked) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "1.5rem",
          alignItems: "stretch",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Column: Queue List (Sticky filters + Independent scroll items) */}
        <div
          style={{
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Filters Bar */}
          <div className="card" style={{ padding: "0.875rem", marginBottom: "0.75rem", flexShrink: 0 }}>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: "32px", fontSize: "0.8125rem" }}
                placeholder="Tìm nhân sự, SĐT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Date Range Picker (Từ ngày - Đến ngày) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Calendar size={13} color="var(--primary)" /> Khoảng ngày báo cáo:
                </span>
                {(appliedFromDate || appliedToDate) && (
                  <button
                    type="button"
                    onClick={handleClearDateRange}
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: "0.6875rem", color: "var(--primary)", padding: "1px 6px", height: "auto" }}
                  >
                    Xem tất cả ngày
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
                <div>
                  <label style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>
                    Từ thời gian:
                  </label>
                  <CustomDateTimePicker
                    value={fromSelectedDate}
                    onChange={handleFromDateChange}
                    isError={isDateRangeInvalid}
                    placeholder="DD/MM/YYYY 00:00:00"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.6875rem", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>
                    Đến thời gian:
                  </label>
                  <CustomDateTimePicker
                    value={toSelectedDate}
                    onChange={handleToDateChange}
                    isError={isDateRangeInvalid}
                    placeholder="DD/MM/YYYY 23:59:59"
                  />
                </div>
              </div>

              {/* Thông báo lỗi inline nếu khoảng ngày không hợp lệ */}
              {isDateRangeInvalid && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--danger)",
                    fontSize: "0.6875rem",
                    marginBottom: "6px",
                    fontWeight: 500,
                  }}
                >
                  <AlertTriangle size={12} />
                  <span>"Từ ngày" đang lớn hơn "Đến ngày"!</span>
                </div>
              )}

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => handleApplyDateRange()}
                  className={`btn btn-sm ${
                    isDateRangeInvalid
                      ? "btn-secondary"
                      : fromSelectedDate !== appliedFromDate || toSelectedDate !== appliedToDate
                      ? "btn-primary"
                      : "btn-secondary"
                  }`}
                  style={{
                    flex: 1,
                    fontSize: "0.75rem",
                    padding: "0.375rem 0.75rem",
                    fontWeight: 600,
                  }}
                  title={
                    isDateRangeInvalid
                      ? "Khoảng ngày không hợp lệ"
                      : fromSelectedDate !== appliedFromDate || toSelectedDate !== appliedToDate
                      ? "Nhấn để áp dụng khoảng ngày vừa chọn"
                      : "Dữ liệu đang khớp với khoảng ngày chọn"
                  }
                >
                  Search
                </button>

                {(appliedFromDate || appliedToDate) && (
                  <button
                    type="button"
                    onClick={handleClearDateRange}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", padding: "0.375rem 0.625rem" }}
                    title="Xóa lọc khoảng ngày để xem tất cả"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>

            {/* Status & Urgent filter */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                className="select"
                style={{ fontSize: "0.8125rem", padding: "0.375rem 0.625rem", flex: 1 }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setSlaUrgentFilter(false);
                }}
              >
                <option value="PENDING">Chờ duyệt (Pending)</option>
                <option value="UNSUBMITTED">Chưa nộp link ({stats.totalUnsubmitted || 0})</option>
                <option value="PASS">Đã duyệt ĐẠT (Pass)</option>
                <option value="FAIL">Đã duyệt HỎNG (Fail)</option>
                <option value="ALL">Tất cả trạng thái</option>
              </select>

              {slaUrgentFilter && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.75rem" }}
                  onClick={() => setSlaUrgentFilter(false)}
                >
                  Xóa lọc khẩn
                </button>
              )}
            </div>
          </div>

          {/* Queue Items (Cuộn độc lập trong cột trái) */}
          <div
            ref={queueScrollRef}
            onScroll={handleQueueScroll}
            className="custom-scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                <RefreshCw size={18} className="animate-spin" style={{ margin: "0 auto 8px auto" }} />
                Đang tải hàng đợi...
              </div>
            ) : queue.length === 0 ? (
              <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Không có báo cáo nào trong hàng đợi phù hợp với bộ lọc.
              </div>
            ) : (
              <>
                {queue.map((rep) => {
                  const isSelected = selectedReport?.id === rep.id;
                  const shiftInfo = SHIFT_MAP[rep.shiftType] || { label: rep.shiftType, icon: "⏰" };
                  const isUrgent = rep.slaStatus === "WARNING" || rep.slaStatus === "OVERDUE";
                  const isUnsubmitted = Boolean(rep.isUnsubmitted);
                  const timeStateInfo = getShiftTimeState(rep.reportDate, rep.shiftType);
                  const isUpcoming = timeStateInfo.timeState === "UPCOMING";
                  const isInShift = timeStateInfo.timeState === "IN_SHIFT";
                  const isEnded = timeStateInfo.timeState === "ENDED";
                  const isReopened = isEnded && Boolean(rep.shiftRegistration?.reopenedBy);
                  const isAbsent = rep.shiftRegistration?.status === "ABSENT";

                  return (
                    <div
                      key={rep.id}
                      onClick={() => handleSelectReport(rep)}
                      className="card"
                      style={{
                        padding: "0.875rem 1rem",
                        cursor: "pointer",
                        borderColor: isSelected
                          ? "var(--primary)"
                          : isUrgent
                          ? "rgba(239, 68, 68, 0.4)"
                          : isUnsubmitted && isReopened
                          ? "rgba(168, 85, 247, 0.4)"
                          : "var(--border-color)",
                        background: isSelected
                          ? "rgba(249, 115, 22, 0.08)"
                          : isUnsubmitted && isReopened
                          ? "rgba(168, 85, 247, 0.05)"
                          : "var(--bg-card)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{rep.user.fullName}</div>
                        {/* SLA / Status Badge */}
                        {isUnsubmitted ? (
                          <span
                            className="badge"
                            style={{
                              fontSize: "0.6875rem",
                              backgroundColor: isAbsent
                                ? "rgba(239, 68, 68, 0.15)"
                                : isUpcoming
                                ? "rgba(148, 163, 184, 0.15)"
                                : isInShift
                                ? "rgba(59, 130, 246, 0.15)"
                                : isReopened
                                ? "rgba(168, 85, 247, 0.15)"
                                : "rgba(249, 115, 22, 0.15)",
                              color: isAbsent
                                ? "#ef4444"
                                : isUpcoming
                                ? "#94a3b8"
                                : isInShift
                                ? "#3b82f6"
                                : isReopened
                                ? "#a855f7"
                                : "#f97316",
                              border: `1px solid ${
                                isAbsent
                                  ? "rgba(239, 68, 68, 0.4)"
                                  : isUpcoming
                                  ? "rgba(148, 163, 184, 0.4)"
                                  : isInShift
                                  ? "rgba(59, 130, 246, 0.4)"
                                  : isReopened
                                  ? "rgba(168, 85, 247, 0.4)"
                                  : "rgba(249, 115, 22, 0.4)"
                              }`,
                            }}
                          >
                            {isAbsent
                              ? "VẮNG CA"
                              : isUpcoming
                              ? "CHƯA ĐẾN CA"
                              : isInShift
                              ? "TRONG CA"
                              : isReopened
                              ? "MỞ NỘP BÙ"
                              : "CHƯA NỘP"}
                          </span>
                        ) : rep.qcReview?.result === "PENDING" ? (
                          <span
                            className={`badge ${
                              rep.slaStatus === "OVERDUE"
                                ? "badge-danger"
                                : rep.slaStatus === "WARNING"
                                ? "badge-warning"
                                : "badge-neutral"
                            }`}
                            style={{ fontSize: "0.6875rem" }}
                          >
                            {rep.slaRemainingDays <= 0 ? "Quá hạn 7 ngày!" : `Còn ${rep.slaRemainingDays} ngày`}
                          </span>
                        ) : rep.qcReview?.result === "PASS" ? (
                          <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                            ĐÃ DUYỆT
                          </span>
                        ) : (
                          <span className="badge badge-danger" style={{ fontSize: "0.6875rem" }}>
                            KHÔNG ĐẠT
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                        {new Date(rep.reportDate).toLocaleDateString("vi-VN")} &bull; {shiftInfo.icon}{" "}
                        {shiftInfo.label} ({rep.shiftRegistration.workMode})
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.6875rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          {isUnsubmitted ? (
                            <span
                              style={{
                                color: isAbsent
                                  ? "#ef4444"
                                  : isUpcoming
                                  ? "#94a3b8"
                                  : isInShift
                                  ? "#3b82f6"
                                  : isReopened
                                  ? "#c084fc"
                                  : "#fb923c",
                              }}
                            >
                              {isAbsent
                                ? "✖ Bị đánh vắng"
                                : isUpcoming
                                ? "⏳ Chưa đến giờ ca"
                                : isInShift
                                ? "⚡ Đang trong ca"
                                : isReopened
                                ? "🔓 Đã mở quyền nộp bù"
                                : "⚠️ Chưa nộp bài"}
                            </span>
                          ) : rep.submittedAt ? (
                            `Nộp: ${new Date(rep.submittedAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          ) : ""}
                        </span>

                        {!isUnsubmitted && (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span className="badge badge-info">{rep.fbLinks.length} FB</span>
                            <span className="badge badge-neutral">{rep.threadLinks.length} TH</span>
                            {rep.commentDriveLink && <span className="badge badge-success">Drive</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Sentinel element để phát hiện cuộn đến đáy và tải thêm data */}
                <div ref={sentinelRef} style={{ height: "1px", width: "100%", pointerEvents: "none" }} />

                {/* Loading indicator khi đang cuộn tải thêm */}
                {loadingMore && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "0.75rem",
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw size={13} className="animate-spin" />
                    Đang tải thêm ca...
                  </div>
                )}

                {/* Thông báo khi đã cuộn tải hết toàn bộ ca */}
                {!hasMore && queue.length > 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "0.625rem",
                      color: "var(--text-muted)",
                      fontSize: "0.6875rem",
                      opacity: 0.7,
                    }}
                  >
                    Đã hiển thị tất cả ({queue.length}) ca
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Grading Workspace (Cuộn độc lập trong cột phải) */}
        <div
          className="custom-scroll"
          style={{
            height: "100%",
            minHeight: 0,
            overflowY: "auto",
            paddingRight: "6px",
          }}
        >
          {selectedReport ? (
            <div className="card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
              {/* Report Header Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "1rem",
                  marginBottom: "1.25rem",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                      {selectedReport.user.fullName}
                    </h2>
                    <span className="badge badge-primary">
                      {SHIFT_MAP[selectedReport.shiftType]?.icon}{" "}
                      {SHIFT_MAP[selectedReport.shiftType]?.label}
                    </span>
                    <span className="badge badge-neutral">
                      {selectedReport.shiftRegistration.workMode}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    <Phone size={13} style={{ display: "inline", marginRight: "4px" }} />
                    {selectedReport.user.phone} &bull; Ngày làm:{" "}
                    <strong>{new Date(selectedReport.reportDate).toLocaleDateString("vi-VN")}</strong> &bull; Nộp lúc:{" "}
                    {selectedReport.isUnsubmitted || !selectedReport.submittedAt ? (
                      <span style={{ color: "#f97316", fontWeight: 600 }}>Chưa nộp link</span>
                    ) : (
                      new Date(selectedReport.submittedAt).toLocaleString("vi-VN")
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {selectedReport.isUnsubmitted && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSendReminder}
                      title="Gửi thông báo in-app nhắc nhân sự nộp link báo cáo"
                    >
                      <Bell size={14} /> Nhắc nộp bài
                    </button>
                  )}
                  {(() => {
                    const timeStateInfo = getShiftTimeState(selectedReport.reportDate, selectedReport.shiftType);
                    const isEnded = timeStateInfo.timeState === "ENDED";
                    const isReopened = isEnded && Boolean(selectedReport.shiftRegistration.reopenedBy);

                    if (isReopened) {
                      return (
                        <>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={handleCloseReopenShift}
                            title="Đóng / Thu hồi quyền nộp bù ca này"
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                          >
                            <Lock size={14} /> Đóng nộp bù
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleOpenReopenModal}
                            title="Gia hạn hoặc điều chỉnh thời gian nộp bù"
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                          >
                            <Clock size={14} /> Đổi thời hạn
                          </button>
                        </>
                      );
                    }

                    if (isEnded) {
                      return (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handleOpenReopenModal}
                          title="Cho phép nhân sự nộp bù hoặc sửa link sau khi đã hết giờ ca"
                        >
                          <Unlock size={14} /> Mở nộp bù
                        </button>
                      );
                    }

                    return null;
                  })()}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleMarkAbsent}
                    title="Đánh vắng do vào muộn > 1 tiếng hoặc bỏ ca"
                  >
                    <UserX size={14} /> Đánh Vắng Ca
                  </button>
                </div>
              </div>

              {selectedReport.isUnsubmitted ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {/* Status Alert Banner */}
                  {(() => {
                    const isAbsent = selectedReport.shiftRegistration.status === "ABSENT";
                    const timeStateInfo = getShiftTimeState(selectedReport.reportDate, selectedReport.shiftType);
                    const isUpcoming = timeStateInfo.timeState === "UPCOMING";
                    const isInShift = timeStateInfo.timeState === "IN_SHIFT";
                    const isEnded = timeStateInfo.timeState === "ENDED";
                    const isReopened = isEnded && Boolean(selectedReport.shiftRegistration.reopenedBy);
                    const remaining = formatRemainingTime(selectedReport.shiftRegistration.reopenedUntil);
                    const isReopenExpired = isReopened && remaining?.isExpired;

                    const bannerBg = isAbsent || isReopenExpired
                      ? "rgba(239, 68, 68, 0.1)"
                      : isUpcoming
                      ? "rgba(148, 163, 184, 0.1)"
                      : isInShift
                      ? "rgba(59, 130, 246, 0.1)"
                      : isReopened
                      ? "rgba(168, 85, 247, 0.1)"
                      : "rgba(249, 115, 22, 0.1)";

                    const bannerBorder = isAbsent || isReopenExpired
                      ? "#ef4444"
                      : isUpcoming
                      ? "#94a3b8"
                      : isInShift
                      ? "#3b82f6"
                      : isReopened
                      ? "#a855f7"
                      : "#f97316";

                    const titleColor = isAbsent || isReopenExpired
                      ? "#ef4444"
                      : isUpcoming
                      ? "#94a3b8"
                      : isInShift
                      ? "#3b82f6"
                      : isReopened
                      ? "#a855f7"
                      : "#f97316";

                    const untilStr = selectedReport.shiftRegistration.reopenedUntil
                      ? new Date(selectedReport.shiftRegistration.reopenedUntil).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "";

                    return (
                      <div
                        style={{
                          background: bannerBg,
                          border: `1px solid ${bannerBorder}`,
                          borderRadius: "10px",
                          padding: "1.25rem",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "1rem",
                        }}
                      >
                        <div style={{ marginTop: "2px" }}>
                          {isAbsent ? (
                            <UserX size={28} color="#ef4444" />
                          ) : isUpcoming ? (
                            <Clock size={28} color="#94a3b8" />
                          ) : isInShift ? (
                            <Clock size={28} color="#3b82f6" />
                          ) : isReopenExpired ? (
                            <AlertTriangle size={28} color="#ef4444" />
                          ) : isReopened ? (
                            <Unlock size={28} color="#a855f7" />
                          ) : (
                            <AlertTriangle size={28} color="#f97316" />
                          )}
                        </div>
                        <div>
                          <h3
                            style={{
                              fontSize: "1.0625rem",
                              fontWeight: 700,
                              margin: "0 0 4px 0",
                              color: titleColor,
                            }}
                          >
                            {isAbsent
                              ? "Ca Làm Việc Này Đã Bị Đánh Vắng"
                              : isUpcoming
                              ? "Ca Làm Việc Chưa Đến Giờ Bắt Đầu"
                              : isInShift
                              ? "Ca Làm Việc Đang Diễn Ra"
                              : isReopenExpired
                              ? "Ca Làm Việc Đã Hết Hạn Nộp Bù"
                              : isReopened
                              ? "Ca Làm Việc Đang Mở Quyền Nộp Bù"
                              : "Nhân Sự Đã Đăng Ký Ca Nhưng Chưa Nộp Link Báo Cáo"}
                          </h3>
                          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            {isAbsent
                              ? "Nhân sự đã bị ghi nhận vắng ca (do vào muộn quá thời gian quy định hoặc không làm việc). Ca này không tính công và không được nộp báo cáo."
                              : isUpcoming
                              ? `Ca trực này diễn ra từ ${timeStateInfo.startText} đến ${timeStateInfo.endText}. Hiện tại nhân sự chưa đến giờ làm việc nên chưa nộp link báo cáo.`
                              : isInShift
                              ? `Nhân sự đang trong khung giờ làm việc (${timeStateInfo.startText} - ${timeStateInfo.endText}). Nhân sự có thể hoàn thành và nộp link báo cáo trong thời gian này.`
                              : isReopenExpired
                              ? `Thời hạn mở nộp bù đã kết thúc lúc ${untilStr}. Biểu mẫu nộp báo cáo phía nhân sự hiện đã bị khóa không thể gửi bài. Quản lý có thể chọn Đổi thời hạn để gia hạn thêm hoặc Đóng nộp bù.`
                              : isReopened
                              ? `Quản lý đã mở khóa cho ca này${untilStr ? ` đến ${untilStr} (${remaining?.text})` : ""}. Nhân sự có thể truy cập trang Báo Cáo để nộp bài trước khi hết hạn.`
                              : "Hệ thống ghi nhận ca làm việc đã kết thúc nhưng nhân sự chưa gửi biểu mẫu báo cáo kết quả. Vui lòng kiểm tra và xử lý theo quy định."}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Information Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                        MÃ CA TRỰC
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                        #SR-{selectedReport.shiftRegistrationId}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                        KHUNG GIỜ CA
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                        {selectedReport.shiftType === "MORNING"
                          ? "08:00 - 12:00"
                          : selectedReport.shiftType === "AFTERNOON"
                          ? "13:30 - 17:30"
                          : "18:00 - 22:00"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                        TRẠNG THÁI CA
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                        <span
                          className={`badge ${
                            selectedReport.shiftRegistration.status === "ABSENT"
                              ? "badge-danger"
                              : selectedReport.shiftRegistration.status === "APPROVED"
                              ? "badge-success"
                              : "badge-neutral"
                          }`}
                        >
                          {selectedReport.shiftRegistration.status === "ABSENT"
                            ? "VẮNG CA"
                            : selectedReport.shiftRegistration.status === "APPROVED"
                            ? "ĐÃ DUYỆT CA"
                            : selectedReport.shiftRegistration.status}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                        ĐĂNG NHẬP / CHẤM CÔNG
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                        {selectedReport.shiftRegistration.loginSession ? (
                          selectedReport.shiftRegistration.loginSession.isLate ? (
                            <span style={{ color: "#ef4444" }}>
                              Muộn {selectedReport.shiftRegistration.loginSession.lateMinutes} phút
                            </span>
                          ) : (
                            <span style={{ color: "#10b981" }}>Đúng giờ</span>
                          )
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Chưa check-in</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                      Thao Tác Quản Lý & Xử Lý Ca
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: "1rem",
                      }}
                    >
                      {/* Action Card 1: Nhắc nhở */}
                      <div
                        style={{
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "1rem",
                          background: "var(--bg-secondary)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <Bell size={18} color="var(--primary)" />
                            <strong style={{ fontSize: "0.9375rem" }}>Nhắc Nộp Báo Cáo</strong>
                          </div>
                          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                            Gửi thông báo in-app nhắc nhân sự khẩn trương hoàn thành và nộp liên kết bài viết ca trực này.
                          </p>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleSendReminder}
                          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <Bell size={14} /> Gửi thông báo nhắc nhở
                        </button>
                      </div>

                      {/* Action Card 2: Mở / Đóng nộp bù */}
                      {(() => {
                        const timeStateInfo = getShiftTimeState(selectedReport.reportDate, selectedReport.shiftType);
                        const isUpcoming = timeStateInfo.timeState === "UPCOMING";
                        const isInShift = timeStateInfo.timeState === "IN_SHIFT";
                        const isEnded = timeStateInfo.timeState === "ENDED";
                        const isReopened = isEnded && Boolean(selectedReport.shiftRegistration.reopenedBy);
                        const remaining = formatRemainingTime(selectedReport.shiftRegistration.reopenedUntil);
                        const isExpired = isReopened && remaining?.isExpired;
                        const untilStr = selectedReport.shiftRegistration.reopenedUntil
                          ? new Date(selectedReport.shiftRegistration.reopenedUntil).toLocaleString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "";

                        return (
                          <div
                            style={{
                              border: isReopened ? "1px solid rgba(168, 85, 247, 0.45)" : "1px solid var(--border-color)",
                              borderRadius: "8px",
                              padding: "1rem",
                              background: isReopened ? "rgba(168, 85, 247, 0.05)" : "var(--bg-secondary)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "1rem",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                {isReopened ? (
                                  isExpired ? <Lock size={18} color="#ef4444" /> : <Unlock size={18} color="#a855f7" />
                                ) : (
                                  <Unlock size={18} color={isEnded ? "#a855f7" : "var(--text-muted)"} />
                                )}
                                <strong style={{ fontSize: "0.9375rem" }}>
                                  {isReopened ? "Quản Lý Quyền Nộp Bù" : "Mở Quyền Nộp Bù"}
                                </strong>
                              </div>
                              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                                {isReopened ? (
                                  isExpired ? (
                                    <span style={{ color: "#ef4444" }}>
                                      Đã hết thời hạn mở nộp bù lúc <strong>{untilStr}</strong>. Phía nhân sự hiện không thể gửi bài.
                                    </span>
                                  ) : untilStr ? (
                                    <span>
                                      Đang mở nộp bù đến <strong>{untilStr}</strong> ({remaining?.text}).
                                    </span>
                                  ) : (
                                    "Ca đang được mở nộp bù cho nhân sự."
                                  )
                                ) : isUpcoming ? (
                                  <span>
                                    Ca chưa bắt đầu ({timeStateInfo.startText} - {timeStateInfo.endText}). Chỉ có thể thao tác mở nộp bù sau khi ca làm việc đã kết thúc.
                                  </span>
                                ) : isInShift ? (
                                  <span>
                                    Ca đang trong giờ làm việc ({timeStateInfo.startText} - {timeStateInfo.endText}). Nhân sự được phép nộp bài trực tiếp.
                                  </span>
                                ) : (
                                  "Mở khóa biểu mẫu cho phép nhân sự vào trang Báo Cáo để nộp bài sau khi hết thời hạn ca."
                                )}
                              </p>
                            </div>

                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {isReopened ? (
                                <>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={handleCloseReopenShift}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                                    title="Chủ động đóng lại quyền nộp bù ca"
                                  >
                                    <Lock size={14} /> Đóng nộp bù
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleOpenReopenModal}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                                    title="Điều chỉnh hoặc gia hạn thêm thời gian nộp bù"
                                  >
                                    <Clock size={14} /> Đổi thời hạn
                                  </button>
                                </>
                              ) : isEnded ? (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleOpenReopenModal}
                                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                  <Unlock size={14} /> Mở quyền nộp bù
                                </button>
                              ) : (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled
                                  style={{ opacity: 0.5, cursor: "not-allowed", display: "flex", alignItems: "center", gap: "6px" }}
                                  title="Chỉ có thể mở nộp bù sau khi ca làm việc đã kết thúc"
                                >
                                  <Clock size={14} /> Chưa đến hạn mở bù
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Action Card 3: Đánh vắng */}
                      <div
                        style={{
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "1rem",
                          background: "var(--bg-secondary)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <UserX size={18} color="#ef4444" />
                            <strong style={{ fontSize: "0.9375rem" }}>Đánh Vắng Ca</strong>
                          </div>
                          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                            Xác nhận nhân sự không tham gia làm việc hoặc bỏ ca. Trạng thái ca sẽ chuyển sang VẮNG.
                          </p>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={handleMarkAbsent}
                          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <UserX size={14} /> Đánh vắng ca trực
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* QC Scan & Capture Inspection Panel */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "1rem",
                  marginBottom: "1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                      <Camera size={18} color="var(--primary)" /> Quét & Chụp Ảnh Bài Viết (Thủ Công)
                    </h3>
                    {fromCache && (
                      <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                        💾 Cache máy cá nhân (IndexedDB)
                      </span>
                    )}
                    {Object.keys(scanResults).length > 0 && !fromCache && (
                      <span className="badge badge-info" style={{ fontSize: "0.6875rem" }}>
                        ⚡ Vừa quét mới
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                    Kiểm tra trạng thái liên kết còn sống/bị gỡ, tự động tải và lưu cache ảnh bài viết trên máy QC (không chiếm dung lượng server)
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={scanLoading}
                    onClick={() => handleTriggerScan(false)}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {scanLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Đang quét link & tải ảnh...
                      </>
                    ) : (
                      <>
                        <Camera size={14} /> {Object.keys(scanResults).length > 0 ? "Tải Lại Xem Ảnh" : "Quét & Chụp Toàn Bộ Link"}
                      </>
                    )}
                  </button>

                  {Object.keys(scanResults).length > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={scanLoading}
                      onClick={() => handleTriggerScan(true)}
                      title="Quét lại từ đầu và cập nhật bộ nhớ đệm máy"
                    >
                      <RefreshCw size={13} className={scanLoading ? "animate-spin" : ""} /> Quét mới (Force)
                    </button>
                  )}

                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleClearLocalCache}
                    title="Xóa toàn bộ bộ nhớ đệm bài viết lưu trên máy của bạn"
                    style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Trash2 size={13} /> Dọn cache máy
                  </button>
                </div>
              </div>

              {/* Viral Approval Summary Bar */}
              <div
                style={{
                  background: viralApprovedLinks.length > 0 ? "rgba(249, 115, 22, 0.1)" : "var(--bg-card)",
                  border: "1px solid " + (viralApprovedLinks.length > 0 ? "var(--primary)" : "var(--border-color)"),
                  borderRadius: "8px",
                  padding: "0.875rem 1rem",
                  marginBottom: "1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Flame size={20} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                      Đánh Giá & Phê Duyệt Thưởng Viral (Cấp Quản Lý)
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Chọn bài viết đủ điều kiện viral bên dưới để cấp tiền thưởng cho nhân sự
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    Đã duyệt: <strong>{viralApprovedLinks.length} bài</strong>
                  </span>
                  <span
                    className="badge badge-warning"
                    style={{ fontSize: "0.875rem", padding: "6px 12px", fontWeight: 700 }}
                  >
                    + {viralBonusAmount.toLocaleString("vi-VN")} đ Thưởng
                  </span>
                </div>
              </div>

              {/* Gợi ý bài nổi bật do nhân sự tự gắn trong ca (nếu có) */}
              {selectedReport.viralPostLinks && selectedReport.viralPostLinks.length > 0 && (
                <div
                  style={{
                    background: "rgba(234, 179, 8, 0.08)",
                    border: "1px dashed rgba(234, 179, 8, 0.5)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.8125rem",
                    color: "#854d0e",
                  }}
                >
                  <Sparkles size={16} color="#ca8a04" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Nhân sự đã đánh dấu {selectedReport.viralPostLinks.length} bài viết nổi bật:</strong> Quản lý có thể tham khảo các bài có huy hiệu <span className="badge" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#ca8a04", fontSize: "0.6875rem", padding: "1px 6px" }}>⭐ Bài nổi bật</span> bên dưới và bấm nút <strong>"Duyệt Viral"</strong> nếu bài đạt tiêu chuẩn viral nhận thưởng.
                  </div>
                </div>
              )}

              {/* Đề xuất Bài viết Viral do nhân sự tự khai báo kèm số like (Ẩn ở phía user, hiển thị ở quản lý) */}
              {selectedReport.viralProposals && selectedReport.viralProposals.length > 0 && (
                <div
                  style={{
                    background: "rgba(139, 92, 246, 0.08)",
                    border: "1px dashed rgba(139, 92, 246, 0.5)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#8b5cf6", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={16} /> Nhân sự đề xuất {selectedReport.viralProposals.length} bài viết Viral (Kèm số like tự khai báo):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedReport.viralProposals.map((prop, pIdx) => {
                      const isFb = prop.url.includes("facebook.com") || prop.url.includes("fb.watch");
                      const platform: "FACEBOOK" | "THREADS" = isFb ? "FACEBOOK" : "THREADS";
                      const contentType = (prop.contentType || "POST") as "POST" | "COMMENT";
                      const bonus = getBonusForLink(platform, contentType, prop.likes);
                      const isAlreadyApproved = viralApprovedLinks.some((l) => matchUrls(l, prop.url));

                      return (
                        <div
                          key={pIdx}
                          style={{
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "260px" }}>
                            <span className="badge" style={{ background: isFb ? "rgba(56, 189, 248, 0.15)" : "rgba(192, 132, 252, 0.15)", color: isFb ? "var(--info)" : "#c084fc", fontSize: "0.6875rem" }}>
                              {platform}
                            </span>
                            <a
                              href={prop.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--info)", fontSize: "0.8125rem", wordBreak: "break-all", fontWeight: 500 }}
                            >
                              {prop.url}
                            </a>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              Số like khai báo: <strong style={{ color: "#8b5cf6" }}>{prop.likes.toLocaleString("vi-VN")} like</strong>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              Thưởng dự kiến: <strong style={{ color: "#10b981" }}>+{bonus.toLocaleString("vi-VN")} đ</strong>
                            </div>
                            <button
                              type="button"
                              className={`btn btn-sm ${isAlreadyApproved ? "btn-secondary" : "btn-primary"}`}
                              style={{
                                fontSize: "0.72rem",
                                padding: "4px 8px",
                                height: "28px",
                                backgroundColor: isAlreadyApproved ? undefined : "#8b5cf6",
                                borderColor: isAlreadyApproved ? undefined : "#8b5cf6",
                                color: "#fff",
                              }}
                              onClick={() => {
                                if (isAlreadyApproved) {
                                  setViralApprovedLinks(viralApprovedLinks.filter((l) => !matchUrls(l, prop.url)));
                                } else {
                                  setViralApprovedLinks([...viralApprovedLinks, prop.url]);
                                  setViralLikes({ ...viralLikes, [prop.url]: prop.likes });
                                  setViralContentTypes({ ...viralContentTypes, [prop.url]: contentType });
                                  showToast(`Đã nhận đề xuất viral: ${prop.likes.toLocaleString("vi-VN")} like (+${bonus.toLocaleString("vi-VN")} đ)`);
                                }
                              }}
                            >
                              {isAlreadyApproved ? "✓ Đã đưa vào duyệt" : "+ Duyệt đề xuất này"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Danh sách các bài Viral đã được Quản lý phê duyệt */}
              {viralApprovedLinks.length > 0 && (
                <div
                  style={{
                    background: "rgba(249, 115, 22, 0.04)",
                    border: "1px dashed var(--primary)",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Flame size={16} /> Danh sách bài viết được Cấp Quản lý phê duyệt Viral ({viralApprovedLinks.length} bài):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {viralApprovedLinks.map((vLink, vIdx) => {
                      const isFb = vLink.includes("facebook.com") || vLink.includes("fb.watch");
                      const platform: "FACEBOOK" | "THREADS" = isFb ? "FACEBOOK" : "THREADS";
                      const currentType = viralContentTypes[vLink] || "POST";
                      const currentLikes = viralLikes[vLink] ?? 500;
                      const bonus = getBonusForLink(platform, currentType, currentLikes);
                      const isMainList =
                        selectedReport.fbLinks.some((l) => matchUrls(l, vLink)) ||
                        selectedReport.fbSupplementLinks.some((l) => matchUrls(l, vLink)) ||
                        selectedReport.threadLinks.some((l) => matchUrls(l, vLink));

                      return (
                        <div
                          key={vIdx}
                          style={{
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "260px" }}>
                            <span className="badge" style={{ background: isFb ? "rgba(56, 189, 248, 0.15)" : "rgba(192, 132, 252, 0.15)", color: isFb ? "var(--info)" : "#c084fc", fontSize: "0.6875rem" }}>
                              {platform}
                            </span>
                            {!isMainList ? (
                              <span className="badge badge-warning" style={{ fontSize: "0.6875rem" }} title="Bài nổi bật được nhân sự gửi riêng ngoài các bài chính/dự phòng">
                                Bài đề xuất riêng
                              </span>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: "0.6875rem" }} title="Khớp với bài viết đã nộp trong ca">
                                ✅ Đã nộp trong ca
                              </span>
                            )}
                            <a
                              href={vLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--info)", fontSize: "0.8125rem", wordBreak: "break-all", fontWeight: 500 }}
                            >
                              {vLink}
                            </a>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Loại:</span>
                              <select
                                className="select"
                                style={{ padding: "2px 6px", fontSize: "0.75rem", height: "auto" }}
                                value={currentType}
                                onChange={(e) => handleUpdateViralContentType(vLink, e.target.value as "POST" | "COMMENT")}
                              >
                                <option value="POST">Bài viết (Post)</option>
                                <option value="COMMENT">Bình luận (Comment)</option>
                              </select>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Like:</span>
                              <input
                                type="number"
                                min={0}
                                step={50}
                                className="input"
                                style={{ width: "70px", padding: "2px 6px", fontSize: "0.75rem" }}
                                value={currentLikes}
                                onChange={(e) => handleUpdateViralLikes(vLink, parseInt(e.target.value) || 0)}
                              />
                            </div>

                            <span style={{ fontSize: "0.75rem", color: bonus > 0 ? "var(--success)" : "var(--text-muted)", fontWeight: 700, minWidth: "90px", textAlign: "right" }}>
                              +{bonus.toLocaleString("vi-VN")} đ
                            </span>

                            <button
                              type="button"
                              onClick={() => toggleViralApproval(vLink)}
                              className="btn btn-danger btn-xs"
                              style={{ padding: "3px 8px", fontSize: "0.6875rem" }}
                              title="Hủy duyệt bài viral này"
                            >
                              Gỡ bỏ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 1: Facebook Links Review */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                          📘 Link Bài Facebook ({selectedReport.fbLinks.length} bài đã nộp)
                        </h3>
                        <div style={{ fontSize: "0.75rem", color: fbInvalidCount > 0 ? "var(--danger)" : "var(--text-muted)", marginTop: "2px" }}>
                          {fbInvalidCount > 0 ? (
                            <span>⚠️ Đã tích chọn <strong>{fbInvalidCount}</strong> link không hợp lệ (tự động trừ {fbInvalidCount} bài đạt)</span>
                          ) : (
                            <span>Mặc định hợp lệ (tích chọn "Không hợp lệ" nếu link lỗi/bị gỡ)</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                            Số bài đạt:
                          </span>
                          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                            {selectedReport.fbLinks.length} gửi - {fbInvalidCount} lỗi{fbReplacementsUsed > 0 ? ` + ${fbReplacementsUsed} bù dự phòng` : ""} = <strong style={{ color: fbApproved < 10 ? "var(--warning)" : "var(--success)" }}>{fbApproved}</strong>
                          </div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={Math.max(10, selectedReport.fbLinks.length)}
                          className="input"
                          style={{ width: "64px", padding: "4px 8px", textAlign: "center", fontWeight: 700 }}
                          value={fbApproved}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setFbApproved(val);
                            syncQcDecision(val, threadApproved, commentApproved);
                          }}
                        />
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>/ 10</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {selectedReport.fbLinks.map((link, idx) => {
                        const tagId = (selectedReport.postTags || {})[link];
                        const tagObj = availableTags.find((t) => t.id === tagId);
                        const isFemale = selectedReport.femaleContentLinks.some((l) => matchUrls(l, link));
                        const isViralApproved = viralApprovedLinks.some((l) => matchUrls(l, link));
                        const isHighlightPost = (selectedReport.viralPostLinks || []).some((l) => matchUrls(l, link));
                        const scan = scanResults[link];
                        const isInvalid = isLinkInvalid(link);

                        return (
                          <div
                            key={idx}
                            style={{
                              background: isInvalid ? "rgba(239, 68, 68, 0.05)" : "var(--bg-input)",
                              border: isInvalid
                                ? "1.5px solid var(--danger)"
                                : isViralApproved
                                ? "1px solid var(--primary)"
                                : scan && !scan.isValid
                                ? "1px solid var(--danger)"
                                : isHighlightPost
                                ? "1px solid rgba(234, 179, 8, 0.5)"
                                : "1px solid var(--border-color)",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              fontSize: "0.8125rem",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                                <span style={{ fontWeight: 700, color: "var(--text-muted)", width: "28px" }}>
                                  #{idx + 1}
                                </span>
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: isInvalid || (scan && !scan.isValid) ? "var(--danger)" : "var(--info)",
                                    textDecoration: isInvalid || (scan && !scan.isValid) ? "line-through" : "none",
                                    wordBreak: "break-all",
                                    fontWeight: 500,
                                  }}
                                >
                                  {link}
                                </a>
                              </div>

                              {/* Action & Status Badges */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                {tagObj && (
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: `${tagObj.color}20`,
                                      color: tagObj.color,
                                      border: `1px solid ${tagObj.color}55`,
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                    }}
                                  >
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: tagObj.color }} />
                                    {tagObj.name}
                                  </span>
                                )}
                                {isFemale && <span className="badge" style={{ background: "#ec4899", color: "white" }}>🌸 Nữ</span>}

                                {isHighlightPost && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(234, 179, 8, 0.15)",
                                      color: "#ca8a04",
                                      border: "1px solid rgba(234, 179, 8, 0.5)",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Bài viết được nhân sự gắn tag nổi bật trong ca"
                                  >
                                    <Sparkles size={12} /> Bài nổi bật
                                  </span>
                                )}

                                {isViralApproved && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(249, 115, 22, 0.15)",
                                      color: "var(--primary)",
                                      border: "1px solid var(--primary)",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Bài viết đã được Cấp quản lý phê duyệt Viral (+thưởng)"
                                  >
                                    <Flame size={12} /> Đã duyệt Viral
                                  </span>
                                )}

                                {selectedReport.makeupUrls && (selectedReport.makeupUrls.includes(link) || selectedReport.makeupUrls.some(u => matchUrls(u, link))) && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(147, 51, 234, 0.15)",
                                      color: "#9333ea",
                                      border: "1px solid rgba(147, 51, 234, 0.5)",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Link nộp bù trong tuần hoặc nộp sau chốt ca - Cần duyệt lại riêng link này"
                                  >
                                    <RefreshCw size={11} /> Nộp bù / Cần duyệt
                                  </span>
                                )}

                                {/* Link status indicator */}
                                {scan ? (
                                  scan.isValid ? (
                                    <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                                      ✅ Link Hợp Lệ
                                    </span>
                                  ) : (
                                    <span className="badge badge-danger" style={{ fontSize: "0.6875rem" }}>
                                      ❌ LINK LỖI / BỊ GỠ
                                    </span>
                                  )
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                                    ⚪ Chưa kiểm tra
                                  </span>
                                )}

                                {/* Option: Tích chọn link không hợp lệ */}
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    background: isInvalid ? "rgba(239, 68, 68, 0.15)" : "var(--bg-secondary)",
                                    border: isInvalid ? "1px solid var(--danger)" : "1px solid var(--border-color)",
                                    color: isInvalid ? "var(--danger)" : "var(--text-secondary)",
                                    fontWeight: isInvalid ? 700 : 500,
                                    fontSize: "0.75rem",
                                    userSelect: "none",
                                    transition: "all 0.15s ease",
                                  }}
                                  title={isInvalid ? "Bỏ tích chọn (link hợp lệ)" : "Tích chọn nếu link bị lỗi / không hợp lệ"}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isInvalid}
                                    onChange={() => toggleInvalidLink(link, "facebook")}
                                    style={{
                                      width: "14px",
                                      height: "14px",
                                      accentColor: "var(--danger)",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <span>Không hợp lệ</span>
                                </label>

                                {/* Manager Viral Toggle */}
                                <button
                                  type="button"
                                  onClick={() => toggleViralApproval(link)}
                                  className={`btn btn-sm ${isViralApproved ? "btn-primary" : "btn-secondary"}`}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: "0.75rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Cấp quản lý đánh dấu bài viết Viral"
                                >
                                  <Flame size={13} /> {isViralApproved ? "Đã Duyệt Viral" : "Duyệt Viral"}
                                </button>

                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-icon"
                                  style={{ padding: "4px 8px" }}
                                  title="Mở link trên tab mới"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            </div>

                        {/* If Viral Approved: show likes controller */}
                        {isViralApproved && (
                          <div
                            style={{
                              marginTop: "6px",
                              marginBottom: "6px",
                              padding: "6px 10px",
                              background: "rgba(249, 115, 22, 0.08)",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: 600 }}>
                              🔥 Thẩm định Viral:
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Loại:</span>
                              <select
                                className="select"
                                style={{ padding: "2px 6px", fontSize: "0.75rem", height: "auto" }}
                                value={viralContentTypes[link] || "POST"}
                                onChange={(e) => handleUpdateViralContentType(link, e.target.value as "POST" | "COMMENT")}
                              >
                                <option value="POST">Bài viết (Post)</option>
                                <option value="COMMENT">Bình luận (Comment)</option>
                              </select>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Số Like:</span>
                              <input
                                type="number"
                                min={0}
                                step={50}
                                className="input"
                                style={{ width: "80px", padding: "2px 6px", fontSize: "0.75rem" }}
                                value={viralLikes[link] ?? 500}
                                onChange={(e) => handleUpdateViralLikes(link, parseInt(e.target.value) || 0)}
                              />
                            </div>
                            {(() => {
                              const bonus = getBonusForLink("FACEBOOK", viralContentTypes[link] || "POST", viralLikes[link] ?? 500);
                              return (
                                <span style={{ fontSize: "0.75rem", color: bonus > 0 ? "var(--success)" : "var(--text-muted)", fontWeight: 700 }}>
                                  Mức thưởng: {bonus > 0 ? `+${bonus.toLocaleString("vi-VN")} đ` : "0 đ (Chưa đạt mốc)"}
                                </span>
                              );
                            })()}
                          </div>
                        )}

                        {/* Error warning if invalid */}
                        {scan && !scan.isValid && (
                          <div
                            style={{
                              marginTop: "6px",
                              padding: "6px 10px",
                              background: "rgba(239, 68, 68, 0.1)",
                              borderRadius: "6px",
                              color: "var(--danger)",
                              fontSize: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <ShieldAlert size={14} />
                            <strong>Cảnh báo:</strong> {scan.errorMessage || "Không thể truy cập hoặc bài viết đã bị xóa!"}
                          </div>
                        )}

                        {/* Live Preview for Facebook (Cached on QC device) */}
                        {(() => {
                          if (!scan || !scan.isValid) return null;
                          const displayImg = getSafeImageUrl(scan);
                          if (!displayImg && !scan.title && !scan.description) return null;

                          return (
                            <div style={{ marginTop: "8px" }}>
                              {displayImg && (
                                <div
                                  onClick={() => setLightboxImage(displayImg || null)}
                                  style={{
                                    position: "relative",
                                    height: "130px",
                                    width: "100%",
                                    maxWidth: "420px",
                                    borderRadius: "6px",
                                    overflow: "hidden",
                                    border: "1px solid var(--border-color)",
                                    cursor: "pointer",
                                    background: "var(--bg-secondary)",
                                  }}
                                  title="Bấm vào để phóng to ảnh xem trước bài viết"
                                >
                                  <img
                                    src={displayImg}
                                    alt={`Ảnh xem trước bài viết #${idx + 1}`}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      // Ẩn khung ảnh nếu ảnh không khả dụng, tránh icon vỡ
                                      const p = e.currentTarget.parentElement;
                                      if (p) p.style.display = "none";
                                    }}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                                  />
                                  <div
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      background: "rgba(0,0,0,0.35)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                      color: "white",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      opacity: 0,
                                      transition: "opacity 0.2s",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                                  >
                                    <Maximize2 size={16} /> Bấm để phóng to xem nội dung
                                  </div>
                                </div>
                              )}
                              {scan.title && (
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                  📄 {decodeHtmlEntities(scan.title)}
                                </div>
                              )}
                              {scan.description && (
                                <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "2px", maxHeight: "36px", overflow: "hidden" }}>
                                  {decodeHtmlEntities(scan.description)}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Supplement FB links with full grading capability */}
                {selectedReport.fbSupplementLinks.length > 0 && (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      padding: "1rem",
                      background: "rgba(234, 179, 8, 0.04)",
                      border: "1.5px dashed rgba(234, 179, 8, 0.4)",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.1rem" }}>🛡️</span>
                        <div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--warning)" }}>
                            Link Facebook Dự Phòng ({selectedReport.fbSupplementLinks.length} bài)
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Đánh giá & tự động bù vào chỉ tiêu đạt nếu link chính bị lỗi/gỡ
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-warning" style={{ fontSize: "0.6875rem", padding: "4px 8px" }}>
                        Bù dự phòng: <strong>{fbReplacementsUsed}</strong> / {selectedReport.fbSupplementLinks.length} bài
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {selectedReport.fbSupplementLinks.map((supp, sIdx) => {
                        const tagId = (selectedReport.postTags || {})[supp];
                        const tagObj = availableTags.find((t) => t.id === tagId);
                        const isFemale = selectedReport.femaleContentLinks.some((l) => matchUrls(l, supp));
                        const isViralApproved = viralApprovedLinks.some((l) => matchUrls(l, supp));
                        const isHighlightPost = (selectedReport.viralPostLinks || []).some((l) => matchUrls(l, supp));
                        const scan = scanResults[supp];
                        const isInvalid = isLinkInvalid(supp);

                        return (
                          <div
                            key={sIdx}
                            style={{
                              background: isInvalid ? "rgba(239, 68, 68, 0.05)" : "var(--bg-input)",
                              border: isInvalid
                                ? "1.5px solid var(--danger)"
                                : isViralApproved
                                ? "1.5px solid var(--primary)"
                                : scan && !scan.isValid
                                ? "1px solid var(--danger)"
                                : isHighlightPost
                                ? "1px solid rgba(234, 179, 8, 0.5)"
                                : "1px solid rgba(234, 179, 8, 0.3)",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              fontSize: "0.8125rem",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                                <span style={{ fontWeight: 700, color: "var(--warning)", width: "36px", flexShrink: 0 }}>
                                   +B{sIdx + 1}
                                </span>
                                <span className="badge" style={{ background: "rgba(234, 179, 8, 0.15)", color: "var(--warning)", fontSize: "0.6875rem" }}>
                                   Dự phòng
                                </span>
                                <a
                                  href={supp}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: isInvalid || (scan && !scan.isValid) ? "var(--danger)" : "var(--info)",
                                    textDecoration: isInvalid || (scan && !scan.isValid) ? "line-through" : "none",
                                    wordBreak: "break-all",
                                    fontWeight: 500,
                                  }}
                                >
                                  {supp}
                                </a>
                              </div>

                              {/* Action & Status Badges */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                {tagObj && (
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: `${tagObj.color}20`,
                                      color: tagObj.color,
                                      border: `1px solid ${tagObj.color}55`,
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                    }}
                                  >
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: tagObj.color }} />
                                    {tagObj.name}
                                  </span>
                                )}
                                {isFemale && <span className="badge" style={{ background: "#ec4899", color: "white" }}>🌸 Nữ</span>}

                                {isHighlightPost && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(234, 179, 8, 0.15)",
                                      color: "#ca8a04",
                                      border: "1px solid rgba(234, 179, 8, 0.5)",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Bài viết được nhân sự gắn tag nổi bật trong ca"
                                  >
                                    <Sparkles size={12} /> Bài nổi bật
                                  </span>
                                )}

                                {isViralApproved && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(249, 115, 22, 0.15)",
                                      color: "var(--primary)",
                                      border: "1px solid var(--primary)",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Bài viết đã được Cấp quản lý phê duyệt Viral (+thưởng)"
                                  >
                                    <Flame size={12} /> Đã duyệt Viral
                                  </span>
                                )}

                                {selectedReport.makeupUrls && (selectedReport.makeupUrls.includes(supp) || selectedReport.makeupUrls.some(u => matchUrls(u, supp))) && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(147, 51, 234, 0.15)",
                                      color: "#9333ea",
                                      border: "1px solid rgba(147, 51, 234, 0.5)",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Link nộp bù trong tuần hoặc nộp sau chốt ca - Cần duyệt lại riêng link này"
                                  >
                                    <RefreshCw size={11} /> Nộp bù / Cần duyệt
                                  </span>
                                )}

                                {/* Link status indicator */}
                                {scan ? (
                                  scan.isValid ? (
                                    <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                                      ✅ Link Hợp Lệ
                                    </span>
                                  ) : (
                                    <span className="badge badge-danger" style={{ fontSize: "0.6875rem" }}>
                                      ❌ LINK LỖI / BỊ GỠ
                                    </span>
                                  )
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                                    ⚪ Chưa kiểm tra
                                  </span>
                                )}

                                {/* Option: Tích chọn link không hợp lệ */}
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    background: isInvalid ? "rgba(239, 68, 68, 0.15)" : "var(--bg-secondary)",
                                    border: isInvalid ? "1px solid var(--danger)" : "1px solid var(--border-color)",
                                    color: isInvalid ? "var(--danger)" : "var(--text-secondary)",
                                    fontWeight: isInvalid ? 700 : 500,
                                    fontSize: "0.75rem",
                                    userSelect: "none",
                                    transition: "all 0.15s ease",
                                  }}
                                  title={isInvalid ? "Bỏ tích chọn (link hợp lệ)" : "Tích chọn nếu link bị lỗi / không hợp lệ"}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isInvalid}
                                    onChange={() => toggleInvalidLink(supp, "facebook")}
                                    style={{
                                      width: "14px",
                                      height: "14px",
                                      accentColor: "var(--danger)",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <span>Không hợp lệ</span>
                                </label>

                                {/* Manager Viral Toggle */}
                                <button
                                  type="button"
                                  onClick={() => toggleViralApproval(supp)}
                                  className={`btn btn-sm ${isViralApproved ? "btn-primary" : "btn-secondary"}`}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: "0.75rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Cấp quản lý đánh dấu bài viết Viral"
                                >
                                  <Flame size={13} /> {isViralApproved ? "Đã Duyệt Viral" : "Duyệt Viral"}
                                </button>

                                <a
                                  href={supp}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-icon"
                                  style={{ padding: "4px 8px" }}
                                  title="Mở link trên tab mới"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            </div>

                            {/* If Viral Approved: show likes controller */}
                            {isViralApproved && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  marginBottom: "6px",
                                  padding: "6px 10px",
                                  background: "rgba(249, 115, 22, 0.08)",
                                  borderRadius: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: 600 }}>
                                  🔥 Thẩm định Viral (Bài dự phòng):
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Loại:</span>
                                  <select
                                    className="select"
                                    style={{ padding: "2px 6px", fontSize: "0.75rem", height: "auto" }}
                                    value={viralContentTypes[supp] || "POST"}
                                    onChange={(e) => handleUpdateViralContentType(supp, e.target.value as "POST" | "COMMENT")}
                                  >
                                    <option value="POST">Bài viết (Post)</option>
                                    <option value="COMMENT">Bình luận (Comment)</option>
                                  </select>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Số Like:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={50}
                                    className="input"
                                    style={{ width: "80px", padding: "2px 6px", fontSize: "0.75rem" }}
                                    value={viralLikes[supp] ?? 500}
                                    onChange={(e) => handleUpdateViralLikes(supp, parseInt(e.target.value) || 0)}
                                  />
                                </div>
                                {(() => {
                                  const bonus = getBonusForLink("FACEBOOK", viralContentTypes[supp] || "POST", viralLikes[supp] ?? 500);
                                  return (
                                    <span style={{ fontSize: "0.75rem", color: bonus > 0 ? "var(--success)" : "var(--text-muted)", fontWeight: 700 }}>
                                      Mức thưởng: {bonus > 0 ? `+${bonus.toLocaleString("vi-VN")} đ` : "0 đ (Chưa đạt mốc)"}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Error warning if invalid */}
                            {scan && !scan.isValid && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  padding: "6px 10px",
                                  background: "rgba(239, 68, 68, 0.1)",
                                  borderRadius: "6px",
                                  color: "var(--danger)",
                                  fontSize: "0.75rem",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <ShieldAlert size={14} />
                                <strong>Cảnh báo:</strong> {scan.errorMessage || "Không thể truy cập hoặc bài viết đã bị xóa!"}
                              </div>
                            )}

                            {/* Live Preview for Facebook Supplement (Cached on QC device) */}
                            {(() => {
                              if (!scan || !scan.isValid) return null;
                              const displayImg = getSafeImageUrl(scan);
                              if (!displayImg && !scan.title && !scan.description) return null;

                              return (
                                <div style={{ marginTop: "8px" }}>
                                  {displayImg && (
                                    <div
                                      onClick={() => setLightboxImage(displayImg || null)}
                                      style={{
                                        position: "relative",
                                        height: "130px",
                                        width: "100%",
                                        maxWidth: "420px",
                                        borderRadius: "6px",
                                        overflow: "hidden",
                                        border: "1px solid var(--border-color)",
                                        cursor: "pointer",
                                        background: "var(--bg-secondary)",
                                      }}
                                      title="Bấm vào để phóng to ảnh xem trước bài viết dự phòng"
                                    >
                                      <img
                                        src={displayImg}
                                        alt={`Ảnh xem trước bài viết dự phòng +B${sIdx + 1}`}
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          const p = e.currentTarget.parentElement;
                                          if (p) p.style.display = "none";
                                        }}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          inset: 0,
                                          background: "rgba(0,0,0,0.35)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: "6px",
                                          color: "white",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          opacity: 0,
                                          transition: "opacity 0.2s",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                                      >
                                        <Maximize2 size={16} /> Bấm để phóng to xem nội dung
                                      </div>
                                    </div>
                                  )}
                                  {scan.title && (
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                      📄 {decodeHtmlEntities(scan.title)}
                                    </div>
                                  )}
                                  {scan.description && (
                                    <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "2px", maxHeight: "36px", overflow: "hidden" }}>
                                      {decodeHtmlEntities(scan.description)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Threads Links Review */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                      🧵 Link Bài Threads ({selectedReport.threadLinks.length} bài đã nộp)
                    </h3>
                    <div style={{ fontSize: "0.75rem", color: threadInvalidCount > 0 ? "var(--danger)" : "var(--text-muted)", marginTop: "2px" }}>
                      {threadInvalidCount > 0 ? (
                        <span>⚠️ Đã tích chọn <strong>{threadInvalidCount}</strong> link không hợp lệ (tự động trừ {threadInvalidCount} bài đạt)</span>
                      ) : (
                        <span>Mặc định hợp lệ (tích chọn "Không hợp lệ" nếu link lỗi/bị gỡ)</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                        Số bài đạt:
                      </span>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                        {selectedReport.threadLinks.length} gửi - {threadInvalidCount} lỗi = <strong style={{ color: threadApproved < 4 ? "var(--warning)" : "var(--success)" }}>{threadApproved}</strong>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(4, selectedReport.threadLinks.length)}
                      className="input"
                      style={{ width: "64px", padding: "4px 8px", textAlign: "center", fontWeight: 700 }}
                      value={threadApproved}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setThreadApproved(val);
                        syncQcDecision(fbApproved, val, commentApproved);
                      }}
                    />
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>/ 4</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {selectedReport.threadLinks.map((link, idx) => {
                    const tagId = (selectedReport.postTags || {})[link];
                    const tagObj = availableTags.find((t) => t.id === tagId);
                    const isViralApproved = viralApprovedLinks.some((l) => matchUrls(l, link));
                    const isHighlightPost = (selectedReport.viralPostLinks || []).some((l) => matchUrls(l, link));
                    const scan = scanResults[link];
                    const isInvalid = isLinkInvalid(link);

                    return (
                      <div
                        key={idx}
                        style={{
                          background: isInvalid ? "rgba(239, 68, 68, 0.05)" : "var(--bg-input)",
                          border: isInvalid
                            ? "1.5px solid var(--danger)"
                            : isViralApproved
                            ? "1px solid var(--primary)"
                            : scan && !scan.isValid
                            ? "1px solid var(--danger)"
                            : isHighlightPost
                            ? "1px solid rgba(234, 179, 8, 0.5)"
                            : "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontSize: "0.8125rem",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                            <span style={{ fontWeight: 700, color: "var(--text-muted)", width: "28px" }}>
                              #{idx + 1}
                            </span>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: isInvalid || (scan && !scan.isValid) ? "var(--danger)" : "var(--info)",
                                textDecoration: isInvalid || (scan && !scan.isValid) ? "line-through" : "none",
                                wordBreak: "break-all",
                                fontWeight: 500,
                              }}
                            >
                              {link}
                            </a>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            {tagObj && (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: `${tagObj.color}20`,
                                  color: tagObj.color,
                                  border: `1px solid ${tagObj.color}55`,
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "2px 8px",
                                }}
                              >
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: tagObj.color }} />
                                {tagObj.name}
                              </span>
                            )}
                            {isHighlightPost && (
                              <span
                                className="badge"
                                style={{
                                  background: "rgba(234, 179, 8, 0.15)",
                                  color: "#ca8a04",
                                  border: "1px solid rgba(234, 179, 8, 0.5)",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Bài viết được nhân sự gắn tag nổi bật trong ca"
                              >
                                <Sparkles size={12} /> Bài nổi bật
                              </span>
                            )}
                            {isViralApproved && (
                              <span
                                className="badge"
                                style={{
                                  background: "rgba(249, 115, 22, 0.15)",
                                  color: "var(--primary)",
                                  border: "1px solid var(--primary)",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Bài viết đã được Cấp quản lý phê duyệt Viral (+thưởng)"
                              >
                                <Flame size={12} /> Đã duyệt Viral
                              </span>
                            )}

                            {selectedReport.makeupUrls && (selectedReport.makeupUrls.includes(link) || selectedReport.makeupUrls.some(u => matchUrls(u, link))) && (
                              <span
                                className="badge"
                                style={{
                                  background: "rgba(147, 51, 234, 0.15)",
                                  color: "#9333ea",
                                  border: "1px solid rgba(147, 51, 234, 0.5)",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Link nộp bù trong tuần hoặc nộp sau chốt ca - Cần duyệt lại riêng link này"
                              >
                                <RefreshCw size={11} /> Nộp bù / Cần duyệt
                              </span>
                            )}

                            {/* Link status indicator */}
                            {scan ? (
                              scan.isValid ? (
                                <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                                  ✅ Link Hợp Lệ
                                </span>
                              ) : (
                                <span className="badge badge-danger" style={{ fontSize: "0.6875rem" }}>
                                  ❌ LINK LỖI / BỊ GỠ
                                </span>
                              )
                            ) : (
                              <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                                ⚪ Chưa kiểm tra
                              </span>
                            )}

                            {/* Option: Tích chọn link không hợp lệ */}
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                background: isInvalid ? "rgba(239, 68, 68, 0.15)" : "var(--bg-secondary)",
                                border: isInvalid ? "1px solid var(--danger)" : "1px solid var(--border-color)",
                                color: isInvalid ? "var(--danger)" : "var(--text-secondary)",
                                fontWeight: isInvalid ? 700 : 500,
                                fontSize: "0.75rem",
                                userSelect: "none",
                                transition: "all 0.15s ease",
                              }}
                              title={isInvalid ? "Bỏ tích chọn (link hợp lệ)" : "Tích chọn nếu link bị lỗi / không hợp lệ"}
                            >
                              <input
                                type="checkbox"
                                checked={isInvalid}
                                onChange={() => toggleInvalidLink(link, "threads")}
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  accentColor: "var(--danger)",
                                  cursor: "pointer",
                                }}
                              />
                              <span>Không hợp lệ</span>
                            </label>

                            {/* Manager Viral Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleViralApproval(link)}
                              className={`btn btn-sm ${isViralApproved ? "btn-primary" : "btn-secondary"}`}
                              style={{
                                padding: "3px 8px",
                                fontSize: "0.75rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Cấp quản lý đánh dấu bài viết Viral"
                            >
                              <Flame size={13} /> {isViralApproved ? "Đã Duyệt Viral" : "Duyệt Viral"}
                            </button>

                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-icon"
                              style={{ padding: "4px 8px" }}
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>

                        {/* If Viral Approved: show likes controller */}
                        {isViralApproved && (
                          <div
                            style={{
                              marginTop: "6px",
                              marginBottom: "6px",
                              padding: "6px 10px",
                              background: "rgba(249, 115, 22, 0.08)",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: 600 }}>
                              🔥 Thẩm định Viral Threads:
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Loại:</span>
                              <select
                                className="select"
                                style={{ padding: "2px 6px", fontSize: "0.75rem", height: "auto" }}
                                value={viralContentTypes[link] || "POST"}
                                onChange={(e) => handleUpdateViralContentType(link, e.target.value as "POST" | "COMMENT")}
                              >
                                <option value="POST">Bài viết (Post)</option>
                                <option value="COMMENT">Bình luận (Comment)</option>
                              </select>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Số Like:</span>
                              <input
                                type="number"
                                min={0}
                                step={50}
                                className="input"
                                style={{ width: "80px", padding: "2px 6px", fontSize: "0.75rem" }}
                                value={viralLikes[link] ?? 500}
                                onChange={(e) => handleUpdateViralLikes(link, parseInt(e.target.value) || 0)}
                              />
                            </div>
                            {(() => {
                              const bonus = getBonusForLink("THREADS", viralContentTypes[link] || "POST", viralLikes[link] ?? 500);
                              return (
                                <span style={{ fontSize: "0.75rem", color: bonus > 0 ? "var(--success)" : "var(--text-muted)", fontWeight: 700 }}>
                                  Mức thưởng: {bonus > 0 ? `+${bonus.toLocaleString("vi-VN")} đ` : "0 đ (Chưa đạt mốc)"}
                                </span>
                              );
                            })()}
                          </div>
                        )}

                        {/* Error warning if invalid */}
                        {scan && !scan.isValid && (
                          <div
                            style={{
                              marginTop: "6px",
                              padding: "6px 10px",
                              background: "rgba(239, 68, 68, 0.1)",
                              borderRadius: "6px",
                              color: "var(--danger)",
                              fontSize: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <ShieldAlert size={14} />
                            <strong>Cảnh báo:</strong> {scan.errorMessage || "Bài viết không tồn tại hoặc đã bị gỡ!"}
                          </div>
                        )}

                        {/* Content Card Preview for Threads (Bóc tách nội dung text và hình ảnh) */}
                        {scan && scan.isValid && (scan.description || scan.title || scan.ogImage) && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "10px",
                              background: "var(--bg-secondary)",
                              borderRadius: "6px",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            {scan.title && (
                              <div style={{ fontWeight: 600, fontSize: "0.8125rem", marginBottom: "4px", color: "var(--text-primary)" }}>
                                🧵 {decodeHtmlEntities(scan.title)}
                              </div>
                            )}
                            {scan.description && (
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-secondary)",
                                  lineHeight: 1.4,
                                  whiteSpace: "pre-line",
                                }}
                              >
                                {decodeHtmlEntities(scan.description)}
                              </div>
                            )}
                            {getSafeImageUrl(scan) && (
                              <div style={{ marginTop: "6px" }}>
                                <img
                                  src={getSafeImageUrl(scan) || ""}
                                  alt="Threads media"
                                  referrerPolicy="no-referrer"
                                  onClick={() => setLightboxImage(getSafeImageUrl(scan) || null)}
                                  onError={(e) => {
                                    const p = e.currentTarget.parentElement;
                                    if (p) p.style.display = "none";
                                  }}
                                  style={{
                                    maxHeight: "120px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    border: "1px solid var(--border-color)",
                                  }}
                                  title="Bấm để xem ảnh phóng to"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Google Drive Comments */}
              <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      📁 Link Google Drive Minh Chứng Comments
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Yêu cầu tối thiểu 50 ảnh chụp màn hình bình luận trong ca
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      Số comment đạt:
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="input"
                      style={{ width: "64px", padding: "4px 8px", textAlign: "center" }}
                      value={commentApproved}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setCommentApproved(val);
                        syncQcDecision(fbApproved, threadApproved, val);
                      }}
                    />
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>/ 50</span>
                  </div>
                </div>

                {selectedReport.commentDriveLink ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <a
                      href={selectedReport.commentDriveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FolderOpen size={16} color="var(--primary)" /> Mở Thư Mục Google Drive Ảnh
                    </a>
                  </div>
                ) : (
                  <div style={{ color: "var(--danger)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                    ❌ Nhân sự không đính kèm link Drive minh chứng!
                  </div>
                )}
              </div>

              {/* Sticky Action Dock: Chấm điểm & Duyệt Ca Cố Định */}
              <div className="sticky-qc-dock">
                {/* Row 1: Header / Status Summary & PASS / FAIL Toggle */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  {/* Left: Section Title & Real-time Metrics Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldCheck size={18} color="var(--primary)" />
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        Kết Luận QC
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      {/* FB Metric */}
                      <span
                        className={`badge ${fbApproved >= 10 ? "badge-success" : "badge-warning"}`}
                        style={{ fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px" }}
                        title={`${fbApproved} bài Facebook hợp lệ (Chỉ tiêu: 10)`}
                      >
                        📘 FB: {fbApproved} đạt
                      </span>

                      {/* Threads Metric */}
                      <span
                        className={`badge ${threadApproved >= 4 ? "badge-success" : "badge-warning"}`}
                        style={{ fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px" }}
                        title={`${threadApproved} bài Threads hợp lệ (Chỉ tiêu: 4)`}
                      >
                        🧵 TH: {threadApproved} đạt
                      </span>

                      {/* Drive Comments Metric */}
                      <span
                        className={`badge ${commentApproved >= 50 ? "badge-success" : "badge-warning"}`}
                        style={{ fontSize: "0.75rem", fontWeight: 600, padding: "3px 8px" }}
                        title={commentApproved >= 50 ? "Đủ chỉ tiêu 50 ảnh minh chứng comment" : "Chưa đủ 50 ảnh comment"}
                      >
                        📁 Drive: {commentApproved}/50
                      </span>

                      {/* Viral Bonus Metric (if any) */}
                      {viralApprovedLinks.length > 0 && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(249, 115, 22, 0.15)",
                            color: "var(--primary)",
                            border: "1px solid var(--primary)",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Flame size={12} /> +{viralBonusAmount.toLocaleString("vi-VN")} đ ({viralApprovedLinks.length} viral)
                        </span>
                      )}

                      {/* Queue position badge */}
                      {pendingCount > 0 && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            background: "var(--bg-surface)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          Ca {currentPendingIndex >= 0 ? currentPendingIndex + 1 : 1}/{pendingCount} chờ duyệt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Modern Segmented PASS / FAIL Controls */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        padding: "6px 14px",
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: result === "PASS" ? "#16a34a" : "var(--bg-surface)",
                        borderColor: result === "PASS" ? "#22c55e" : "var(--border-color)",
                        color: result === "PASS" ? "#ffffff" : "var(--text-secondary)",
                        boxShadow: result === "PASS" ? "0 0 14px rgba(22, 163, 74, 0.45)" : "none",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSetResult("PASS")}
                    >
                      <CheckCircle2 size={16} /> ĐẠT (PASS)
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        padding: "6px 14px",
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: result === "FAIL" ? "#dc2626" : "var(--bg-surface)",
                        borderColor: result === "FAIL" ? "#ef4444" : "var(--border-color)",
                        color: result === "FAIL" ? "#ffffff" : "var(--text-secondary)",
                        boxShadow: result === "FAIL" ? "0 0 14px rgba(220, 38, 38, 0.45)" : "none",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSetResult("FAIL")}
                    >
                      <XCircle size={16} /> KHÔNG ĐẠT (FAIL)
                    </button>
                  </div>
                </div>

                {/* Optional Expanded Multi-line Textarea */}
                {isFeedbackExpanded && (
                  <div style={{ marginTop: "0.625rem" }}>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Nhập chi tiết đánh giá cho nhân sự..."
                      value={feedback}
                      onChange={(e) => handleFeedbackChange(e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: "0.8125rem",
                        background: "var(--bg-input)",
                        color: "var(--text-primary)",
                        borderColor: result === "FAIL" ? "rgba(239, 68, 68, 0.4)" : "var(--border-color)",
                      }}
                    />
                  </div>
                )}

                {/* Row 2: Feedback Input & Quick Chips + Submit CTAs */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    marginTop: "0.625rem",
                  }}
                >
                  {/* Left: Feedback Field */}
                  <div style={{ flex: 1, minWidth: "280px", display: "flex", alignItems: "center", gap: "6px" }}>
                    {!isFeedbackExpanded && (
                      <input
                        type="text"
                        className="input"
                        style={{
                          flex: 1,
                          height: "36px",
                          fontSize: "0.8125rem",
                          background: "var(--bg-input)",
                          color: "var(--text-primary)",
                          borderColor: result === "FAIL" ? "rgba(239, 68, 68, 0.4)" : "var(--border-color)",
                          padding: "4px 10px",
                        }}
                        placeholder="Nhận xét / Lời nhắn cho nhân sự..."
                        value={feedback}
                        onChange={(e) => handleFeedbackChange(e.target.value)}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        height: "36px",
                        padding: "0 10px",
                        fontSize: "0.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                      title={isFeedbackExpanded ? "Thu gọn ô nhận xét" : "Mở rộng ô nhận xét dài"}
                    >
                      {isFeedbackExpanded ? (
                        <>
                          <ChevronUp size={14} /> Thu gọn
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Mở rộng
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Action Buttons Group */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {/* Save current shift only */}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        height: "38px",
                        padding: "0 14px",
                        fontSize: "0.8125rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 600,
                      }}
                      disabled={saving}
                      onClick={() => handleSaveReview(false)}
                      title="Lưu kết quả kiểm duyệt và ở lại ca này"
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" /> Đang lưu...
                        </>
                      ) : (
                        <>
                          <Send size={15} /> Lưu Duyệt
                        </>
                      )}
                    </button>

                    {/* Primary CTA: Save & Next Shift */}
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        height: "38px",
                        padding: "0 18px",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                        boxShadow: "0 4px 15px rgba(249, 115, 22, 0.4)",
                        border: "none",
                      }}
                      disabled={saving}
                      onClick={() => handleSaveReview(true)}
                      title="Lưu kết quả ca hiện tại và tự động chuyển sang ca tiếp theo đang chờ duyệt"
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Đang xử lý...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Duyệt & Ca Tiếp Theo <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
            <div
              className="card"
              style={{
                padding: "4rem 2rem",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <ClipboardCheck size={48} style={{ margin: "0 auto 1rem auto", opacity: 0.5 }} />
              <h3>Chọn một ca làm việc từ hàng đợi bên trái để bắt đầu kiểm duyệt</h3>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Viewing Full Resolution Screenshot */}
      {lightboxImage && (
        <Modal
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          maxWidth="1100px"
          closeOnOutsideClick={false}
          headerLeft={
            <div className="modal-title" style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
              📸 Ảnh chụp màn hình bài viết gốc
            </div>
          }
          footer={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setLightboxImage(null)}
            >
              Đóng
            </button>
          }
        >
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src={lightboxImage}
              alt="Full preview capture"
              style={{ maxWidth: "100%", maxHeight: "calc(100vh - 12rem)", objectFit: "contain", borderRadius: "8px", display: "block" }}
            />
          </div>
        </Modal>
      )}

      {/* Modal Mở Nộp Bù Ca / Thiết lập thời gian */}
      {reopenModalOpen && selectedReport && (
        <Modal
          isOpen={reopenModalOpen}
          onClose={() => setReopenModalOpen(false)}
          maxWidth="560px"
          closeOnOutsideClick={false}
          headerLeft={
            <div className="modal-title" style={{ fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <Unlock size={18} color="#a855f7" />
              {selectedReport.shiftRegistration.reopenedBy ? "Điều Chỉnh Thời Gian Nộp Bù" : "Mở Quyền Nộp Bù Ca Làm Việc"}
            </div>
          }
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReopenModalOpen(false)}
                disabled={submittingReopen}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmReopenShift}
                disabled={submittingReopen}
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 600,
                }}
              >
                {submittingReopen ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <Unlock size={14} /> {selectedReport.shiftRegistration.reopenedBy ? "Cập Nhật Thời Hạn" : "Xác Nhận Mở Nộp Bù"}
                  </>
                )}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                fontSize: "0.8125rem",
                lineHeight: "1.5",
              }}
            >
              <div>👤 <strong>Nhân sự:</strong> {selectedReport.user.fullName} ({selectedReport.user.phone})</div>
              <div>📅 <strong>Ca làm việc:</strong> {new Date(selectedReport.reportDate).toLocaleDateString("vi-VN")} - {selectedReport.shiftType === "MORNING" ? "Ca Sáng" : selectedReport.shiftType === "AFTERNOON" ? "Ca Chiều" : "Ca Tối"}</div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Chọn khoảng thời gian cho phép nộp bù:
              </label>

              {/* Preset buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "0.875rem" }}>
                {[
                  { label: "30 Phút", minutes: 30 },
                  { label: "1 Giờ", minutes: 60 },
                  { label: "2 Giờ", minutes: 120 },
                  { label: "4 Giờ", minutes: 240 },
                  { label: "12 Giờ", minutes: 720 },
                  { label: "24 Giờ", minutes: 1440 },
                ].map((item) => {
                  const isSelected = reopenMode === "PRESET" && reopenDurationMinutes === item.minutes;
                  return (
                    <button
                      key={item.minutes}
                      type="button"
                      onClick={() => {
                        setReopenMode("PRESET");
                        setReopenDurationMinutes(item.minutes);
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? "1.5px solid #a855f7" : "1px solid var(--border-color)",
                        background: isSelected ? "rgba(168, 85, 247, 0.18)" : "var(--bg-secondary)",
                        color: isSelected ? "#c084fc" : "var(--text-primary)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Datetime Option */}
              <div style={{ marginTop: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8125rem", marginBottom: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="reopenMode"
                    checked={reopenMode === "CUSTOM"}
                    onChange={() => setReopenMode("CUSTOM")}
                  />
                  <span>Hoặc chọn thời điểm hết hạn cụ thể:</span>
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  style={{
                    width: "100%",
                    fontSize: "0.8125rem",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    opacity: reopenMode === "CUSTOM" ? 1 : 0.6,
                  }}
                  value={reopenCustomDateTime}
                  onChange={(e) => {
                    setReopenMode("CUSTOM");
                    setReopenCustomDateTime(e.target.value);
                  }}
                  onFocus={() => setReopenMode("CUSTOM")}
                />
              </div>
            </div>

            {/* Preview Banner */}
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                background: "rgba(168, 85, 247, 0.12)",
                border: "1px solid rgba(168, 85, 247, 0.35)",
                fontSize: "0.75rem",
                color: "#c084fc",
                lineHeight: "1.4",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Clock size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Hạn chót nộp bù dự kiến: </strong>
                {(() => {
                  let target: Date;
                  if (reopenMode === "CUSTOM" && reopenCustomDateTime) {
                    target = new Date(reopenCustomDateTime);
                  } else {
                    target = new Date(Date.now() + reopenDurationMinutes * 60 * 1000);
                  }
                  if (isNaN(target.getTime())) return "Chưa hợp lệ";
                  return target.toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                })()}
                <div>(Hết thời gian này, biểu mẫu cấp user sẽ tự động bị khóa và không thể submit)</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

