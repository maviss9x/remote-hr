"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  LogOut,
  Shield,
  User,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Key,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  MapPin,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Modal } from "@/components/ui/Modal";

interface UserInfo {
  userId: number;
  role: string;
  fullName: string;
}

interface TopbarProps {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const PAGE_TITLES: Record<string, { title: string; category: string }> = {
  "/": { title: "Bảng điều khiển", category: "Tổng quan" },
  "/nhan-su": { title: "Hồ sơ nhân sự", category: "Quản lý nhân sự" },
  "/ca-lam-viec": { title: "Ca làm việc", category: "Quản lý nhân sự" },
  "/bao-cao": { title: "Báo cáo Seeding", category: "Công việc" },
  "/kiem-duyet": { title: "Kiểm duyệt QC", category: "Công việc" },
  "/kpi": { title: "KPI & Báo cáo", category: "Tổng hợp" },
  "/nghiem-thu": { title: "Nghiệm thu", category: "Tổng hợp" },
  "/admin": { title: "Cài đặt hệ thống", category: "Hệ thống" },
  "/thong-bao": { title: "Thông báo", category: "Hệ thống" },
};

export default function Topbar({ sidebarCollapsed = false, onToggleSidebar }: TopbarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  // Feature toggle: Đặt true khi hoàn thiện API và giao diện trang thông báo
  const SHOW_NOTIFICATIONS = false;
  const [notifications] = useState(0);

  // Profile Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<"info" | "password">("info");

  // Show/Hide Password States
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    fullName: "",
    phone: "",
    email: "",
    cccd: "",
    bankAccount: "",
    bankName: "",
    role: "",
    status: "",
    startDate: "",
    dateOfBirth: "",
    cccdDate: "",
    cccdPlace: "",
    currentAddress: "",
    permanentAddress: "",
    driveFolderUrl: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(console.error);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Fetch full profile when modal opens
  useEffect(() => {
    if (isProfileModalOpen) {
      setProfileLoading(true);
      setProfileMessage(null);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      fetch("/api/auth/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setProfileData({
              fullName: data.user.fullName || "",
              phone: data.user.phone || "",
              email: data.user.email || "",
              cccd: data.user.cccd || "",
              bankAccount: data.user.bankAccount || "",
              bankName: data.user.bankName || "",
              role: data.user.role || "",
              status: data.user.status || "",
              startDate: data.user.startDate ? new Date(data.user.startDate).toISOString().slice(0, 10) : "",
              dateOfBirth: data.user.dateOfBirth ? new Date(data.user.dateOfBirth).toISOString().slice(0, 10) : "",
              cccdDate: data.user.cccdDate ? new Date(data.user.cccdDate).toISOString().slice(0, 10) : "",
              cccdPlace: data.user.cccdPlace || "",
              currentAddress: data.user.currentAddress || "",
              permanentAddress: data.user.permanentAddress || "",
              driveFolderUrl: data.user.driveFolderUrl || "",
            });
          }
        })
        .catch(() => {
          setProfileMessage({ type: "error", text: "Không thể tải thông tin hồ sơ" });
        })
        .finally(() => {
          setProfileLoading(false);
        });
    }
  }, [isProfileModalOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      SUPER_ADMIN: "Super Admin",
      ADMIN: "Admin",
      HR: "Nhân sự",
      MANAGER: "Quản lý",
      QC: "Kiểm duyệt",
      NHAN_SU_HYBRID: "Nhân sự Remote",
    };
    return labels[role] || role;
  }

  function getRoleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      SUPER_ADMIN: "badge-danger",
      ADMIN: "badge-primary",
      HR: "badge-info",
      MANAGER: "badge-warning",
      QC: "badge-success",
      NHAN_SU_HYBRID: "badge-neutral",
    };
    return classes[role] || "badge-neutral";
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    setProfileMessage(null);

    try {
      if (activeProfileTab === "password") {
        if (!passwordForm.currentPassword) {
          throw new Error("Vui lòng nhập mật khẩu hiện tại");
        }
        if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
          throw new Error("Mật khẩu mới phải có tối thiểu 6 ký tự");
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
        }
      }

      const payload = {
        fullName: profileData.fullName,
        phone: profileData.phone,
        email: profileData.email,
        bankAccount: profileData.bankAccount,
        bankName: profileData.bankName,
        currentAddress: profileData.currentAddress,
        permanentAddress: profileData.permanentAddress,
        dateOfBirth: profileData.dateOfBirth || null,
        cccdDate: profileData.cccdDate || null,
        cccdPlace: profileData.cccdPlace,
        driveFolderUrl: profileData.driveFolderUrl || null,
        ...(activeProfileTab === "password"
          ? {
              currentPassword: passwordForm.currentPassword,
              newPassword: passwordForm.newPassword,
            }
          : {}),
      };

      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật hồ sơ thất bại");

      setProfileMessage({ type: "success", text: data.message || "Cập nhật thông tin thành công!" });
      if (data.user) {
        setUser((prev) => (prev ? { ...prev, fullName: data.user.fullName } : null));
      }
      if (activeProfileTab === "password") {
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message });
    } finally {
      setProfileSubmitting(false);
    }
  };

  const currentMeta = PAGE_TITLES[pathname] || { title: "Hệ thống", category: "Freetrip" };

  return (
    <>
      <header className="topbar">
        {/* Left: Sidebar Toggle Button & Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="btn btn-icon btn-ghost desktop-sidebar-btn"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: sidebarCollapsed ? "var(--primary)" : "var(--text-secondary)",
                backgroundColor: sidebarCollapsed ? "rgba(249, 115, 22, 0.12)" : "transparent",
                border: sidebarCollapsed ? "1px solid rgba(249, 115, 22, 0.3)" : "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={sidebarCollapsed ? "Mở rộng menu sidebar (Hiện thanh menu)" : "Thu gọn menu sidebar (Ẩn thanh menu)"}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span className="topbar-category" style={{ color: "var(--text-muted)", fontWeight: 500 }}>{currentMeta.category}</span>
            <ChevronRight size={14} className="topbar-chevron" style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <span style={{ color: "var(--text-primary)", fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden" }}>{currentMeta.title}</span>
          </div>
        </div>

        {/* Right: Notifications, Theme Switcher & User Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Notifications Icon Button */}
          {SHOW_NOTIFICATIONS && (
            <>
              <Link
                href="/thong-bao"
                className="btn-icon btn-ghost"
                style={{
                  position: "relative",
                  color: "var(--text-secondary)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  width: 38,
                  height: 38,
                  transition: "all var(--transition-fast)",
                }}
                title="Thông báo hệ thống"
              >
                <Bell size={18} />
                {notifications > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: "linear-gradient(135deg, #f43f5e, #e11d48)",
                      color: "white",
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(244, 63, 94, 0.4)",
                      border: "2px solid var(--bg-secondary)",
                    }}
                  >
                    {notifications}
                  </span>
                )}
              </Link>
              <div style={{ width: 1, height: 24, background: "var(--border-color)" }} />
            </>
          )}

          {/* User Info Profile Pill with Dropdown */}
          {user ? (
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <div
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                role="button"
                tabIndex={0}
                title="Tài khoản cá nhân"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.35rem 0.65rem 0.35rem 0.75rem",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-surface)",
                  border: isDropdownOpen ? "1px solid var(--primary)" : "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-sm)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  userSelect: "none",
                }}
                className="user-pill-container"
              >
                {/* Avatar with Online Dot */}
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      border: "1.5px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {user.fullName
                      .split(" ")
                      .map((w) => w[0])
                      .slice(-2)
                      .join("")}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: -1,
                      right: -1,
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      border: "1.5px solid var(--bg-surface)",
                    }}
                    title="Đang hoạt động"
                  />
                </div>

                {/* Name & Role */}
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      lineHeight: 1.2,
                    }}
                  >
                    {user.fullName}
                  </span>
                  <span
                    className={`badge ${getRoleBadgeClass(user.role)}`}
                    style={{
                      fontSize: "0.625rem",
                      padding: "0.05rem 0.35rem",
                      marginTop: "0.15rem",
                      alignSelf: "flex-start",
                    }}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </div>

                {/* Dropdown Chevron Indicator */}
                <ChevronDown
                  size={15}
                  style={{
                    color: "var(--text-muted)",
                    marginLeft: "0.15rem",
                    transition: "transform 0.2s ease",
                    transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    flexShrink: 0,
                  }}
                />
              </div>

              {/* Profile Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  className="profile-dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 240,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
                    zIndex: 50,
                    overflow: "hidden",
                    animation: "fadeInDown 0.15s ease-out",
                  }}
                >
                  {/* Dropdown Header */}
                  <div
                    style={{
                      padding: "0.85rem 1rem",
                      borderBottom: "1px solid var(--border-color)",
                      background: "var(--bg-secondary)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                      {user.fullName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ fontSize: "0.6875rem" }}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Actions */}
                  <div style={{ padding: "0.35rem" }}>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                    >
                      <User size={15} />
                      <span>Thông tin tài khoản</span>
                    </button>

                    <div style={{ height: "1px", background: "var(--border-color)", margin: "0.35rem 0" }} />

                    <button
                      type="button"
                      className="dropdown-item logout"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }}
                    >
                      <LogOut size={15} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="skeleton" style={{ width: 140, height: 36, borderRadius: "var(--radius-lg)" }} />
          )}
        </div>
      </header>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          maxWidth="640px"
          closeOnOutsideClick={false}
        >
          <div className="modal-header">
            <div>
              <div className="modal-title">Hồ Sơ Cá Nhân & Tài Khoản</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Xem thông tin, vai trò hệ thống và đổi mật khẩu bảo mật
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost btn-icon"
              onClick={() => setIsProfileModalOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              {/* Profile Card Banner */}
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "1.125rem",
                      fontWeight: 700,
                    }}
                  >
                    {profileData.fullName
                      ? profileData.fullName
                          .split(" ")
                          .map((w) => w[0])
                          .slice(-2)
                          .join("")
                      : "U"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>
                      {profileData.fullName || user?.fullName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span className={`badge ${getRoleBadgeClass(profileData.role || user?.role || "")}`}>
                        {getRoleLabel(profileData.role || user?.role || "")}
                      </span>
                      {profileData.status && (
                        <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                          {profileData.status === "ACTIVE"
                            ? "Chính thức"
                            : profileData.status === "PROBATION"
                            ? "Thử việc"
                            : profileData.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  <div>Ngày tham gia</div>
                  <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginTop: "2px" }}>
                    {profileData.startDate ? new Date(profileData.startDate).toLocaleDateString("vi-VN") : "---"}
                  </div>
                </div>
              </div>

              {/* Tabs Switcher */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  borderBottom: "1px solid var(--border-color)",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className={`btn btn-sm ${activeProfileTab === "info" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveProfileTab("info")}
                  style={{ gap: "6px" }}
                >
                  <User size={15} /> Thông tin hồ sơ
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeProfileTab === "password" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveProfileTab("password")}
                  style={{ gap: "6px" }}
                >
                  <Key size={15} /> Đổi mật khẩu
                </button>
              </div>

              {/* Message Alert */}
              {profileMessage && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.875rem",
                    background: profileMessage.type === "success" ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: profileMessage.type === "success" ? "var(--success)" : "var(--danger)",
                    border: `1px solid ${profileMessage.type === "success" ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                  }}
                >
                  {profileMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              {profileLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <div>Đang tải hồ sơ nhân sự...</div>
                </div>
              ) : activeProfileTab === "info" ? (
                /* TAB 1: THÔNG TIN HỒ SƠ */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Họ và tên *</label>
                    <input
                      type="text"
                      className="input"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số điện thoại (Tài khoản đăng nhập) *</label>
                    <input
                      type="tel"
                      className="input"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Email liên hệ</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="email@example.com"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số CCCD / CMND</label>
                    <input
                      type="text"
                      className="input"
                      value={profileData.cccd}
                      onChange={(e) => setProfileData({ ...profileData, cccd: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Sinh ngày</label>
                    <input
                      type="date"
                      className="input"
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Tên Ngân hàng</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ví dụ: MBBank, Vietcombank..."
                      value={profileData.bankName}
                      onChange={(e) => setProfileData({ ...profileData, bankName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số tài khoản ngân hàng</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Số tài khoản nhận lương"
                      value={profileData.bankAccount}
                      onChange={(e) => setProfileData({ ...profileData, bankAccount: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Nơi ở hiện nay</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Địa chỉ cư trú hiện tại"
                      value={profileData.currentAddress}
                      onChange={(e) => setProfileData({ ...profileData, currentAddress: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Địa chỉ thường trú</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Theo hộ khẩu / CCCD"
                      value={profileData.permanentAddress}
                      onChange={(e) => setProfileData({ ...profileData, permanentAddress: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Link Google Drive tổng nhân sự</span>
                      {profileData.driveFolderUrl && (
                        <a
                          href={profileData.driveFolderUrl}
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
                      placeholder="Ví dụ: https://drive.google.com/drive/folders/..."
                      value={profileData.driveFolderUrl}
                      onChange={(e) => setProfileData({ ...profileData, driveFolderUrl: e.target.value })}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                      Thư mục Google Drive tổng lưu trữ tài liệu, quy chuẩn (rule) và minh chứng làm việc cá nhân.
                    </span>
                  </div>
                </div>
              ) : (
                /* TAB 2: ĐỔI MẬT KHẨU CÓ ICON SHOW/HIDE */
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="label">Mật khẩu hiện tại *</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        className="input"
                        placeholder="Nhập mật khẩu đang sử dụng"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        required
                        style={{ paddingRight: "42px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        tabIndex={-1}
                        className="btn-icon btn-ghost password-toggle-btn"
                        title={showCurrentPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        aria-label={showCurrentPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label">Mật khẩu mới (Tối thiểu 6 ký tự) *</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        className="input"
                        placeholder="Nhập mật khẩu mới"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        required
                        minLength={6}
                        style={{ paddingRight: "42px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        tabIndex={-1}
                        className="btn-icon btn-ghost password-toggle-btn"
                        title={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label">Xác nhận mật khẩu mới *</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="input"
                        placeholder="Nhập lại mật khẩu mới"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        required
                        style={{ paddingRight: "42px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        tabIndex={-1}
                        className="btn-icon btn-ghost password-toggle-btn"
                        title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={profileSubmitting || profileLoading}
              >
                {profileSubmitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style jsx>{`
        .user-pill-container:hover {
          border-color: var(--primary) !important;
          background: rgba(249, 115, 22, 0.04) !important;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          width: 100%;
          padding: 0.6rem 0.85rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-primary);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .dropdown-item:hover {
          background: var(--bg-hover);
          color: var(--primary);
        }
        .dropdown-item.logout {
          color: var(--text-secondary);
        }
        .dropdown-item.logout:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
        }

        .password-toggle-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }
        .password-toggle-btn:hover {
          color: var(--primary);
          background: rgba(249, 115, 22, 0.12);
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
