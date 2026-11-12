"use client";

import React, { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { TimepickerUI } from "timepicker-ui";

interface CustomTimePickerProps {
  value: string; // Định dạng chuẩn "HH:mm" (24h)
  onChange: (time: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function CustomTimePicker({
  value = "",
  onChange,
  className = "",
  placeholder = "--:--",
  disabled = false,
  required = false,
}: CustomTimePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tpRef = useRef<TimepickerUI | null>(null);

  // Khởi tạo TimepickerUI theo Material Design Clock Face
  useEffect(() => {
    if (!containerRef.current) return;

    const tp = new TimepickerUI(containerRef.current, {
      clock: {
        type: "12h",
        autoSwitchToMinutes: true,
        incrementMinutes: 1,
      },
      ui: {
        theme: "dark",
        animation: true,
      },
      labels: {
        time: "SELECT TIME",
        ok: "OK",
        cancel: "CANCEL",
      },
      behavior: {
        focusTrap: true,
      },
    });

    tp.create();
    tpRef.current = tp;

    // Định vị popover bám sát ngay trên/dưới ô input được click
    const positionPicker = () => {
      if (!inputRef.current) return;
      const modalEl = document.querySelector<HTMLElement>(`[data-owner-id="${tp.instanceId}"]`);
      if (!modalEl) return;
      const wrapper = modalEl.querySelector<HTMLElement>(".tp-ui-wrapper");
      if (!wrapper) return;

      const rect = inputRef.current.getBoundingClientRect();
      const popoverWidth = wrapper.offsetWidth || 328;
      const popoverHeight = wrapper.offsetHeight || 440;

      // Tính vị trí Top: ưu tiên bên dưới input
      let top = rect.bottom + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Nếu bên dưới không đủ chỗ và bên trên thoáng hơn -> hiển thị lên phía trên
      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        top = Math.max(12, rect.top - popoverHeight - 8);
      }

      // Tính vị trí Left: căn theo mép trái input, tránh tràn mép phải màn hình
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      if (left < 16) left = 16;

      wrapper.style.position = "fixed";
      wrapper.style.top = `${top}px`;
      wrapper.style.left = `${left}px`;
      wrapper.style.transform = "none";
      wrapper.style.margin = "0";
    };

    const handleOpen = () => {
      positionPicker();
      requestAnimationFrame(positionPicker);
      setTimeout(positionPicker, 30);
      setTimeout(positionPicker, 120);

      window.addEventListener("scroll", positionPicker, true);
      window.addEventListener("resize", positionPicker);
    };

    const handleClose = () => {
      window.removeEventListener("scroll", positionPicker, true);
      window.removeEventListener("resize", positionPicker);
    };

    const handleConfirm = (data: any) => {
      handleClose();
      if (!data) return;
      let hour = parseInt(data.hour || "12", 10);
      const minutes = (data.minutes || "00").toString().padStart(2, "0");
      const type = data.type || "AM";

      // Chuẩn hóa sang 24h: "HH:mm"
      if (type === "PM" && hour < 12) {
        hour += 12;
      } else if (type === "AM" && hour === 12) {
        hour = 0;
      }

      const formatted24h = `${hour.toString().padStart(2, "0")}:${minutes}`;
      onChange(formatted24h);
    };

    tp.on("open", handleOpen);
    tp.on("cancel", handleClose);
    tp.on("hide", handleClose);
    tp.on("confirm", handleConfirm);

    return () => {
      handleClose();
      try {
        tp.destroy();
      } catch (e) {
        // cleanup safe
      }
    };
  }, [onChange]);

  // Đồng bộ giá trị vào input khi value thay đổi
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || !tpRef.current) return;
    tpRef.current.open();
  };

  return (
    <div ref={containerRef} className="relative w-full timepicker-ui-container">
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={handleManualInput}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        data-open="tp-ui-input"
        className={`input w-full h-[42px] pr-10 font-mono tracking-wider text-sm box-border cursor-pointer select-none ${className}`}
        style={{ minWidth: "120px" }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpenPicker}
        data-open="tp-ui-button"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors rounded-lg cursor-pointer focus:outline-none"
        title="Mở đồng hồ chọn giờ"
      >
        <Clock size={16} className={value ? "text-[var(--primary)]" : "text-[var(--text-muted)]"} />
      </button>
    </div>
  );
}
