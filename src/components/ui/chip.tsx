"use client";

import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";

export type ChipSize = "compact" | "standard";
export type ChipStatusTone = "neutral" | "info" | "success" | "warning" | "danger";
export type ChipCategoryTone =
  "document" | "table" | "search" | "source" | "service" | "form" | "purple" | "indigo" | "rose" | "slate";
export type ChipInformationTone = "neutral" | "quiet" | "inset" | "accent" | "info";

export type ChipAppearance =
  | { kind: "status"; tone: ChipStatusTone }
  | { kind: "category"; tone: ChipCategoryTone }
  | { kind: "information"; tone?: ChipInformationTone };

const STATUS: Record<ChipStatusTone, string> = {
  neutral: toneNeutral,
  info: toneInfo,
  success: toneSuccess,
  warning: toneWarning,
  danger: toneDanger,
};

const CATEGORY: Record<ChipCategoryTone, string> = {
  document:
    "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  table: "border-[color:var(--type-table-border)] bg-[color:var(--type-table-soft)] text-[color:var(--type-table)]",
  search: "border-[color:var(--type-search-border)] bg-[color:var(--type-search-soft)] text-[color:var(--type-search)]",
  source: "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
  service:
    "border-[color:var(--type-service-border)] bg-[color:var(--type-service-soft)] text-[color:var(--type-service)]",
  form: "border-[color:var(--type-form-border)] bg-[color:var(--type-form-soft)] text-[color:var(--type-form)]",
  purple: "border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]",
  indigo: "border-[color:var(--tone-indigo-border)] bg-[color:var(--tone-indigo-soft)] text-[color:var(--tone-indigo)]",
  rose: "border-[color:var(--tone-rose-border)] bg-[color:var(--tone-rose-soft)] text-[color:var(--tone-rose)]",
  slate: "border-[color:var(--tone-slate-border)] bg-[color:var(--tone-slate-soft)] text-[color:var(--tone-slate)]",
};

const INFORMATION: Record<ChipInformationTone, string> = {
  neutral: toneNeutral,
  quiet: "border-transparent bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  inset: "border-[color:var(--border)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
  accent:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  info: toneInfo,
};

const SIZE: Record<ChipSize, string> = {
  compact: "h-6 px-2 text-2xs",
  standard: "h-7 px-2.5 text-xs",
};

function appearanceClasses(appearance: ChipAppearance) {
  if (appearance.kind === "status") return STATUS[appearance.tone];
  if (appearance.kind === "category") return CATEGORY[appearance.tone];
  return INFORMATION[appearance.tone ?? "neutral"];
}

function dotClasses(appearance: ChipAppearance) {
  if (appearance.kind === "status") {
    if (appearance.tone === "success") return "bg-[color:var(--success)]";
    if (appearance.tone === "warning") return "bg-[color:var(--warning)]";
    if (appearance.tone === "danger") return "bg-[color:var(--danger)]";
    if (appearance.tone === "info") return "bg-[color:var(--info)]";
  }
  return "bg-current";
}

type ChipBase = {
  children: ReactNode;
  size?: ChipSize;
  appearance?: ChipAppearance;
  /** Status dot. Never the only carrier of meaning — the label still says it. */
  dot?: boolean;
  icon?: LucideIcon;
  /** Layout only: margin, width, shrink/grow, alignment and wrapping. */
  className?: string;
};

/** Removable chips require a unique, object-specific label. */
export type ChipProps = ChipBase &
  ({ onRemove: () => void; removeLabel: string } | { onRemove?: never; removeLabel?: never });

export function Chip({
  children,
  size = "standard",
  appearance = { kind: "information", tone: "neutral" },
  dot = false,
  icon: Icon,
  onRemove,
  removeLabel,
  className,
}: ChipProps) {
  const fullLabel = typeof children === "string" ? children : undefined;
  return (
    <span
      data-testid="chip"
      data-size={size}
      data-appearance={appearance.kind}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-md border font-semibold leading-none",
        SIZE[size],
        appearanceClasses(appearance),
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses(appearance))} /> : null}
      {Icon ? <Icon aria-hidden="true" className="size-icon-xs shrink-0" /> : null}
      <span className="max-h-full min-w-0 overflow-hidden truncate" title={fullLabel}>
        {children}
      </span>
      {onRemove ? (
        <span className="relative h-5 w-5 shrink-0">
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="absolute left-1/2 top-1/2 grid h-tap w-tap -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)]"
          >
            <span className="grid h-5 w-5 place-items-center rounded-sm transition hover:bg-[color:var(--surface-highlight)]">
              <X aria-hidden="true" className="h-3 w-3" />
            </span>
          </button>
        </span>
      ) : null}
    </span>
  );
}
