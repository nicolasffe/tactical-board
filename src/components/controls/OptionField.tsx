"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface OptionItem {
  value: string;
  label: string;
}

interface OptionFieldProps {
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  title?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
}

interface FloatingPosition {
  top: number;
  left: number;
  width: number;
  placeAbove: boolean;
}

const triggerBaseClass =
  "inline-flex h-11 w-full items-center justify-between gap-3 rounded-[18px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 text-left text-[11px] font-semibold text-slate-700 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)] outline-none transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-sky-200 sm:text-xs";

const floatingClass =
  "overflow-hidden rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-1.5 shadow-[0_26px_64px_-34px_rgba(15,23,42,0.42)] ring-1 ring-slate-200/60 backdrop-blur-xl";

export function OptionField({
  options,
  value,
  onChange,
  title,
  icon: Icon,
  className,
}: OptionFieldProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const listboxId = useId();
  const canUseDOM = typeof window !== "undefined";

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const estimatedHeight = Math.min(options.length * 46 + 18, 296);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const placeAbove =
        spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const top = placeAbove
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : Math.min(window.innerHeight - estimatedHeight - 12, rect.bottom + 8);

      setPosition({
        top,
        left: Math.max(12, rect.left),
        width: rect.width,
        placeAbove,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (triggerRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, options.length]);

  const handleToggle = () => {
    setIsOpen((current) => !current);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerBaseClass} ${className ?? ""}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        title={title}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
              <Icon size={14} />
            </span>
          ) : null}
          <span className="truncate text-slate-800">{selectedOption?.label}</span>
        </span>

        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition ${isOpen ? "rotate-180 text-slate-700" : ""}`}
        >
          <ChevronDown size={15} />
        </span>
      </button>

      {canUseDOM && isOpen && position
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              className={floatingClass}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: 80,
              }}
            >
              <div
                className="max-h-[296px] overflow-y-auto"
                style={{
                  transformOrigin: position.placeAbove ? "bottom center" : "top center",
                }}
              >
                {options.map((option) => {
                  const isSelected = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      autoFocus={isSelected}
                      className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left text-[11px] font-semibold transition sm:text-xs ${
                        isSelected
                          ? "bg-[linear-gradient(135deg,#1e293b,#334155)] text-white shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]"
                          : "text-slate-700 hover:bg-slate-100/90"
                      }`}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                    >
                      <span className="truncate">{option.label}</span>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                          isSelected ? "bg-white/14 text-white" : "text-slate-300"
                        }`}
                      >
                        <Check size={13} strokeWidth={2.8} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
