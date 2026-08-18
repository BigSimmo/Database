import type { ReactNode } from "react";
import { ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";

import { Chip, type ChipAppearance } from "@/components/ui/chip";
import {
  cn,
  EmptyState as SharedEmptyState,
  LoadingPanel,
  toneInfo,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";

import { reviewStatusMeta } from "./data/select";

// ---- tag pill -----------------------------------------------------------

type Tone = "neutral" | "purple" | "info" | "success" | "warning" | "accent";

/**
 * Border + background + text for a filled pill. `info`/`success`/`warning` reuse the
 * shared recipes: `--success` and `--success-soft` are aliases of `--success-text` and
 * `--success-bg`, so these render identically to the tone classes they replace. Therapy
 * additionally needs `purple` (therapy modality) and `accent`, which the shared kit
 * does not carry.
 */
const TONE_SURFACE: Record<Tone, string> = {
  neutral: "border-[color:var(--border)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
  purple: "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
  info: toneInfo,
  success: toneSuccess,
  warning: toneWarning,
  accent:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]",
};

/** Text colour only, for the borderless transparent eyebrow. */
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-[color:var(--text-muted)]",
  purple: "text-[color:var(--type-source)]",
  info: "text-[color:var(--info)]",
  success: "text-[color:var(--success)]",
  warning: "text-[color:var(--warning)]",
  accent: "text-[color:var(--clinical-accent-hover)]",
};

export function tagTone(tag: string): Tone {
  const t = tag.toLowerCase();
  if (/(cbt|act|dbt|behavioural)/.test(t)) return "purple";
  if (/(crisis|risk|trauma|psychosis)/.test(t)) return "info";
  if (/(handout|sheet|reviewed)/.test(t)) return "success";
  if (/(single|micro|5-min|multi-session)/.test(t)) return "neutral";
  return "neutral";
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const appearance: ChipAppearance =
    tone === "purple"
      ? { kind: "category", tone: "source" }
      : tone === "accent"
        ? { kind: "information", tone: "accent" }
        : tone === "success" || tone === "warning" || tone === "info"
          ? { kind: "status", tone }
          : { kind: "information", tone: "inset" };
  return (
    <Chip size="compact" appearance={appearance} className="whitespace-nowrap">
      {children}
    </Chip>
  );
}

export function TagRow({
  tags,
  max = 5,
  /** Search cards keep one row; detail may still wrap a longer set. */
  wrap = true,
}: {
  tags: string[];
  max?: number;
  wrap?: boolean;
}) {
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  const pills = shown.map((tag) => (
    <Tag key={tag} tone={tagTone(tag)}>
      {tag}
    </Tag>
  ));
  const overflow = extra > 0 ? <Tag tone="neutral">+{extra}</Tag> : null;

  // Single-row cards: keep `+N` as a non-shrinking sibling so overflow-hidden
  // clips long tags, not the indicator that more tags exist.
  if (!wrap) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-hidden">{pills}</div>
        {overflow ? <span className="shrink-0">{overflow}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pills}
      {overflow}
    </div>
  );
}

// ---- review status badge ------------------------------------------------

export function StatusBadge({ status }: { status: string }) {
  const meta = reviewStatusMeta(status);
  const tone = meta.tone === "success" ? "success" : meta.tone === "warning" ? "warning" : "neutral";
  const Icon = meta.tone === "success" ? ShieldCheck : TriangleAlert;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        TONE_SURFACE[tone],
      )}
    >
      <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// ---- icon tile ----------------------------------------------------------

export function IconTile({
  icon: Icon,
  size = 44,
  variant = "accent",
}: {
  icon: LucideIcon;
  size?: number;
  variant?: "accent" | "soft";
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-lg",
        size === 44 ? "h-tap w-tap" : "h-[38px] w-[38px]",
        variant === "accent"
          ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
          : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
      )}
    >
      <Icon size={Math.round(size * 0.5)} aria-hidden="true" />
    </span>
  );
}

// ---- loading / empty ----------------------------------------------------

export function LoadingState({ label = "Loading therapy library…" }: { label?: string }) {
  return <LoadingPanel label={label} layout="centered" />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <SharedEmptyState
      title={title}
      body={body}
      actions={action}
      iconNode={<Icon size={26} aria-hidden="true" />}
      align="center"
      live="polite"
      centeredTreatment="clinical"
    />
  );
}

// ---- small building blocks ---------------------------------------------

export function SectionHeading({ children }: { children: ReactNode }) {
  return <div className="text-base-minus font-semibold text-[color:var(--text-heading)]">{children}</div>;
}

export function Eyebrow({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cn("text-2xs font-bold tracking-eyebrow", TONE_TEXT[tone])}>{children}</span>;
}

/** A completeness meter (0–100) used on cards and the detail rail. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-[color:var(--text-muted)]">{label}</span>
        <span className="text-2xs font-semibold text-[color:var(--text-muted)]">{value == null ? "—" : `${v}%`}</span>
      </div>
      <span
        role={value == null ? undefined : "meter"}
        aria-label={value == null ? undefined : label}
        aria-valuemin={value == null ? undefined : 0}
        aria-valuemax={value == null ? undefined : 100}
        aria-valuenow={value == null ? undefined : v}
        className="block h-1.5 overflow-hidden rounded-xs bg-[color:var(--surface-inset)]"
      >
        <span
          className={cn(
            "block h-full rounded-xs",
            v >= 80
              ? "bg-[color:var(--success)]"
              : v >= 50
                ? "bg-[color:var(--clinical-accent)]"
                : "bg-[color:var(--warning)]",
          )}
          style={{ width: `${v}%` }}
        />
      </span>
    </div>
  );
}
