"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import BrandLogo from "@/components/BrandLogo";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  FileText,
  ClipboardCheck,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Menu,
  X,
  UserCheck,
  Database,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Tổng quan",
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: <LayoutDashboard size={18} />,
      },
    ],
  },
  {
    title: "Quản lý nhân sự",
    items: [
      {
        label: "Hồ sơ nhân sự",
        href: "/nhan-su",
        icon: <Users size={18} />,
        roles: ["SUPER_ADMIN", "ADMIN", "HR"],
      },
      {
        label: "Ca làm việc",
        href: "/ca-lam-viec",
        icon: <Calendar size={18} />,
      },
      {
        label: "Theo dõi ca",
        href: "/theo-doi-ca",
        icon: <Clock size={18} />,
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"],
      },
    ],
  },
  {
    title: "Công việc",
    items: [
      {
        label: "Báo cáo Seeding",
        href: "/bao-cao",
        icon: <FileText size={18} />,
      },
      {
        label: "Kiểm duyệt QC",
        href: "/kiem-duyet",
        icon: <ClipboardCheck size={18} />,
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "QC"],
      },
    ],
  },
  {
    title: "Tổng hợp",
    items: [
      {
        label: "KPI & Báo cáo",
        href: "/kpi",
        icon: <BarChart3 size={18} />,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
      },
      {
        label: "Nghiệm thu",
        href: "/nghiem-thu",
        icon: <FileSpreadsheet size={18} />,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
      },
      {
        label: "Báo cáo nhân sự",
        href: "/bao-cao-nhan-su",
        icon: <UserCheck size={18} />,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
      },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      {
        label: "Cài đặt",
        href: "/admin",
        icon: <Settings size={18} />,
        roles: ["SUPER_ADMIN"],
      },
      {
        label: "Dữ liệu",
        href: "/admin/import",
        icon: <Database size={18} />,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
];

interface UserInfo {
  userId: number;
  role: string;
  fullName: string;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps = {}) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(console.error);
  }, []);

  // Auto hide drawer trên mobile/tablet khi chuyển trang hoặc reload
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function canAccess(item: NavItem): boolean {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  }

  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(canAccess),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile/Tablet toggle button: Chỉ hiển thị khi Drawer đang đóng để không che logo */}
      {!mobileOpen && (
        <button
          className="btn btn-icon btn-secondary"
          onClick={() => setMobileOpen(true)}
          style={{
            position: "fixed",
            top: "0.875rem",
            left: "0.875rem",
            zIndex: 50,
            display: "none",
            boxShadow: "var(--shadow-md)",
          }}
          id="sidebar-toggle"
          aria-label="Mở menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay for mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 39,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar navigation container */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-header" style={{ justifyContent: "center", alignItems: "center" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
            }}
            title="Về trang tổng quan"
          >
            <BrandLogo variant="full" size="md" priority />
          </Link>

          {/* Nút đóng drawer cho Mobile/Tablet: Nằm ở góc trên bên phải header */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="btn btn-icon btn-ghost btn-sm mobile-sidebar-close-btn"
            style={{
              color: "var(--text-muted)",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Đóng menu"
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="sidebar-nav">
          {filteredSections.map((section) => (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? "active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <style jsx>{`
        @media (max-width: 1024px) {
          #sidebar-toggle {
            display: flex !important;
          }
          .mobile-sidebar-close-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </>
  );
}
