"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { promptModal, WeekPicker, Modal } from "@/components/ui";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Flame,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Sparkles,
  User,
  Plus,
  Trash2,
  Calculator,
  Save,
  X,
  Filter,
  Clock,
  BookOpen,
  Gift,
  Calendar,
  Edit2,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { exportKpiExcel } from "@/lib/exportKpiExcel";
import { getWeekDateRange } from "@/lib/dateUtils";

// Types
interface KpiUserSummary {
  user: {
    id: number;
    fullName: string;
    phone: string;
    role: string;
    status: string;
    avatarUrl?: string | null;
    startDate: string;
  };
  kpi: {
    weekNumber: number;
    year: number;
    totalShifts: number;
    totalShiftsPassed: number;
    minRequiredShifts: number;
    targetsPerShift?: {
      facebook: number;
      threads: number;
      comments: number;
    };
    isCustom?: boolean;
    targets: {
      facebook: number;
      threads: number;
      comments: number;
    };
    actual: {
      facebook: number;
      threads: number;
      comments: number;
    };
    completionRates: {
      facebook: number;
      threads: number;
      comments: number;
      overall: number;
    };
    growth: {
      facebook: number;
      threads: number;
      comments: number;
      overall: number;
    };
  };
  evaluation: {
    id: number | null;
    isSaved: boolean;
    overallRating: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_IMPROVEMENT" | "POOR";
    fbQualityReview: string | null;
    threadQualityReview: string | null;
    commentQualityReview: string | null;
    postCareReview: string | null;
    viralBonus: number;
    viralLinks: string[];
    badLinks: string[];
    updatedAt: string | null;
  };
}

interface ViralTier {
  id: number;
  contentType: "POST" | "COMMENT";
  platform: "FACEBOOK" | "THREADS";
  minLikes: number;
  bonusAmount: number;
}

interface ViralPostItem {
  id?: number;
  link: string;
  userId: number;
  authorName: string;
  userPhone?: string;
  reportDate: string;
  reportId: number;
  shiftType?: string;
  submittedAt?: string;
  isFemaleContent: boolean;
  platform?: string;
  contentType?: string;
  likes?: number;
  bonusAmount?: number;
}

const SHIFT_MAP: Record<string, { label: string; icon: string; badgeClass: string }> = {
  MORNING: { label: "Ca Sáng", icon: "☀️", badgeClass: "badge-warning" },
  AFTERNOON: { label: "Ca Chiều", icon: "🌤️", badgeClass: "badge-info" },
  EVENING: { label: "Ca Tối", icon: "🌙", badgeClass: "badge-purple" },
};

const RATING_CONFIG: Record<
  string,
  { label: string; badgeClass: string; bgClass: string; textClass: string }
> = {
  EXCELLENT: {
    label: "Rất tốt",
    badgeClass: "badge-success",
    bgClass: "bg-emerald-600",
    textClass: "text-emerald-400",
  },
  GOOD: {
    label: "Tốt",
    badgeClass: "badge-info",
    bgClass: "bg-blue-600",
    textClass: "text-blue-400",
  },
  FAIR: {
    label: "Khá",
    badgeClass: "badge-warning",
    bgClass: "bg-amber-600",
    textClass: "text-amber-400",
  },
  NEEDS_IMPROVEMENT: {
    label: "Cần cố gắng",
    badgeClass: "badge-warning",
    bgClass: "bg-orange-600",
    textClass: "text-orange-400",
  },
  POOR: {
    label: "Không tốt",
    badgeClass: "badge-danger",
    bgClass: "bg-red-600",
    textClass: "text-red-400",
  },
};

const AVATAR_BG_COLORS = [
  "bg-purple-600/80",
  "bg-rose-500/80",
  "bg-amber-600/80",
  "bg-indigo-600/80",
  "bg-emerald-600/80",
  "bg-sky-600/80",
  "bg-pink-600/80",
  "bg-teal-600/80",
];

// Helper tính tuần ISO hiện tại
function getCurrentISOWeek(): { week: number; year: number } {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNo, year: date.getUTCFullYear() };
}

export default function KpiPage() {
  const currentISO = getCurrentISOWeek();
  const [selectedWeek, setSelectedWeek] = useState<number>(currentISO.week);
  const [selectedYear, setSelectedYear] = useState<number>(currentISO.year);

  const [activeTab, setActiveTab] = useState<"PERSONNEL" | "VIRAL">("PERSONNEL");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [ratingFilter, setRatingFilter] = useState<string>("ALL");

  // Data
  const [personnelList, setPersonnelList] = useState<KpiUserSummary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [viralTiers, setViralTiers] = useState<ViralTier[]>([]);
  const [viralPosts, setViralPosts] = useState<ViralPostItem[]>([]);

  // Modal Đánh giá
  const [evalModalUser, setEvalModalUser] = useState<KpiUserSummary | null>(null);
  const [overallRating, setOverallRating] = useState<string>("GOOD");
  const [fbQualityReview, setFbQualityReview] = useState<string>("");
  const [threadQualityReview, setThreadQualityReview] = useState<string>("");
  const [commentQualityReview, setCommentQualityReview] = useState<string>("");
  const [postCareReview, setPostCareReview] = useState<string>("");
  const [viralBonus, setViralBonus] = useState<number>(0);
  const [viralLinks, setViralLinks] = useState<string[]>([]);
  const [badLinks, setBadLinks] = useState<string[]>([]);

  // State cho việc thêm bài viral tính thưởng trong Modal
  const [modalViralLikes, setModalViralLikes] = useState<{
    [url: string]: { likes: number; platform: "FACEBOOK" | "THREADS"; type: "POST" | "COMMENT" };
  }>({});

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // State xuất báo cáo Excel
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportType, setExportType] = useState<"WEEK" | "MONTH">("WEEK");
  const [exportWeek, setExportWeek] = useState<number>(selectedWeek);
  const [exportYear, setExportYear] = useState<number>(selectedYear);
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth() + 1);
  const [exportSplitByMonth, setExportSplitByMonth] = useState<boolean>(true); // Phương án B
  const [exportCutOffDate, setExportCutOffDate] = useState<string>("");
  const [exporting, setExporting] = useState<boolean>(false);

  useEffect(() => {
    setExportWeek(selectedWeek);
    setExportYear(selectedYear);
  }, [selectedWeek, selectedYear]);

  // Tính chi tiết từ ngày - đến ngày của tuần được chọn
  const exportWeekRangeText = useMemo(() => {
    try {
      if (!exportWeek || !exportYear) return { fullWeek: "", actualPeriod: "" };
      const { startDate, endDate } = getWeekDateRange(exportWeek, exportYear);
      const sD = String(startDate.getUTCDate()).padStart(2, "0");
      const sM = String(startDate.getUTCMonth() + 1).padStart(2, "0");
      const eD = String(endDate.getUTCDate()).padStart(2, "0");
      const eM = String(endDate.getUTCMonth() + 1).padStart(2, "0");

      const fullWeek = `${sD}/${sM} - ${eD}/${eM}`;

      if (exportSplitByMonth) {
        const monthStart = new Date(Date.UTC(exportYear, exportMonth - 1, 1));
        const monthEnd = new Date(Date.UTC(exportYear, exportMonth, 0));
        const actualStart = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
        let actualEnd = new Date(Math.min(endDate.getTime(), monthEnd.getTime()));

        if (exportCutOffDate) {
          const [coY, coM, coD] = exportCutOffDate.split("-").map(Number);
          const cutOffTime = new Date(Date.UTC(coY, coM - 1, coD));
          if (actualEnd > cutOffTime) actualEnd = cutOffTime;
        }

        const asD = String(actualStart.getUTCDate()).padStart(2, "0");
        const asM = String(actualStart.getUTCMonth() + 1).padStart(2, "0");
        const aeD = String(actualEnd.getUTCDate()).padStart(2, "0");
        const aeM = String(actualEnd.getUTCMonth() + 1).padStart(2, "0");

        return {
          fullWeek,
          actualPeriod: `${asD}/${asM} - ${aeD}/${aeM}`,
        };
      }

      return {
        fullWeek,
        actualPeriod: fullWeek,
      };
    } catch {
      return { fullWeek: "", actualPeriod: "" };
    }
  }, [exportWeek, exportYear, exportSplitByMonth, exportMonth, exportCutOffDate]);

  const handleExportSubmit = async () => {
    setExporting(true);
    try {
      let url = "";
      if (exportType === "WEEK") {
        url = `/api/kpi/export-data?type=week&week=${exportWeek}&year=${exportYear}&splitByMonth=${exportSplitByMonth}`;
        if (exportSplitByMonth) {
          url += `&month=${exportMonth}`;
        }
        if (exportCutOffDate) {
          url += `&cutOffDate=${exportCutOffDate}`;
        }
      } else {
        url = `/api/kpi/export-data?type=month&month=${exportMonth}&year=${exportYear}`;
        if (exportCutOffDate) {
          url += `&cutOffDate=${exportCutOffDate}`;
        }
      }

      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể lấy dữ liệu báo cáo");
      }

      const payload = await res.json();
      await exportKpiExcel(payload);
      showToast(`Đã xuất thành công ${exportType === "WEEK" ? "Báo cáo Tuần" : "Báo cáo Tháng"}!`);
      setExportModalOpen(false);
    } catch (error: any) {
      showToast(error.message || "Lỗi khi xuất file Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  // 1. Fetch dữ liệu KPI
  const fetchKpiData = useCallback(async () => {
    setLoading(true);
    try {
      const [resKpi, resViral] = await Promise.all([
        fetch(`/api/kpi?week=${selectedWeek}&year=${selectedYear}`),
        fetch(`/api/kpi/viral?week=${selectedWeek}&year=${selectedYear}`),
      ]);

      if (!resKpi.ok) throw new Error("Không thể tải bảng KPI tuần");
      const kpiData = await resKpi.json();
      setPersonnelList(kpiData.personnel || []);
      setSummary(kpiData.summary || null);

      if (resViral.ok) {
        const viralData = await resViral.json();
        setViralTiers(viralData.tiers || []);
        setViralPosts(viralData.posts || []);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedWeek, selectedYear]);

  useEffect(() => {
    fetchKpiData();
  }, [fetchKpiData]);

  // Về tuần hiện tại

  const handleCurrentWeek = () => {
    setSelectedWeek(currentISO.week);
    setSelectedYear(currentISO.year);
  };

  // Mở modal đánh giá
  const handleOpenEvaluation = (item: KpiUserSummary) => {
    setEvalModalUser(item);
    setOverallRating(item.evaluation.overallRating);
    setFbQualityReview(item.evaluation.fbQualityReview || "");
    setThreadQualityReview(item.evaluation.threadQualityReview || "");
    setCommentQualityReview(item.evaluation.commentQualityReview || "");
    setPostCareReview(item.evaluation.postCareReview || "");
    setViralBonus(item.evaluation.viralBonus || 0);
    setViralLinks(item.evaluation.viralLinks || []);
    setBadLinks(item.evaluation.badLinks || []);

    // Setup form tính like cho các bài viral hiện tại
    const initialLikes: any = {};
    (item.evaluation.viralLinks || []).forEach((link) => {
      const isFb = link.includes("facebook.com") || link.includes("fb.watch");
      initialLikes[link] = {
        likes: 0,
        platform: isFb ? "FACEBOOK" : "THREADS",
        type: "POST",
      };
    });
    setModalViralLikes(initialLikes);
  };

  // Tự động tính tiền thưởng viral từ lượt like
  const handleCalculateViralBonus = () => {
    let totalCalculated = 0;
    Object.entries(modalViralLikes).forEach(([_, data]) => {
      const match = viralTiers
        .filter((t) => t.platform === data.platform && t.contentType === data.type && data.likes >= t.minLikes)
        .sort((a, b) => b.minLikes - a.minLikes)[0];

      if (match) {
        totalCalculated += match.bonusAmount;
      }
    });

    setViralBonus(totalCalculated);
    showToast(`Đã tính tự động thưởng viral: ${totalCalculated.toLocaleString("vi-VN")} đ`);
  };

  // Thêm link bài viral thủ công
  const handleAddViralLink = async () => {
    const newLink = await promptModal({
      title: "Thêm liên kết viral",
      message: "Nhập đường dẫn (URL) bài viết viral đạt mốc thưởng:",
      placeholder: "https://facebook.com/... hoặc https://threads.net/...",
      confirmText: "Thêm liên kết",
      cancelText: "Hủy",
    });
    if (newLink && newLink.trim()) {
      const trimmed = newLink.trim();
      if (!viralLinks.includes(trimmed)) {
        const updated = [...viralLinks, trimmed];
        setViralLinks(updated);
        const isFb = trimmed.includes("facebook.com") || trimmed.includes("fb.watch");
        setModalViralLikes({
          ...modalViralLikes,
          [trimmed]: {
            likes: 0,
            platform: isFb ? "FACEBOOK" : "THREADS",
            type: "POST",
          },
        });
      }
    }
  };

  // Xóa link bài viral
  const handleRemoveViralLink = (index: number) => {
    const link = viralLinks[index];
    const updated = viralLinks.filter((_, i) => i !== index);
    setViralLinks(updated);
    const updatedLikes = { ...modalViralLikes };
    delete updatedLikes[link];
    setModalViralLikes(updatedLikes);
  };

  // Thêm link bài chưa tốt
  const handleAddBadLink = async () => {
    const newLink = await promptModal({
      title: "Báo cáo bài viết vi phạm / chưa tốt",
      message: "Nhập đường dẫn (URL) bài viết seeding chưa tốt hoặc vi phạm quy chuẩn:",
      placeholder: "https://facebook.com/... hoặc https://threads.net/...",
      confirmText: "Thêm bài vi phạm",
      cancelText: "Hủy",
      type: "danger",
    });
    if (newLink && newLink.trim()) {
      const trimmed = newLink.trim();
      if (!badLinks.includes(trimmed)) {
        setBadLinks([...badLinks, trimmed]);
      }
    }
  };

  const handleRemoveBadLink = (index: number) => {
    setBadLinks(badLinks.filter((_, i) => i !== index));
  };

  // Lưu đánh giá tuần
  const handleSaveEvaluation = async () => {
    if (!evalModalUser) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kpi/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: evalModalUser.user.id,
          weekNumber: selectedWeek,
          year: selectedYear,
          overallRating,
          fbQualityReview,
          threadQualityReview,
          commentQualityReview,
          postCareReview,
          viralBonus,
          viralLinks,
          badLinks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu đánh giá");

      showToast("Đã lưu đánh giá tuần thành công!");
      setEvalModalUser(null);
      fetchKpiData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Cập nhật lượt tương tác (Like) cho bài viết viral trực tiếp từ Bảng Vàng
  const handleUpdateViralLikes = async (post: ViralPostItem) => {
    if (!post.id) {
      showToast("Không tìm thấy mã bài viết viral", "error");
      return;
    }
    const currentLikes = post.likes ?? 500;
    const input = await promptModal({
      title: "Cập nhật lượt tương tác (Like)",
      message: `Nhập số lượt Like thực tế cho bài viết của ${post.authorName}:`,
      defaultValue: String(currentLikes),
      placeholder: "Ví dụ: 1000",
      confirmText: "Lưu thay đổi",
      cancelText: "Hủy",
    });

    if (input !== null && input.trim() !== "") {
      const newLikes = parseInt(input.trim());
      if (isNaN(newLikes) || newLikes < 0) {
        showToast("Số like không hợp lệ (phải là số >= 0)", "error");
        return;
      }

      try {
        const res = await fetch("/api/kpi/viral", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: post.id, likes: newLikes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không thể cập nhật bài viết");

        showToast(`Đã cập nhật bài viết: ${newLikes.toLocaleString("vi-VN")} Like (+${(data.post?.bonusAmount || 0).toLocaleString("vi-VN")} đ)`);
        fetchKpiData();
      } catch (err: any) {
        showToast(err.message, "error");
      }
    }
  };

  // Tổng tiền thưởng các bài viral trong tuần
  const calculatedViralTotal = useMemo(() => {
    return viralPosts.reduce((sum, p) => sum + (p.bonusAmount || 0), 0);
  }, [viralPosts]);

  // Lọc danh sách nhân sự
  const filteredPersonnel = useMemo(() => {
    return personnelList.filter((item) => {
      const matchSearch =
        item.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        item.user.phone.includes(search);

      if (!matchSearch) return false;

      if (ratingFilter === "ALL") return true;
      if (ratingFilter === "UNSAVED") return !item.evaluation.isSaved;
      return item.evaluation.overallRating === ratingFilter;
    });
  }, [personnelList, search, ratingFilter]);

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

      {/* Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="page-title">Tổng Hợp KPI & Đánh Giá Tuần</h1>
          <p className="page-subtitle">
            Đánh giá chất lượng seeding, tỷ lệ hoàn thành KPI và thưởng viral tuần
          </p>
        </div>

        {/* Date Selector & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <WeekPicker
            selectedWeek={selectedWeek}
            selectedYear={selectedYear}
            onWeekChange={(week, year) => {
              setSelectedWeek(week);
              setSelectedYear(year);
            }}
            onCurrentWeekClick={handleCurrentWeek}
            onRefreshClick={fetchKpiData}
            loading={loading}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
              padding: "0.55rem 1rem",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
            onClick={() => setExportModalOpen(true)}
          >
            <FileSpreadsheet size={18} />
            <span>Xuất Excel Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {summary && (
        <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
          {/* Card 1: Ca Đạt / Tổng Ca */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{
                background:
                  summary.shiftPassRate >= 80 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: summary.shiftPassRate >= 80 ? "var(--success)" : "var(--danger)",
              }}
            >
              <Clock size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                <span className="stat-value">{summary.totalPassedShifts}</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  / {summary.totalShifts} ca
                </span>
              </div>
              <div className="stat-label">Ca đạt chuẩn ({summary.shiftPassRate}%)</div>
              <div style={{ marginTop: "0.35rem" }}>
                <span
                  className={`badge ${
                    summary.totalShifts < summary.minRequiredShifts
                      ? "badge-danger"
                      : "badge-success"
                  }`}
                  style={{ fontSize: "0.6875rem" }}
                >
                  {summary.totalShifts < summary.minRequiredShifts
                    ? "Chưa đủ 5 ca"
                    : "Đạt định mức"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Tổng Sản Lượng Bài */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--info)" }}
            >
              <BookOpen size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">
                {(summary.totalFacebook + summary.totalThreads).toLocaleString()}
              </div>
              <div className="stat-label">Tổng bài (FB + Threads)</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                FB: <strong style={{ color: "var(--text-primary)" }}>{summary.totalFacebook}</strong>{" "}
                | Thh:{" "}
                <strong style={{ color: "var(--text-primary)" }}>{summary.totalThreads}</strong> | CMT:{" "}
                <strong style={{ color: "var(--text-primary)" }}>{summary.totalComments}</strong>
              </div>
            </div>
          </div>

          {/* Card 3: KPI Hoàn Thành TB */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(249, 115, 22, 0.15)", color: "var(--primary)" }}
            >
              <TrendingUp size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">{summary.avgCompletionRate}%</div>
              <div className="stat-label">KPI hoàn thành trung bình</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Đã chốt:{" "}
                <strong style={{ color: "var(--text-primary)" }}>{summary.evaluatedCount}</strong> /{" "}
                {summary.totalPersonnel} nhân sự
              </div>
            </div>
          </div>

          {/* Card 4: Thưởng Viral Tuần */}
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: "rgba(234, 179, 8, 0.15)", color: "var(--warning)" }}
            >
              <Gift size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value" style={{ color: "#fbbf24" }}>
                {(summary.totalViralBonus || calculatedViralTotal).toLocaleString("vi-VN")} đ
              </div>
              <div className="stat-label">Tổng thưởng viral tuần</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                }}
              >
                Ghi nhận viral:{" "}
                <strong style={{ color: "var(--text-primary)" }}>{viralPosts.length}</strong> bài
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setActiveTab("PERSONNEL")}
          className={`btn ${activeTab === "PERSONNEL" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Bảng Đánh Giá Nhân Sự ({personnelList.length})
        </button>
        <button
          onClick={() => setActiveTab("VIRAL")}
          className={`btn ${activeTab === "VIRAL" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          <Sparkles size={14} /> Bảng Vàng Bài Viral ({viralPosts.length})
        </button>
      </div>

      {/* Filter & Search Bar */}
      {activeTab === "PERSONNEL" && (
        <div
          className="card"
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
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: "36px" }}
                placeholder="Tìm tên nhân sự, số điện thoại..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <select
              className="select"
              style={{ width: "auto" }}
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="ALL">Tất cả xếp loại</option>
              <option value="UNSAVED">Chưa chốt đánh giá</option>
              <option value="EXCELLENT">Rất tốt</option>
              <option value="GOOD">Tốt</option>
              <option value="FAIR">Khá</option>
              <option value="NEEDS_IMPROVEMENT">Cần cố gắng</option>
              <option value="POOR">Không tốt</option>
            </select>

            <button
              className="btn btn-secondary btn-icon"
              onClick={() => fetchKpiData()}
              title="Làm mới danh sách"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: BẢNG KPI & XẾP HẠNG NHÂN SỰ */}
      {activeTab === "PERSONNEL" && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "50px", textAlign: "center" }}>STT</th>
                <th style={{ minWidth: "200px" }}>Nhân sự</th>
                <th style={{ textAlign: "center" }}>Ca (ĐK/Đạt)</th>
                <th style={{ textAlign: "center" }}>Facebook</th>
                <th style={{ textAlign: "center" }}>Threads</th>
                <th style={{ textAlign: "center" }}>Bình luận (CMT)</th>
                <th style={{ textAlign: "center" }}>Tăng trưởng</th>
                <th style={{ textAlign: "center" }}>Xếp loại</th>
                <th style={{ textAlign: "center" }}>Thưởng viral</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersonnel.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}
                  >
                    Không tìm thấy nhân sự phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredPersonnel.map((item, index) => {
                  const ratingInfo =
                    RATING_CONFIG[item.evaluation.overallRating] || RATING_CONFIG.GOOD;
                  const growthVal = item.kpi.growth.overall;

                  return (
                    <tr key={item.user.id}>
                      {/* STT */}
                      <td
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {index + 1}
                      </td>

                      {/* Nhân sự */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                              color: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                              fontSize: "0.875rem",
                              flexShrink: 0,
                            }}
                          >
                            {item.user.fullName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              {item.user.fullName}
                              {item.kpi.isCustom && (
                                <span
                                  className="badge badge-warning"
                                  style={{ fontSize: "0.625rem", padding: "1px 5px", lineHeight: "1.2" }}
                                  title={`Chỉ tiêu riêng: ${item.kpi.targetsPerShift?.facebook ?? 10} FB, ${item.kpi.targetsPerShift?.threads ?? 4} Threads, ${item.kpi.targetsPerShift?.comments ?? 50} CMT`}
                                >
                                  KPI riêng
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              {item.user.phone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ca làm việc */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.kpi.totalShiftsPassed}
                        </span>{" "}
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          / {item.kpi.totalShifts} ca
                        </span>
                      </td>

                      {/* Facebook */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.kpi.actual.facebook}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {" "}
                          / {item.kpi.targets.facebook}
                        </span>
                      </td>

                      {/* Threads */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.kpi.actual.threads}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {" "}
                          / {item.kpi.targets.threads}
                        </span>
                      </td>

                      {/* Comments */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.kpi.actual.comments}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {" "}
                          / {item.kpi.targets.comments}
                        </span>
                      </td>

                      {/* Tăng trưởng */}
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: growthVal >= 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {growthVal > 0 ? `+${growthVal}%` : `${growthVal}%`}
                        </span>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                          (vs tuần trước)
                        </div>
                      </td>

                      {/* Xếp loại */}
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${ratingInfo.badgeClass}`}>
                          {item.evaluation.isSaved ? ratingInfo.label : "Chưa chốt"}
                        </span>
                      </td>

                      {/* Thưởng Viral */}
                      <td style={{ textAlign: "center" }}>
                        {item.evaluation.viralBonus > 0 ? (
                          <span style={{ fontWeight: 600, color: "#fbbf24" }}>
                            +{item.evaluation.viralBonus.toLocaleString("vi-VN")} đ
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => handleOpenEvaluation(item)}
                          className="btn btn-primary btn-sm"
                        >
                          Đánh Giá
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: BẢNG VÀNG BÀI VIẾT VIRAL */}
      {activeTab === "VIRAL" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              background: "rgba(245, 158, 11, 0.05)",
              borderColor: "rgba(245, 158, 11, 0.2)",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.875rem",
            }}
          >
            <Sparkles
              style={{ color: "var(--warning)", marginTop: "2px", flexShrink: 0 }}
              size={20}
            />
            <div style={{ fontSize: "0.8125rem", width: "100%" }}>
              <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "0.5rem" }}>
                Quy Định Thưởng Bài Viết & Bình Luận Viral:
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "0.5rem",
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  • <strong>Facebook Post:</strong> 500L (50k), 1kL (80k), 3kL (100k), 5kL (200k)
                </div>
                <div>
                  • <strong>Threads Post:</strong> 1kL (50k), 3kL (80k), 5kL (100k), 10kL (200k)
                </div>
                <div>
                  • <strong>Facebook CMT:</strong> 500L (25k), 1kL (50k), 5kL (80k), 10kL (100k)
                </div>
                <div>
                  • <strong>Threads CMT:</strong> 1kL (25k), 5kL (50k), 10kL (80k), 50kL (100k)
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "45px", textAlign: "center" }}>STT</th>
                  <th>Tác giả</th>
                  <th>Ca làm & Giờ nộp</th>
                  <th>Nền tảng & Loại</th>
                  <th style={{ textAlign: "center" }}>Lượng tương tác / Like</th>
                  <th style={{ textAlign: "right" }}>Thưởng Viral</th>
                  <th>Đường dẫn bài viết</th>
                  <th style={{ textAlign: "right", minWidth: "110px" }}>Xem bài</th>
                </tr>
              </thead>
              <tbody>
                {viralPosts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}
                    >
                      Chưa có bài viết nào được ghi nhận Viral (🔥) trong tuần {selectedWeek}.
                    </td>
                  </tr>
                ) : (
                  viralPosts.map((post, index) => {
                    const isFb =
                      post.platform === "FACEBOOK" ||
                      post.link.includes("facebook.com") ||
                      post.link.includes("fb.watch");
                    const shiftInfo = SHIFT_MAP[post.shiftType || ""] || {
                      label: post.shiftType || "Ca Sáng",
                      icon: "☀️",
                      badgeClass: "badge-info",
                    };

                    const formattedDate = post.reportDate
                      ? new Date(post.reportDate).toLocaleDateString("vi-VN")
                      : "";

                    const formattedSubmitted = post.submittedAt
                      ? new Date(post.submittedAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) + " • " + new Date(post.submittedAt).toLocaleDateString("vi-VN")
                      : formattedDate;

                    return (
                      <tr key={post.id || index}>
                        <td
                          style={{
                            textAlign: "center",
                            color: "var(--text-muted)",
                            fontWeight: 500,
                          }}
                        >
                          {index + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {post.authorName}
                          </div>
                          {post.userPhone && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {post.userPhone}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="badge badge-secondary" style={{ fontSize: "0.75rem" }}>
                              {shiftInfo.icon} {shiftInfo.label}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              marginTop: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={12} /> {formattedSubmitted}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
                            <span className={`badge ${isFb ? "badge-info" : "badge-primary"}`}>
                              {isFb ? "Facebook" : "Threads"}
                            </span>
                            <span className="badge badge-secondary" style={{ fontSize: "0.7rem" }}>
                              {post.contentType === "COMMENT" ? "CMT" : "Post"}
                            </span>
                            {post.isFemaleContent && (
                              <span
                                className="badge badge-warning"
                                title="Content hướng nữ"
                              >
                                🌸 Nữ
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateViralLikes(post)}
                            title="Bấm để chỉnh sửa lượt tương tác / Like"
                            className="btn btn-ghost btn-sm"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontWeight: 700,
                              color: "#f59e0b",
                              padding: "4px 9px",
                              borderRadius: "8px",
                              background: "rgba(245, 158, 11, 0.08)",
                              border: "1px dashed rgba(245, 158, 11, 0.35)",
                              cursor: "pointer",
                            }}
                          >
                            <Flame size={14} className="text-orange-400 fill-orange-400" />
                            <span>{(post.likes ?? 0).toLocaleString("vi-VN")} Like</span>
                            <Edit2 size={11} style={{ opacity: 0.7, marginLeft: "2px" }} />
                          </button>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "0.875rem",
                              color: "#10b981",
                              background: "rgba(16, 185, 129, 0.12)",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid rgba(16, 185, 129, 0.25)",
                              display: "inline-block",
                            }}
                          >
                            + {(post.bonusAmount ?? 0).toLocaleString("vi-VN")} đ
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-secondary)",
                              fontFamily: "monospace",
                              display: "block",
                              maxWidth: "300px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={post.link}
                          >
                            {post.link}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <a
                            href={post.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                          >
                            Mở link <ExternalLink size={13} />
                          </a>
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

      {/* MODAL ĐÁNH GIÁ NHÂN SỰ & CHẤM THƯỞNG VIRAL */}
      {evalModalUser && (
        <Modal
          isOpen={!!evalModalUser}
          onClose={() => setEvalModalUser(null)}
          maxWidth="890px"
          closeOnOutsideClick={false}
        >
          {/* Modal Header */}
          <div className="modal-header px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-tr from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                {evalModalUser.user.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="modal-title flex items-center gap-3 text-base font-bold text-[var(--text-primary)] mb-1">
                  <span>Đánh Giá KPI Tuần {selectedWeek}/{selectedYear}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Tuần {selectedWeek}
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <span>Nhân sự: <strong className="text-[var(--text-primary)] font-semibold">{evalModalUser.user.fullName}</strong></span>
                  <span>•</span>
                  <span>SĐT: <span className="font-mono text-[var(--text-secondary)]">{evalModalUser.user.phone}</span></span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEvalModalUser(null)}
              className="btn-icon btn-ghost text-[var(--text-muted)] hover:text-[var(--text-primary)] p-2 rounded-md transition"
              title="Đóng cửa sổ"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-6 space-y-8 text-xs overflow-y-auto">
      
      {/* 1. Thống kê nhanh chỉ tiêu vs thực tế */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
        <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/60 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="text-[var(--text-muted)] text-[11px] font-medium flex items-center gap-1.5 mb-2.5">
            <Clock size={13} className="text-amber-400" />
            <span>Ca hoàn thành</span>
          </div>
          <div className="font-bold text-lg text-[var(--text-primary)] tabular-nums">
            {evalModalUser.kpi.totalShiftsPassed}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">/ {evalModalUser.kpi.totalShifts}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/60 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="text-[var(--text-muted)] text-[11px] font-medium flex items-center gap-1.5 mb-2.5">
            <span className="w-2 h-2 rounded-sm bg-blue-500"></span>
            <span>Facebook</span>
          </div>
          <div className="font-bold text-lg text-blue-400 tabular-nums flex items-baseline justify-center gap-1.5">
            {evalModalUser.kpi.actual.facebook}
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400">
              {evalModalUser.kpi.completionRates.facebook}%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/60 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="text-[var(--text-muted)] text-[11px] font-medium flex items-center gap-1.5 mb-2.5">
            <span className="w-2 h-2 rounded-sm bg-purple-500"></span>
            <span>Threads</span>
          </div>
          <div className="font-bold text-lg text-purple-400 tabular-nums flex items-baseline justify-center gap-1.5">
            {evalModalUser.kpi.actual.threads}
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-purple-500/10 text-purple-400">
              {evalModalUser.kpi.completionRates.threads}%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]/60 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="text-[var(--text-muted)] text-[11px] font-medium flex items-center gap-1.5 mb-2.5">
            <TrendingUp size={13} className={evalModalUser.kpi.growth.overall >= 0 ? "text-emerald-400" : "text-rose-400"} />
            <span>Tăng trưởng</span>
          </div>
          <div className={`font-bold text-lg tabular-nums ${evalModalUser.kpi.growth.overall >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {evalModalUser.kpi.growth.overall > 0 ? `+${evalModalUser.kpi.growth.overall}%` : `${evalModalUser.kpi.growth.overall}%`}
          </div>
        </div>
      </div>

      {/* 2. Xếp loại tuần */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <label className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
            <Award size={17} className="text-amber-400" />
            <span>Xếp Loại Đánh Giá Chung:</span>
          </label>
          <span className="text-xs text-[var(--text-muted)]">
            Chọn mức xếp loại đánh giá phù hợp cho tuần làm việc
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(RATING_CONFIG).map(([key, info]) => {
            const isSelected = overallRating === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOverallRating(key)}
                className={`py-3 px-3 rounded-lg text-center font-bold text-xs transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                  isSelected
                    ? `${info.bgClass} text-white shadow-md border-transparent ring-1 ring-white/30 scale-[1.02]`
                    : "bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-white" : info.bgClass}`}></span>
                <span>{info.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Nhận xét chất lượng 4 tiêu chí */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-sm">
            <MessageSquare size={17} className="text-sky-400" />
            <span>Nhận Xét Đánh Giá Chất Lượng:</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">Nhập góp ý chi tiết theo từng khía cạnh</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-card)] rounded-lg flex flex-col gap-2 shadow-sm transition-colors focus-within:border-blue-500/60">
            <label className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0"></span>
              <span>Chất lượng bài viết Facebook:</span>
            </label>
            <textarea
              rows={3}
              value={fbQualityReview}
              onChange={(e) => setFbQualityReview(e.target.value)}
              placeholder="VD: Đúng form mẫu, hình ảnh nét, chọn group tương tác tốt..."
              className="input text-[13px] leading-loose resize-y py-3 px-3 bg-transparent border-t border-[var(--border-color)]/30 rounded-none focus:outline-none focus:ring-0"
            />
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-lg flex flex-col gap-2 shadow-sm transition-colors focus-within:border-purple-500/60">
            <label className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shrink-0"></span>
              <span>Chất lượng bài viết Threads:</span>
            </label>
            <textarea
              rows={3}
              value={threadQualityReview}
              onChange={(e) => setThreadQualityReview(e.target.value)}
              placeholder="VD: Câu hook thu hút, hình ảnh rõ nét, đúng chủ đề thảo luận..."
              className="input text-[13px] leading-loose resize-y py-3 px-3 bg-transparent border-t border-[var(--border-color)]/30 rounded-none focus:outline-none focus:ring-0"
            />
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-lg flex flex-col gap-2 shadow-sm transition-colors focus-within:border-amber-500/60">
            <label className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0"></span>
              <span>Chất lượng Bình luận (Comments):</span>
            </label>
            <textarea
              rows={3}
              value={commentQualityReview}
              onChange={(e) => setCommentQualityReview(e.target.value)}
              placeholder="VD: Đạt chỉ tiêu bình luận, phản hồi có tâm, không spam lặp từ..."
              className="input text-[13px] leading-loose resize-y py-3 px-3 bg-transparent border-t border-[var(--border-color)]/30 rounded-none focus:outline-none focus:ring-0"
            />
          </div>

          <div className="p-4 bg-[var(--bg-card)] rounded-lg flex flex-col gap-2 shadow-sm transition-colors focus-within:border-emerald-500/60">
            <label className="font-semibold text-[13px] text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0"></span>
              <span>Chăm sóc bài viết & Trả lời:</span>
            </label>
            <textarea
              rows={3}
              value={postCareReview}
              onChange={(e) => setPostCareReview(e.target.value)}
              placeholder="VD: Trả lời comment kịp thời, giữ nhiệt tương tác chu đáo..."
              className="input text-[13px] leading-loose resize-y py-3 px-3 bg-transparent border-t border-[var(--border-color)]/30 rounded-none focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* 4. Quản lý bài viết Viral & Tự động tính tiền thưởng */}
      <div className="p-5 bg-gradient-to-b from-amber-500/[0.06] to-amber-500/[0.02] rounded-lg border border-amber-500/30 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-bold text-amber-300 flex items-center gap-2 text-[13px] mb-1">
              <Flame size={17} className="text-orange-400 fill-orange-400" />
              <span>Chấm Thưởng Bài Viết Viral</span>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                {viralLinks.length} bài
              </span>
            </div>
            <p className="text-[11.5px] text-amber-200/70">
              Hệ thống tự động đối chiếu số like bài viết với các bậc thưởng đã cấu hình
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddViralLink}
            className="btn btn-sm text-orange-300 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 flex items-center gap-1.5 text-xs py-2 px-4 rounded-lg transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus size={14} /> <span>Thêm link bài</span>
          </button>
        </div>

        {viralLinks.length === 0 ? (
          <div className="p-5 text-center rounded-lg bg-[var(--bg-card)]/60 border border-dashed border-amber-500/30 text-[var(--text-muted)] italic text-xs mb-2">
            Nhân sự chưa có bài viết viral nào được ghi nhận trong tuần này.
          </div>
        ) : (
          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-2 mb-2">
            {viralLinks.map((link, idx) => {
              const postMeta = modalViralLikes[link] || {
                likes: 0,
                platform: link.includes("facebook.com") ? "FACEBOOK" : "THREADS",
                type: "POST",
              };

              const matchedTier = viralTiers
                .filter(
                  (t) =>
                    t.platform === postMeta.platform &&
                    t.contentType === postMeta.type &&
                    postMeta.likes >= t.minLikes
                )
                .sort((a, b) => b.minLikes - a.minLikes)[0];

              return (
                <div
                  key={idx}
                  className="bg-[var(--bg-card)] p-4 rounded-lg border border-amber-500/30 flex flex-col gap-3.5 shadow-sm transition-all hover:border-amber-500/50"
                >
                  {/* Hàng 1: Thứ tự, URL, Link ngoài và Nút Xoá */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="px-2 py-0.5 rounded text-amber-300 bg-amber-500/10 font-bold text-[11px] shrink-0 border border-amber-500/20">
                        #{idx + 1}
                      </span>
                      <span
                        className="text-[12px] text-[var(--text-muted)] truncate font-mono flex-1 min-w-0"
                        title={link}
                      >
                        {link}
                      </span>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11.5px] font-medium shrink-0 ml-2 transition"
                      >
                        <span>Mở link</span> <ExternalLink size={13} />
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveViralLink(idx)}
                      className="btn-icon btn-ghost text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0 p-1.5 rounded-md transition"
                      title="Xóa bài viết này"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Hàng 2: Controls phân bố thông thoáng */}
                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[var(--border-color)]/60">
                    {/* Nền tảng */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-[var(--text-muted)] font-medium">Nền tảng:</span>
                      <select
                        value={postMeta.platform}
                        onChange={(e) => {
                          setModalViralLikes({
                            ...modalViralLikes,
                            [link]: {
                              ...postMeta,
                              platform: e.target.value as "FACEBOOK" | "THREADS",
                            },
                          });
                        }}
                        className="select h-9 py-0 pl-3 pr-8 text-xs rounded-md"
                        style={{ width: "120px" }}
                      >
                        <option value="FACEBOOK">Facebook</option>
                        <option value="THREADS">Threads</option>
                      </select>
                    </div>

                    {/* Loại */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-[var(--text-muted)] font-medium">Phân loại:</span>
                      <select
                        value={postMeta.type}
                        onChange={(e) => {
                          setModalViralLikes({
                            ...modalViralLikes,
                            [link]: {
                              ...postMeta,
                              type: e.target.value as "POST" | "COMMENT",
                            },
                          });
                        }}
                        className="select h-9 py-0 pl-3 pr-8 text-xs rounded-md"
                        style={{ width: "115px" }}
                      >
                        <option value="POST">Bài viết</option>
                        <option value="COMMENT">Bình luận</option>
                      </select>
                    </div>

                    {/* Nhập Likes */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-[var(--text-muted)] font-medium">Số Like:</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={postMeta.likes || ""}
                        onChange={(e) => {
                          setModalViralLikes({
                            ...modalViralLikes,
                            [link]: {
                              ...postMeta,
                              likes: parseInt(e.target.value) || 0,
                            },
                          });
                        }}
                        className="input h-9 py-0 px-3 text-center font-bold text-[13px] rounded-md"
                        style={{ width: "90px" }}
                      />
                    </div>

                    {/* Thưởng dự kiến cho bài */}
                    {matchedTier && (
                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11.5px]">
                        <Sparkles size={14} className="text-emerald-400" />
                        <span>+ {matchedTier.bonusAmount.toLocaleString("vi-VN")} đ</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tính thưởng & Nhập tiền thưởng */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-amber-500/25 bg-[var(--bg-card)]/70 p-4 rounded-lg border border-amber-500/20">
          <button
            type="button"
            onClick={handleCalculateViralBonus}
            className="btn btn-sm text-white font-bold transition shadow-sm hover:brightness-110 active:scale-95 flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none" }}
          >
            <Calculator size={15} />
            <span>Tự động tính tiền theo bậc</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="font-semibold text-[13px] text-amber-200">Tổng tiền thưởng viral:</span>
            <input
              type="number"
              value={viralBonus}
              onChange={(e) => setViralBonus(Number(e.target.value))}
              className="input h-10 font-extrabold text-amber-300 text-right text-sm rounded-md"
              style={{ width: "140px", background: "rgba(0,0,0,0.3)" }}
            />
            <span className="font-bold text-[13px] text-amber-400">VNĐ</span>
          </div>
        </div>
      </div>

      {/* 5. Danh sách bài viết chưa tốt (Bad links) */}
      <div className="p-5 bg-gradient-to-b from-rose-500/[0.05] to-rose-500/[0.01] rounded-lg border border-rose-500/25 space-y-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="font-bold text-[var(--text-primary)] text-[13px] flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400" />
            <span>Bài Viết Chưa Tốt / Cần Khắc Phục</span>
            <span className="px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-bold text-[11px] border border-rose-500/30">
              {badLinks.length}
            </span>
          </label>
          <button
            type="button"
            onClick={handleAddBadLink}
            className="btn btn-sm text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus size={14} /> <span>Thêm link</span>
          </button>
        </div>

        {badLinks.length === 0 ? (
          <p className="text-[var(--text-muted)] italic text-xs py-2">
            Không có bài viết vi phạm hay chưa tốt trong tuần này.
          </p>
        ) : (
          <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
            {badLinks.map((link, idx) => (
              <div
                key={idx}
                className="bg-[var(--bg-card)] px-4 py-3 rounded-lg border border-rose-500/25 flex items-center justify-between gap-3 shadow-sm hover:border-rose-500/40 transition"
              >
                <span className="text-rose-300 truncate font-mono text-[12px]" title={link}>
                  {link}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveBadLink(idx)}
                  className="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-500/10 rounded-md transition"
                  title="Xóa link này"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Modal Footer */}
    <div className="modal-footer px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-b-lg flex items-center justify-end gap-4">
      <button
        type="button"
        onClick={() => setEvalModalUser(null)}
        className="btn btn-secondary px-6 py-2.5 text-[13px] font-semibold rounded-lg cursor-pointer"
      >
        Hủy bỏ
      </button>
      <button
        type="button"
        onClick={handleSaveEvaluation}
        disabled={saving}
        className="btn btn-primary px-6 py-2.5 text-[13px] font-bold rounded-lg flex items-center gap-2 shadow-sm cursor-pointer"
      >
        <Save size={16} />
        <span>{saving ? "Đang lưu..." : "Lưu Đánh Giá Tuần"}</span>
      </button>
    </div>
  </Modal>
      )}

      {/* Modal Xuất Báo Cáo Excel (Phương án B) */}
      {exportModalOpen && (
        <Modal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          title="Xuất Báo Cáo Tổng Hợp KPI & Đánh Giá"
        >
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>
              Xuất file Excel theo chuẩn biểu mẫu Freetrip. Tự động tách thành 2 file riêng biệt cho <strong>Báo Cáo Tuần</strong> hoặc <strong>Báo Cáo Tháng</strong>.
            </p>

            {/* Type selector tabs */}
            <div style={{ display: "flex", gap: "0.5rem", background: "var(--bg-secondary)", padding: "0.25rem", borderRadius: "0.5rem" }}>
              <button
                type="button"
                className={`btn ${exportType === "WEEK" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1, padding: "0.5rem", borderRadius: "0.375rem", fontWeight: 600, fontSize: "0.875rem" }}
                onClick={() => setExportType("WEEK")}
              >
                📑 Báo Cáo Tuần
              </button>
              <button
                type="button"
                className={`btn ${exportType === "MONTH" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1, padding: "0.5rem", borderRadius: "0.375rem", fontWeight: 600, fontSize: "0.875rem" }}
                onClick={() => setExportType("MONTH")}
              >
                📅 Báo Cáo Tháng
              </button>
            </div>

            {/* Content for WEEK */}
            {exportType === "WEEK" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                        Tuần số:
                      </label>
                      {exportWeekRangeText.fullWeek && (
                        <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>
                          ({exportWeekRangeText.fullWeek})
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={53}
                      className="input"
                      value={exportWeek}
                      onChange={(e) => setExportWeek(parseInt(e.target.value) || 1)}
                    />
                    {exportWeekRangeText.fullWeek && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "0.35rem" }}>
                        📅 Từ <strong style={{ color: "var(--text-primary)" }}>{exportWeekRangeText.fullWeek.split(" - ")[0]}/{exportYear}</strong> đến <strong style={{ color: "var(--text-primary)" }}>{exportWeekRangeText.fullWeek.split(" - ")[1]}/{exportYear}</strong>
                      </span>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                      Năm:
                    </label>
                    <input
                      type="number"
                      min={2020}
                      max={2035}
                      className="input"
                      value={exportYear}
                      onChange={(e) => setExportYear(parseInt(e.target.value) || 2026)}
                    />
                  </div>
                </div>

                {/* Option: Split by month boundary */}
                <div
                  style={{
                    padding: "0.875rem",
                    background: "rgba(59, 130, 246, 0.06)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    borderRadius: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={exportSplitByMonth}
                      onChange={(e) => setExportSplitByMonth(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                    />
                    <span>Cắt tuần theo ranh giới tháng (Xử lý tuần giao thoa)</span>
                  </label>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, paddingLeft: "1.5rem" }}>
                    Tự động giới hạn ngày trong tuần không vượt quá ranh giới tháng (Ví dụ: tuần 40 chỉ tính các ngày 28/09–30/09 thuộc Tháng 9).
                  </p>

                  {exportSplitByMonth && (
                    <div style={{ paddingLeft: "1.5rem", marginTop: "0.35rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                          Thuộc tháng:
                        </label>
                        <select
                          className="select"
                          value={exportMonth}
                          onChange={(e) => setExportMonth(parseInt(e.target.value))}
                          style={{ width: "auto", minWidth: "140px" }}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m} style={{ backgroundColor: "#151928", color: "#f8fafc" }}>
                              Tháng {m < 10 ? `0${m}` : m}
                            </option>
                          ))}
                        </select>
                      </div>
                      {exportWeekRangeText.actualPeriod !== exportWeekRangeText.fullWeek && (
                        <div style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 500 }}>
                          ⚡ Khoảng ngày thực tế sau khi cắt tháng: <strong>{exportWeekRangeText.actualPeriod}/{exportYear}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Option: Cut-off date */}
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                    Ngày chốt sớm (Tùy chọn - Cut-off date):
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={exportCutOffDate}
                    onChange={(e) => setExportCutOffDate(e.target.value)}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "0.25rem" }}>
                    Để trống nếu tính hết tuần. Chọn ngày nếu cần làm báo cáo sớm trước 1–2 ngày.
                  </span>
                </div>
              </div>
            )}

            {/* Content for MONTH */}
            {exportType === "MONTH" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                      Tháng:
                    </label>
                    <select
                      className="select"
                      value={exportMonth}
                      onChange={(e) => setExportMonth(parseInt(e.target.value))}
                      style={{ width: "100%" }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m} style={{ backgroundColor: "#151928", color: "#f8fafc" }}>
                          Tháng {m < 10 ? `0${m}` : m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                      Năm:
                    </label>
                    <input
                      type="number"
                      min={2020}
                      max={2035}
                      className="input"
                      value={exportYear}
                      onChange={(e) => setExportYear(parseInt(e.target.value) || 2026)}
                    />
                  </div>
                </div>

                {/* Option: Cut-off date for Month */}
                <div
                  style={{
                    padding: "0.875rem",
                    background: "rgba(245, 158, 11, 0.06)",
                    border: "1px solid rgba(245, 158, 11, 0.2)",
                    borderRadius: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block" }}>
                    Chốt số liệu sớm trước cuối tháng (Cut-off date):
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={exportCutOffDate}
                    onChange={(e) => setExportCutOffDate(e.target.value)}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    💡 <em>Ví dụ: Chọn ngày 29/{exportMonth < 10 ? `0${exportMonth}` : exportMonth} nếu cần làm báo cáo sớm để sáng mùng 1 đầu tháng xuất nộp ngay.</em>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-b-lg flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setExportModalOpen(false)}
              className="btn btn-secondary px-5 py-2 text-[13px] font-semibold rounded-lg cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleExportSubmit}
              disabled={exporting}
              className="btn btn-primary px-5 py-2 text-[13px] font-bold rounded-lg flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {exporting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Đang tạo file Excel...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Tải Báo Cáo {exportType === "WEEK" ? "Tuần" : "Tháng"} (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
