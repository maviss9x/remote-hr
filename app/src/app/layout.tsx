import type { Metadata } from "next";
import "./globals.css";
import { GlobalDialog } from "@/components/ui/ModalAlert";
import SessionWatcher from "@/components/SessionWatcher";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Remote HR - Quản Lý Nhân Sự | Freetrip",
  description:
    "Hệ thống quản lý nhân sự Remote Seeding - Freetrip. Quản lý ca làm việc, báo cáo seeding, kiểm duyệt QC và tính công.",
  icons: {
    icon: "/images/logos/favicon.png",
    shortcut: "/images/logos/favicon.png",
    apple: "/images/logos/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('hybrid_theme')||'dark';document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <GlobalDialog />
          <SessionWatcher />
        </ThemeProvider>
      </body>
    </html>
  );
}
