"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Tự động thu gọn menu sidebar khi vào trang /bao-cao để tối ưu không gian làm việc
  useEffect(() => {
    if (pathname === "/bao-cao") {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  }, [pathname]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar collapsed={isSidebarCollapsed} />
      <main className={`main-content ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Topbar
          sidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
