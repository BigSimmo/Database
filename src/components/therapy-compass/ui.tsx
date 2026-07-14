import type { ReactNode } from "react";

import { AlertIcon, ShieldCheckIcon } from "./icons";
import { reviewStatusMeta } from "./data/select";
import { s } from "./style-utils";

// ---- tag pill -----------------------------------------------------------

type Tone = "neutral" | "purple" | "info" | "success" | "warning" | "accent";

const TONE_STYLE: Record<Tone, string> = {
  neutral: "background:var(--surface-inset);color:var(--text-muted);border:1px solid var(--border);",
  // The design's "CBT-family" purple is a deliberate category colour with no
  // token equivalent; keep it verbatim (reads fine in both themes).
  purple: "background:#f4f0ff;color:#6d3fc4;border:1px solid #e4d9fb;",
  info: "background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-border);",
  success: "background:var(--success-bg);color:var(--success-text);border:1px solid var(--success-border);",
  warning: "background:var(--warning-bg);color:var(--warning-text);border:1px solid var(--warning-border);",
  accent:
    "background:var(--clinical-accent-soft);color:var(--clinical-accent-hover);border:1px solid var(--clinical-accent-border);",
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
      style={s(
        `font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:7px;white-space:nowrap;` + TONE_STYLE[tone],
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
    <div style={s(`display:flex;flex-wrap:wrap;gap:7px;`)}>
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
      style={s(
        `display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;padding:5px 11px;border-radius:8px;` +
          TONE_STYLE[tone],
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
  const bg =
    variant === "accent"
      ? "background:var(--clinical-accent);color:#fff;"
      : "background:var(--clinical-accent-soft);color:var(--clinical-accent);";
  return (
    <span
      style={s(
        `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:12px;flex:none;` +
          bg,
      )}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

// ---- loading / empty ----------------------------------------------------

export function LoadingState({ label = "Loading therapy library…" }: { label?: string }) {
  return (
    <div
      style={s(
        `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:280px;color:var(--text-soft);`,
      )}
    >
      <span
        className="tc-spin"
        style={s(
          `width:34px;height:34px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--clinical-accent);`,
        )}
      />
      <span style={s(`font-size:14px;font-weight:500;`)}>{label}</span>
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
    <div
      style={s(
        `display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:48px 24px;background:var(--surface);border:1px dashed var(--border-strong);border-radius:16px;`,
      )}
    >
      <span
        style={s(
          `display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:var(--clinical-accent-soft);color:var(--clinical-accent);margin-bottom:2px;`,
        )}
      >
        <Icon size={26} />
      </span>
      <div style={s(`font-size:17px;font-weight:680;color:var(--text-heading);`)}>{title}</div>
      <p style={s(`margin:0;max-width:44ch;font-size:13.5px;line-height:1.55;color:var(--text-muted);`)}>{body}</p>
      {action ? <div style={s(`margin-top:8px;`)}>{action}</div> : null}
    </div>
  );
}

// ---- small building blocks ---------------------------------------------

export function SectionHeading({ children }: { children: ReactNode }) {
  return <div style={s(`font-size:15px;font-weight:650;color:var(--text-heading);`)}>{children}</div>;
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span style={s(`font-size:10.5px;font-weight:700;letter-spacing:0.05em;color:${color ?? "var(--text-soft)"};`)}>
      {children}
    </span>
  );
}

/** A completeness meter (0–100) used on cards and the detail rail. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div style={s(`display:flex;flex-direction:column;gap:4px;min-width:0;`)}>
      <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:8px;`)}>
        <span style={s(`font-size:11px;color:var(--text-soft);`)}>{label}</span>
        <span style={s(`font-size:11px;font-weight:650;color:var(--text-muted);`)}>
          {value == null ? "—" : `${v}%`}
        </span>
      </div>
      <span style={s(`height:5px;border-radius:3px;background:var(--surface-inset);overflow:hidden;`)}>
        <span
          style={s(
            `display:block;height:100%;border-radius:3px;width:${v}%;background:${v >= 80 ? "var(--success-solid, var(--success-text))" : v >= 50 ? "var(--clinical-accent)" : "var(--warning-text)"};`,
          )}
        />
      </span>
    </div>
  );
}
