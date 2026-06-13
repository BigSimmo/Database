import { Loader2, type LucideIcon } from "lucide-react";
import {
  extractionQualityLabel,
  formatClinicalDate,
  normalizeSourceMetadata,
  sourceStatusLabel,
  validationStatusLabel,
} from "@/lib/source-metadata";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const textMuted = "text-[color:var(--text-muted)]";
export const raisedCard = "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]";
export const insetCard = "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-inset)]";
export const appBackdrop =
  "bg-[radial-gradient(circle_at_50%_-12%,color-mix(in_srgb,var(--primary)_11%,transparent),transparent_28rem),linear-gradient(180deg,var(--background),color-mix(in_srgb,var(--background)_90%,var(--surface-inset)))]";
export const glassPanel =
  "rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)] dark:border-white/10";
export const quietPanel =
  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]";
export const sourceCard = `${quietPanel} transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)]`;
export const answerSurface =
  "rounded-xl border border-[color:var(--border-lux)] border-l-4 border-l-[color:var(--primary)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]";
export const evidenceSurface =
  "rounded-xl border border-[color:var(--primary)]/20 border-l-4 border-l-[color:var(--primary)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]";
export const panel =
  "rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] ring-1 ring-white/25 dark:ring-white/5";
export const panelSubtle = quietPanel;
export const controlBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-none";
export const primaryControl = `${controlBase} bg-[color:var(--primary)] px-5 text-[color:var(--primary-contrast)] shadow-[inset_0_1px_0_rgb(255_255_255_/_18%),var(--shadow-tight)] hover:bg-[color:var(--primary-strong)] hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_22%),var(--shadow-hover)]`;
export const floatingControl =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none";
export const toolbarButton =
  "grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none";
export const eyebrowText = "text-2xs font-semibold uppercase text-[color:var(--text-soft)]";
export const fieldLabel = `mb-1.5 block ${eyebrowText}`;
export const fieldControl =
  "h-[44px] w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-sm text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25";
export const fieldControlWithIcon = `${fieldControl} pl-9 pr-3`;
export const fieldControlPlain = `${fieldControl} px-3`;
export const fieldIcon =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]";
export const shellChip =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]";
export const navPill =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]";
export const metadataPill =
  "inline-flex min-h-7 items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]";
export const subtleStatusPill =
  "inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 text-xs font-semibold text-[color:var(--text-muted)]";
export const clinicalDivider = "border-t border-[color:var(--border)]/80";
export const iconTile =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]";
export const iconTilePremium =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]";
export const compactMetadataRow =
  "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[color:var(--text-muted)]";
export const premiumHeaderSurface =
  "border-b border-white/10 bg-[radial-gradient(circle_at_12%_-35%,color-mix(in_srgb,var(--app-shell-accent)_34%,transparent),transparent_18rem),linear-gradient(135deg,var(--app-shell)_0%,var(--app-shell-muted)_58%,color-mix(in_srgb,var(--app-shell-muted)_72%,var(--app-shell-accent))_100%)] text-white shadow-[var(--shadow-soft)]";
export const sheetSurface =
  "rounded-t-[var(--radius-xl)] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)] ring-1 ring-white/25 backdrop-blur-xl dark:ring-white/10 sm:rounded-[var(--radius-lg)]";
export const sheetHandle = "mx-auto block h-1 w-10 rounded-full bg-[color:var(--border-strong)]/70 sm:hidden";
export const commandInput =
  "min-h-[48px] w-full rounded-[var(--radius-lg)] border border-white/20 bg-white/95 pl-12 pr-12 text-base font-semibold text-slate-950 shadow-[0_16px_34px_rgb(0_0_0_/_14%),inset_0_1px_0_rgb(255_255_255_/_82%)] outline-none transition placeholder:text-slate-500 focus:border-[color:var(--focus)] focus:ring-4 focus:ring-teal-300/25 dark:bg-slate-950/90 dark:text-slate-50 dark:placeholder:text-slate-500";

export const toneSuccess =
  "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
export const toneDanger =
  "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
export const toneInfo = "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
export const toneWarning =
  "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
export const toneWarningQuiet =
  "border-[color:var(--warning-border)]/60 bg-[color:var(--warning-soft)]/45 text-[color:var(--warning)]";
export const toneNeutral =
  "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";

type IconComponent = LucideIcon;

export function SourceStatusBadge({
  metadata,
  className,
  showTitle = true,
}: {
  metadata?: unknown;
  className?: string;
  showTitle?: boolean;
}) {
  const source = normalizeSourceMetadata(metadata);
  const toneClassName =
    source.document_status === "current"
      ? toneSuccess
      : source.document_status === "outdated"
        ? toneDanger
        : source.document_status === "review_due"
          ? toneWarning
          : toneWarningQuiet;

  return (
    <span
      title={showTitle ? sourceStatusLabel(source) : undefined}
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold",
        toneClassName,
        className,
      )}
    >
      {sourceStatusLabel(source)}
    </span>
  );
}

export function SourceProvenance({ metadata }: { metadata?: unknown }) {
  const source = normalizeSourceMetadata(metadata);
  const items = [
    validationStatusLabel(source),
    `Review ${formatClinicalDate(source.review_date)}`,
    source.jurisdiction ?? "Jurisdiction unknown",
    extractionQualityLabel(source),
  ];

  return (
    <div className={compactMetadataRow}>
      {items.map((item, index) => (
        <span key={`${item}:${index}`} className="inline-flex items-center gap-2">
          {index > 0 && <span className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" aria-hidden />}
          {item}
        </span>
      ))}
    </div>
  );
}

export function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: IconComponent;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={iconTile}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h2>
        {description && <p className={cn("mt-1 text-sm leading-6", textMuted)}>{description}</p>}
      </div>
    </div>
  );
}

export function LoadingPanel({
  label,
  variant = "spinner",
  lines = 3,
}: {
  label: string;
  variant?: "spinner" | "skeleton";
  lines?: number;
}) {
  if (variant === "skeleton") {
    return (
      <div className={`${insetCard} mt-3 space-y-2.5 p-4`} role="status" aria-label={label}>
        {Array.from({ length: lines }).map((_, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              "block h-3.5 rounded-md bg-[color:var(--surface-subtle)] bg-no-repeat",
              "bg-[length:200%_100%] bg-[linear-gradient(100deg,transparent_30%,color-mix(in_srgb,var(--surface-highlight)_72%,transparent)_50%,transparent_70%)]",
              "motion-safe:animate-shimmer",
              index === lines - 1 ? "w-2/3" : "w-full",
            )}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={`${insetCard} mt-3 grid min-h-28 place-items-center p-4 text-center text-sm font-semibold text-[color:var(--text-muted)]`}
      role="status"
    >
      <div>
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-[color:var(--primary)]" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: IconComponent; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm shadow-[var(--shadow-inset)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--text-muted)]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[color:var(--text)]">{title}</p>
          <p className={cn("mt-1 leading-6", textMuted)}>{body}</p>
        </div>
      </div>
    </div>
  );
}
