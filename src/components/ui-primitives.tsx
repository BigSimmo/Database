import { Ban, Loader2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
export const raisedCard = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";
export const insetCard = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)]";
export const appBackdrop = "app-edge-backdrop";
export const glassPanel =
  "rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]";
export const quietPanel =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]";
export const sourceCard = `${quietPanel} transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)]`;
export const answerSurface = "rounded-lg bg-transparent";
export const evidenceSurface =
  "rounded-lg border border-[color:var(--border)] border-l-[3px] border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]";
export const panel =
  "rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] ring-1 ring-[color:var(--border-strong)]/20 dark:ring-[color:var(--border-strong)]/10";
export const panelSubtle = quietPanel;
export const controlBase =
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-lg text-sm font-semibold transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none";
export const primaryControl = `${controlBase} bg-[color:var(--command)] px-5 text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)] hover:shadow-[var(--shadow-hover)]`;
export const floatingControl =
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none";
export const toolbarButton =
  "grid h-tap w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none";
export const eyebrowText = "text-2xs font-semibold uppercase leading-4 tracking-[0.06em] text-[color:var(--text-soft)]";
export const fieldLabel = `mb-1.5 block ${eyebrowText}`;
export const fieldControl =
  "h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-sm text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25";
export const fieldControlWithIcon = `${fieldControl} pl-9 pr-3`;
export const fieldControlPlain = `${fieldControl} px-3`;
export const fieldIcon =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]";
export const shellChip =
  "inline-flex min-h-tap items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]";
export const navPill =
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
export const metadataPill =
  "inline-flex min-h-7 items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]";
export const subtleStatusPill =
  "inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 text-xs font-semibold text-[color:var(--text-muted)]";
export const clinicalDivider = "border-t border-[color:var(--border)]/80";
export const iconTile =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
export const iconTilePremium =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
export const compactMetadataRow =
  "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tabular-nums text-[color:var(--text-muted)]";
export const sheetSurface =
  "rounded-t-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)] ring-1 ring-[color:var(--border-strong)]/20 backdrop-blur-xl dark:ring-[color:var(--border-strong)]/10 sm:rounded-lg";
export const sheetHandle = "mx-auto block h-1 w-10 rounded-full bg-[color:var(--border-strong)]/70 sm:hidden";
// Comfortable reading measure for long-form prose (answers, source passages, document text).
export const proseMeasure = "max-w-[68ch]";
// Geist Mono for clinical codes and identifiers: citation/source indices, page and
// chunk numbers, guideline versions, document IDs. Pairs with tabular figures.
export const codeText = "font-mono tabular-nums tracking-tight";
export const commandInput =
  "min-h-12 w-full rounded-lg border border-[color:var(--border)]/70 bg-[color:var(--surface)] pl-12 pr-12 text-sm font-semibold text-[color:var(--text)] shadow-[0_10px_22px_rgba(0,0,0,0.06),var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25 motion-safe:transition sm:text-base";

export const chatAnswerText =
  "max-w-[68ch] text-base-minus font-medium leading-[1.56] text-[color:var(--text-heading)] sm:text-base sm:leading-[1.62]";
export const chatActionRow =
  "flex min-h-tap flex-wrap items-center gap-1.5 text-xs font-semibold text-[color:var(--text-heading)] sm:min-h-8";
export const chatMicroAction =
  "inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
export const sourceCapsule =
  "source-capsule-hover focus-ring-premium inline-flex min-h-tap items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--clinical-accent-soft)_55%,var(--surface))] px-3 text-xs font-medium text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent-border)]";
export const sourceCapsuleCountBadge =
  "nums inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-raised)] px-1.5 text-2xs font-semibold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]";
export const evidenceRow =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
export const clinicalNotesRow =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-sand-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
/*
 * Composer SHELL constant — base/delta split (2026-07-08).
 *
 * The composer pill surface class `answer-footer-search-pill` (a <form>, in
 * `src/app/globals.css`) now lives in `@layer components`, so plain Tailwind
 * utilities on the pill win. To keep the class in control of the properties it
 * owns, `chatComposerShell` is split:
 *   - `chatComposerShellBase`  — utilities the pill class does NOT set (display,
 *     align, radius, border-width). Safe to stack next to the layered class;
 *     used at the composer pill call sites.
 *   - `chatComposerShellDelta` — utilities that set a property the pill class
 *     ALSO sets (min-height, gap, border-colour, background, padding, shadow,
 *     focus-within border). These would beat the layered class, so they are
 *     dropped at pill call sites and only reappear via the combined const.
 * `chatComposerShell` = `base + delta` (byte-identical class set to before) for
 * any call site that uses the pill surface WITHOUT the layered class.
 *
 * The pill-INTERIOR control constants (`chatComposerInput`, `chatSendButton`,
 * `chatComposerIconButton`) are NOT split: their chrome classes stay unlayered
 * because they land on <input>/<button> elements governed by unlayered global
 * resets (`font: inherit`, the ≤640px 16px font-size floor, the button
 * transition reset — see globals.css). An unlayered chrome class still beats
 * those resets by specificity; a layered one would not. Verified byte-identical
 * across 16 states with scripts/capture-chrome-parity.ts.
 */
export const chatComposerShellBase = "flex items-center rounded-full border";
export const chatComposerShellDelta =
  "min-h-14 gap-2 border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[0_1px_2px_rgb(16_24_40_/_5%),0_8px_22px_rgb(16_24_40_/_8%)] focus-within:border-[color:var(--clinical-accent)]";
export const chatComposerShell = `${chatComposerShellBase} ${chatComposerShellDelta}`;
export const chatComposerInput =
  "min-h-tap min-w-0 flex-1 bg-transparent px-2 text-base font-medium text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]";
export const chatComposerIconButton =
  "grid h-tap w-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
export const chatSendButton =
  "grid h-tap w-tap shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
export const tableCard =
  "overflow-hidden rounded-lg border border-[color:var(--border)]/80 bg-[color:var(--surface)] shadow-[0_6px_16px_rgb(15_27_45_/_4%)]";
export const tableCardHeader =
  "border-b border-[color:var(--border)] bg-[color:var(--clinical-chat-table-header)] px-3 py-2.5 text-sm font-semibold text-[color:var(--text-heading)]";
export const tableMicroActionRow =
  "flex min-h-tap flex-wrap items-center gap-1 border-t border-[color:var(--border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] sm:min-h-9";
export const sidebarItem =
  "flex min-h-tap min-w-0 w-full items-center gap-2 overflow-hidden rounded-lg px-2.5 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
export const sidebarToolTile =
  "grid min-h-16 place-items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-2 text-center text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
export const statusDotBase = "inline-block h-2 w-2 shrink-0 rounded-full";
export const statusDotReady = `${statusDotBase} bg-[color:var(--success)]`;
export const statusDotReview = `${statusDotBase} bg-[color:var(--warning)]`;
export const statusDotMuted = `${statusDotBase} bg-[color:var(--text-soft)]`;

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

export const searchPageCanvas = "bg-[color:var(--background)] text-[color:var(--text)]";
export const searchPageShell =
  "min-h-[calc(100dvh-4rem)] overflow-x-hidden px-3 py-3 pb-[calc(12rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-5 sm:pb-8 lg:px-6";
export const searchPageContainer = "mx-auto w-full max-w-[1500px]";
export const searchResultsBodyGrid = "grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]";
export const searchResultsMainColumn = "search-results-main min-w-0";
export const searchResultsSidebar = "hidden w-[22rem] shrink-0 space-y-4 xl:block";
export const searchResultsSection =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";
export const searchFocusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export type NoticeTone = "success" | "warning" | "danger" | "info" | "neutral";

function noticeToneClass(tone: NoticeTone) {
  if (tone === "success") return toneSuccess;
  if (tone === "danger") return toneDanger;
  if (tone === "info") return toneInfo;
  if (tone === "warning") return toneWarning;
  return toneNeutral;
}

/**
 * Shared inline feedback banner used across surfaces (auth panel, action
 * notices, upload) so success/warning/error feedback looks and announces the
 * same everywhere. Success/info announce politely (role=status); warning/danger
 * assert (role=alert). Pass onDismiss to render a dismiss control.
 */
export function InlineNotice({
  tone,
  children,
  onDismiss,
  dismissLabel = "Dismiss notification",
  animated = false,
  className,
}: {
  tone: NoticeTone;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  animated?: boolean;
  className?: string;
}) {
  const assertive = tone === "danger" || tone === "warning";
  return (
    <div
      role={assertive ? "alert" : "status"}
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border p-3 text-sm font-medium",
        animated && "motion-safe:animate-fade-up",
        noticeToneClass(tone),
        className,
      )}
    >
      <span className="min-w-0">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="-m-2.5 grid h-tap w-tap shrink-0 place-items-center rounded-lg opacity-70 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export type SemanticChipTone = "danger" | "info" | "warning" | "success" | "neutral";

export function semanticChipTone(tone: SemanticChipTone | undefined | null) {
  if (tone === "danger") return toneDanger;
  if (tone === "info") return toneInfo;
  if (tone === "warning") return toneWarning;
  if (tone === "success") return toneSuccess;
  return toneNeutral;
}

export function ToggleSwitch({
  enabled,
  className,
  onToggle,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  enabled: boolean;
  className?: string;
  // When provided the switch is an operable control; when omitted it renders as a
  // read-only presentational indicator (no interactive role is advertised).
  onToggle?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const track = cn(
    "relative inline-flex h-6 w-10 shrink-0 rounded-full transition",
    enabled ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
    className,
  );
  const knob = (
    <span
      aria-hidden
      className={cn(
        "absolute top-1 h-4 w-4 rounded-full bg-[color:var(--surface)] shadow-sm transition",
        enabled ? "right-1" : "left-1",
      )}
    />
  );

  if (onToggle) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          track,
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {knob}
      </button>
    );
  }

  // Read-only: expose the state as an image label so assistive tech announces
  // on/off without implying the control can be operated.
  return (
    <span role="img" aria-label={ariaLabel ? `${ariaLabel}: ${enabled ? "on" : "off"}` : undefined} className={track}>
      {knob}
    </span>
  );
}

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
  const status = source.document_status;
  const toneClassName =
    status === "current"
      ? toneSuccess
      : status === "outdated"
        ? toneDanger
        : status === "review_due"
          ? toneWarning
          : toneWarningQuiet;
  // Danger/warning states carry an icon so they stay distinguishable without
  // colour (forced-colors, fast scanning). "Current" stays quiet and iconless.
  const Icon = status === "outdated" ? Ban : status === "current" ? null : TriangleAlert;

  return (
    <span
      title={showTitle ? sourceStatusLabel(source) : undefined}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold",
        toneClassName,
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      {sourceStatusLabel(source)}
    </span>
  );
}

export function SourceProvenance({ metadata }: { metadata?: unknown }) {
  const source = normalizeSourceMetadata(metadata);
  const reviewDate = formatClinicalDate(source.review_date);
  // Unknown review date / jurisdiction segments are dropped as filler; the
  // validation and extraction-quality labels always stay — they are clinical
  // governance signals, not noise.
  const items = [
    validationStatusLabel(source),
    reviewDate === "Unknown" ? null : `Review ${reviewDate}`,
    source.jurisdiction,
    extractionQualityLabel(source),
  ].filter((item): item is string => Boolean(item));

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
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-[color:var(--clinical-accent)]" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: IconComponent; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm shadow-[var(--shadow-inset)] sm:p-5">
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
