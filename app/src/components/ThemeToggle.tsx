"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const handleToggle = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || theme;
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    toggleTheme();
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("hybrid_theme", nextTheme);
  };

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      onClick={handleToggle}
      className={`btn-icon ${className}`}
      style={{
        width: 38,
        height: 38,
        borderRadius: "var(--radius-md)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        color: isDark ? "#fbbf24" : "#f97316",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all var(--transition-fast)",
        boxShadow: "var(--shadow-sm)",
      }}
      title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      aria-label="Toggle Theme"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.borderColor = "var(--border-focus)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = "var(--border-color)";
      }}
    >
      {isDark ? (
        <Sun size={18} style={{ transition: "transform 300ms ease" }} />
      ) : (
        <Moon size={18} style={{ transition: "transform 300ms ease" }} />
      )}
    </button>
  );
}
