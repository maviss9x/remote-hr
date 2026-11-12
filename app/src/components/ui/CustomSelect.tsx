"use client";

import React, { Fragment } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Chọn tùy chọn...",
  className = "",
  disabled = false,
}: CustomSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative w-full ${className}`}>
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {({ open }) => (
          <>
            <ListboxButton
              className={`relative w-full h-[42px] cursor-pointer rounded-xl bg-[var(--bg-input)] pl-4 pr-10 flex items-center text-left text-sm text-[var(--text-primary)] border border-[var(--border-color)] transition-all focus:outline-none box-border ${
                open
                  ? "border-[var(--border-focus)] shadow-[0_0_0_3px_rgba(249,115,22,0.15)] bg-[var(--bg-card)]"
                  : "hover:border-[var(--border-hover)]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="flex items-center gap-2.5 truncate">
                {selectedOption?.icon}
                <span className={!selectedOption ? "text-[var(--text-muted)]" : "font-medium"}>
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
                {selectedOption?.badge && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[0.6875rem] font-semibold rounded bg-[rgba(249,115,22,0.15)] text-[var(--primary)] border border-[rgba(249,115,22,0.2)]">
                    {selectedOption.badge}
                  </span>
                )}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                <ChevronDown
                  size={16}
                  className={`text-[var(--text-secondary)] transition-transform duration-200 ${
                    open ? "rotate-180 text-[var(--primary)]" : ""
                  }`}
                  aria-hidden="true"
                />
              </span>
            </ListboxButton>

            <ListboxOptions
              anchor="bottom start"
              className="z-50 mt-1.5 max-h-60 w-[var(--button-width)] overflow-auto rounded-xl bg-[#121624] border border-[var(--border-color)] p-1.5 text-sm shadow-2xl backdrop-blur-xl focus:outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 custom-scrollbar"
              style={{
                boxShadow: "0 14px 34px rgba(0, 0, 0, 0.7), 0 0 20px rgba(249, 115, 22, 0.12)",
              }}
            >
              {options.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className={({ active, selected }) =>
                    `relative cursor-pointer select-none rounded-lg py-2.5 pl-10 pr-4 transition-colors ${
                      active
                        ? "bg-[rgba(249,115,22,0.12)] text-[var(--primary)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    } ${selected ? "font-semibold text-[var(--primary)]" : ""}`
                  }
                >
                  {({ selected }) => (
                    <>
                      <div className="flex items-center gap-2 truncate">
                        {option.icon}
                        <span className={`block truncate ${selected ? "font-semibold" : "font-normal"}`}>
                          {option.label}
                        </span>
                        {option.badge && (
                          <span className="ml-auto px-1.5 py-0.5 text-[0.625rem] font-medium rounded bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                            {option.badge}
                          </span>
                        )}
                      </div>

                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-[var(--primary)]">
                          <Check size={16} aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </>
        )}
      </Listbox>
    </div>
  );
}
