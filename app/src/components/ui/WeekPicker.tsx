"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, RefreshCw, Check } from "lucide-react";
import { getISOWeekAndYear, getWeekDateRange } from "@/lib/dateUtils";

interface WeekPickerProps {
  selectedWeek: number;
  selectedYear: number;
  onWeekChange: (week: number, year: number) => void;
  onCurrentWeekClick: () => void;
  onRefreshClick: () => void;
  loading?: boolean;
  className?: string;
}

export function WeekPicker({
  selectedWeek,
  selectedYear,
  onWeekChange,
  onCurrentWeekClick,
  onRefreshClick,
  loading = false,
  className = "",
}: WeekPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownYear, setDropdownYear] = useState(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const currentISO = useMemo(() => getISOWeekAndYear(new Date()), []);

  // Format ngày dd/mm/yyyy
  const formatVN = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  };

  // Khoảng ngày của tuần hiện đang chọn
  const currentWeekRangeText = useMemo(() => {
    const { startDate, endDate } = getWeekDateRange(selectedWeek, selectedYear);
    return `${formatVN(startDate)} - ${formatVN(endDate)}`;
  }, [selectedWeek, selectedYear]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Đồng bộ dropdownYear với selectedYear khi mở
  useEffect(() => {
    if (isOpen) {
      setDropdownYear(selectedYear);
      // Scroll tới tuần đang chọn
      setTimeout(() => {
        if (selectedItemRef.current) {
          selectedItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 50);
    }
  }, [isOpen, selectedYear]);

  // Tính số tuần của năm trong dropdown (ISO: ngày 28/12 luôn nằm trong tuần cuối cùng)
  const totalWeeks = useMemo(() => {
    const d = new Date(Date.UTC(dropdownYear, 11, 28));
    return getISOWeekAndYear(d).weekNumber;
  }, [dropdownYear]);

  // Danh sách tuần trong năm
  const weeksList = useMemo(() => {
    const list = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const { startDate, endDate } = getWeekDateRange(w, dropdownYear);
      const isCurrent = w === currentISO.weekNumber && dropdownYear === currentISO.year;
      const isSelected = w === selectedWeek && dropdownYear === selectedYear;
      list.push({
        week: w,
        startDate,
        endDate,
        rangeLabel: `${formatVN(startDate)} - ${formatVN(endDate)}`,
        isCurrent,
        isSelected,
      });
    }
    return list;
  }, [dropdownYear, totalWeeks, currentISO, selectedWeek, selectedYear]);

  // Điều hướng tuần trước / sau
  const handlePrevWeek = () => {
    if (selectedWeek > 1) {
      onWeekChange(selectedWeek - 1, selectedYear);
    } else {
      const prevYear = selectedYear - 1;
      const prevYearTotalWeeks = getISOWeekAndYear(new Date(Date.UTC(prevYear, 11, 28))).weekNumber;
      onWeekChange(prevYearTotalWeeks, prevYear);
    }
  };

  const handleNextWeek = () => {
    const currentYearWeeks = getISOWeekAndYear(new Date(Date.UTC(selectedYear, 11, 28))).weekNumber;
    if (selectedWeek < currentYearWeeks) {
      onWeekChange(selectedWeek + 1, selectedYear);
    } else {
      onWeekChange(1, selectedYear + 1);
    }
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} ref={containerRef}>
      {/* 1. Week Selector Group (Prev, Next, Dropdown) */}
      <div className="relative">
        <div className="flex items-center h-[38px] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--border-hover)] rounded-[9px] px-1.5 gap-1.5 shadow-sm transition-all">
          {/* Nút Tuần trước */}
          <button
            type="button"
            onClick={handlePrevWeek}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--primary)] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Tuần trước"
          >
            <ChevronLeft size={15} strokeWidth={2.2} />
          </button>

          {/* Nút Tuần sau */}
          <button
            type="button"
            onClick={handleNextWeek}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--primary)] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Tuần sau"
          >
            <ChevronRight size={15} strokeWidth={2.2} />
          </button>

          {/* Vách ngăn phân cách giữa nút điều hướng và tên tuần */}
          <div className="w-[1px] h-4 bg-[var(--border-color)] mx-0.5" />

          {/* Trigger Dropdown chọn tuần */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 pl-2 pr-2.5 h-7 rounded-[6px] hover:bg-[var(--bg-hover)] transition-all cursor-pointer select-none text-left"
          >
            <span className="text-[13px] font-bold text-[var(--text-primary)] tracking-wide uppercase whitespace-nowrap">
              TUẦN {selectedWeek}
            </span>
            <span className="text-[13px] text-[var(--text-secondary)] font-normal whitespace-nowrap">
              ({currentWeekRangeText})
            </span>
            <ChevronDown
              size={14}
              className={`text-[var(--text-secondary)] ml-2 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-[var(--primary)]" : ""
              }`}
            />
          </button>
        </div>

        {/* Dropdown Menu Danh Sách Tuần */}
        {isOpen && (
          <div
            className="absolute top-full right-0 mt-2 w-[390px] max-h-[440px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[10px] shadow-xl backdrop-blur-xl z-50 flex flex-col p-3 animate-fadeIn"
          >
            {/* Header chuyển năm bên trong popover */}
            <div className="flex items-center justify-between px-2 py-2 mb-2.5 border-b border-[var(--border-color)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Chọn tuần làm việc
              </span>
              <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setDropdownYear((y) => y - 1)}
                  className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors"
                  title="Năm trước"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-bold text-[var(--text-primary)]">{dropdownYear}</span>
                <button
                  type="button"
                  onClick={() => setDropdownYear((y) => y + 1)}
                  className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors"
                  title="Năm sau"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* List các tuần với Flex Gap và Card Padding thông thoáng */}
            <div
              className="overflow-y-auto max-h-[340px] pr-1.5 custom-scrollbar"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                padding: "2px 0",
              }}
            >
              {weeksList.map((item) => (
                <button
                  key={item.week}
                  ref={item.isSelected ? selectedItemRef : undefined}
                  type="button"
                  onClick={() => {
                    onWeekChange(item.week, dropdownYear);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg text-left transition-all cursor-pointer ${
                    item.isSelected
                      ? "bg-[rgba(249,115,22,0.15)] text-[var(--primary)] font-semibold border border-[rgba(249,115,22,0.4)] shadow-xs"
                      : "bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-color)]"
                  }`}
                  style={{
                    minHeight: "42px",
                    padding: "9px 14px",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[13px] font-bold tracking-wide ${
                        item.isSelected ? "text-[var(--primary)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      TUẦN {item.week}
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)] font-normal">
                      ({item.rangeLabel})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isCurrent && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        Hiện tại
                      </span>
                    )}
                    {item.isSelected && <Check size={16} className="text-[var(--primary)]" strokeWidth={2.5} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Nút "Tuần này" với accent cam theo design */}
      <button
        type="button"
        onClick={onCurrentWeekClick}
        className="flex items-center gap-1.5 px-3 h-[38px] rounded-[9px] text-xs font-semibold tracking-wide border border-[var(--primary)]/40 text-[var(--primary)] bg-[rgba(249,115,22,0.1)] hover:bg-[rgba(249,115,22,0.18)] hover:border-[var(--primary)] transition-all cursor-pointer whitespace-nowrap shadow-xs active:scale-95"
        title="Trở về tuần hiện tại"
      >
        <Calendar size={14} className="text-[var(--primary)]" strokeWidth={2} />
        <span>Tuần này</span>
      </button>

      {/* 3. Nút Refresh (Tải lại) */}
      <button
        type="button"
        onClick={onRefreshClick}
        disabled={loading}
        className="w-[38px] h-[38px] flex items-center justify-center rounded-[9px] border border-[var(--border-color)] hover:border-[var(--border-hover)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
        title="Tải lại số liệu"
      >
        <RefreshCw size={14} className={loading ? "animate-spin text-amber-500" : ""} />
      </button>
    </div>
  );
}
