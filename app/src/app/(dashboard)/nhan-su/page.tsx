"use client";

import { useState, useEffect, useCallback } from "react";
import { confirmModal, Modal } from "@/components/ui";
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  Plus,
  Download,
  Upload,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  FileCheck,
  UserX,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  Shield,
  Printer,
  ExternalLink,
} from "lucide-react";
import ContractPrintModal from "@/components/nhan-su/ContractPrintModal";

interface Contract {
  id: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "EXPIRED" | "TERMINATED" | "RENEWED";
  contractType: string;
  note?: string;
}

interface UserItem {
  id: number;
  fullName: string;
  email?: string;
  phone: string;
  cccd?: string;
  bankAccount?: string;
  bankName?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "HR" | "MANAGER" | "QC" | "NHAN_SU_HYBRID";
  status: "PROBATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  startDate: string;
  dateOfBirth?: string;
  cccdDate?: string;
  cccdPlace?: string;
  currentAddress?: string;
  permanentAddress?: string;
  avatarUrl?: string;
  driveFolderUrl?: string | null;
  latestContract?: Contract | null;
  contractAlert: "NONE" | "EXPIRING_7" | "EXPIRING_14" | "EXPIRED" | "NO_CONTRACT";
}

interface Stats {
  totalUsers: number;
  probationUsers: number;
  activeUsers: number;
  expiringContracts: number;
}

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  PROBATION: { label: "Thử việc (1 tuần)", badge: "badge-warning" },
  ACTIVE: { label: "Chính thức", badge: "badge-success" },
  INACTIVE: { label: "Đã nghỉ", badge: "badge-neutral" },
  SUSPENDED: { label: "Tạm đình chỉ", badge: "badge-danger" },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Quản trị viên",
  HR: "Nhân sự (HR)",
  MANAGER: "Quản lý ca",
  QC: "Kiểm duyệt viên (QC)",
  NHAN_SU_HYBRID: "Nhân sự Remote",
};

const ROLE_BADGES: Record<string, string> = {
  SUPER_ADMIN: "badge-danger",
  ADMIN: "badge-primary",
  HR: "badge-info",
  MANAGER: "badge-warning",
  QC: "badge-success",
  NHAN_SU_HYBRID: "badge-neutral",
};

// Helper tính ngày kết thúc hợp đồng chuẩn theo trạng thái nhân sự (Thử việc 1 tuần hoặc Chính thức 3 tháng)
function calculateContractEndDate(
  startDateStr: string,
  statusOrMonths: "PROBATION" | "ACTIVE" | number = "PROBATION"
): string {
  if (!startDateStr) return "";
  const parts = startDateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (statusOrMonths === "PROBATION") {
    // Thử việc 1 tuần: 7 ngày tính từ ngày bắt đầu (+ 6 ngày)
    // Ví dụ: Bắt đầu 01/09/2026 -> Kết thúc 07/09/2026
    const target = new Date(year, month - 1, day + 6);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const monthsToAdd = typeof statusOrMonths === "number" ? statusOrMonths : 3;
  // Hợp đồng 3 tháng (Ví dụ: 01/09/2026 -> 30/11/2026)
  let target: Date;
  if (day === 1) {
    target = new Date(year, month - 1 + monthsToAdd, 0);
  } else {
    target = new Date(year, month - 1 + monthsToAdd, day - 1);
  }

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function NhanSuPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    probationUsers: 0,
    activeUsers: 0,
    expiringContracts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [contractFilter, setContractFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [selectedUserForContract, setSelectedUserForContract] = useState<UserItem | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedUserForPrint, setSelectedUserForPrint] = useState<UserItem | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states
  const [userFormData, setUserFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    cccd: "",
    cccdDate: "",
    cccdPlace: "",
    currentAddress: "",
    permanentAddress: "",
    dateOfBirth: "",
    bankAccount: "",
    bankName: "",
    role: "NHAN_SU_HYBRID",
    status: "PROBATION",
    startDate: new Date().toISOString().slice(0, 10),
    contractStartDate: new Date().toISOString().slice(0, 10),
    contractEndDate: calculateContractEndDate(new Date().toISOString().slice(0, 10), "PROBATION"),
    createContract: false,
    customPassword: "",
    driveFolderUrl: "",
  });

  const [contractFormData, setContractFormData] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    contractType: "khoan_viec",
    note: "Gia hạn hợp đồng 3 tháng",
    action: "RENEW",
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
        contractStatus: contractFilter === "ALL" ? "" : contractFilter,
      });

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error("Không thể tải danh sách nhân sự");

      const data = await res.json();
      setUsers(data.users || []);
      setStats(
        data.stats || {
          totalUsers: 0,
          probationUsers: 0,
          activeUsers: 0,
          expiringContracts: 0,
        }
      );
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, roleFilter, statusFilter, contractFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open Create/Edit User Modal
  const handleOpenUserModal = (user?: UserItem) => {
    if (user) {
      setEditingUser(user);
      const cStart = user.latestContract?.startDate
        ? new Date(user.latestContract.startDate).toISOString().slice(0, 10)
        : "";
      const cEnd = user.latestContract?.endDate
        ? new Date(user.latestContract.endDate).toISOString().slice(0, 10)
        : (cStart ? calculateContractEndDate(cStart, user.status === "ACTIVE" ? "ACTIVE" : "PROBATION") : "");

      const dobStr = user.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
        : "";
      const cccdDateStr = user.cccdDate
        ? new Date(user.cccdDate).toISOString().slice(0, 10)
        : "";

      setUserFormData({
        fullName: user.fullName,
        phone: user.phone,
        email: user.email || "",
        cccd: user.cccd || "",
        cccdDate: cccdDateStr,
        cccdPlace: user.cccdPlace || "",
        currentAddress: user.currentAddress || "",
        permanentAddress: user.permanentAddress || "",
        dateOfBirth: dobStr,
        bankAccount: user.bankAccount || "",
        bankName: user.bankName || "",
        role: user.role,
        status: user.status,
        startDate: new Date(user.startDate).toISOString().slice(0, 10),
        contractStartDate: cStart,
        contractEndDate: cEnd,
        createContract: Boolean(user.latestContract),
        customPassword: "",
        driveFolderUrl: user.driveFolderUrl || "",
      });
    } else {
      setEditingUser(null);
      const todayStr = new Date().toISOString().slice(0, 10);
      setUserFormData({
        fullName: "",
        phone: "",
        email: "",
        cccd: "",
        cccdDate: "",
        cccdPlace: "",
        currentAddress: "",
        permanentAddress: "",
        dateOfBirth: "",
        bankAccount: "",
        bankName: "",
        role: "NHAN_SU_HYBRID",
        status: "PROBATION",
        startDate: todayStr,
        contractStartDate: todayStr,
        contractEndDate: calculateContractEndDate(todayStr, "PROBATION"),
        createContract: true,
        customPassword: "",
        driveFolderUrl: "",
      });
    }
    setIsUserModalOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : `/api/users`;
      const method = editingUser ? "PUT" : "POST";

      const payload = {
        ...userFormData,
        createContract: Boolean(userFormData.contractStartDate),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra khi lưu nhân sự");

      showToast(data.message || "Lưu hồ sơ nhân sự thành công!");
      setIsUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Contract Modal
  const handleOpenContractModal = (user: UserItem) => {
    setSelectedUserForContract(user);
    const today = new Date();
    const defaultStart = user.latestContract
      ? new Date(user.latestContract.endDate) > today
        ? new Date(new Date(user.latestContract.endDate).getTime() + 86400000)
            .toISOString()
            .slice(0, 10)
        : today.toISOString().slice(0, 10)
      : today.toISOString().slice(0, 10);

    const defaultEndDate = calculateContractEndDate(defaultStart, 3);

    setContractFormData({
      startDate: defaultStart,
      endDate: defaultEndDate,
      contractType: "khoan_viec",
      note: "Gia hạn hợp đồng 3 tháng",
      action: user.latestContract ? "RENEW" : "NEW",
    });
    setIsContractModalOpen(true);
  };

  // Save Contract
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForContract) return;

    setFormSubmitting(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserForContract.id,
          ...contractFormData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi xử lý hợp đồng");

      showToast(data.message || "Thao tác hợp đồng thành công!");
      setIsContractModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Deactivate (Soft Delete)
  const handleDeactivateUser = async (user: UserItem) => {
    const isConfirmed = await confirmModal({
      title: "Xác nhận chuyển trạng thái",
      message: `Bạn có chắc chắn muốn chuyển nhân sự "${user.fullName}" sang trạng thái ĐÃ NGHỈ (INACTIVE)?`,
      confirmText: "Xác nhận nghỉ",
      cancelText: "Hủy",
      type: "danger",
    });

    if (!isConfirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể vô hiệu hóa nhân sự");

      showToast(data.message);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    const params = new URLSearchParams({
      role: roleFilter,
      status: statusFilter,
    });
    window.open(`/api/users/export?${params.toString()}`, "_blank");
  };

  // Handle Import Excel
  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      showToast("Vui lòng chọn file Excel để tải lên", "error");
      return;
    }

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch("/api/users/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error + (data.details ? `:\n${data.details.slice(0, 3).join("\n")}` : "")
        );
      }

      showToast(data.message || "Nhập dữ liệu thành công!");
      setIsImportModalOpen(false);
      setImportFile(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setImportLoading(false);
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
          <h1 className="page-title">Hồ Sơ Nhân Sự</h1>
          <p className="page-subtitle">
            Quản lý thông tin cá nhân, chức vụ, hợp đồng khoán việc và trạng thái nhân sự
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            title="Xuất file Excel"
          >
            <Download size={16} /> Xuất Excel
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsImportModalOpen(true)}
            title="Nhập dữ liệu từ Excel"
          >
            <Upload size={16} /> Nhập Excel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenUserModal()}
          >
            <Plus size={16} /> Thêm Nhân Sự
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(34, 197, 94, 0.15)", color: "var(--success)" }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.activeUsers}</div>
            <div className="stat-label">Chính thức (Có HĐ 3T)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(234, 179, 8, 0.15)", color: "var(--warning)" }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.probationUsers}</div>
            <div className="stat-label">Đang thử việc (1 tuần)</div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            cursor: "pointer",
            borderColor: stats.expiringContracts > 0 ? "rgba(239, 68, 68, 0.4)" : undefined,
          }}
          onClick={() => setContractFilter(contractFilter === "expiring_soon" ? "ALL" : "expiring_soon")}
        >
          <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ color: stats.expiringContracts > 0 ? "var(--danger)" : undefined }}>
              {stats.expiringContracts}
            </div>
            <div className="stat-label">HĐ sắp hết hạn (&le; 14 ngày)</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
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
              }}
            />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: "36px" }}
              placeholder="Tìm theo Tên, SĐT, CCCD, Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <select
            className="select"
            style={{ width: "auto" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PROBATION">Thử việc</option>
            <option value="ACTIVE">Chính thức</option>
            <option value="INACTIVE">Đã nghỉ</option>
            <option value="SUSPENDED">Tạm đình chỉ</option>
          </select>

          <select
            className="select"
            style={{ width: "auto" }}
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
          >
            <option value="ALL">Tất cả hợp đồng</option>
            <option value="expiring_soon">⚠️ Sắp hết hạn (&le; 14 ngày)</option>
            <option value="expired">❌ Đã hết hạn</option>
            <option value="no_contract">❓ Chưa có HĐ</option>
          </select>

          <button
            className="btn btn-secondary btn-icon"
            onClick={fetchUsers}
            title="Làm mới danh sách"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nhân sự</th>
              <th>Vai trò</th>
              <th>Liên hệ</th>
              <th>Ngân hàng</th>
              <th>Trạng thái</th>
              <th>Hợp đồng</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                    <RefreshCw size={18} className="animate-spin" /> Đang tải danh sách nhân sự...
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  Không tìm thấy nhân sự nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const statusInfo = STATUS_LABELS[user.status] || { label: user.status, badge: "badge-neutral" };
                const contract = user.latestContract;
                const isProbationContract =
                  contract?.contractType === "thu_viec" || user.status === "PROBATION";

                return (
                  <tr key={user.id}>
                    {/* User info */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            flexShrink: 0,
                          }}
                        >
                          {user.fullName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{user.fullName}</span>
                            {user.driveFolderUrl && (
                              <a
                                href={user.driveFolderUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Mở thư mục Google Drive tổng hợp"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  color: "var(--primary)",
                                  opacity: 0.85,
                                }}
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                          {user.dateOfBirth && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              Sinh: {new Date(user.dateOfBirth).toLocaleDateString("vi-VN")}
                            </div>
                          )}
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            Vào làm: {new Date(user.startDate).toLocaleDateString("vi-VN")}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Vai trò */}
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {(user.role || "").split(",").map((r: string) => r.trim()).filter(Boolean).map((r: string) => (
                          <span key={r} className={`badge ${ROLE_BADGES[r] || "badge-neutral"}`} style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                            {ROLE_LABELS[r] || r}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Contact & CCCD */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem" }}>
                          <Phone size={13} color="var(--primary)" />
                          <span style={{ fontWeight: 500 }}>{user.phone}</span>
                        </div>
                        {user.cccd ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            <CreditCard size={12} style={{ flexShrink: 0 }} />
                            <span>CCCD: {user.cccd}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--warning)" }}>Chưa có CCCD</span>
                        )}
                        {user.email ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              maxWidth: "220px",
                            }}
                            title={user.email}
                          >
                            <Mail size={12} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {user.email}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.7 }}>Chưa có Email</span>
                        )}
                      </div>
                    </td>

                    {/* Bank */}
                    <td>
                      {user.bankAccount ? (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "0.8125rem" }}>{user.bankAccount}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {user.bankName || "Ngân hàng"}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Chưa bổ sung</span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge ${statusInfo.badge}`}>{statusInfo.label}</span>
                    </td>

                    {/* Contract Info */}
                    <td>
                      {contract ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: 600,
                                background: isProbationContract
                                  ? "rgba(234, 179, 8, 0.15)"
                                  : "rgba(34, 197, 94, 0.15)",
                                color: isProbationContract
                                  ? "var(--warning)"
                                  : "var(--success)",
                              }}
                            >
                              {isProbationContract ? "Thử việc (1 tuần)" : "Khoán việc (3 tháng)"}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                            {new Date(contract.startDate).toLocaleDateString("vi-VN")} &rarr;{" "}
                            {new Date(contract.endDate).toLocaleDateString("vi-VN")}
                          </div>

                          {user.contractAlert === "EXPIRING_7" && (
                            <span className="badge badge-danger" style={{ marginTop: "4px" }}>
                              <AlertTriangle size={12} /> Hết hạn &le; 7 ngày!
                            </span>
                          )}
                          {user.contractAlert === "EXPIRING_14" && (
                            <span className="badge badge-warning" style={{ marginTop: "4px" }}>
                              <Clock size={12} /> Sắp hết hạn (&le; 14 ngày)
                            </span>
                          )}
                          {user.contractAlert === "EXPIRED" && (
                            <span className="badge badge-danger" style={{ marginTop: "4px" }}>
                              Đã hết hạn
                            </span>
                          )}
                          {user.contractAlert === "NONE" && (
                            <span className="badge badge-success" style={{ marginTop: "4px" }}>
                              Còn hiệu lực
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="badge badge-neutral">Chưa có hợp đồng</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.375rem" }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ padding: "6px" }}
                          onClick={() => {
                            setSelectedUserForPrint(user);
                            setIsPrintModalOpen(true);
                          }}
                          title="In / Xuất biên bản thỏa thuận làm việc"
                        >
                          <Printer size={16} color="var(--info)" />
                        </button>

                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ padding: "6px" }}
                          onClick={() => handleOpenContractModal(user)}
                          title="Ký mới / Gia hạn HĐ"
                        >
                          <FileCheck size={16} color="var(--primary)" />
                        </button>

                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ padding: "6px" }}
                          onClick={() => handleOpenUserModal(user)}
                          title="Chỉnh sửa hồ sơ"
                        >
                          <Edit2 size={16} />
                        </button>

                        {user.status !== "INACTIVE" && (
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ padding: "6px" }}
                            onClick={() => handleDeactivateUser(user)}
                            title="Ngừng hoạt động nhân sự"
                          >
                            <UserX size={16} color="var(--danger)" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1rem",
            padding: "0.5rem",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            Trang {page} / {totalPages}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Thêm / Sửa Nhân Sự */}
      {isUserModalOpen && (
        <Modal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          maxWidth="620px"
          closeOnOutsideClick={false}
        >
          <div className="modal-header">
            <div className="modal-title">
              {editingUser ? `Chỉnh Sửa: ${editingUser.fullName}` : "Thêm Mới Hồ Sơ Nhân Sự"}
            </div>
            <button
              type="button"
              className="btn-ghost btn-icon"
              onClick={() => setIsUserModalOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Họ và tên nhân sự *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      required
                      value={userFormData.fullName}
                      onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số điện thoại (Tài khoản) *</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="Ví dụ: 0901234567"
                      required
                      value={userFormData.phone}
                      onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số CCCD (12 chữ số)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ví dụ: 001201012345"
                      maxLength={12}
                      value={userFormData.cccd}
                      onChange={(e) => setUserFormData({ ...userFormData, cccd: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Sinh ngày</label>
                    <input
                      type="date"
                      className="input"
                      value={userFormData.dateOfBirth}
                      onChange={(e) => setUserFormData({ ...userFormData, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Ngày cấp CCCD</label>
                    <input
                      type="date"
                      className="input"
                      value={userFormData.cccdDate}
                      onChange={(e) => setUserFormData({ ...userFormData, cccdDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Nơi cấp CMND/CCCD</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ví dụ: Cục Cảnh sát QLHC về TTXH"
                      value={userFormData.cccdPlace}
                      onChange={(e) => setUserFormData({ ...userFormData, cccdPlace: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Nơi ở hiện nay</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP"
                      value={userFormData.currentAddress}
                      onChange={(e) => setUserFormData({ ...userFormData, currentAddress: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Địa chỉ thường trú</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Theo hộ khẩu / CCCD"
                      value={userFormData.permanentAddress}
                      onChange={(e) => setUserFormData({ ...userFormData, permanentAddress: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Địa chỉ Email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="nguyenvana@gmail.com"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Ngày bắt đầu làm việc</label>
                    <input
                      type="date"
                      className="input"
                      value={userFormData.startDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const targetStatus = userFormData.status === "ACTIVE" ? "ACTIVE" : "PROBATION";
                        setUserFormData((prev) => ({
                          ...prev,
                          startDate: newStart,
                          ...(!editingUser
                            ? {
                                contractStartDate: newStart,
                                contractEndDate: calculateContractEndDate(newStart, targetStatus),
                              }
                            : {}),
                        }));
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Vai trò (Role / Quyền hạn) *</label>
                    <select
                      className="select"
                      value={userFormData.role}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          role: e.target.value as any,
                        })
                      }
                    >
                      <option value="NHAN_SU_HYBRID">Nhân sự Remote</option>
                      <option value="QC">Kiểm duyệt viên (QC)</option>
                      <option value="MANAGER">Quản lý ca (Manager)</option>
                      <option value="HR">Hành chính Nhân sự (HR)</option>
                      <option value="ADMIN">Quản trị viên (Admin)</option>
                      {userFormData.role === "SUPER_ADMIN" && (
                        <option value="SUPER_ADMIN">Super Admin</option>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">Trạng thái nhân sự</label>
                    <select
                      className="select"
                      value={userFormData.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as "PROBATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
                        const targetStatus = newStatus === "ACTIVE" ? "ACTIVE" : "PROBATION";
                        const baseStart = userFormData.contractStartDate || userFormData.startDate;
                        setUserFormData((prev) => ({
                          ...prev,
                          status: newStatus,
                          contractEndDate: calculateContractEndDate(baseStart, targetStatus),
                        }));
                      }}
                    >
                      <option value="PROBATION">Thử việc (1 tuần)</option>
                      <option value="ACTIVE">Chính thức (Ký HĐ 3 tháng)</option>
                      <option value="INACTIVE">Đã nghỉ (INACTIVE)</option>
                      <option value="SUSPENDED">Tạm đình chỉ</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">Ngày bắt đầu ký hợp đồng</label>
                    <input
                      type="date"
                      className="input"
                      value={userFormData.contractStartDate}
                      onChange={(e) => {
                        const start = e.target.value;
                        const targetStatus = userFormData.status === "ACTIVE" ? "ACTIVE" : "PROBATION";
                        setUserFormData((prev) => ({
                          ...prev,
                          contractStartDate: start,
                          contractEndDate: calculateContractEndDate(start, targetStatus),
                          createContract: true,
                        }));
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Ngày kết thúc hợp đồng{" "}
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "normal" }}>
                        {userFormData.status === "PROBATION" ? "(+1 tuần thử việc)" : "(+3 tháng)"}
                      </span>
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={userFormData.contractEndDate}
                      onChange={(e) =>
                        setUserFormData((prev) => ({ ...prev, contractEndDate: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Tên Ngân hàng</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ví dụ: MBBank, Techcombank..."
                      value={userFormData.bankName}
                      onChange={(e) => setUserFormData({ ...userFormData, bankName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số tài khoản ngân hàng</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ví dụ: 1903658241001"
                      value={userFormData.bankAccount}
                      onChange={(e) => setUserFormData({ ...userFormData, bankAccount: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Link Google Drive tổng nhân sự (chứa folder các tháng làm việc)</span>
                      {userFormData.driveFolderUrl && (
                        <a
                          href={userFormData.driveFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            textDecoration: "underline",
                          }}
                        >
                          Mở thư mục Drive ↗
                        </a>
                      )}
                    </label>
                    <input
                      type="url"
                      className="input"
                      placeholder="Ví dụ: https://drive.google.com/drive/folders/1ABCxyz..."
                      value={userFormData.driveFolderUrl}
                      onChange={(e) =>
                        setUserFormData({ ...userFormData, driveFolderUrl: e.target.value })
                      }
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                      Thư mục gốc chứa các tháng làm việc (Tháng 5, Tháng 6...) để tự động gắn vào hàng Đánh giá khi xuất báo cáo Excel tuần/tháng.
                    </span>
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">
                      {editingUser ? "Đổi mật khẩu mới (Bỏ trống nếu không đổi)" : "Mật khẩu ban đầu (Mặc định: 123456)"}
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder={editingUser ? "Nhập mật khẩu mới..." : "Mặc định 123456"}
                      value={userFormData.customPassword}
                      onChange={(e) => setUserFormData({ ...userFormData, customPassword: e.target.value })}
                    />
                  </div>

                  {!editingUser && (
                    <div
                      style={{
                        gridColumn: "span 2",
                        background: "var(--bg-input)",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        id="createContractCheck"
                        checked={userFormData.createContract}
                        onChange={(e) =>
                          setUserFormData({ ...userFormData, createContract: e.target.checked })
                        }
                        style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="createContractCheck" style={{ fontSize: "0.875rem", cursor: "pointer" }}>
                        Khởi tạo ngay hợp đồng khoán việc cho nhân sự này theo thời hạn trên
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Đang lưu..." : editingUser ? "Cập Nhật" : "Tạo Hồ Sơ"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* MODAL: Ký / Gia Hạn Hợp Đồng 3 Tháng */}
        {isContractModalOpen && selectedUserForContract && (
          <Modal
            isOpen={isContractModalOpen && !!selectedUserForContract}
            onClose={() => setIsContractModalOpen(false)}
            maxWidth="520px"
            closeOnOutsideClick={false}
          >
            <div className="modal-header">
              <div className="modal-title">
                Gia Hạn Hợp Đồng: {selectedUserForContract.fullName}
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setIsContractModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContract} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body">
                <div
                  style={{
                    background: "rgba(249, 115, 22, 0.1)",
                    border: "1px solid rgba(249, 115, 22, 0.2)",
                    borderRadius: "8px",
                    padding: "0.875rem",
                    marginBottom: "1.25rem",
                    fontSize: "0.8125rem",
                    color: "var(--text-primary)",
                  }}
                >
                  💡 <strong>Quy định Freetrip:</strong> Hợp đồng khoán việc có thời hạn chuẩn là{" "}
                  <strong>3 tháng</strong>. Khi gia hạn, nhân sự thử việc sẽ được tự động kích hoạt thành{" "}
                  <strong>Chính thức (ACTIVE)</strong>.
                </div>

                <div className="form-group">
                  <label className="label">Loại hợp đồng</label>
                  <select
                    className="select"
                    value={contractFormData.contractType}
                    onChange={(e) =>
                      setContractFormData({ ...contractFormData, contractType: e.target.value })
                    }
                  >
                    <option value="khoan_viec">Hợp đồng khoán việc (3 tháng)</option>
                    <option value="thu_viec">Hợp đồng thử việc</option>
                    <option value="chinh_thuc">Hợp đồng lao động chính thức</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="label">Ngày bắt đầu hiệu lực *</label>
                    <input
                      type="date"
                      className="input"
                      required
                      value={contractFormData.startDate}
                      onChange={(e) => {
                        const start = e.target.value;
                        setContractFormData({
                          ...contractFormData,
                          startDate: start,
                          endDate: calculateContractEndDate(start, 3),
                        });
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Ngày hết hạn (+3 tháng) *</label>
                    <input
                      type="date"
                      className="input"
                      required
                      value={contractFormData.endDate}
                      onChange={(e) =>
                        setContractFormData({ ...contractFormData, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Ghi chú hợp đồng</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Ghi chú điều khoản bổ sung hoặc lý do gia hạn..."
                    value={contractFormData.note}
                    onChange={(e) =>
                      setContractFormData({ ...contractFormData, note: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsContractModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Đang xử lý..." : "Xác Nhận Ký / Gia Hạn HĐ"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* MODAL: Nhập Excel */}
        {isImportModalOpen && (
          <Modal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            maxWidth="540px"
            closeOnOutsideClick={false}
          >
            <div className="modal-header">
              <div className="modal-title">Nhập Danh Sách Nhân Sự Từ Excel</div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setIsImportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportExcel} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body">
                <div
                  style={{
                    border: "2px dashed var(--border-color)",
                    borderRadius: "12px",
                    padding: "2rem 1.5rem",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--bg-input)",
                    marginBottom: "1.25rem",
                  }}
                  onClick={() => document.getElementById("fileInput")?.click()}
                >
                  <FileSpreadsheet
                    size={40}
                    color="var(--primary)"
                    style={{ margin: "0 auto 0.75rem auto" }}
                  />
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {importFile ? importFile.name : "Nhấn để chọn file Excel (.xlsx, .xls)"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Hỗ trợ định dạng bảng tính Excel chứa danh sách nhân viên
                  </div>
                  <input
                    type="file"
                    id="fileInput"
                    style={{ display: "none" }}
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setImportFile(e.target.files[0]);
                    }}
                  />
                </div>

                <div
                  style={{
                    background: "var(--bg-card)",
                    padding: "1rem",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                    📋 Các cột trong file Excel (Tiếng Việt hoặc Tiếng Anh):
                  </div>
                  <ul style={{ paddingLeft: "1.25rem", marginTop: "0.25rem" }}>
                    <li><strong>Họ và tên</strong> (Bắt buộc)</li>
                    <li><strong>Số điện thoại</strong> (Bắt buộc - dùng làm tài khoản đăng nhập)</li>
                    <li><strong>Số CCCD</strong>, <strong>Email</strong> (Không được trùng lặp)</li>
                    <li><strong>Ngân hàng</strong>, <strong>Số tài khoản</strong></li>
                    <li><strong>Vai trò</strong> (Nhân sự Remote, HR, Quản lý, Admin...)</li>
                    <li><strong>Trạng thái</strong> (Thử việc, Chính thức...)</li>
                  </ul>
                  <div style={{ marginTop: "0.5rem", color: "var(--info)" }}>
                    💡 Mật khẩu mặc định sau khi nhập: <strong>123456</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={importLoading || !importFile}
                >
                  {importLoading ? "Đang xử lý..." : "Tiến Hành Nhập"}
                </button>
              </div>
            </form>
          </Modal>
        )}

      {/* Contract Print & Preview Modal */}
      <ContractPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        user={selectedUserForPrint}
        onUserUpdated={fetchUsers}
      />
    </div>
  );
}
