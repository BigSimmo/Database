import type { LucideIcon } from "lucide-react";

import { cn, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";

export type ClinicalBadgeTone = "clinical" | "success" | "danger" | "warning" | "neutral" | "info";

export type ClinicalBadgeItem = {
  id?: string;
  label: string;
  tone?: ClinicalBadgeTone;
  icon?: LucideIcon;
};

export const clinicalBadgeTonePriority: Record<ClinicalBadgeTone, number> = {
  danger: 6,
  warning: 5,
  clinical: 4,
  success: 3,
  neutral: 2,
  info: 1,
};

export function clinicalBadgeToneClass(tone: ClinicalBadgeTone): string {
  const toneClassName: Record<ClinicalBadgeTone, string> = {
    clinical:
      "border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
    success: toneSuccess,
    danger: toneDanger,
    warning: toneWarning,
    neutral: toneNeutral,
    info: toneInfo,
  };
  return toneClassName[tone];
}

export function ClinicalBadge({
  label,
  tone = "neutral",
  icon: Icon,
  compact = false,
}: ClinicalBadgeItem & { compact?: boolean }) {
  return (
    <span
      title={label}
      className={cn(
        "inline-flex h-[1.375rem] max-w-full shrink-0 items-center gap-1 rounded-md border px-1.5 text-3xs font-semibold leading-none shadow-[var(--shadow-inset)]",
        compact && "h-5 px-1.5 text-3xs",
        clinicalBadgeToneClass(tone),
      )}
    >
      {Icon ? <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function BadgeCluster({
  items,
  compact = false,
  limit,
  showOverflowCount = false,
  className,
}: {
  items?: ClinicalBadgeItem[];
  compact?: boolean;
  limit?: number;
  showOverflowCount?: boolean;
  className?: string;
}) {
  if (!items?.length) return null;
  const orderedItems =
    typeof limit === "number"
      ? [...items].sort(
          (a, b) => clinicalBadgeTonePriority[b.tone ?? "neutral"] - clinicalBadgeTonePriority[a.tone ?? "neutral"],
        )
      : items;
  const visibleItems = typeof limit === "number" ? orderedItems.slice(0, limit) : orderedItems;
  const hiddenCount = typeof limit === "number" ? Math.max(0, items.length - visibleItems.length) : 0;

  return (
    <div className={cn("flex min-w-0 flex-wrap gap-1", className)}>
      {visibleItems.map((item, index) => (
        <ClinicalBadge
          key={item.id ?? `${item.label}-${item.tone ?? "neutral"}-${index}`}
          compact={compact}
          {...item}
        />
      ))}
      {showOverflowCount && hiddenCount ? (
        <ClinicalBadge label={`+${hiddenCount}`} tone="neutral" compact={compact} />
      ) : null}
    </div>
  );
}
