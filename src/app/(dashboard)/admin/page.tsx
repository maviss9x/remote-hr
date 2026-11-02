"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { confirmModal, Modal } from "@/components/ui";
import {
  FileUp,
  Database,
  ShieldAlert,
  ShieldCheck,
  Users,
  BarChart3,
  Clock,
  Plus,
  Edit2,
  Lock,
  Unlock,
  KeyRound,
  Search,
  RefreshCw,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  TrendingUp,
  Award,
  Calendar,
  Layers,
  Flame,
  Tag,
  Palette,
  RotateCcw,
} from "lucide-react";
import { CustomTimePicker, CustomSelect } from "@/components/ui";

// ============================================
// TYPES
// ============================================

type RoleType = "SUPER_ADMIN" | "ADMIN" | "HR" | "MANAGER" | "QC" | "NHAN_SU_HYBRID";
type UserStatusType = "PROBATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

interface UserItem {
  id: number;
  fullName: string;
  email: string | null;
  phone: string;
  cccd: string | null;
  bankAccount: string | null;
  bankName: string | null;
  role: RoleType;
  status: UserStatusType;
  startDate: string;
  avatarUrl: string | null;
  createdAt: string;
  contracts?: Array<{
    id: number;
    startDate: string;
    endDate: string;
    status: string;
    contractType: string;
  }>;
}

interface KpiConfigData {
  id?: number;
  fbPerShift: number;
  threadPerShift: number;
  commentPerShift: number;
  minShiftsPerWeek: number;
  maxAbsentsPerMonth: number;
  minDaysForSalary: number;
  lateThresholdMinutes: number;
  effectiveFrom: string;
  createdAt?: string;
}

interface UserKpiItem {
  user: {
    id: number;
    fullName: string;
    phone: string;
    status: string;
    startDate: string;
    avatarUrl?: string | null;
  };
  kpi: {
    fbPerShift: number;
    threadPerShift: number;
    commentPerShift: number;
    minShiftsPerWeek: number;
    isCustom: boolean;
    note?: string | null;
    configId?: number;
  };
}

interface ShiftTimeConfig {
  label: string;
  startTime: string;
  endTime: string;
  icon: string;
  hourlyRate: number;
}

interface ShiftTimesState {
  MORNING: ShiftTimeConfig;
  AFTERNOON: ShiftTimeConfig;
  EVENING: ShiftTimeConfig;
}

interface ShiftRulesState {
  openDayOfWeek: number;
  openTime: string;
  closeDayOfWeek: number;
  closeTime: string;
  maxShiftsPerDay: number;
  minShiftsPerWeek: number;
  allowCancelHoursBefore: number;
  maxAbsentsPerMonth: number;
  maxUsersPerShift?: number;
  tagPostGraceDays?: number;
  viralPostGraceDays?: number;
  lateCheckinMinutes?: number;
  postShiftEditMinutes?: number;
  participationThresholdPercent?: number;
}

interface ViralTierItem {
  id: number;
  platform: "FACEBOOK" | "THREADS";
  contentType: "POST" | "COMMENT";
  minLikes: number;
  bonusAmount: number;
}

interface PostTagConfigItem {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

const DAY_OPTIONS = [
  { value: 1, label: "Thứ Hai" },
  { value: 2, label: "Thứ Ba" },
  { value: 3, label: "Thứ Tư" },
  { value: 4, label: "Thứ Năm" },
  { value: 5, label: "Thứ Sáu" },
  { value: 6, label: "Thứ Bảy" },
  { value: 0, label: "Chủ Nhật" },
];

const TAG_COLOR_PRESETS = [
  { name: "Xanh dương", color: "#3b82f6" },
  { name: "Tím", color: "#a855f7" },
  { name: "Hồng", color: "#ec4899" },
  { name: "Xanh ngọc", color: "#10b981" },
  { name: "Cam", color: "#f97316" },
  { name: "Đỏ", color: "#ef4444" },
  { name: "Vàng chanh", color: "#eab308" },
  { name: "Xanh lục", color: "#14b8a6" },
  { name: "Chàm", color: "#6366f1" },
  { name: "Xám đá", color: "#64748b" },
];

export default function AdminPage() {
  // 1. Session state
  const [currentUser, setCurrentUser] = useState<{ userId: number; role: RoleType; fullName: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"management-accounts" | "staff-accounts" | "kpi" | "shifts" | "viral" | "post-tags">("management-accounts");

  // Target type when creating account (MANAGEMENT vs STAFF)
  const [createTargetType, setCreateTargetType] = useState<"MANAGEMENT" | "STAFF">("MANAGEMENT");

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ============================================
  // TAB 1 & 2: ACCOUNTS STATE
  // ============================================
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userStats, setUserStats] = useState<{
    total: number;
    managementTotal: number;
    staffTotal: number;
    byRole: Record<string, number>;
  }>({
    total: 0,
    managementTotal: 0,
    staffTotal: 0,
    byRole: {},
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals for Accounts
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [submittingAccount, setSubmittingAccount] = useState(false);

  // Create User Form state
  const [createForm, setCreateForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    cccd: "",
    bankAccount: "",
    bankName: "",
    role: "NHAN_SU_HYBRID" as RoleType,
    status: "ACTIVE" as UserStatusType,
    startDate: new Date().toISOString().split("T")[0],
    customPassword: "",
    contractType: "khoan_viec",
  });

  // Edit User Form state
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    cccd: "",
    bankAccount: "",
    bankName: "",
    role: "NHAN_SU_HYBRID" as RoleType,
    status: "ACTIVE" as UserStatusType,
    startDate: "",
    newPassword: "",
  });

  // ============================================
  // TAB 2: KPI STATE
  // ============================================
  const [kpiForm, setKpiForm] = useState<KpiConfigData>({
    fbPerShift: 10,
    threadPerShift: 4,
    commentPerShift: 50,
    minShiftsPerWeek: 5,
    maxAbsentsPerMonth: 3,
    minDaysForSalary: 3,
    lateThresholdMinutes: 60,
    effectiveFrom: new Date().toISOString().split("T")[0],
  });
  const [kpiHistory, setKpiHistory] = useState<KpiConfigData[]>([]);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [savingKpi, setSavingKpi] = useState(false);

  // User Specific KPI State
  const [userKpiList, setUserKpiList] = useState<UserKpiItem[]>([]);
  const [loadingUserKpi, setLoadingUserKpi] = useState(false);
  const [userKpiSearch, setUserKpiSearch] = useState("");
  const [selectedUserKpi, setSelectedUserKpi] = useState<UserKpiItem | null>(null);
  const [showUserKpiModal, setShowUserKpiModal] = useState(false);
  const [userKpiForm, setUserKpiForm] = useState({
    fbPerShift: 10,
    threadPerShift: 4,
    commentPerShift: 50,
    minShiftsPerWeek: 5,
    note: "",
    effectiveFrom: new Date().toISOString().split("T")[0],
  });
  const [savingUserKpi, setSavingUserKpi] = useState(false);

  // ============================================
  // TAB 3: SHIFTS CONFIG STATE
  // ============================================
  const [shiftTimes, setShiftTimes] = useState<ShiftTimesState>({
    MORNING: { label: "Ca Sáng", startTime: "08:30", endTime: "12:30", icon: "☀️", hourlyRate: 25000 },
    AFTERNOON: { label: "Ca Chiều", startTime: "13:30", endTime: "17:30", icon: "🌤️", hourlyRate: 25000 },
    EVENING: { label: "Ca Tối", startTime: "20:00", endTime: "24:00", icon: "🌙", hourlyRate: 33000 },
  });
  const [shiftRules, setShiftRules] = useState<ShiftRulesState>({
    openDayOfWeek: 5,
    openTime: "00:00",
    closeDayOfWeek: 0,
    closeTime: "23:59",
    maxShiftsPerDay: 2,
    minShiftsPerWeek: 5,
    allowCancelHoursBefore: 4,
    maxAbsentsPerMonth: 3,
    maxUsersPerShift: 10,
    tagPostGraceDays: 7,
    viralPostGraceDays: 30,
    lateCheckinMinutes: 60,
    postShiftEditMinutes: 60,
    participationThresholdPercent: 70,
  });
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [savingShifts, setSavingShifts] = useState(false);

  // ============================================
  // TAB 4: VIRAL TIERS STATE
  // ============================================
  const [viralTiers, setViralTiers] = useState<ViralTierItem[]>([]);
  const [loadingViral, setLoadingViral] = useState(false);
  const [showViralModal, setShowViralModal] = useState(false);
  const [editingTier, setEditingTier] = useState<ViralTierItem | null>(null);
  const [viralFilterPlatform, setViralFilterPlatform] = useState<string>("ALL");
  const [viralForm, setViralForm] = useState({
    platform: "FACEBOOK" as "FACEBOOK" | "THREADS",
    contentType: "POST" as "POST" | "COMMENT",
    minLikes: 500,
    bonusAmount: 50000,
  });
  const [submittingViral, setSubmittingViral] = useState(false);

  // ============================================
  // TAB 5: POST TAGS CONFIG STATE
  // ============================================
  const [postTags, setPostTags] = useState<PostTagConfigItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<PostTagConfigItem | null>(null);
  const [tagForm, setTagForm] = useState({ name: "", color: "#3b82f6" });

  // ============================================
  // 1. AUTH CHECK
  // ============================================
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(console.error)
      .finally(() => setCheckingAuth(false));
  }, []);

  // ============================================
  // 2. DATA FETCHING HANDLERS
  // ============================================

  // Fetch Users based on active tab
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const params = new URLSearchParams();
      const currentScope = activeTab === "staff-accounts" ? "STAFF" : "MANAGEMENT";
      params.append("scope", currentScope);

      if (searchQuery) params.append("search", searchQuery);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Không thể tải danh sách tài khoản");
      const data = await res.json();
      setUsers(data.users || []);
      setUserStats(
        data.stats || {
          total: 0,
          managementTotal: 0,
          staffTotal: 0,
          byRole: {},
        }
      );
    } catch (err: any) {
      showToast(err.message || "Lỗi tải tài khoản", "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [activeTab, searchQuery, roleFilter, statusFilter]);

  // Tab change handler (resets filters on account tab switch)
  const handleTabChange = (newTab: "management-accounts" | "staff-accounts" | "kpi" | "shifts" | "viral" | "post-tags") => {
    if (newTab !== activeTab) {
      if (
        (activeTab === "management-accounts" && newTab === "staff-accounts") ||
        (activeTab === "staff-accounts" && newTab === "management-accounts")
      ) {
        setSearchQuery("");
        setRoleFilter("ALL");
        setStatusFilter("ALL");
      }
      setActiveTab(newTab);
    }
  };

  // Fetch KPI Config
  const fetchKpiConfig = useCallback(async () => {
    try {
      setLoadingKpi(true);
      const res = await fetch("/api/admin/kpi-config");
      if (!res.ok) throw new Error("Không thể tải cấu hình KPI");
      const data = await res.json();
      if (data.config) {
        setKpiForm({
          ...data.config,
          effectiveFrom: data.config.effectiveFrom
            ? new Date(data.config.effectiveFrom).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        });
      }
      setKpiHistory(data.history || []);
    } catch (err: any) {
      showToast(err.message || "Lỗi tải cấu hình KPI", "error");
    } finally {
      setLoadingKpi(false);
    }
  }, []);

  // Fetch User KPI List
  const fetchUserKpiList = useCallback(async (query: string = userKpiSearch) => {
    try {
      setLoadingUserKpi(true);
      const res = await fetch(`/api/admin/user-kpi?search=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Không thể tải danh sách KPI nhân sự");
      const data = await res.json();
      setUserKpiList(data.users || []);
    } catch (err: any) {
      showToast(err.message || "Lỗi tải KPI nhân sự", "error");
    } finally {
      setLoadingUserKpi(false);
    }
  }, [userKpiSearch]);

  // Fetch Shifts Config
  const fetchShiftsConfig = useCallback(async () => {
    try {
      setLoadingShifts(true);
      const res = await fetch("/api/admin/shifts-config");
      if (!res.ok) throw new Error("Không thể tải cấu hình ca làm việc");
      const data = await res.json();
      if (data.shiftTimes) setShiftTimes(data.shiftTimes);
      if (data.shiftRules) setShiftRules(data.shiftRules);
    } catch (err: any) {
      showToast(err.message || "Lỗi tải cấu hình ca làm việc", "error");
    } finally {
      setLoadingShifts(false);
    }
  }, []);

  // Fetch Viral Tiers
  const fetchViralTiers = useCallback(async () => {
    try {
      setLoadingViral(true);
      const res = await fetch("/api/admin/viral-tiers");
      if (!res.ok) throw new Error("Không thể tải bảng mức thưởng viral");
      const data = await res.json();
      setViralTiers(data.tiers || []);
    } catch (err: any) {
      showToast(err.message || "Lỗi tải mức thưởng viral", "error");
    } finally {
      setLoadingViral(false);
    }
  }, []);

  // Fetch Post Tags
  const fetchPostTags = useCallback(async () => {
    try {
      setLoadingTags(true);
      const res = await fetch("/api/post-tags");
      if (!res.ok) throw new Error("Không thể tải cấu hình tag bài viết");
      const data = await res.json();
      setPostTags(data.tags || []);
    } catch (err: any) {
      showToast(err.message || "Lỗi tải cấu hình tag", "error");
    } finally {
      setLoadingTags(false);
    }
  }, []);

  // Load data based on tab
  useEffect(() => {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") return;

    if (activeTab === "management-accounts" || activeTab === "staff-accounts") fetchUsers();
    if (activeTab === "kpi") {
      fetchKpiConfig();
      fetchUserKpiList();
    }
    if (activeTab === "shifts") fetchShiftsConfig();
    if (activeTab === "viral") fetchViralTiers();
    if (activeTab === "post-tags") fetchPostTags();
  }, [activeTab, currentUser, fetchUsers, fetchKpiConfig, fetchUserKpiList, fetchShiftsConfig, fetchViralTiers, fetchPostTags]);

  // ============================================
  // TAB 1 ACTIONS: CREATE / EDIT USER
  // ============================================

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim() || !createForm.phone.trim()) {
      showToast("Vui lòng nhập họ tên và số điện thoại", "error");
      return;
    }

    try {
      setSubmittingAccount(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo tài khoản thất bại");

      showToast(data.message || "Khởi tạo tài khoản thành công!");
      setShowCreateModal(false);
      setCreateForm({
        fullName: "",
        phone: "",
        email: "",
        cccd: "",
        bankAccount: "",
        bankName: "",
        role: "NHAN_SU_HYBRID",
        status: "ACTIVE",
        startDate: new Date().toISOString().split("T")[0],
        customPassword: "",
        contractType: "khoan_viec",
      });
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingAccount(false);
    }
  };

  const openCreateManagementModal = () => {
    setCreateTargetType("MANAGEMENT");
    setCreateForm({
      fullName: "",
      phone: "",
      email: "",
      cccd: "",
      bankAccount: "",
      bankName: "",
      role: "ADMIN",
      status: "ACTIVE",
      startDate: new Date().toISOString().split("T")[0],
      customPassword: "",
      contractType: "khoan_viec",
    });
    setShowCreateModal(true);
  };

  const openCreateStaffModal = () => {
    setCreateTargetType("STAFF");
    setCreateForm({
      fullName: "",
      phone: "",
      email: "",
      cccd: "",
      bankAccount: "",
      bankName: "",
      role: "NHAN_SU_HYBRID",
      status: "ACTIVE",
      startDate: new Date().toISOString().split("T")[0],
      customPassword: "",
      contractType: "khoan_viec",
    });
    setShowCreateModal(true);
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName || "",
      phone: user.phone || "",
      email: user.email || "",
      cccd: user.cccd || "",
      bankAccount: user.bankAccount || "",
      bankName: user.bankName || "",
      role: user.role,
      status: user.status,
      startDate: user.startDate ? new Date(user.startDate).toISOString().split("T")[0] : "",
      newPassword: "",
    });
    setShowEditModal(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setSubmittingAccount(true);
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật tài khoản thất bại");

      showToast(data.message || "Cập nhật tài khoản thành công!");
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingAccount(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    if (currentUser?.userId === user.id) {
      showToast("Bạn không thể tự khóa tài khoản của chính mình!", "error");
      return;
    }

    const nextStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const isSuspending = nextStatus === "SUSPENDED";
    const confirmText = isSuspending
      ? `Bạn có chắc chắn muốn TẠM KHÓA tài khoản của "${user.fullName}"?`
      : `Kích hoạt lại tài khoản của "${user.fullName}"?`;

    const isConfirmed = await confirmModal({
      title: isSuspending ? "Xác nhận khóa tài khoản" : "Kích hoạt tài khoản",
      message: confirmText,
      confirmText: isSuspending ? "Khóa tài khoản" : "Kích hoạt",
      cancelText: "Hủy",
      type: isSuspending ? "danger" : "primary",
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thao tác thất bại");
      showToast(`Đã ${nextStatus === "SUSPENDED" ? "khóa" : "kích hoạt"} tài khoản thành công`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // ============================================
  // TAB 2 ACTIONS: KPI CONFIG
  // ============================================

  const handleSaveKpiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingKpi(true);
      const res = await fetch("/api/admin/kpi-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kpiForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu cấu hình KPI thất bại");

      showToast("Lưu và áp dụng chỉ tiêu KPI toàn hệ thống thành công!");
      fetchKpiConfig();
      fetchUserKpiList();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingKpi(false);
    }
  };

  const handleOpenUserKpiModal = (item: UserKpiItem) => {
    setSelectedUserKpi(item);
    setUserKpiForm({
      fbPerShift: item.kpi.fbPerShift,
      threadPerShift: item.kpi.threadPerShift,
      commentPerShift: item.kpi.commentPerShift,
      minShiftsPerWeek: item.kpi.minShiftsPerWeek,
      note: item.kpi.note || "",
      effectiveFrom: new Date().toISOString().split("T")[0],
    });
    setShowUserKpiModal(true);
  };

  const handleSaveUserKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserKpi) return;
    try {
      setSavingUserKpi(true);
      const res = await fetch("/api/admin/user-kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserKpi.user.id,
          ...userKpiForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu chỉ tiêu riêng thất bại");
      showToast(data.message || "Đã cập nhật chỉ tiêu riêng cho nhân sự!");
      setShowUserKpiModal(false);
      fetchUserKpiList();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingUserKpi(false);
    }
  };

  const handleResetUserKpiToDefault = async (userId: number, userName: string) => {
    const isConfirmed = await confirmModal({
      title: "Khôi phục KPI mặc định",
      message: `Bạn có chắc muốn hủy bỏ cấu hình KPI riêng của nhân sự ${userName} và quay về áp dụng KPI mặc định toàn hệ thống?`,
      confirmText: "Khôi phục mặc định",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch("/api/admin/user-kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          resetToDefault: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Khôi phục KPI thất bại");
      showToast(data.message || "Đã khôi phục KPI mặc định cho nhân sự!");
      fetchUserKpiList();
      if (showUserKpiModal) setShowUserKpiModal(false);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // ============================================
  // TAB 3 ACTIONS: SHIFTS CONFIG
  // ============================================

  const handleSaveShiftsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingShifts(true);
      const res = await fetch("/api/admin/shifts-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftTimes, shiftRules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu cấu hình ca thất bại");

      showToast("Lưu cài đặt khung giờ và quy chế ca thành công!");
      fetchShiftsConfig();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingShifts(false);
    }
  };

  // ============================================
  // TAB 4 ACTIONS: VIRAL TIERS
  // ============================================

  const handleSaveViralTier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingViral(true);
      const url = editingTier ? `/api/admin/viral-tiers/${editingTier.id}` : "/api/admin/viral-tiers";
      const method = editingTier ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(viralForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu mức thưởng thất bại");

      showToast(data.message || "Đã lưu mức thưởng viral thành công!");
      setShowViralModal(false);
      setEditingTier(null);
      fetchViralTiers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingViral(false);
    }
  };

  const handleDeleteViralTier = async (id: number) => {
    const isConfirmed = await confirmModal({
      title: "Xác nhận xóa mốc thưởng",
      message: "Bạn có chắc chắn muốn xóa mốc thưởng viral này khỏi hệ thống?",
      confirmText: "Xóa mốc",
      cancelText: "Hủy",
      type: "danger",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/viral-tiers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa mức thưởng thất bại");
      showToast("Đã xóa mức thưởng viral!");
      fetchViralTiers();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSeedDefaultTiers = async () => {
    const defaultTiers = [
      { platform: "FACEBOOK", contentType: "POST", minLikes: 200, bonusAmount: 20000 },
      { platform: "FACEBOOK", contentType: "POST", minLikes: 500, bonusAmount: 50000 },
      { platform: "FACEBOOK", contentType: "POST", minLikes: 1000, bonusAmount: 100000 },
      { platform: "FACEBOOK", contentType: "POST", minLikes: 3000, bonusAmount: 200000 },
      { platform: "FACEBOOK", contentType: "POST", minLikes: 5000, bonusAmount: 350000 },
      { platform: "THREADS", contentType: "POST", minLikes: 100, bonusAmount: 20000 },
      { platform: "THREADS", contentType: "POST", minLikes: 300, bonusAmount: 50000 },
      { platform: "THREADS", contentType: "POST", minLikes: 1000, bonusAmount: 120000 },
    ];

    try {
      setLoadingViral(true);
      for (const tier of defaultTiers) {
        await fetch("/api/admin/viral-tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tier),
        });
      }
      showToast("Đã khởi tạo các bậc thưởng viral tiêu chuẩn thành công!");
      fetchViralTiers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoadingViral(false);
    }
  };

  // ============================================
  // TAB 5 ACTIONS: POST TAGS CONFIG
  // ============================================
  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagForm.name.trim()) {
      showToast("Vui lòng nhập tên tag loại bài viết", "error");
      return;
    }

    try {
      setSavingTags(true);
      let updatedTags: PostTagConfigItem[];

      if (editingTag) {
        updatedTags = postTags.map((t) =>
          t.id === editingTag.id ? { ...t, name: tagForm.name.trim(), color: tagForm.color } : t
        );
      } else {
        const slug = tagForm.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || `tag-${Date.now()}`;

        let finalId = slug;
        let counter = 1;
        while (postTags.some((t) => t.id === finalId)) {
          finalId = `${slug}-${counter++}`;
        }

        updatedTags = [
          ...postTags,
          {
            id: finalId,
            name: tagForm.name.trim(),
            color: tagForm.color,
            isDefault: false,
          },
        ];
      }

      const res = await fetch("/api/post-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lưu tag bài viết thất bại");

      showToast(data.message || "Đã lưu tag bài viết thành công!");
      setPostTags(data.tags || updatedTags);
      setShowTagModal(false);
      setEditingTag(null);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingTags(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const tagToDelete = postTags.find((t) => t.id === tagId);
    if (!tagToDelete) return;

    if (postTags.length <= 1) {
      showToast("Hệ thống phải duy trì ít nhất 1 tag bài viết!", "error");
      return;
    }

    const isConfirmed = await confirmModal({
      title: "Xác nhận xóa tag bài viết",
      message: `Bạn có chắc muốn xóa tag "${tagToDelete.name}"? Các bài viết cũ từng gắn tag này vẫn giữ nguyên lịch sử nhưng tag sẽ không còn xuất hiện khi nộp bài mới.`,
      confirmText: "Xóa tag",
      cancelText: "Hủy",
      type: "danger",
    });
    if (!isConfirmed) return;

    try {
      setSavingTags(true);
      const updatedTags = postTags.filter((t) => t.id !== tagId);
      const res = await fetch("/api/post-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa tag thất bại");

      showToast("Đã xóa tag bài viết thành công!");
      setPostTags(data.tags || updatedTags);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingTags(false);
    }
  };

  const handleResetDefaultTags = async () => {
    const isConfirmed = await confirmModal({
      title: "Khôi phục danh mục Tag mặc định",
      message: "Bạn có chắc chắn muốn khôi phục về 4 tag mặc định ban đầu: Nạp thẻ, Fastdate, Secret chat, Các tính năng khác?",
      confirmText: "Khôi phục mặc định",
      cancelText: "Hủy",
      type: "warning",
    });
    if (!isConfirmed) return;

    const defaultTags: PostTagConfigItem[] = [
      { id: "nap-the", name: "Nạp thẻ", color: "#3b82f6", isDefault: true },
      { id: "fastdate", name: "Fastdate", color: "#a855f7", isDefault: true },
      { id: "secret-chat", name: "Secret chat", color: "#ec4899", isDefault: true },
      { id: "other", name: "Các tính năng khác", color: "#10b981", isDefault: true },
    ];

    try {
      setSavingTags(true);
      const res = await fetch("/api/post-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: defaultTags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Khôi phục thất bại");

      showToast("Đã khôi phục về danh mục tag mặc định!");
      setPostTags(data.tags || defaultTags);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingTags(false);
    }
  };

  // Helper Badge Renderers
  const getRoleBadge = (role: RoleType) => {
    switch (role) {
      case "SUPER_ADMIN":
        return <span className="badge badge-primary">Super Admin</span>;
      case "ADMIN":
        return <span className="badge badge-info">Quản trị viên</span>;
      case "HR":
        return <span className="badge badge-info">Nhân sự (HR)</span>;
      case "MANAGER":
        return <span className="badge badge-warning">Quản lý ca</span>;
      case "QC":
        return <span className="badge badge-neutral">Kiểm duyệt QC</span>;
      case "NHAN_SU_HYBRID":
      default:
        return <span className="badge badge-success">Nhân sự Remote</span>;
    }
  };

  const getStatusBadge = (status: UserStatusType) => {
    switch (status) {
      case "ACTIVE":
        return <span className="badge badge-success">● Đang làm việc</span>;
      case "PROBATION":
        return <span className="badge badge-warning">● Thử việc</span>;
      case "SUSPENDED":
        return <span className="badge badge-danger">● Tạm đình chỉ</span>;
      case "INACTIVE":
      default:
        return <span className="badge badge-neutral">● Đã nghỉ việc</span>;
    }
  };

  // ============================================
  // AUTH GUARD UI
  // ============================================
  if (checkingAuth) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: "1rem" }}>
        <RefreshCw className="animate-spin text-orange-500" size={36} />
        <p style={{ color: "var(--text-muted)", fontWeight: 500 }}>Đang xác thực quyền truy cập Quản trị viên...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "1.5rem", textAlign: "center" }}>
        <div style={{ width: "70px", height: "70px", borderRadius: "16px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem", color: "var(--danger)" }}>
          <ShieldAlert size={38} />
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Khu vực Giới hạn Tuyệt đối</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "450px", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Trang Cài đặt Hệ thống cốt lõi chỉ dành riêng cho tài khoản có quyền Quản trị viên cao nhất (
          <span style={{ color: "#c084fc", fontWeight: 600 }}>SUPER_ADMIN</span>). Tài khoản hiện tại của bạn không có đủ thẩm quyền.
        </p>
        <a href="/" className="btn btn-primary btn-sm">
          Trở về Bảng Điều Khiển
        </a>
      </div>
    );
  }

  // Filtered viral tiers
  const filteredViralTiers = viralTiers.filter((t) => {
    if (viralFilterPlatform !== "ALL" && t.platform !== viralFilterPlatform) return false;
    return true;
  });

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

      {/* ============================================
          HEADER SECTION
      ============================================ */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
            <h1 className="page-title">Cài Đặt Hệ Thống Quản Trị</h1>
            <span className="badge badge-primary">SUPER_ADMIN</span>
          </div>
          <p className="page-subtitle">
            Toàn quyền quản trị tài khoản cấp dưới, cấu hình chỉ tiêu KPI, ca làm việc và mức thưởng viral
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link
            href="/admin/import"
            className="btn btn-primary"
            style={{ gap: "0.5rem" }}
          >
            <Database size={16} />
            <span>Dữ liệu</span>
          </Link>

          {/* User Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "var(--bg-card)",
              padding: "0.5rem 0.875rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}
          >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.875rem",
              color: "#fff",
            }}
          >
            {currentUser.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {currentUser.fullName}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#c084fc", fontWeight: 500 }}>Quản trị viên Tối cao</div>
          </div>
        </div>
      </div>
    </div>

      {/* ============================================
          TABS NAVIGATION
      ============================================ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => handleTabChange("management-accounts")}
          className={`btn btn-sm ${activeTab === "management-accounts" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <ShieldCheck size={16} />
          <span>Tài khoản Quản lý</span>
          <span
            style={{
              background: activeTab === "management-accounts" ? "rgba(0,0,0,0.25)" : "var(--bg-surface)",
              padding: "0.1rem 0.45rem",
              borderRadius: "999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {userStats.managementTotal}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("staff-accounts")}
          className={`btn btn-sm ${activeTab === "staff-accounts" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Users size={16} />
          <span>Tài khoản Nhân viên</span>
          <span
            style={{
              background: activeTab === "staff-accounts" ? "rgba(0,0,0,0.25)" : "var(--bg-surface)",
              padding: "0.1rem 0.45rem",
              borderRadius: "999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {userStats.staffTotal}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("kpi")}
          className={`btn btn-sm ${activeTab === "kpi" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <BarChart3 size={16} />
          <span>Chỉ tiêu KPI</span>
        </button>

        <button
          onClick={() => handleTabChange("shifts")}
          className={`btn btn-sm ${activeTab === "shifts" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Clock size={16} />
          <span>Cài đặt Ca làm việc</span>
        </button>

        <button
          onClick={() => handleTabChange("viral")}
          className={`btn btn-sm ${activeTab === "viral" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Flame size={16} />
          <span>Thưởng Bài Viral</span>
          <span
            style={{
              background: activeTab === "viral" ? "rgba(0,0,0,0.25)" : "var(--bg-surface)",
              padding: "0.1rem 0.45rem",
              borderRadius: "999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {viralTiers.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("post-tags")}
          className={`btn btn-sm ${activeTab === "post-tags" ? "btn-primary" : "btn-secondary"}`}
          style={{ gap: "0.5rem" }}
        >
          <Tag size={16} />
          <span>Tag Loại Bài Viết</span>
          <span
            style={{
              background: activeTab === "post-tags" ? "rgba(0,0,0,0.25)" : "var(--bg-surface)",
              padding: "0.1rem 0.45rem",
              borderRadius: "999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {postTags.length}
          </span>
        </button>
      </div>

      {/* ============================================
          TAB 1 CONTENT: QUẢN LÝ TÀI KHOẢN QUẢN LÝ
      ============================================ */}
      {activeTab === "management-accounts" && (
        <div>
          {/* Quick Stats Grid */}
          <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(249, 115, 22, 0.15)", color: "var(--primary)" }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="stat-value">{userStats.managementTotal}</div>
                <div className="stat-label">Tổng tài khoản quản lý</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--info)" }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <div className="stat-value">
                  {(userStats.byRole["SUPER_ADMIN"] || 0) + (userStats.byRole["ADMIN"] || 0)}
                </div>
                <div className="stat-label">Quản trị viên (Admin)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(45, 212, 191, 0.15)", color: "#2dd4bf" }}>
                <Users size={22} />
              </div>
              <div>
                <div className="stat-value">
                  {(userStats.byRole["HR"] || 0) + (userStats.byRole["QC"] || 0)}
                </div>
                <div className="stat-label">HR & Kiểm duyệt (QC)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(234, 179, 8, 0.15)", color: "var(--warning)" }}>
                <Clock size={22} />
              </div>
              <div>
                <div className="stat-value">{userStats.byRole["MANAGER"] || 0}</div>
                <div className="stat-label">Quản lý ca (Manager)</div>
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
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
                  placeholder="Tìm theo họ tên, số điện thoại, email, CCCD..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <select
                className="select"
                style={{ width: "auto" }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">Mọi vai trò quản lý</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Quản trị viên (Admin)</option>
                <option value="HR">Hành chính (HR)</option>
                <option value="MANAGER">Quản lý (Manager)</option>
                <option value="QC">Kiểm duyệt (QC)</option>
              </select>

              <select
                className="select"
                style={{ width: "auto" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Mọi trạng thái</option>
                <option value="ACTIVE">Đang làm việc</option>
                <option value="SUSPENDED">Bị tạm khóa</option>
                <option value="INACTIVE">Đã nghỉ việc</option>
              </select>

              <button
                className="btn btn-secondary btn-icon"
                onClick={fetchUsers}
                title="Làm mới danh sách"
              >
                <RefreshCw size={16} className={loadingUsers ? "animate-spin" : ""} />
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={openCreateManagementModal}
              >
                <Plus size={16} /> Tạo tài khoản Quản lý
              </button>
            </div>
          </div>

          {/* Management Users Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Tài khoản (SĐT)</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tham gia</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem" }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem auto", color: "var(--primary)" }} />
                      <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Đang tải danh sách tài khoản quản lý...</div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                      Không tìm thấy tài khoản quản lý phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = currentUser?.userId === u.id;

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                color: "white",
                                flexShrink: 0,
                              }}
                            >
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.fullName}</span>
                                {isSelf && (
                                  <span className="badge badge-primary" style={{ fontSize: "0.6875rem", padding: "0.1rem 0.4rem" }}>
                                    Bạn
                                  </span>
                                )}
                              </div>
                              {u.email && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                            {u.phone}
                          </span>
                        </td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td>{getStatusBadge(u.status)}</td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          {u.startDate ? new Date(u.startDate).toLocaleDateString("vi-VN") : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                            <button
                              onClick={() => openEditModal(u)}
                              title="Chỉnh sửa tài khoản & Quyền"
                              className="btn btn-ghost btn-sm btn-icon"
                            >
                              <Edit2 size={15} />
                            </button>

                            {!isSelf ? (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                title={u.status === "ACTIVE" ? "Tạm khóa tài khoản" : "Kích hoạt lại"}
                                className="btn btn-ghost btn-sm btn-icon"
                                style={{
                                  color: u.status === "ACTIVE" ? "var(--warning)" : "var(--success)",
                                }}
                              >
                                {u.status === "ACTIVE" ? <Lock size={15} /> : <Unlock size={15} />}
                              </button>
                            ) : (
                              <span
                                title="Không thể tự khóa tài khoản của chính mình"
                                className="btn btn-ghost btn-sm btn-icon"
                                style={{ opacity: 0.3, cursor: "not-allowed" }}
                              >
                                <Lock size={15} />
                              </span>
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

      {/* ============================================
          TAB 2 CONTENT: QUẢN LÝ TÀI KHOẢN NHÂN VIÊN
      ============================================ */}
      {activeTab === "staff-accounts" && (
        <div>
          {/* Quick Stats Grid */}
          <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(34, 197, 94, 0.15)", color: "var(--success)" }}>
                <Users size={22} />
              </div>
              <div>
                <div className="stat-value">{userStats.staffTotal}</div>
                <div className="stat-label">Tổng nhân viên Remote</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--info)" }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="stat-value">
                  {users.filter((u) => u.status === "ACTIVE").length}
                </div>
                <div className="stat-label">Chính thức (Đang làm)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(234, 179, 8, 0.15)", color: "var(--warning)" }}>
                <Clock size={22} />
              </div>
              <div>
                <div className="stat-value">
                  {users.filter((u) => u.status === "PROBATION").length}
                </div>
                <div className="stat-label">Đang thử việc</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <div className="stat-value">
                  {users.filter((u) => u.status === "SUSPENDED" || u.status === "INACTIVE").length}
                </div>
                <div className="stat-label">Tạm khóa / Đã nghỉ</div>
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
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
                  placeholder="Tìm theo họ tên, số điện thoại, email, CCCD..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                <option value="ALL">Mọi trạng thái</option>
                <option value="ACTIVE">Đang làm việc</option>
                <option value="PROBATION">Thử việc</option>
                <option value="SUSPENDED">Bị tạm khóa</option>
                <option value="INACTIVE">Đã nghỉ việc</option>
              </select>

              <button
                className="btn btn-secondary btn-icon"
                onClick={fetchUsers}
                title="Làm mới danh sách"
              >
                <RefreshCw size={16} className={loadingUsers ? "animate-spin" : ""} />
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={openCreateStaffModal}
              >
                <Plus size={16} /> Tạo tài khoản Nhân viên
              </button>
            </div>
          </div>

          {/* Staff Users Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Tài khoản (SĐT)</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tham gia</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem" }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem auto", color: "var(--primary)" }} />
                      <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Đang tải danh sách tài khoản nhân viên...</div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                      Không tìm thấy tài khoản nhân viên phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = currentUser?.userId === u.id;

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #10b981, #059669)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                color: "white",
                                flexShrink: 0,
                              }}
                            >
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.fullName}</span>
                                {isSelf && (
                                  <span className="badge badge-primary" style={{ fontSize: "0.6875rem", padding: "0.1rem 0.4rem" }}>
                                    Bạn
                                  </span>
                                )}
                              </div>
                              {u.email && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                            {u.phone}
                          </span>
                        </td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td>{getStatusBadge(u.status)}</td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          {u.startDate ? new Date(u.startDate).toLocaleDateString("vi-VN") : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                            <button
                              onClick={() => openEditModal(u)}
                              title="Chỉnh sửa tài khoản"
                              className="btn btn-ghost btn-sm btn-icon"
                            >
                              <Edit2 size={15} />
                            </button>

                            {!isSelf ? (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                title={u.status === "ACTIVE" ? "Tạm khóa tài khoản" : "Kích hoạt lại"}
                                className="btn btn-ghost btn-sm btn-icon"
                                style={{
                                  color: u.status === "ACTIVE" ? "var(--warning)" : "var(--success)",
                                }}
                              >
                                {u.status === "ACTIVE" ? <Lock size={15} /> : <Unlock size={15} />}
                              </button>
                            ) : (
                              <span
                                title="Không thể tự khóa tài khoản của chính mình"
                                className="btn btn-ghost btn-sm btn-icon"
                                style={{ opacity: 0.3, cursor: "not-allowed" }}
                              >
                                <Lock size={15} />
                              </span>
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

      {/* ============================================
          TAB 2 CONTENT: CẤU HÌNH CHỈ TIÊU KPI
      ============================================ */}
      {activeTab === "kpi" && (
        <div className="animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* PHẦN 1: CHỈ TIÊU KPI CHUẨN TOÀN HỆ THỐNG */}
          <form onSubmit={handleSaveKpiConfig}>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--border-color)",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <TrendingUp className="text-orange-500" size={20} />
                  Chỉ tiêu KPI Chuẩn theo Ca làm việc
                </h2>
                <p className="page-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                  Căn cứ để tính tỉ lệ hoàn thành nhiệm vụ và nghiệm thu tiền lương hàng tuần/tháng
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={fetchKpiConfig}
                  className="btn btn-secondary btn-icon"
                  title="Làm mới cấu hình"
                >
                  <RefreshCw size={16} className={loadingKpi ? "animate-spin" : ""} />
                </button>
                <button
                  type="submit"
                  disabled={savingKpi}
                  className="btn btn-primary btn-sm"
                >
                  <Save size={16} />
                  <span>{savingKpi ? "Đang lưu..." : "Lưu & Áp dụng ngay"}</span>
                </button>
              </div>
            </div>

            {/* KPI Input Grid */}
            <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
              {/* 1. Facebook per Shift */}
              <div
                style={{
                  background: "var(--bg-input)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--info)", textTransform: "uppercase" }}>
                    Bài đăng Facebook / Ca
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>bài/ca</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={kpiForm.fbPerShift}
                  onChange={(e) => setKpiForm({ ...kpiForm, fbPerShift: parseInt(e.target.value) || 0 })}
                  className="input"
                  style={{ fontSize: "1.5rem", fontWeight: 700, padding: "0.5rem 0.75rem" }}
                  required
                />
                <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  Mặc định: 10 bài. Đăng trên các nhóm.
                </p>
              </div>

              {/* 2. Threads per Shift */}
              <div
                style={{
                  background: "var(--bg-input)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#c084fc", textTransform: "uppercase" }}>
                    Bài đăng Threads / Ca
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>bài/ca</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={kpiForm.threadPerShift}
                  onChange={(e) => setKpiForm({ ...kpiForm, threadPerShift: parseInt(e.target.value) || 0 })}
                  className="input"
                  style={{ fontSize: "1.5rem", fontWeight: 700, padding: "0.5rem 0.75rem" }}
                  required
                />
                <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  Mặc định: 4 bài. Đăng trên nền tảng Threads.
                </p>
              </div>

              {/* 3. Comments per Shift */}
              <div
                style={{
                  background: "var(--bg-input)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--success)", textTransform: "uppercase" }}>
                    Bình luận tương tác / Ca
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>cmt/ca</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={kpiForm.commentPerShift}
                  onChange={(e) => setKpiForm({ ...kpiForm, commentPerShift: parseInt(e.target.value) || 0 })}
                  className="input"
                  style={{ fontSize: "1.5rem", fontWeight: 700, padding: "0.5rem 0.75rem" }}
                  required
                />
                <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  Mặc định: 50 comments. Tương tác mồi và chăm sóc bài viết.
                </p>
              </div>
            </div>

            {/* Operational Rules Grid */}
            <div
              className="grid-4"
              style={{
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--border-color)",
                marginBottom: "1.25rem",
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Ca tối thiểu / Tuần</label>
                <input
                  type="number"
                  min={0}
                  max={21}
                  value={kpiForm.minShiftsPerWeek}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setKpiForm({ ...kpiForm, minShiftsPerWeek: isNaN(val) ? 0 : Math.max(0, val) });
                  }}
                  className="input"
                  required
                />
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Mặc định: 5 ca/tuần (Nhập 0 nếu không yêu cầu)
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Ca nghỉ tối đa / Tháng</label>
                <input
                  type="number"
                  min={0}
                  value={kpiForm.maxAbsentsPerMonth}
                  onChange={(e) => setKpiForm({ ...kpiForm, maxAbsentsPerMonth: parseInt(e.target.value) || 0 })}
                  className="input"
                  required
                />
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Mặc định: 3 ca nghỉ phép
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Ngày tối thiểu tính lương</label>
                <input
                  type="number"
                  min={1}
                  value={kpiForm.minDaysForSalary}
                  onChange={(e) => setKpiForm({ ...kpiForm, minDaysForSalary: parseInt(e.target.value) || 1 })}
                  className="input"
                  required
                />
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Nghỉ trước mốc này không tính lương
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">Ngưỡng tính đi trễ (phút)</label>
                <input
                  type="number"
                  min={0}
                  value={kpiForm.lateThresholdMinutes}
                  onChange={(e) => setKpiForm({ ...kpiForm, lateThresholdMinutes: parseInt(e.target.value) || 0 })}
                  className="input"
                  required
                />
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Quá thời gian này tính vắng ca
                </span>
              </div>
            </div>

            {/* Effective From Date */}
            <div
              style={{
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ width: "240px" }}>
                <label className="label">Ngày áp dụng chỉ tiêu</label>
                <input
                  type="date"
                  value={kpiForm.effectiveFrom}
                  onChange={(e) => setKpiForm({ ...kpiForm, effectiveFrom: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", flex: 1, paddingTop: "1.25rem" }}>
                * Khi lưu cấu hình mới, bộ nhớ đệm KPI sẽ được xóa tự động để cập nhật ngay trên toàn hệ thống.
              </div>
            </div>
          </div>

          {/* KPI History */}
          {kpiHistory.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                Lịch sử điều chỉnh KPI gần đây
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {kpiHistory.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-input)",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                        FB: {item.fbPerShift} | Threads: {item.threadPerShift} | Cmt: {item.commentPerShift}
                      </span>
                      <span>Ca tối thiểu: {item.minShiftsPerWeek}/tuần</span>
                    </div>
                    <div>
                      Hiệu lực từ: <span style={{ color: "var(--text-primary)" }}>{new Date(item.effectiveFrom).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </form>

          {/* PHẦN 2: CHỈ TIÊU KPI RIÊNG CHO TỪNG NHÂN SỰ */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--border-color)",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Users className="text-blue-500" size={20} />
                  Chỉ tiêu KPI Riêng theo Từng Nhân sự
                </h2>
                <p className="page-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                  Cấu hình chỉ tiêu cá nhân hóa cho từng nhân viên (nhân sự không có chỉ tiêu riêng sẽ tự động áp dụng chỉ tiêu chuẩn của hệ thống)
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ position: "relative", minWidth: "260px" }}>
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
                    style={{ paddingLeft: "36px", height: "36px", fontSize: "0.8125rem" }}
                    placeholder="Tìm theo tên, SĐT..."
                    value={userKpiSearch}
                    onChange={(e) => {
                      setUserKpiSearch(e.target.value);
                      fetchUserKpiList(e.target.value);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchUserKpiList(userKpiSearch)}
                  className="btn btn-secondary btn-icon"
                  title="Làm mới danh sách"
                >
                  <RefreshCw size={16} className={loadingUserKpi ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "50px", textAlign: "center" }}>STT</th>
                    <th style={{ minWidth: "180px" }}>Nhân sự</th>
                    <th style={{ textAlign: "center" }}>FB / Ca</th>
                    <th style={{ textAlign: "center" }}>Threads / Ca</th>
                    <th style={{ textAlign: "center" }}>CMT / Ca</th>
                    <th style={{ textAlign: "center" }}>Ca tối thiểu / Tuần</th>
                    <th style={{ textAlign: "center" }}>Áp dụng</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUserKpi ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
                        <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
                        Đang tải danh sách KPI nhân sự...
                      </td>
                    </tr>
                  ) : userKpiList.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
                        Không tìm thấy nhân sự phù hợp.
                      </td>
                    </tr>
                  ) : (
                    userKpiList.map((item, index) => {
                      return (
                        <tr key={item.user.id}>
                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{index + 1}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                                  color: "white",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 600,
                                  fontSize: "0.75rem",
                                  flexShrink: 0,
                                }}
                              >
                                {item.user.fullName.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                                  {item.user.fullName}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                  {item.user.phone}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: item.kpi.isCustom ? 700 : 500, color: item.kpi.isCustom ? "var(--primary)" : "inherit" }}>
                            {item.kpi.fbPerShift}
                          </td>
                          <td style={{ textAlign: "center", fontWeight: item.kpi.isCustom ? 700 : 500, color: item.kpi.isCustom ? "#c084fc" : "inherit" }}>
                            {item.kpi.threadPerShift}
                          </td>
                          <td style={{ textAlign: "center", fontWeight: item.kpi.isCustom ? 700 : 500, color: item.kpi.isCustom ? "var(--success)" : "inherit" }}>
                            {item.kpi.commentPerShift}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {item.kpi.minShiftsPerWeek} ca
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {item.kpi.isCustom ? (
                              <span className="badge badge-warning" style={{ fontSize: "0.6875rem" }}>
                                Chỉ tiêu riêng
                              </span>
                            ) : (
                              <span className="badge badge-secondary" style={{ fontSize: "0.6875rem" }}>
                                Mặc định chung
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.kpi.note || "-"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                              <button
                                type="button"
                                onClick={() => handleOpenUserKpiModal(item)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                title="Thiết lập chỉ tiêu riêng"
                              >
                                <Edit2 size={13} />
                                <span>Cài đặt</span>
                              </button>
                              {item.kpi.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleResetUserKpiToDefault(item.user.id, item.user.fullName)}
                                  className="btn btn-ghost btn-sm btn-icon"
                                  title="Khôi phục về KPI mặc định"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <RotateCcw size={14} />
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
        </div>
      )}

      {/* ============================================
          TAB 3 CONTENT: CÀI ĐẶT CA LÀM VIỆC
      ============================================ */}
      {activeTab === "shifts" && (
        <form onSubmit={handleSaveShiftsConfig} className="animate-fadeIn">
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--border-color)",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Clock className="text-orange-500" size={20} />
                  Khung Giờ Ca Làm Việc & Quy Định Đăng Ký
                </h2>
                <p className="page-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                  Tùy chỉnh thời gian bắt đầu, kết thúc của 3 ca làm việc và quy chế chốt ca tuần tự động
                </p>
              </div>

              <button
                type="submit"
                disabled={savingShifts}
                className="btn btn-primary btn-sm"
              >
                <Save size={16} />
                <span>{savingShifts ? "Đang lưu..." : "Lưu Cài Đặt Ca"}</span>
              </button>
            </div>

            {/* Section 1: 3 Shifts Time Settings */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <Layers size={16} className="text-orange-400" />
                Khung giờ chuẩn 3 ca làm việc
              </h3>

              <div className="grid-3">
                {/* Sáng */}
                <div
                  style={{
                    background: "var(--bg-input)",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--warning)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>☀️</span> {shiftTimes.MORNING.label}
                    </span>
                    <span className="badge badge-warning">MORNING</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="label">Giờ bắt đầu</label>
                      <CustomTimePicker
                        value={shiftTimes.MORNING.startTime}
                        onChange={(val) =>
                          setShiftTimes({
                            ...shiftTimes,
                            MORNING: { ...shiftTimes.MORNING, startTime: val },
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Giờ kết thúc</label>
                      <CustomTimePicker
                        value={shiftTimes.MORNING.endTime}
                        onChange={(val) =>
                          setShiftTimes({
                            ...shiftTimes,
                            MORNING: { ...shiftTimes.MORNING, endTime: val },
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <label className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Tiền lương theo giờ</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: 700 }}>
                        {(shiftTimes.MORNING.hourlyRate || 0).toLocaleString("vi-VN")} đ/h
                      </span>
                    </label>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      step={1000}
                      placeholder="25000"
                      value={shiftTimes.MORNING.hourlyRate ?? 25000}
                      onChange={(e) =>
                        setShiftTimes({
                          ...shiftTimes,
                          MORNING: { ...shiftTimes.MORNING, hourlyRate: Number(e.target.value) || 0 },
                        })
                      }
                      required
                    />
                  </div>
                </div>

                {/* Chiều */}
                <div
                  style={{
                    background: "var(--bg-input)",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(249, 115, 22, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>🌤️</span> {shiftTimes.AFTERNOON.label}
                    </span>
                    <span className="badge badge-primary">AFTERNOON</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="label">Giờ bắt đầu</label>
                      <CustomTimePicker
                        value={shiftTimes.AFTERNOON.startTime}
                        onChange={(val) =>
                          setShiftTimes({
                            ...shiftTimes,
                            AFTERNOON: { ...shiftTimes.AFTERNOON, startTime: val },
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Giờ kết thúc</label>
                      <CustomTimePicker
                        value={shiftTimes.AFTERNOON.endTime}
                        onChange={(val) =>
                          setShiftTimes({
                            ...shiftTimes,
                            AFTERNOON: { ...shiftTimes.AFTERNOON, endTime: val },
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <label className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Tiền lương theo giờ</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700 }}>
                        {(shiftTimes.AFTERNOON.hourlyRate || 0).toLocaleString("vi-VN")} đ/h
                      </span>
                    </label>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      step={1000}
                      placeholder="25000"
                      value={shiftTimes.AFTERNOON.hourlyRate ?? 25000}
                      onChange={(e) =>
                        setShiftTimes({
                          ...shiftTimes,
                          AFTERNOON: { ...shiftTimes.AFTERNOON, hourlyRate: Number(e.target.value) || 0 },
                        })
                      }
                      required
                    />
                  </div>
                </div>

                {/* Tối */}
                <div
                  style={{
                    background: "var(--bg-input)",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(192, 132, 252, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <span style={{ fontWeight: 700, color: "#c084fc", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>🌙</span> {shiftTimes.EVENING.label}
                    </span>
                    <span className="badge" style={{ background: "rgba(192, 132, 252, 0.15)", color: "#c084fc", border: "1px solid rgba(192, 132, 252, 0.3)" }}>
                      EVENING
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="label">Giờ bắt đầu</label>
                      <CustomTimePicker
                        value={shiftTimes.EVENING.startTime}
                        onChange={(val) =>
                          setShiftTimes({
                            ...shiftTimes,
                            EVENING: { ...shiftTimes.EVENING, startTime: val },
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Giờ kết thúc</label>
                      <CustomTimePicker
                        value={shiftTimes.EVENING.endTime}
                        onChange={(val) =>
                          setShiftTimes({
                            ...shiftTimes,
                            EVENING: { ...shiftTimes.EVENING, endTime: val },
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <label className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Tiền lương theo giờ</span>
                      <span style={{ fontSize: "0.75rem", color: "#c084fc", fontWeight: 700 }}>
                        {(shiftTimes.EVENING.hourlyRate || 0).toLocaleString("vi-VN")} đ/h
                      </span>
                    </label>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      step={1000}
                      placeholder="33000"
                      value={shiftTimes.EVENING.hourlyRate ?? 33000}
                      onChange={(e) =>
                        setShiftTimes({
                          ...shiftTimes,
                          EVENING: { ...shiftTimes.EVENING, hourlyRate: Number(e.target.value) || 0 },
                        })
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Registration Schedule Rules */}
            <div style={{ paddingTop: "1.25rem", borderTop: "1px solid var(--border-color)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <Calendar size={16} className="text-orange-400" />
                Quy chế mở & chốt đăng ký ca tuần
              </h3>

              <div className="grid-4" style={{ marginBottom: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Ngày mở đăng ký tuần</label>
                  <CustomSelect
                    value={shiftRules.openDayOfWeek}
                    onChange={(val) => setShiftRules({ ...shiftRules, openDayOfWeek: parseInt(val) })}
                    options={DAY_OPTIONS}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Giờ mở form</label>
                  <CustomTimePicker
                    value={shiftRules.openTime}
                    onChange={(val) => setShiftRules({ ...shiftRules, openTime: val })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Ngày chốt đăng ký tuần</label>
                  <CustomSelect
                    value={shiftRules.closeDayOfWeek}
                    onChange={(val) => setShiftRules({ ...shiftRules, closeDayOfWeek: parseInt(val) })}
                    options={DAY_OPTIONS}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Giờ khóa form</label>
                  <CustomTimePicker
                    value={shiftRules.closeTime}
                    onChange={(val) => setShiftRules({ ...shiftRules, closeTime: val })}
                  />
                </div>
              </div>

              {/* Extra Rules */}
              <div className="grid-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Tổng số người tối đa / ca</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={shiftRules.maxUsersPerShift ?? 10}
                    onChange={(e) =>
                      setShiftRules({ ...shiftRules, maxUsersPerShift: parseInt(e.target.value) || 1 })
                    }
                    className="input"
                  />
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Mặc định: 10 người/ca (Tự động khóa ca khi đủ số lượng).
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Giới hạn số ca đăng ký / ngày</label>
                  <CustomSelect
                    value={shiftRules.maxShiftsPerDay ?? 1}
                    onChange={(val) =>
                      setShiftRules({ ...shiftRules, maxShiftsPerDay: parseInt(val) })
                    }
                    options={[
                      { value: 1, label: "Tối đa 1 ca / ngày (Chính sách chuẩn từ Tháng 09/2026)" },
                      { value: 2, label: "Tối đa 2 ca / ngày" },
                      { value: 3, label: "Tối đa 3 ca / ngày (Sáng, Chiều, Tối)" },
                      { value: 0, label: "Không giới hạn số ca / ngày" },
                    ]}
                  />
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem", lineHeight: "1.3" }}>
                    Chính sách 1 ca/ngày áp dụng từ <strong>Tháng 09/2026</strong>. Các ca đăng ký <strong>Tháng 08/2026</strong> được tự động hỗ trợ không giới hạn theo đúng thực tế lịch sử.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Thời hạn tối thiểu báo nghỉ (giờ)</label>
                  <input
                    type="number"
                    min={1}
                    value={shiftRules.allowCancelHoursBefore}
                    onChange={(e) =>
                      setShiftRules({ ...shiftRules, allowCancelHoursBefore: parseInt(e.target.value) || 1 })
                    }
                    className="input"
                  />
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Mặc định: 4 giờ trước giờ bắt đầu ca.
                  </p>
                </div>
              </div>

              {/* Section 3: Quy định Hạn Gắn Loại Bài Viết & Đề Xuất Bài Viral */}
              <div style={{ paddingTop: "1.25rem", borderTop: "1px solid var(--border-color)", marginTop: "1.25rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <Flame size={16} className="text-orange-400" />
                  Quy chế Gắn Loại Bài Viết & Đề Xuất Bài Viết Viral Sau Ca
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Thời hạn gắn / sửa Loại Bài Viết (ngày)</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={shiftRules.tagPostGraceDays ?? 7}
                      onChange={(e) =>
                        setShiftRules({ ...shiftRules, tagPostGraceDays: parseInt(e.target.value) || 1 })
                      }
                      className="input"
                      required
                    />
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Mặc định: <strong>7 ngày</strong> tính từ lúc submit link. Sau thời gian này, phân loại bài viết sẽ khóa cố định.
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Thời hạn đề xuất / gắn cờ Bài Viết Viral (ngày)</label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={shiftRules.viralPostGraceDays ?? 30}
                      onChange={(e) =>
                        setShiftRules({ ...shiftRules, viralPostGraceDays: parseInt(e.target.value) || 1 })
                      }
                      className="input"
                      required
                    />
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Mặc định: <strong>30 ngày</strong> tính từ lúc submit link. Giúp nhân sự chủ động gắn bài viral đạt tương tác mà không cần xin mở lại ca.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 4: Quy chế Vào Ca & Nộp Bù Báo Cáo Tự Động */}
              <div style={{ paddingTop: "1.25rem", borderTop: "1px solid var(--border-color)", marginTop: "1.25rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <Clock size={16} className="text-emerald-500" />
                  Quy Chế Vào Ca & Nộp Bù Báo Cáo Tự Động (Policy Mới)
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Hạn chót Vào Ca (phút đầu ca)</label>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={shiftRules.lateCheckinMinutes ?? 60}
                      onChange={(e) =>
                        setShiftRules({ ...shiftRules, lateCheckinMinutes: parseInt(e.target.value) || 0 })
                      }
                      className="input"
                      required
                    />
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Mặc định: <strong>60 phút</strong> tính từ giờ bắt đầu ca. Quá mốc này chưa bấm &quot;Vào ca&quot; thì ca bị khóa.
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Cửa sổ sửa sau ca (phút sau ca)</label>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={shiftRules.postShiftEditMinutes ?? 60}
                      onChange={(e) =>
                        setShiftRules({ ...shiftRules, postShiftEditMinutes: parseInt(e.target.value) || 0 })
                      }
                      className="input"
                      required
                    />
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Mặc định: <strong>60 phút</strong> sau khi ca kết thúc. Nhân sự đạt ngưỡng được sửa / nộp bù link không cần xin mở.
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Ngưỡng tham gia ca tối thiểu (%)</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={shiftRules.participationThresholdPercent ?? 70}
                      onChange={(e) =>
                        setShiftRules({ ...shiftRules, participationThresholdPercent: parseInt(e.target.value) || 0 })
                      }
                      className="input"
                      required
                    />
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Mặc định: <strong>70%</strong> KPI từng loại link nộp trong ca. Đạt ngưỡng mới được nộp bù tuần đến hết Chủ nhật.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ============================================
          TAB 4 CONTENT: THƯỞNG BÀI VIẾT VIRAL
      ============================================ */}
      {activeTab === "viral" && (
        <div className="animate-fadeIn">
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--border-color)",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Award className="text-orange-500" size={20} />
                  Bảng Mức Tiền Thưởng Bài Viết & Bình Luận Viral
                </h2>
                <p className="page-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                  Định mức tiền thưởng nóng tự động cộng vào bảng nghiệm thu lương khi nội dung đạt mốc tương tác
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={fetchViralTiers}
                  className="btn btn-secondary btn-icon"
                  title="Làm mới bảng thưởng"
                >
                  <RefreshCw size={16} className={loadingViral ? "animate-spin" : ""} />
                </button>
                {viralTiers.length === 0 && (
                  <button
                    onClick={handleSeedDefaultTiers}
                    className="btn btn-secondary btn-sm"
                  >
                    Khởi tạo mốc mẫu
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingTier(null);
                    setViralForm({
                      platform: "FACEBOOK",
                      contentType: "POST",
                      minLikes: 500,
                      bonusAmount: 50000,
                    });
                    setShowViralModal(true);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Plus size={16} />
                  <span>Thêm mốc thưởng</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Lọc theo nền tảng:</span>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                {["ALL", "FACEBOOK", "THREADS"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setViralFilterPlatform(p)}
                    className={`btn btn-sm ${viralFilterPlatform === p ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                  >
                    {p === "ALL" ? "Tất cả" : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Viral Tiers Table */}
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nền tảng</th>
                    <th>Loại nội dung</th>
                    <th>Mốc Likes Tối thiểu</th>
                    <th>Mức tiền thưởng (VNĐ)</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingViral ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "3rem" }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem auto", color: "var(--primary)" }} />
                        <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Đang tải mức thưởng...</div>
                      </td>
                    </tr>
                  ) : filteredViralTiers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                        Chưa có bậc thưởng nào. Hãy bấm &quot;Thêm mốc thưởng&quot; hoặc &quot;Khởi tạo mốc mẫu&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredViralTiers.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: t.platform === "FACEBOOK" ? "rgba(56, 189, 248, 0.15)" : "rgba(192, 132, 252, 0.15)",
                              color: t.platform === "FACEBOOK" ? "var(--info)" : "#c084fc",
                              border: `1px solid ${t.platform === "FACEBOOK" ? "rgba(56, 189, 248, 0.3)" : "rgba(192, 132, 252, 0.3)"}`,
                              fontWeight: 700,
                            }}
                          >
                            {t.platform}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                          {t.contentType === "POST" ? "Bài viết (Post)" : "Bình luận (Comment)"}
                        </td>
                        <td>
                          <span style={{ fontFamily: "monospace", color: "var(--warning)", fontWeight: 700 }}>
                            ≥ {t.minLikes.toLocaleString("vi-VN")} likes
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "monospace", color: "var(--success)", fontWeight: 700, fontSize: "0.9375rem" }}>
                            +{t.bonusAmount.toLocaleString("vi-VN")} đ
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem" }}>
                            <button
                              onClick={() => {
                                setEditingTier(t);
                                setViralForm({
                                  platform: t.platform,
                                  contentType: t.contentType,
                                  minLikes: t.minLikes,
                                  bonusAmount: t.bonusAmount,
                                });
                                setShowViralModal(true);
                              }}
                              className="btn btn-ghost btn-sm btn-icon"
                              title="Sửa mức thưởng"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteViralTier(t.id)}
                              className="btn btn-ghost btn-sm btn-icon"
                              style={{ color: "var(--danger)" }}
                              title="Xóa mức thưởng"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          MODAL: TẠO TÀI KHOẢN (QUẢN LÝ / NHÂN VIÊN)
      ============================================ */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          maxWidth="620px"
          closeOnOutsideClick={false}
        >
          <div className="modal-header">
            <div className="modal-title">
              {createTargetType === "MANAGEMENT" ? "Khởi Tạo Tài Khoản Quản Lý" : "Khởi Tạo Tài Khoản Nhân Viên"}
            </div>
            <button
              type="button"
              className="btn-ghost btn-icon"
              onClick={() => setShowCreateModal(false)}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Họ và tên *</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={createForm.fullName}
                      onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số điện thoại (Tài khoản) *</label>
                    <input
                      type="tel"
                      placeholder="Ví dụ: 0912345678"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số CCCD / CMND</label>
                    <input
                      type="text"
                      placeholder="00120000xxxx"
                      value={createForm.cccd}
                      onChange={(e) => setCreateForm({ ...createForm, cccd: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Email liên hệ</label>
                    <input
                      type="email"
                      placeholder="nhansu@freetrip.vn"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Ngày bắt đầu làm việc</label>
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Tên Ngân hàng</label>
                    <input
                      type="text"
                      placeholder="MB Bank, Techcombank..."
                      value={createForm.bankName}
                      onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số tài khoản ngân hàng</label>
                    <input
                      type="text"
                      placeholder="0123456789"
                      value={createForm.bankAccount}
                      onChange={(e) => setCreateForm({ ...createForm, bankAccount: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Phân quyền vai trò *</label>
                    {createTargetType === "MANAGEMENT" ? (
                      <select
                        value={createForm.role}
                        onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as RoleType })}
                        className="select"
                      >
                        <option value="ADMIN">Quản trị viên (Admin)</option>
                        <option value="HR">Hành chính Nhân sự (HR)</option>
                        <option value="MANAGER">Quản lý Đội ngũ (Manager)</option>
                        <option value="QC">Kiểm duyệt viên (QC)</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input"
                        value="Nhân sự Remote (Đăng bài)"
                        disabled
                        style={{ opacity: 0.8, cursor: "not-allowed", background: "rgba(255,255,255,0.03)" }}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="label">Trạng thái khởi tạo</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as UserStatusType })}
                      className="select"
                    >
                      <option value="ACTIVE">Đang làm việc (Active)</option>
                      <option value="PROBATION">Thử việc (Probation)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Mật khẩu khởi tạo</label>
                    <input
                      type="text"
                      placeholder="Mặc định: 123456"
                      value={createForm.customPassword}
                      onChange={(e) => setCreateForm({ ...createForm, customPassword: e.target.value })}
                      className="input"
                    />
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                      Để trống sẽ dùng mật khẩu mặc định 123456
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingAccount}
                  className="btn btn-primary"
                >
                  {submittingAccount ? "Đang tạo..." : "Xác nhận tạo tài khoản"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ============================================
            MODAL: CHỈNH SỬA TÀI KHOẢN CẤP DƯỚI
        ============================================ */}
        {showEditModal && editingUser && (
          <Modal
            isOpen={showEditModal && !!editingUser}
            onClose={() => setShowEditModal(false)}
            maxWidth="620px"
            closeOnOutsideClick={false}
          >
            <div className="modal-header">
              <div>
                <div className="modal-title">Chỉnh Sửa Tài Khoản: {editingUser.fullName}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  ID: #{editingUser.id} | SĐT: {editingUser.phone}
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label className="label">Họ và tên</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số điện thoại</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số CCCD / CMND</label>
                    <input
                      type="text"
                      value={editForm.cccd}
                      onChange={(e) => setEditForm({ ...editForm, cccd: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Email liên hệ</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Tên Ngân hàng</label>
                    <input
                      type="text"
                      value={editForm.bankName}
                      onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Số tài khoản</label>
                    <input
                      type="text"
                      value={editForm.bankAccount}
                      onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Vai trò (Role)</label>
                    <select
                      value={editForm.role}
                      disabled={currentUser?.userId === editingUser.id}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as RoleType })}
                      className="select"
                    >
                      {editingUser.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
                      <option value="ADMIN">Quản trị viên (Admin)</option>
                      <option value="HR">Hành chính Nhân sự (HR)</option>
                      <option value="MANAGER">Quản lý Đội ngũ (Manager)</option>
                      <option value="QC">Kiểm duyệt viên (QC)</option>
                      <option value="NHAN_SU_HYBRID">Nhân sự Remote</option>
                    </select>
                    {currentUser?.userId === editingUser.id && (
                      <span style={{ fontSize: "0.6875rem", color: "#c084fc", marginTop: "0.25rem", display: "block" }}>
                        Không thể tự hạ vai trò SUPER_ADMIN của bạn
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="label">Trạng thái hoạt động</label>
                    <select
                      value={editForm.status}
                      disabled={currentUser?.userId === editingUser.id}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatusType })}
                      className="select"
                    >
                      <option value="ACTIVE">Đang làm việc (Active)</option>
                      <option value="PROBATION">Thử việc (Probation)</option>
                      <option value="SUSPENDED">Bị tạm khóa (Suspended)</option>
                      <option value="INACTIVE">Đã nghỉ việc (Inactive)</option>
                    </select>
                    {currentUser?.userId === editingUser.id && (
                      <span style={{ fontSize: "0.6875rem", color: "#c084fc", marginTop: "0.25rem", display: "block" }}>
                        Không thể tự khóa tài khoản của bạn
                      </span>
                    )}
                  </div>

                  {/* Đổi mật khẩu mới */}
                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <div
                      style={{
                        background: "var(--bg-input)",
                        padding: "0.875rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <label className="label" style={{ color: "var(--warning)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <KeyRound size={14} />
                        Đặt lại mật khẩu mới (Nếu cần thay đổi)
                      </label>
                      <input
                        type="password"
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                        value={editForm.newPassword}
                        onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                        className="input"
                      />
                      <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                        Để trống nếu không muốn đổi mật khẩu người dùng.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingAccount}
                  className="btn btn-primary"
                >
                  {submittingAccount ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ============================================
            MODAL: THÊM / SỬA MỨC THƯỞNG VIRAL
        ============================================ */}
        {showViralModal && (
          <Modal
            isOpen={showViralModal}
            onClose={() => setShowViralModal(false)}
            maxWidth="480px"
            closeOnOutsideClick={false}
          >
            <div className="modal-header">
              <div className="modal-title">
                {editingTier ? "Chỉnh sửa Mức thưởng Viral" : "Thêm Mốc thưởng Viral Mới"}
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setShowViralModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveViralTier} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Nền tảng</label>
                  <select
                    value={viralForm.platform}
                    disabled={!!editingTier}
                    onChange={(e) =>
                      setViralForm({ ...viralForm, platform: e.target.value as "FACEBOOK" | "THREADS" })
                    }
                    className="select"
                  >
                    <option value="FACEBOOK">Facebook</option>
                    <option value="THREADS">Threads</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Loại nội dung</label>
                  <select
                    value={viralForm.contentType}
                    disabled={!!editingTier}
                    onChange={(e) =>
                      setViralForm({ ...viralForm, contentType: e.target.value as "POST" | "COMMENT" })
                    }
                    className="select"
                  >
                    <option value="POST">Bài viết (Post)</option>
                    <option value="COMMENT">Bình luận (Comment)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Mốc Likes tối thiểu đạt thưởng</label>
                  <input
                    type="number"
                    min={1}
                    value={viralForm.minLikes}
                    onChange={(e) => setViralForm({ ...viralForm, minLikes: parseInt(e.target.value) || 0 })}
                    className="input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Mức tiền thưởng (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={viralForm.bonusAmount}
                    onChange={(e) => setViralForm({ ...viralForm, bonusAmount: parseInt(e.target.value) || 0 })}
                    className="input"
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--success)", fontFamily: "monospace", marginTop: "0.25rem", display: "block" }}>
                    = {viralForm.bonusAmount.toLocaleString("vi-VN")} VNĐ
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowViralModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingViral}
                  className="btn btn-primary"
                >
                  {submittingViral ? "Đang lưu..." : "Xác nhận lưu"}
                </button>
              </div>
            </form>
          </Modal>
        )}

      {/* ============================================
          TAB 5 CONTENT: CẤU HÌNH TAG LOẠI BÀI VIẾT
      ============================================ */}
      {activeTab === "post-tags" && (
        <div className="animate-fadeIn">
          {/* Main Card */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--border-color)",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Tag className="text-orange-500" size={20} />
                  Cấu Hình Danh Mục Tag (Loại Bài Viết Seeding)
                </h2>
                <p className="page-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                  Tùy biến các tag loại bài (nạp thẻ, fastdate, secret chat...) để nhân sự tự chọn khi nộp báo cáo ca và QC kiểm duyệt trực quan
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleResetDefaultTags}
                  disabled={savingTags || loadingTags}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: "0.4rem" }}
                  title="Khôi phục về 4 loại tag mặc định của hệ thống"
                >
                  <RotateCcw size={14} />
                  <span>Khôi phục mặc định</span>
                </button>

                <button
                  type="button"
                  onClick={fetchPostTags}
                  disabled={loadingTags}
                  className="btn btn-secondary btn-sm"
                  title="Tải lại danh sách"
                >
                  <RefreshCw size={14} className={loadingTags ? "animate-spin" : ""} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingTag(null);
                    setTagForm({ name: "", color: "#3b82f6" });
                    setShowTagModal(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ gap: "0.4rem" }}
                >
                  <Plus size={16} />
                  <span>Thêm Tag Mới</span>
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-card" style={{ padding: "1rem" }}>
                <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                  <Tag size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{postTags.length}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Tổng số loại bài</div>
                </div>
              </div>

              <div className="stat-card" style={{ padding: "1rem" }}>
                <div className="stat-icon" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>
                  <Palette size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                    {postTags.filter((t) => t.isDefault).length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Tag mặc định gốc</div>
                </div>
              </div>

              <div className="stat-card" style={{ padding: "1rem" }}>
                <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                    {postTags.filter((t) => !t.isDefault).length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Tag tùy chỉnh thêm</div>
                </div>
              </div>
            </div>

            {/* Table of Tags */}
            {loadingTags ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 0.5rem auto" }} />
                Đang tải danh mục tag...
              </div>
            ) : postTags.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                Chưa có tag nào trong hệ thống. Hãy bấm &quot;Thêm Tag Mới&quot; hoặc &quot;Khôi phục mặc định&quot;.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: "50px", textAlign: "center" }}>STT</th>
                      <th style={{ width: "200px" }}>Hiển Thị Trực Quan</th>
                      <th>Tên Loại Bài Viết</th>
                      <th style={{ width: "160px" }}>Mã Tag (ID)</th>
                      <th style={{ width: "140px" }}>Mã Màu</th>
                      <th style={{ width: "130px", textAlign: "center" }}>Phân Loại</th>
                      <th style={{ width: "120px", textAlign: "right" }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postTags.map((tag, idx) => (
                      <tr key={tag.id}>
                        <td style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                          #{idx + 1}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `${tag.color}22`,
                              color: tag.color,
                              border: `1px solid ${tag.color}55`,
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: tag.color,
                              }}
                            />
                            {tag.name}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{tag.name}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          {tag.id}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "4px",
                                backgroundColor: tag.color,
                                border: "1px solid rgba(255,255,255,0.2)",
                              }}
                            />
                            <code style={{ fontSize: "0.8125rem", color: tag.color }}>{tag.color}</code>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {tag.isDefault ? (
                            <span className="badge badge-info" style={{ fontSize: "0.6875rem" }}>
                              Mặc định
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                              Tùy biến
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTag(tag);
                                setTagForm({ name: tag.name, color: tag.color });
                                setShowTagModal(true);
                              }}
                              className="btn btn-secondary btn-xs"
                              title="Chỉnh sửa tag"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTag(tag.id)}
                              className="btn btn-danger btn-xs"
                              title="Xóa tag"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL THÊM / CHỈNH SỬA TAG */}
      {showTagModal && (
        <Modal
          isOpen={showTagModal}
          onClose={() => setShowTagModal(false)}
          title={editingTag ? "Chỉnh Sửa Tag Bài Viết" : "Thêm Tag Loại Bài Viết Mới"}
        >
          <form onSubmit={handleSaveTag}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="label">
                  Tên Loại Bài Viết <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ví dụ: Nạp thẻ, Fastdate, Secret chat, Tính năng khác..."
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="label">Mã Màu Nhận Diện</label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <input
                    type="color"
                    value={tagForm.color}
                    onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                    style={{
                      width: "44px",
                      height: "38px",
                      padding: "2px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      cursor: "pointer",
                      backgroundColor: "var(--bg-input)",
                    }}
                  />
                  <input
                    type="text"
                    className="input"
                    value={tagForm.color}
                    onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                    style={{ flex: 1, fontFamily: "monospace" }}
                    placeholder="#3b82f6"
                  />
                </div>

                {/* Preset Colors */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                    Bảng màu gợi ý (click để chọn nhanh):
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {TAG_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setTagForm({ ...tagForm, color: preset.color })}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          border: tagForm.color.toLowerCase() === preset.color.toLowerCase()
                            ? `2px solid ${preset.color}`
                            : "1px solid var(--border-color)",
                          backgroundColor: tagForm.color.toLowerCase() === preset.color.toLowerCase()
                            ? `${preset.color}25`
                            : "var(--bg-input)",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: preset.color,
                          }}
                        />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Badge */}
              <div
                style={{
                  background: "var(--bg-input)",
                  border: "1px dashed var(--border-color)",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginTop: "0.5rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                  Xem trước hiển thị thực tế:
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: `${tagForm.color}22`,
                    color: tagForm.color,
                    border: `1px solid ${tagForm.color}55`,
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: tagForm.color,
                    }}
                  />
                  {tagForm.name.trim() || "Tên Tag mẫu"}
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="btn btn-secondary"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingTags}
                className="btn btn-primary"
              >
                {savingTags ? "Đang lưu..." : editingTag ? "Cập nhật Tag" : "Tạo Tag Mới"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL CẤU HÌNH KPI RIÊNG CHO TỪNG NHÂN SỰ */}
      {showUserKpiModal && selectedUserKpi && (
        <Modal
          isOpen={showUserKpiModal}
          onClose={() => setShowUserKpiModal(false)}
          maxWidth="560px"
        >
          <form onSubmit={handleSaveUserKpi} className="modal-content">
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <TrendingUp size={20} className="text-orange-500" />
                <span>Cấu hình KPI: {selectedUserKpi.user.fullName}</span>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowUserKpiModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                  }}
                >
                  {selectedUserKpi.user.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {selectedUserKpi.user.fullName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    SĐT: {selectedUserKpi.user.phone} • Trạng thái:{" "}
                    {selectedUserKpi.kpi.isCustom ? (
                      <span className="text-orange-500 font-semibold">Đang áp dụng KPI riêng</span>
                    ) : (
                      <span className="text-gray-400">Đang áp dụng KPI mặc định</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: "0.75rem" }}>
                <div>
                  <label className="label">Bài Facebook / Ca</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={userKpiForm.fbPerShift}
                    onChange={(e) =>
                      setUserKpiForm({ ...userKpiForm, fbPerShift: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                    Mặc định hệ thống: {kpiForm.fbPerShift} bài
                  </span>
                </div>

                <div>
                  <label className="label">Bài Threads / Ca</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={userKpiForm.threadPerShift}
                    onChange={(e) =>
                      setUserKpiForm({ ...userKpiForm, threadPerShift: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                    Mặc định hệ thống: {kpiForm.threadPerShift} bài
                  </span>
                </div>

                <div>
                  <label className="label">Bình luận (CMT) / Ca</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={userKpiForm.commentPerShift}
                    onChange={(e) =>
                      setUserKpiForm({ ...userKpiForm, commentPerShift: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                    Mặc định hệ thống: {kpiForm.commentPerShift} cmt
                  </span>
                </div>

                <div>
                  <label className="label">Ca tối thiểu / Tuần</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={userKpiForm.minShiftsPerWeek}
                    onChange={(e) =>
                      setUserKpiForm({ ...userKpiForm, minShiftsPerWeek: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                    Mặc định hệ thống: {kpiForm.minShiftsPerWeek} ca
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Ngày bắt đầu áp dụng hiệu lực</label>
                <input
                  type="date"
                  className="input"
                  value={userKpiForm.effectiveFrom}
                  onChange={(e) =>
                    setUserKpiForm({ ...userKpiForm, effectiveFrom: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">Ghi chú lý do điều chỉnh</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Vd: Thử việc tuần đầu, nhân sự part-time, quản lý nhóm..."
                  value={userKpiForm.note}
                  onChange={(e) => setUserKpiForm({ ...userKpiForm, note: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {selectedUserKpi.kpi.isCustom && (
                  <button
                    type="button"
                    onClick={() =>
                      handleResetUserKpiToDefault(
                        selectedUserKpi.user.id,
                        selectedUserKpi.user.fullName
                      )
                    }
                    className="btn btn-secondary btn-sm"
                    style={{ color: "var(--danger)" }}
                  >
                    <RotateCcw size={14} /> Khôi phục mặc định
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowUserKpiModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingUserKpi}
                  className="btn btn-primary btn-sm"
                >
                  <Save size={15} />
                  <span>{savingUserKpi ? "Đang lưu..." : "Lưu chỉ tiêu riêng"}</span>
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
