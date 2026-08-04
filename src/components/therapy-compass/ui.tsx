import type { ReactNode } from "react";

import { cn, toneInfo, toneSuccess, toneWarning } from "@/components/ui-primitives";

import { AlertIcon, ShieldCheckIcon } from "./icons";
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
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-2xs font-semibold",
        TONE_SURFACE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function TagRow({ tags, max = 5 }: { tags: string[]; max?: number }) {
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((tag) => (
        <Tag key={tag} tone={tagTone(tag)}>
          {tag}
        </Tag>
      ))}
      {extra > 0 ? <Tag tone="neutral">+{extra}</Tag> : null}
    </div>
  );
}

// ---- review status badge ------------------------------------------------

export function StatusBadge({ status }: { status: string }) {
  const meta = reviewStatusMeta(status);
  const tone = meta.tone === "success" ? "success" : meta.tone === "warning" ? "warning" : "neutral";
  const Icon = meta.tone === "success" ? ShieldCheckIcon : AlertIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        TONE_SURFACE[tone],
      )}
    >
      <Icon size={14} strokeWidth={1.9} />
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
  icon: (p: { size?: number }) => ReactNode;
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
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

// ---- loading / empty ----------------------------------------------------

/**
 * Therapy keeps its own centred loading/empty states rather than the shared
 * `LoadingPanel`/`EmptyState`, which are left-aligned inset panels. Deliberate: the
 * stylesheet teardown was scoped to remove the parallel CSS without changing how the
 * mode looks. The spinner needs no in-app motion gate — `html[data-motion="reduced"] *`
 * in globals.css already suppresses every animation.
 */
export function LoadingState({ label = "Loading therapy library…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-[color:var(--text-soft)]"
    >
      <span className="h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-[color:var(--border)] border-t-[color:var(--clinical-accent)] motion-reduce:animate-none" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: (p: { size?: number }) => ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] px-6 py-12 text-center">
      <span className="mb-0.5 inline-flex h-13 w-13 items-center justify-center rounded-xl bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon size={26} />
      </span>
      <div className="text-lg-minus font-bold text-[color:var(--text-heading)]">{title}</div>
      <p className="m-0 max-w-[44ch] text-sm-minus leading-normal text-[color:var(--text-muted)]">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
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
        <span className="text-2xs text-[color:var(--text-soft)]">{label}</span>
        <span className="text-2xs font-semibold text-[color:var(--text-muted)]">{value == null ? "—" : `${v}%`}</span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-xs bg-[color:var(--surface-inset)]">
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
