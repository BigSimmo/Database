import type { CSSProperties, ReactNode } from "react";

import { AlertIcon, ShieldCheckIcon } from "./icons";
import { reviewStatusMeta } from "./data/select";

// ---- tag pill -----------------------------------------------------------

type Tone = "neutral" | "purple" | "info" | "success" | "warning" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "tc-tone-neutral",
  purple: "tc-tone-purple",
  info: "tc-tone-info",
  success: "tc-tone-success",
  warning: "tc-tone-warning",
  accent: "tc-tone-accent",
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
  return <span className={`tc-tag ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function TagRow({ tags, max = 5 }: { tags: string[]; max?: number }) {
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <div className="tc-ui-001">
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
    <span className={`tc-status-badge ${TONE_CLASS[tone]}`}>
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
    <span className={`tc-icon-tile tc-icon-tile-${size} tc-icon-tile-${variant}`}>
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

// ---- loading / empty ----------------------------------------------------

export function LoadingState({ label = "Loading therapy library…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="tc-ui-002">
      <span className="tc-spin tc-ui-003" />
      <span className="tc-ui-004">{label}</span>
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
    <div className="tc-ui-005">
      <span className="tc-ui-006">
        <Icon size={26} />
      </span>
      <div className="tc-ui-007">{title}</div>
      <p className="tc-ui-008">{body}</p>
      {action ? <div className="tc-ui-009">{action}</div> : null}
    </div>
  );
}

// ---- small building blocks ---------------------------------------------

export function SectionHeading({ children }: { children: ReactNode }) {
  return <div className="tc-ui-010">{children}</div>;
}

export function Eyebrow({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`tc-eyebrow ${TONE_CLASS[tone]}`}>{children}</span>;
}

/** A completeness meter (0–100) used on cards and the detail rail. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="tc-ui-011">
      <div className="tc-ui-012">
        <span className="tc-ui-013">{label}</span>
        <span className="tc-ui-014">{value == null ? "—" : `${v}%`}</span>
      </div>
      <span className="tc-ui-015">
        <span
          className={`tc-meter-fill ${v >= 80 ? "tc-meter-success" : v >= 50 ? "tc-meter-accent" : "tc-meter-warning"}`}
          style={{ "--tc-meter-width": `${v}%` } as CSSProperties}
        />
      </span>
    </div>
  );
}
