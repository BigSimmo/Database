import { Ban, Landmark, Loader2, ShieldCheck, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  extractionQualityLabel,
  formatClinicalDate,
  normalizeSourceMetadata,
  sourceDesignationDescription,
  sourceDesignationLabel,
  sourceStatusLabel,
  validationStatusLabel,
} from "@/lib/source-metadata";
import { classifySourceAuthority } from "@/lib/source-authority-registry";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const textMuted = "text-[color:var(--text-muted)]";
export const raisedCard = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";
export const insetCard = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)]";
export const appBackdrop = "app-edge-backdrop";
export const glassPanel =
  "rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]";
export const glassOverlaySurface =
  "border border-[color:var(--border-lux)] ring-1 ring-[color:var(--surface-highlight)] backdrop-blur-xl";
export const toggleThumbSurface = "bg-[color:var(--surface-raised)]";
export const panelSubtle =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]";
export const sourceCard = `${panelSubtle} transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)]`;
export const answerSurface = "rounded-lg bg-transparent";
export const evidenceSurface =
  "rounded-lg border border-[color:var(--border)] border-l-[3px] border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]";
export const panel =
  "rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] ring-1 ring-[color:var(--border-strong)]/20 dark:ring-[color:var(--border-strong)]/10";
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
  "h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-sm text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] aria-[invalid=true]:border-[color:var(--danger)] aria-[invalid=true]:bg-[color:var(--danger-soft)] aria-[invalid=true]:text-[color:var(--danger)] aria-[invalid=true]:focus:border-[color:var(--danger)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-inset)] disabled:text-[color:var(--disabled)] disabled:shadow-none disabled:opacity-75 read-only:cursor-default read-only:bg-[color:var(--surface-subtle)] read-only:text-[color:var(--text-muted)] read-only:shadow-none";
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
  "min-h-12 w-full rounded-lg border border-[color:var(--border)]/70 bg-[color:var(--surface)] pl-12 pr-12 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-soft),var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] motion-safe:transition sm:text-base";

export const chatAnswerText =
  "max-w-[68ch] text-base-minus font-medium leading-[1.56] text-[color:var(--text-heading)] sm:text-base sm:leading-[1.62]";
export const chatActionRow =
  "flex min-h-tap flex-wrap items-center gap-1.5 text-xs font-semibold text-[color:var(--text-heading)] sm:min-h-8";
export const chatMicroAction =
  "inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
// Answer "Sources" capsule. `sourceCapsuleHit` is an invisible 44px WCAG touch
// target that wraps the compact visible pill `sourceCapsule` (`.source-capsule-face`),
// so the control reads smaller and lighter without shrinking the tap area. Hover,
// expanded, and focus chrome are driven from the hit target's :hover /
// [aria-expanded] / :focus-visible in globals.css (@layer components).
export const sourceCapsuleHit =
  "source-capsule-hit inline-flex min-h-tap w-fit items-center justify-center rounded-full outline-none";
export const sourceCapsule =
  "source-capsule-face inline-flex items-center gap-1.5 rounded-full border bg-[color-mix(in_srgb,var(--clinical-accent-soft)_55%,var(--surface))] px-2.5 py-1 text-2xs font-medium text-[color:var(--clinical-accent)]";
export const sourceCapsuleCountBadge =
  "nums inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-raised)] px-1 text-3xs font-semibold leading-none text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]";
export const evidenceRow =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
export const clinicalNotesRow =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-sand-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
/* Composer chrome has one owner: the unlayered classes in globals.css. These
 * exports are semantic handles only, so recipes and cascade rules cannot fight
 * over input/button dimensions, states, or paint. */
export const chatComposerShellBase = "chat-composer-shell-base";
export const chatComposerShellDelta = "chat-composer-shell-delta";
export const chatComposerShell = `${chatComposerShellBase} ${chatComposerShellDelta}`;
export const chatComposerInput = "chat-composer-input";
export const chatComposerIconButton = "chat-composer-icon-button";
export const chatSendButton = "chat-send-button";
export const tableCard =
  "overflow-hidden rounded-lg border border-[color:var(--border)]/80 bg-[color:var(--surface)] shadow-[var(--shadow-tight)]";
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
// Phone bottom-dock clearance lives on #main-content / dashboard <main> via
// --mobile-composer-reserve so it can collapse when the dock hides. Do not bake
// a second dock-sized safe-area pad into page shells.
export const searchPageShell =
  "min-h-[calc(100dvh-var(--shell-header-h))] overflow-x-hidden px-3 py-3 pb-4 sm:px-5 sm:py-5 sm:pb-8 lg:px-6";
export const searchPageContainer = "mx-auto w-full max-w-[1500px]";
// Canonical content-page width. Detail pages (service / form / differential),
// medication record + prescribing workspace, and the forms results view converge
// on this so the reading measure is one source of truth instead of a scatter of
// `mx-auto max-w-7xl` literals. Width only — call sites keep their own padding and
// vertical rhythm via cn(). Intentionally-wider surfaces (the document viewer's
// 1440px viewer+rail, the differentials tables) keep their bespoke widths.
export const pageContainer = "mx-auto w-full max-w-7xl";
export const searchResultsBodyGrid = "grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]";
export const searchResultsMainColumn = "search-results-main min-w-0";
export const searchResultsSidebar = "hidden w-[22rem] shrink-0 space-y-4 xl:block";
export const searchResultsSection =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";
export const searchFocusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type AsyncButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  busy: boolean;
  busyLabel: string;
  children: ReactNode;
  idleIcon?: ReactNode;
};

/** Shared busy-state contract for async actions: one label, spinner, disabled state, and announcement hook. */
export function AsyncButton({ busy, busyLabel, children, disabled, idleIcon, ...props }: AsyncButtonProps) {
  return (
    <button {...props} disabled={busy || disabled} aria-busy={busy || undefined}>
      {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : idleIcon}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /**
   * Required accessible name. Icon-only buttons carry no visible text, so the
   * label is the only thing assistive tech can announce — making it a required
   * prop closes the "unlabeled icon button" hole structurally, rather than
   * relying on convention + a runtime axe scan that only reaches a few routes.
   */
  label: string;
  /** Lucide icon rendered decoratively (aria-hidden) inside the button. */
  icon: LucideIcon;
  /** Size utility for the icon glyph; defaults to the 16px `size-icon-md` step. */
  iconClassName?: string;
};

/**
 * Accessible icon-only button. Guarantees the accessible name (`aria-label`), an
 * `aria-hidden` icon glyph, a 44px tap target, and the shared focus ring. Pass a
 * recipe like `toolbarButton`/`floatingControl` via `className` for chrome; the
 * base stays colour-neutral so the glyph inherits `currentColor` from context.
 */
export function IconButton({ label, icon: Icon, className, iconClassName, type, ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type={type ?? "button"}
      aria-label={label}
      className={cn(
        "grid size-tap shrink-0 place-items-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("size-icon-md", iconClassName)} />
    </button>
  );
}

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
        <IconButton icon={X} label={dismissLabel} onClick={onDismiss} className="-m-2.5 opacity-70 hover:opacity-100" />
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

export function SourceDesignationBadge({ metadata, className }: { metadata?: unknown; className?: string }) {
  const source = normalizeSourceMetadata(metadata);
  const classification = classifySourceAuthority(source);
  const toneClassName =
    classification.designation === "official"
      ? toneSuccess
      : classification.designation === "trusted"
        ? toneInfo
        : toneWarningQuiet;
  const Icon =
    classification.designation === "official"
      ? Landmark
      : classification.designation === "trusted"
        ? ShieldCheck
        : TriangleAlert;

  return (
    <span
      title={sourceDesignationDescription(source)}
      aria-label={`Source designation: ${sourceDesignationLabel(classification.designation)}. ${sourceDesignationDescription(source)}`}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold",
        toneClassName,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {sourceDesignationLabel(classification.designation)}
    </span>
  );
}

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
    sourceDesignationLabel(classifySourceAuthority(source).designation),
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
  icon?: IconComponent;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className={iconTile}>
          <Icon className="size-icon-md sm:size-icon-lg" />
        </span>
      )}
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
        <Loader2 aria-hidden="true" className="mx-auto mb-2 h-4 w-4 animate-spin text-[color:var(--clinical-accent)]" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  actions,
  live,
  tone = "neutral",
  testId,
}: {
  icon?: IconComponent;
  title: string;
  body: string;
  /** Optional controls stay within the shared state surface rather than becoming a second panel. */
  actions?: ReactNode;
  /** Announce a state transition only when the state is introduced dynamically. */
  live?: "polite" | "assertive";
  tone?: "neutral" | "info" | "danger";
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn(
        "rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm shadow-[var(--shadow-inset)] sm:p-5",
        tone === "info" && "border-[color:var(--info-border)] bg-[color:var(--info-soft)]",
        tone === "danger" && "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]",
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--text-muted)]",
              tone === "info" && "bg-[color:var(--info-soft)] text-[color:var(--info)]",
              tone === "danger" && "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
            )}
          >
            <Icon className="size-icon-md sm:size-icon-lg" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-[color:var(--text)]">{title}</p>
          <p className={cn("mt-1 leading-6", textMuted)}>{body}</p>
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
