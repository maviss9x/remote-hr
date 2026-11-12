"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  FileUp,
  Download,
  Users,
  Calendar,
  FileSpreadsheet,
  Flame,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Eye,
  Sliders,
  Settings,
  ShieldAlert,
  Info,
  Check,
  Package,
  Database,
  HardDriveDownload,
  FileText,
  Award,
  CheckSquare,
  Square,
} from "lucide-react";

type PageTab = "json-all-in-one" | "nhan-su" | "ca-lam-viec" | "bao-cao-seeding" | "thuong-viral" | "backup" | "reset";

const BACKUP_CATEGORIES = [
  { id: "users", label: "Hồ sơ nhân sự", desc: "Thông tin cá nhân, chức vụ, ngân hàng, CCCD (loại trừ mật khẩu)", icon: Users, statKey: "users" },
  { id: "contracts", label: "Hợp đồng nhân sự", desc: "Hợp đồng khoán việc, thời hạn bắt đầu/kết thúc", icon: FileText, statKey: "contracts" },
  { id: "shifts", label: "Ca làm việc & Chấm công", desc: "Đăng ký ca, hình thức Online/Offline, giờ vào/ra, tính trễ", icon: Calendar, statKey: "shifts" },
  { id: "reports", label: "Báo cáo Seeding", desc: "Danh sách link FB, Threads, Google Drive comment, bài nữ", icon: FileSpreadsheet, statKey: "dailyReports" },
  { id: "qcs", label: "Đánh giá kiểm định QC", desc: "Trạng thái duyệt, số link đạt chuẩn, phản hồi vi phạm của QC", icon: CheckCircle2, statKey: "qcReviews" },
  { id: "evaluations", label: "Đánh giá tuần", desc: "Tổng ca đạt, tỷ lệ hoàn thành KPI, xếp loại và thưởng viral", icon: Award, statKey: "weeklyEvaluations" },
  { id: "acceptances", label: "Nghiệm thu tháng", desc: "Số lượng bài, số gói nghiệm thu hoàn thành, thưởng tháng", icon: Check, statKey: "monthlyAcceptances" },
  { id: "virals", label: "Bài viết Viral & Thưởng", desc: "Link bài viral, nền tảng, lượt like và số tiền thưởng tương ứng", icon: Flame, statKey: "viralPosts" },
  { id: "configs", label: "Cấu hình & Cài đặt hệ thống", desc: "Chỉ tiêu KPI, cấu hình ca, khung thưởng viral, cài đặt chung", icon: Sliders, statKey: "configs" },
];

interface PreviewResult {
  success: boolean;
  type: string;
  sheetNames: string[];
  selectedSheet: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  stats?: {
    totalPersonnel: number;
    totalShifts: number;
    totalReports: number;
    totalViralPosts: number;
    totalAcceptances: number;
  };
  previewRows: any[];
  errors: Array<{ row: number; message: string; details?: string }>;
  parsedData: any[];
}

interface ExecuteResult {
  success: boolean;
  type: string;
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
  details?: {
    shiftsCreated: number;
    reportsCreated: number;
    viralCreated: number;
    acceptancesCreated: number;
  };
}

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("json-all-in-one");

  // Step state for tabs: 1 = Upload, 2 = Preview, 3 = Result
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options
  const [mode, setMode] = useState<"UPSERT" | "SKIP">("UPSERT");
  const [defaultPassword, setDefaultPassword] = useState("123456");
  const [createContracts, setCreateContracts] = useState(true);
  const [autoCreateWeeks, setAutoCreateWeeks] = useState(true);

  // Progress & results
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);

  // Reset tab state
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{
    message: string;
    remainingManagers: any[];
  } | null>(null);

  // Backup tab state
  const [backupSelectedTypes, setBackupSelectedTypes] = useState<string[]>(
    BACKUP_CATEGORIES.map((c) => c.id)
  );
  const [backupFormat, setBackupFormat] = useState<"xlsx" | "json">("xlsx");
  const [backupStats, setBackupStats] = useState<Record<string, number> | null>(null);
  const [loadingBackupStats, setLoadingBackupStats] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  // Toast / notification
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showAlert = (message: string, type: "success" | "error" = "success") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchBackupStats = async () => {
    try {
      setLoadingBackupStats(true);
      const res = await fetch("/api/admin/backup/stats");
      const data = await res.json();
      if (data.success && data.stats) {
        setBackupStats(data.stats);
      }
    } catch (err) {
      console.error("Lỗi tải thống kê dữ liệu sao lưu:", err);
    } finally {
      setLoadingBackupStats(false);
    }
  };

  // Reset file and steps when changing tab
  const handleTabChange = (tab: PageTab) => {
    setActiveTab(tab);
    setCurrentStep(1);
    setSelectedFile(null);
    setSheetName("");
    setAvailableSheets([]);
    setPreviewData(null);
    setExecuteResult(null);
    setResetResult(null);
    setResetConfirmText("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (tab === "backup") {
      fetchBackupStats();
    }
  };

  const handleToggleBackupType = (id: string) => {
    setBackupSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllBackup = () => {
    if (backupSelectedTypes.length === BACKUP_CATEGORIES.length) {
      setBackupSelectedTypes([]);
    } else {
      setBackupSelectedTypes(BACKUP_CATEGORIES.map((c) => c.id));
    }
  };

  const handleDownloadBackup = async () => {
    if (backupSelectedTypes.length === 0) {
      showAlert("Vui lòng chọn ít nhất 1 loại dữ liệu cần sao lưu.", "error");
      return;
    }

    try {
      setDownloadingBackup(true);
      const isAll = backupSelectedTypes.length === BACKUP_CATEGORIES.length;
      const typesParam = isAll ? "all" : backupSelectedTypes.join(",");
      const url = `/api/admin/backup?types=${typesParam}&format=${backupFormat}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Không thể tạo bản sao lưu.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = `backup_freetrip_hr_${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}.${backupFormat}`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();

      showAlert(`Sao lưu thành công! Đã tải tệp ${filename}`, "success");
    } catch (err: any) {
      showAlert(err.message || "Lỗi khi tải bản sao lưu", "error");
    } finally {
      setDownloadingBackup(false);
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
      setExecuteResult(null);
    }
  };

  // Step 1 -> 2: Dry Run Preview
  const handleRunPreview = async () => {
    if (!selectedFile) {
      showAlert(
        activeTab === "json-all-in-one"
          ? "Vui lòng chọn một tệp JSON để tải lên."
          : "Vui lòng chọn một tệp Excel hoặc CSV để tải lên.",
        "error"
      );
      return;
    }

    try {
      setLoadingPreview(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", activeTab);
      if (sheetName) formData.append("sheetName", sheetName);

      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Lỗi khi kiểm tra dữ liệu.");
      }

      setPreviewData(data);
      setAvailableSheets(data.sheetNames || []);
      setSheetName(data.selectedSheet || "");
      setCurrentStep(2);
      showAlert(
        activeTab === "json-all-in-one"
          ? `Đã phân tích gói JSON: ${data.validCount} nhân sự hợp lệ, ${data.stats?.totalShifts || 0} ca làm, ${data.stats?.totalReports || 0} báo cáo.`
          : `Đã phân tích ${data.totalRows} dòng: ${data.validCount} dòng hợp lệ, ${data.errorCount} lỗi.`,
        "success"
      );
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Step 2 -> 3: Execute Import
  const handleExecuteImport = async () => {
    if (!previewData || !previewData.parsedData || previewData.parsedData.length === 0) {
      showAlert("Không có dữ liệu hợp lệ nào để nạp vào hệ thống.", "error");
      return;
    }

    try {
      setExecuting(true);
      const res = await fetch("/api/admin/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          items: previewData.parsedData,
          options: {
            mode,
            defaultPassword,
            createContracts,
            autoCreateWeeks,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Quá trình import thất bại.");
      }

      setExecuteResult(data);
      setCurrentStep(3);
      showAlert(
        `Nạp dữ liệu hoàn tất: Tạo mới ${data.createdCount}, Cập nhật ${data.updatedCount}.`,
        "success"
      );
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setExecuting(false);
    }
  };

  // Handle Reset Database
  const handleExecuteReset = async () => {
    if (resetConfirmText !== "XAC NHAN XOA") {
      showAlert('Vui lòng nhập chính xác "XAC NHAN XOA" để tiếp tục.', "error");
      return;
    }

    if (!confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ dữ liệu nghiệp vụ thử nghiệm không? Thao tác này không thể hoàn tác!")) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch("/api/admin/import/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationText: resetConfirmText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Lỗi dọn dẹp dữ liệu.");
      }

      setResetResult(data);
      setResetConfirmText("");
      showAlert("Đã dọn dẹp dữ liệu thử nghiệm thành công! Tài khoản quản lý được bảo toàn.", "success");
    } catch (err: any) {
      showAlert(err.message, "error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Toast Alert */}
      {alert && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "0.875rem 1.25rem",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)",
            background: alert.type === "success" ? "#10b981" : "#ef4444",
            color: "#ffffff",
          }}
        >
          {alert.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.35rem" }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Trung tâm Dữ liệu Quản trị
            </h1>
            <span
              className="badge"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontWeight: 700,
                fontSize: "0.75rem",
              }}
            >
              SUPER_ADMIN
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>
            Khởi tạo & đồng bộ dữ liệu (Excel/JSON), sao lưu an toàn (Backup) và quản lý dữ liệu hệ thống Freetrip
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/admin" className="btn btn-secondary" style={{ gap: "0.5rem" }}>
            <Settings size={16} />
            <span>Cài đặt hệ thống</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="card"
        style={{
          padding: "0.5rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => handleTabChange("json-all-in-one")}
          className={`btn btn-sm ${activeTab === "json-all-in-one" ? "btn-primary" : "btn-secondary"}`}
          style={{
            gap: "0.5rem",
            background: activeTab === "json-all-in-one" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : undefined,
            color: activeTab === "json-all-in-one" ? "#ffffff" : undefined,
          }}
        >
          <Package size={16} />
          <span>📦 Gói JSON Trọn gói (All-in-One)</span>
        </button>

        <button
          onClick={() => handleTabChange("nhan-su")}
          className={`btn btn-sm ${activeTab === "nhan-su" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Users size={16} />
          <span>1. Hồ sơ nhân sự</span>
        </button>

        <button
          onClick={() => handleTabChange("ca-lam-viec")}
          className={`btn btn-sm ${activeTab === "ca-lam-viec" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Calendar size={16} />
          <span>2. Ca làm việc & Chấm công</span>
        </button>

        <button
          onClick={() => handleTabChange("bao-cao-seeding")}
          className={`btn btn-sm ${activeTab === "bao-cao-seeding" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <FileSpreadsheet size={16} />
          <span>3. Báo cáo Seeding & QC</span>
        </button>

        <button
          onClick={() => handleTabChange("thuong-viral")}
          className={`btn btn-sm ${activeTab === "thuong-viral" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Flame size={16} />
          <span>4. Thưởng Viral</span>
        </button>

        <button
          onClick={() => handleTabChange("backup")}
          className={`btn btn-sm ${activeTab === "backup" ? "btn-primary" : "btn-secondary"}`}
          style={{
            gap: "0.5rem",
            background: activeTab === "backup" ? "linear-gradient(135deg, #059669, #10b981)" : undefined,
            color: activeTab === "backup" ? "#ffffff" : "#10b981",
            borderColor: activeTab === "backup" ? undefined : "rgba(16, 185, 129, 0.4)",
          }}
        >
          <HardDriveDownload size={16} />
          <span>💾 Sao lưu dữ liệu (Backup)</span>
        </button>

        <button
          onClick={() => handleTabChange("reset")}
          className={`btn btn-sm ${activeTab === "reset" ? "btn-primary" : "btn-secondary"}`}
          style={{
            gap: "0.5rem",
            marginLeft: "auto",
            color: activeTab === "reset" ? "#ffffff" : "#ef4444",
            borderColor: "rgba(239, 68, 68, 0.3)",
          }}
        >
          <Trash2 size={16} />
          <span>Dọn dẹp dữ liệu (Reset)</span>
        </button>
      </div>

      {/* ==============================================================
          MAIN CONTENT FOR TABS (WIZARD PIPELINE)
      ============================================================== */}
      {activeTab !== "reset" && activeTab !== "backup" && (
        <div>
          {/* Stepper Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem",
              marginBottom: "1.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: currentStep >= 1 ? "var(--primary)" : "var(--text-muted)",
                fontWeight: currentStep === 1 ? 700 : 500,
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: currentStep >= 1 ? "var(--primary)" : "var(--bg-surface)",
                  color: currentStep >= 1 ? "#ffffff" : "var(--text-muted)",
                  fontSize: "0.8125rem",
                }}
              >
                1
              </div>
              <span>Tải tệp & Tùy chọn</span>
            </div>

            <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: currentStep >= 2 ? "var(--primary)" : "var(--text-muted)",
                fontWeight: currentStep === 2 ? 700 : 500,
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: currentStep >= 2 ? "var(--primary)" : "var(--bg-surface)",
                  color: currentStep >= 2 ? "#ffffff" : "var(--text-muted)",
                  fontSize: "0.8125rem",
                }}
              >
                2
              </div>
              <span>Kiểm tra & Xem trước</span>
            </div>

            <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: currentStep >= 3 ? "var(--primary)" : "var(--text-muted)",
                fontWeight: currentStep === 3 ? 700 : 500,
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: currentStep >= 3 ? "var(--primary)" : "var(--bg-surface)",
                  color: currentStep >= 3 ? "#ffffff" : "var(--text-muted)",
                  fontSize: "0.8125rem",
                }}
              >
                3
              </div>
              <span>Thực thi & Kết quả</span>
            </div>
          </div>

          {/* ==============================================================
              STEP 1: UPLOAD & CONFIGURATION
          ============================================================== */}
          {currentStep === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }}>
              {/* Left Column: Dropzone */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, margin: 0 }}>
                    1. Chọn tệp {activeTab === "json-all-in-one" ? "JSON Trọn gói" : "Excel / CSV"}
                  </h3>
                  <a
                    href={`/api/admin/import/template?type=${activeTab}`}
                    download
                    className="btn btn-secondary btn-sm"
                    style={{ gap: "0.35rem", fontSize: "0.75rem" }}
                  >
                    <Download size={14} />
                    <span>
                      {activeTab === "json-all-in-one" ? "Tải mẫu JSON chuẩn (.json)" : "Tải mẫu chuẩn (.xlsx)"}
                    </span>
                  </a>
                </div>

                {/* Dropzone Container */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--border-color)",
                    borderRadius: "12px",
                    padding: "2.5rem 1.5rem",
                    textAlign: "center",
                    cursor: "pointer",
                    background: selectedFile ? "rgba(16, 185, 129, 0.05)" : "var(--bg-surface)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={activeTab === "json-all-in-one" ? ".json" : ".xlsx, .xls, .csv"}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />

                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: selectedFile ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)",
                      color: selectedFile ? "#10b981" : "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 1rem auto",
                    }}
                  >
                    {selectedFile ? (
                      <Check size={28} />
                    ) : activeTab === "json-all-in-one" ? (
                      <Package size={28} />
                    ) : (
                      <FileUp size={28} />
                    )}
                  </div>

                  {selectedFile ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB — Nhấp để đổi tệp khác
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>
                        {activeTab === "json-all-in-one"
                          ? "Nhấp vào đây hoặc kéo thả tệp .JSON All-In-One vào vùng này"
                          : "Nhấp vào đây hoặc kéo thả tệp Excel vào vùng này"}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                        {activeTab === "json-all-in-one"
                          ? "Hỗ trợ định dạng .json chứa mảng nhân sự & toàn bộ quan hệ (Tối đa 50MB)"
                          : "Hỗ trợ định dạng .xlsx, .xls, .csv (Tối đa 50MB)"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sheet Selector if multiple sheets exist (Excel only) */}
                {availableSheets.length > 1 && (
                  <div style={{ marginTop: "1rem" }}>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                      Chọn trang tính (Sheet):
                    </label>
                    <select
                      className="select"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                    >
                      {availableSheets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Submit Action */}
                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleRunPreview}
                    disabled={!selectedFile || loadingPreview}
                    className="btn btn-primary"
                    style={{ gap: "0.5rem", minWidth: "180px" }}
                  >
                    {loadingPreview ? (
                      <>
                        <RefreshCw size={16} className="spin" />
                        <span>Đang phân tích...</span>
                      </>
                    ) : (
                      <>
                        <Eye size={16} />
                        <span>Kiểm tra dữ liệu (Dry Run)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Options & Guide */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="card" style={{ padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Sliders size={16} />
                    <span>Tùy chọn xử lý dữ liệu</span>
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    <div>
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                        Chế độ khi trùng lặp (Duplicate Handling):
                      </label>
                      <select
                        className="select"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as "UPSERT" | "SKIP")}
                      >
                        <option value="UPSERT">Cập nhật (Ghi đè thông tin mới)</option>
                        <option value="SKIP">Bỏ qua (Giữ nguyên bản ghi cũ)</option>
                      </select>
                    </div>

                    {(activeTab === "nhan-su" || activeTab === "json-all-in-one") && (
                      <>
                        <div>
                          <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                            Mật khẩu mặc định cho nhân sự mới:
                          </label>
                          <input
                            type="text"
                            className="input"
                            value={defaultPassword}
                            onChange={(e) => setDefaultPassword(e.target.value)}
                            placeholder="Mặc định: 123456"
                          />
                        </div>

                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={createContracts}
                            onChange={(e) => setCreateContracts(e.target.checked)}
                          />
                          <span>Tự động tạo Hợp đồng lao động nếu chưa có</span>
                        </label>
                      </>
                    )}

                    {(activeTab === "ca-lam-viec" || activeTab === "json-all-in-one") && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={autoCreateWeeks}
                          onChange={(e) => setAutoCreateWeeks(e.target.checked)}
                        />
                        <span>Tự động kích hoạt cấu hình mở tuần làm việc cho các ca</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: "1.25rem", background: "rgba(99, 102, 241, 0.04)" }}>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Info size={16} />
                    <span>
                      {activeTab === "json-all-in-one" ? "Ưu điểm Gói JSON All-In-One" : "Lưu ý kỹ thuật"}
                    </span>
                  </h4>
                  <ul style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", paddingLeft: "1.2rem", margin: 0, lineHeight: 1.6 }}>
                    {activeTab === "json-all-in-one" ? (
                      <>
                        <li><strong>Trọn gói 1 lần:</strong> Tự động liên kết User -&gt; Hợp đồng -&gt; Ca làm việc -&gt; Báo cáo Seeding -&gt; Duyệt QC -&gt; Thưởng Viral.</li>
                        <li><strong>Không lo sai lệch:</strong> Tránh tình trạng lệch số điện thoại giữa các file Excel rời rạc.</li>
                        <li><strong>An toàn:</strong> Tự động tính toán mã khóa ngoại và xử lý trong transaction an toàn.</li>
                      </>
                    ) : (
                      <>
                        <li><strong>Định danh nhân sự:</strong> Khi nạp ca làm hoặc báo cáo, hệ thống sẽ tự động tìm nhân sự theo SĐT, Email hoặc Tên.</li>
                        <li><strong>Thứ tự khuyến nghị:</strong> Nên nạp <em>1. Hồ sơ nhân sự</em> trước khi nạp Ca làm việc hoặc Báo cáo seeding.</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 2: PREVIEW & VALIDATION
          ============================================================== */}
          {currentStep === 2 && previewData && (
            <div>
              {/* Stats Bar */}
              {activeTab === "json-all-in-one" && previewData.stats ? (
                <div className="grid-4" style={{ marginBottom: "1.25rem" }}>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--primary)" }}>
                      <Users size={22} />
                    </div>
                    <div>
                      <div className="stat-value">{previewData.stats.totalPersonnel}</div>
                      <div className="stat-label">Tổng nhân sự trong gói</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                      <Calendar size={22} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: "#10b981" }}>{previewData.stats.totalShifts}</div>
                      <div className="stat-label">Tổng số ca làm việc</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--info)" }}>
                      <FileSpreadsheet size={22} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: "var(--info)" }}>{previewData.stats.totalReports}</div>
                      <div className="stat-label">Tổng báo cáo Seeding & QC</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(249, 115, 22, 0.15)", color: "#f97316" }}>
                      <Flame size={22} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: "#f97316" }}>{previewData.stats.totalViralPosts}</div>
                      <div className="stat-label">Tổng bài viết Viral</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--primary)" }}>
                      <FileSpreadsheet size={22} />
                    </div>
                    <div>
                      <div className="stat-value">{previewData.totalRows}</div>
                      <div className="stat-label">Tổng số dòng đọc được</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <div className="stat-value">{previewData.validCount}</div>
                      <div className="stat-label">Dòng hợp lệ sẵn sàng nạp</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                      <XCircle size={22} />
                    </div>
                    <div>
                      <div className="stat-value">{previewData.errorCount}</div>
                      <div className="stat-label">Dòng phát hiện lỗi/cảnh báo</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error list if any */}
              {previewData.errors.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: "1rem",
                    marginBottom: "1.25rem",
                    background: "rgba(239, 68, 68, 0.05)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontWeight: 600, marginBottom: "0.5rem" }}>
                    <AlertTriangle size={18} />
                    <span>Danh sách {previewData.errors.length} cảnh báo/lỗi:</span>
                  </div>
                  <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.8125rem" }}>
                    {previewData.errors.map((err, idx) => (
                      <div key={idx} style={{ padding: "0.25rem 0", color: "var(--text-secondary)" }}>
                        <span style={{ fontWeight: 600, color: "#ef4444" }}>Dòng {err.row}:</span> {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                    {activeTab === "json-all-in-one"
                      ? `Danh sách nhân sự trong gói (${Math.min(previewData.previewRows.length, 15)} / ${previewData.validCount} nhân sự)`
                      : `Xem trước dữ liệu (${Math.min(previewData.previewRows.length, 10)} / ${previewData.validCount} dòng)`}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {activeTab === "json-all-in-one" ? "Gói JSON All-In-One" : `Trang tính: ${previewData.selectedSheet}`}
                  </span>
                </div>

                <div className="table-container" style={{ maxHeight: "350px", overflowY: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {activeTab === "json-all-in-one" && (
                          <>
                            <th>Họ và tên</th>
                            <th>Số điện thoại</th>
                            <th>Email</th>
                            <th>Số ca làm việc</th>
                            <th>Số báo cáo Seeding</th>
                            <th>Số bài Viral</th>
                            <th>Trạng thái trong DB</th>
                          </>
                        )}
                        {activeTab === "nhan-su" && (
                          <>
                            <th>Họ và tên</th>
                            <th>Số điện thoại</th>
                            <th>Email</th>
                            <th>CCCD</th>
                            <th>Vai trò</th>
                            <th>Ngày sinh</th>
                            <th>Trạng thái DB</th>
                          </>
                        )}
                        {activeTab === "ca-lam-viec" && (
                          <>
                            <th>Nhân sự</th>
                            <th>Ngày làm việc</th>
                            <th>Ca làm</th>
                            <th>Hình thức</th>
                            <th>Trạng thái</th>
                            <th>Ghi chú</th>
                          </>
                        )}
                        {activeTab === "bao-cao-seeding" && (
                          <>
                            <th>Nhân sự</th>
                            <th>Ngày báo cáo</th>
                            <th>Ca làm</th>
                            <th>Số link FB</th>
                            <th>Số link Threads</th>
                            <th>Duyệt QC</th>
                          </>
                        )}
                        {activeTab === "thuong-viral" && (
                          <>
                            <th>Nhân sự</th>
                            <th>Link bài viết</th>
                            <th>Nền tảng</th>
                            <th>Lượt Likes</th>
                            <th>Tiền thưởng</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.previewRows.map((item, idx) => (
                        <tr key={idx}>
                          <td>#{item.row}</td>

                          {activeTab === "json-all-in-one" && (
                            <>
                              <td style={{ fontWeight: 600 }}>{item.fullName}</td>
                              <td>{item.phone}</td>
                              <td>{item.email || "—"}</td>
                              <td>
                                <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700 }}>
                                  {item.shiftCount} ca
                                </span>
                              </td>
                              <td>
                                <span className="badge" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--primary)", fontWeight: 700 }}>
                                  {item.reportCount} báo cáo
                                </span>
                              </td>
                              <td>
                                <span className="badge" style={{ background: "rgba(249, 115, 22, 0.15)", color: "#f97316", fontWeight: 700 }}>
                                  {item.viralCount} bài
                                </span>
                              </td>
                              <td>
                                {item.isExisting ? (
                                  <span className="badge" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--primary)" }}>
                                    Đã có (ID: {item.existingId})
                                  </span>
                                ) : (
                                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                                    Tạo mới
                                  </span>
                                )}
                              </td>
                            </>
                          )}

                          {activeTab === "nhan-su" && (
                            <>
                              <td style={{ fontWeight: 600 }}>{item.fullName}</td>
                              <td>{item.phone}</td>
                              <td>{item.email || "—"}</td>
                              <td>{item.cccd || "—"}</td>
                              <td>
                                <span className="badge badge-neutral">{item.role}</span>
                              </td>
                              <td>{item.dateOfBirth || "—"}</td>
                              <td>
                                {item.isExisting ? (
                                  <span className="badge" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--primary)" }}>
                                    Đã có (ID: {item.existingId})
                                  </span>
                                ) : (
                                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                                    Tạo mới
                                  </span>
                                )}
                              </td>
                            </>
                          )}

                          {activeTab === "ca-lam-viec" && (
                            <>
                              <td style={{ fontWeight: 600 }}>{item.userName}</td>
                              <td>{item.shiftDate}</td>
                              <td>
                                <span className="badge badge-neutral">{item.shiftType}</span>
                              </td>
                              <td>{item.workMode}</td>
                              <td>
                                <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.note}</td>
                            </>
                          )}

                          {activeTab === "bao-cao-seeding" && (
                            <>
                              <td style={{ fontWeight: 600 }}>{item.userName}</td>
                              <td>{item.reportDate}</td>
                              <td>{item.shiftType}</td>
                              <td>{item.fbLinks.length} bài</td>
                              <td>{item.threadLinks.length} bài</td>
                              <td>
                                <span className={`badge ${item.qcResult === "PASS" ? "badge-success" : "badge-warning"}`}>
                                  {item.qcResult}
                                </span>
                              </td>
                            </>
                          )}

                          {activeTab === "thuong-viral" && (
                            <>
                              <td style={{ fontWeight: 600 }}>{item.userName}</td>
                              <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <a href={item.postUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                                  {item.postUrl}
                                </a>
                              </td>
                              <td>{item.platform}</td>
                              <td>{item.likes.toLocaleString()}</td>
                              <td style={{ fontWeight: 600, color: "#10b981" }}>
                                {item.bonusAmount.toLocaleString()} VNĐ
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem" }}>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="btn btn-secondary"
                    style={{ gap: "0.4rem" }}
                  >
                    <RotateCcw size={15} />
                    <span>Chọn tệp khác</span>
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={executing || previewData.validCount === 0}
                    className="btn btn-primary"
                    style={{
                      gap: "0.5rem",
                      minWidth: "220px",
                      background: activeTab === "json-all-in-one" ? "linear-gradient(135deg, #10b981, #059669)" : undefined,
                    }}
                  >
                    {executing ? (
                      <>
                        <RefreshCw size={16} className="spin" />
                        <span>Đang nạp vào cơ sở dữ liệu...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>
                          {activeTab === "json-all-in-one"
                            ? `Xác nhận & Nạp trọn gói ${previewData.validCount} nhân sự`
                            : `Xác nhận & Nạp ${previewData.validCount} bản ghi`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 3: EXECUTION RESULTS
          ============================================================== */}
          {currentStep === 3 && executeResult && (
            <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.25rem auto",
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h2 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
                {activeTab === "json-all-in-one"
                  ? "Nạp trọn gói dữ liệu All-in-One hoàn tất thành công!"
                  : "Nạp dữ liệu hoàn tất thành công!"}
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: "0 0 2rem 0" }}>
                Toàn bộ dữ liệu nhân sự và các quan hệ phụ thuộc đã được đồng bộ vào cơ sở dữ liệu SQL Server.
              </p>

              {/* Result Summary Grid */}
              <div className="grid-4" style={{ marginBottom: "1.5rem", textAlign: "left" }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                    <Check size={20} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: "#10b981" }}>{executeResult.createdCount}</div>
                    <div className="stat-label">
                      {activeTab === "json-all-in-one" ? "Nhân sự tạo mới" : "Bản ghi tạo mới"}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--primary)" }}>
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: "var(--primary)" }}>{executeResult.updatedCount}</div>
                    <div className="stat-label">
                      {activeTab === "json-all-in-one" ? "Nhân sự cập nhật" : "Bản ghi cập nhật"}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(156, 163, 175, 0.15)", color: "var(--text-muted)" }}>
                    <RotateCcw size={20} />
                  </div>
                  <div>
                    <div className="stat-value">{executeResult.skippedCount}</div>
                    <div className="stat-label">Bỏ qua do trùng lặp</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                    <XCircle size={20} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: executeResult.errorCount > 0 ? "#ef4444" : "var(--text-muted)" }}>
                      {executeResult.errorCount}
                    </div>
                    <div className="stat-label">Bản ghi gặp lỗi</div>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown for JSON All-in-One */}
              {executeResult.details && (
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    marginBottom: "2rem",
                    display: "flex",
                    justifyContent: "space-around",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Ca làm đã nạp: </span>
                    <strong style={{ color: "#10b981" }}>{executeResult.details.shiftsCreated}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Báo cáo seeding & QC: </span>
                    <strong style={{ color: "var(--primary)" }}>{executeResult.details.reportsCreated}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Bài viral: </span>
                    <strong style={{ color: "#f97316" }}>{executeResult.details.viralCreated}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Nghiệm thu tháng: </span>
                    <strong style={{ color: "var(--info)" }}>{executeResult.details.acceptancesCreated}</strong>
                  </div>
                </div>
              )}

              {/* Actions to continue */}
              <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setSelectedFile(null);
                    setPreviewData(null);
                    setExecuteResult(null);
                  }}
                  className="btn btn-secondary"
                  style={{ gap: "0.5rem" }}
                >
                  <FileUp size={16} />
                  <span>Nạp thêm tệp khác</span>
                </button>

                <Link href="/nhan-su" className="btn btn-primary" style={{ gap: "0.5rem" }}>
                  <Users size={16} />
                  <span>Xem danh sách Hồ sơ nhân sự</span>
                </Link>

                <Link href="/ca-lam-viec" className="btn btn-primary" style={{ gap: "0.5rem" }}>
                  <Calendar size={16} />
                  <span>Xem lịch Ca làm việc</span>
                </Link>

                <Link href="/bao-cao" className="btn btn-primary" style={{ gap: "0.5rem" }}>
                  <FileSpreadsheet size={16} />
                  <span>Xem Báo cáo Seeding</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==============================================================
          TAB: SAO LƯU DỮ LIỆU (BACKUP)
      ============================================================== */}
      {activeTab === "backup" && (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div
            className="card"
            style={{
              padding: "1.75rem",
              marginBottom: "1.5rem",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              background: "linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, rgba(16, 185, 129, 0.01) 100%)",
            }}
          >
            {/* Header section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HardDriveDownload size={26} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    Sao lưu Dữ liệu Hệ thống (Data Backup)
                  </h2>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Xuất và lưu trữ an toàn các phân hệ dữ liệu. Dùng để đối soát, lưu trữ định kỳ hoặc phục hồi (Restore).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchBackupStats}
                disabled={loadingBackupStats}
                className="btn btn-secondary btn-sm"
                style={{ gap: "0.4rem" }}
                title="Làm mới số lượng bản ghi"
              >
                <RefreshCw size={14} className={loadingBackupStats ? "spin" : ""} />
                <span>Cập nhật số liệu</span>
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
                padding: "0.875rem 1.25rem",
                borderRadius: "8px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleToggleAllBackup}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: "0.4rem" }}
                >
                  {backupSelectedTypes.length === BACKUP_CATEGORIES.length ? (
                    <>
                      <CheckSquare size={16} style={{ color: "#10b981" }} />
                      <span>Bỏ chọn tất cả</span>
                    </>
                  ) : (
                    <>
                      <Square size={16} />
                      <span>Chọn tất cả ({BACKUP_CATEGORIES.length})</span>
                    </>
                  )}
                </button>
                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Đã chọn: <strong style={{ color: "#10b981" }}>{backupSelectedTypes.length}</strong> / {BACKUP_CATEGORIES.length} phân hệ
                </span>
              </div>

              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                * Mật khẩu tài khoản nhân sự được bảo vệ, tự động loại trừ khỏi bản sao lưu
              </div>
            </div>

            {/* Selection Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
                gap: "0.875rem",
                marginBottom: "1.75rem",
              }}
            >
              {BACKUP_CATEGORIES.map((cat) => {
                const isSelected = backupSelectedTypes.includes(cat.id);
                const IconComponent = cat.icon;
                const count = backupStats ? backupStats[cat.statKey] : undefined;

                return (
                  <div
                    key={cat.id}
                    onClick={() => handleToggleBackupType(cat.id)}
                    style={{
                      padding: "1rem",
                      borderRadius: "10px",
                      cursor: "pointer",
                      border: isSelected ? "2px solid #10b981" : "1px solid var(--border-color)",
                      background: isSelected ? "rgba(16, 185, 129, 0.05)" : "var(--bg-card)",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ marginTop: "0.2rem", cursor: "pointer", accentColor: "#10b981", width: "16px", height: "16px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, fontSize: "0.9375rem" }}>
                          <IconComponent size={16} style={{ color: isSelected ? "#10b981" : "var(--text-muted)" }} />
                          <span>{cat.label}</span>
                        </div>
                        {count !== undefined ? (
                          <span
                            className="badge"
                            style={{
                              fontSize: "0.75rem",
                              background: count > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                              color: count > 0 ? "#10b981" : "var(--text-muted)",
                            }}
                          >
                            {count.toLocaleString("vi-VN")} bản ghi
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>...</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        {cat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Format Selection & Download */}
            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                paddingTop: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              <div>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "0.625rem" }}>
                  Định dạng tệp sao lưu:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div
                    onClick={() => setBackupFormat("xlsx")}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: backupFormat === "xlsx" ? "2px solid #10b981" : "1px solid var(--border-color)",
                      background: backupFormat === "xlsx" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-card)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <FileSpreadsheet size={24} style={{ color: "#10b981" }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Microsoft Excel (.xlsx)</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Tự động chia nhiều sheet, phù hợp đối soát ngoại tuyến và lưu trữ nội bộ
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setBackupFormat("json")}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: backupFormat === "json" ? "2px solid #6366f1" : "1px solid var(--border-color)",
                      background: backupFormat === "json" ? "rgba(99, 102, 241, 0.08)" : "var(--bg-card)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <Package size={24} style={{ color: "#6366f1" }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Gói JSON Trọn gói (.json)</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Chuẩn dữ liệu kỹ thuật, bảo toàn cấu trúc để khôi phục (Restore) hệ thống
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Action */}
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={backupSelectedTypes.length === 0 || downloadingBackup}
                className="btn btn-primary"
                style={{
                  padding: "0.875rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  gap: "0.625rem",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                }}
              >
                {downloadingBackup ? (
                  <>
                    <RefreshCw size={20} className="spin" />
                    <span>Đang đóng gói và khởi tạo tệp sao lưu...</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>
                      Tải bản sao lưu {backupFormat.toUpperCase()} ({backupSelectedTypes.length} phân hệ)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          TAB 5: RESET DATABASE TOOL
      ============================================================== */}
      {activeTab === "reset" && (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div
            className="card"
            style={{
              padding: "2rem",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "rgba(239, 68, 68, 0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#ef4444", marginBottom: "1rem" }}>
              <ShieldAlert size={28} />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                Công cụ Dọn dẹp Dữ liệu Thử nghiệm (Database Reset)
              </h2>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Chức năng này dùng để <strong>xóa sạch toàn bộ dữ liệu nghiệp vụ thử nghiệm</strong> (bao gồm: các ca làm việc, báo cáo seeding, đánh giá QC, bài viết viral, nghiệm thu và tài khoản nhân sự thường).
            </p>

            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontWeight: 600, color: "#10b981", fontSize: "0.875rem", marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <CheckCircle2 size={16} />
                <span>Cam kết an toàn hệ thống:</span>
              </div>
              <ul style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
                <li>Bảo lưu 100% tài khoản Quản trị & Quản lý: <code>SUPER_ADMIN</code>, <code>ADMIN</code>, <code>HR</code>, <code>MANAGER</code>, <code>QC</code>.</li>
                <li>Bảo lưu toàn bộ bảng Cấu hình hệ thống: Chỉ tiêu KPI, Cấu hình ca làm việc, Tag bài viết, Bậc thưởng Viral.</li>
              </ul>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                Để xác nhận, vui lòng gõ chính xác dòng chữ <span style={{ color: "#ef4444", fontFamily: "monospace" }}>XAC NHAN XOA</span> vào ô dưới đây:
              </label>
              <input
                type="text"
                className="input"
                placeholder="XAC NHAN XOA"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                style={{ fontFamily: "monospace", letterSpacing: "1px" }}
              />
            </div>

            <button
              onClick={handleExecuteReset}
              disabled={resetConfirmText !== "XAC NHAN XOA" || resetting}
              className="btn btn-primary"
              style={{
                background: "#ef4444",
                borderColor: "#ef4444",
                gap: "0.5rem",
                width: "100%",
                justifyContent: "center",
              }}
            >
              {resetting ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Đang dọn dẹp dữ liệu an toàn...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Xác nhận Xóa & Làm sạch hệ thống</span>
                </>
              )}
            </button>
          </div>

          {/* Reset Result Table */}
          {resetResult && (
            <div className="card" style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#10b981", fontWeight: 600, marginBottom: "0.75rem" }}>
                <CheckCircle2 size={20} />
                <span>{resetResult.message}</span>
              </div>

              <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Danh sách tài khoản quản lý được bảo tồn:
              </h4>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Họ và tên</th>
                      <th>Số điện thoại</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resetResult.remainingManagers.map((m) => (
                      <tr key={m.id}>
                        <td>#{m.id}</td>
                        <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                        <td>{m.phone}</td>
                        <td>
                          <span className="badge badge-neutral">{m.role}</span>
                        </td>
                        <td>
                          <span className="badge badge-success">{m.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
