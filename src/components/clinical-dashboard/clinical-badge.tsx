import { Ban, Lock, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";
import {
  SEMANTIC_TONE_META,
  SEMANTIC_TONE_PRIORITY,
  type SemanticIconKey,
  type SemanticTone,
} from "@/lib/semantic-tone";

// Clinical badge tones are the shared semantic tones. Aliased for backwards
// compatibility with existing call sites; the definition lives in semantic-tone.ts.
export type ClinicalBadgeTone = SemanticTone;

export type ClinicalBadgeItem = {
  id?: string;
  label: string;
  tone?: ClinicalBadgeTone;
  // Explicit icon component (existing callers that pass a lucide icon directly).
  icon?: LucideIcon;
  // Semantic icon key resolved here (e.g. controlled-drug lock). Takes priority
  // over the tone's default icon but not over an explicit `icon`.
  iconKey?: SemanticIconKey;
};

// Re-exported so existing importers keep working; there is now exactly one map.
export const clinicalBadgeTonePriority = SEMANTIC_TONE_PRIORITY;

const SEMANTIC_ICONS: Record<SemanticIconKey, LucideIcon> = {
  danger: Ban,
  warning: TriangleAlert,
  controlled: Lock,
};

// Only the two safety tones carry a default icon so danger/warning stay
// distinguishable without colour (forced-colors, colour-blindness). Neutral,
// info, success, and clinical stay icon-free to keep badges quiet.
const TONE_DEFAULT_ICON: Partial<Record<ClinicalBadgeTone, SemanticIconKey>> = {
  danger: "danger",
  warning: "warning",
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
  icon,
  iconKey,
  compact = false,
}: ClinicalBadgeItem & { compact?: boolean }) {
  // Resolve to an icon *key* first (a string), then index the static component
  // map — mirrors StatusBadge and avoids the react-hooks/static-components rule
  // that fires when a component is produced by a call expression during render.
  const resolvedIconKey: SemanticIconKey | null = icon ? null : (iconKey ?? TONE_DEFAULT_ICON[tone] ?? null);
  const Icon = icon ?? (resolvedIconKey ? SEMANTIC_ICONS[resolvedIconKey] : null);
  // Announce the tone's meaning before the label so screen-reader users get the
  // same "stop vs caution" signal sighted users get from colour + icon.
  const ariaPrefix = SEMANTIC_TONE_META[tone].ariaPrefix;

  return (
    <span
      title={label}
      className={cn(
        "inline-flex h-[1.375rem] max-w-full shrink-0 items-center gap-1 rounded-md border px-1.5 text-3xs font-semibold leading-none shadow-[var(--shadow-inset)]",
        compact && "h-5 px-1.5 text-3xs",
        clinicalBadgeToneClass(tone),
      )}
    >
      {ariaPrefix ? <span className="sr-only">{ariaPrefix}: </span> : null}
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
