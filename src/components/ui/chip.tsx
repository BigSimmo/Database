"use client";

import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";

export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE: Record<ChipTone, string> = {
  neutral: toneNeutral,
  info: toneInfo,
  success: toneSuccess,
  warning: toneWarning,
  danger: toneDanger,
};

const DOT: Record<ChipTone, string> = {
  neutral: "bg-[color:var(--text-soft)]",
  info: "bg-[color:var(--info)]",
  success: "bg-[color:var(--success)]",
  warning: "bg-[color:var(--warning)]",
  danger: "bg-[color:var(--danger)]",
};

export type ChipProps = {
  children: ReactNode;
  tone?: ChipTone;
  /** Status dot. Never the only carrier of meaning — the label still says it. */
  dot?: boolean;
  icon?: LucideIcon;
  /**
   * Removal handler. The label is per-chip and required when removable: a row of
   * identical "Remove" buttons is unusable by voice or screen reader.
   */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

// A chip is static text at 28px (`--chip-height`), NOT a 44px tap target — that
// floor is for interactive controls (register #7/#18). The remove control inside
// a removable chip is interactive and keeps its own hit area.
export function Chip({
  children,
  tone = "neutral",
  dot = false,
  icon: Icon,
  onRemove,
  removeLabel,
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
        TONE[tone],
        onRemove && "pr-1",
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} /> : null}
      {Icon ? <Icon aria-hidden="true" className="size-icon-xs shrink-0" /> : null}
      <span className="min-w-0 truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${typeof children === "string" ? children : "filter"}`}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm transition hover:bg-[color:var(--surface-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)]"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
