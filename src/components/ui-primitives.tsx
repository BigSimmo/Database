import { Ban, Landmark, Loader2, ShieldCheck, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
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
import { twMergeClinical } from "@/lib/tailwind-merge";
import type { ClinicalSourceMetadata } from "@/lib/types";

/**
 * What the source badges accept. Previously `unknown`, which meant the `.d.ts`
 * published to the design system promised a typed shape TypeScript refused to
 * enforce — so `{ validation_status: … }` (the wrong key; the real one is
 * `clinical_validation_status`) compiled cleanly and silently fell back, and an
 * off-vocabulary value reached the normalizer at runtime instead of at build
 * time. `Partial` because every field is genuinely optional on legacy rows;
 * `null` because that is what a missing join returns.
 */
export type SourceMetadataInput = Partial<ClinicalSourceMetadata> | null;

/**
 * Compose Tailwind classes, resolving conflicts last-wins.
 *
 * Falsy arguments are dropped exactly as before; what changed is that the result
 * now goes through tailwind-merge, so a later class beats an earlier one instead
 * of both being emitted and the generated stylesheet's order deciding. See
 * `@/lib/tailwind-merge` for why the merge needs this repo's `@theme` scales
 * declared to it, and what it silently deletes without them.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return twMergeClinical(classes.filter(Boolean).join(" "));
}

/**
 * The click handler for an `aria-disabled` placeholder — a control whose feature
 * is not built yet, or whose action needs data this record does not have.
 *
 * Those controls carry `aria-disabled="true"` rather than the native `disabled`
 * attribute, because `disabled` takes a button out of the tab order: a keyboard
 * user (and a screen-reader user moving by Tab rather than by virtual cursor)
 * can never land on it, so the `title` and the `aria-describedby` reason we went
 * to the trouble of writing are never reached. `aria-disabled` keeps the tab
 * stop and the announcement — "dimmed"/"unavailable" plus the description — and
 * moves the job of doing nothing to this handler.
 *
 * It stops propagation as well as preventing the default, because that is what
 * the native attribute did: a disabled button fires no click at all, so nothing
 * bubbled to a clickable ancestor. Without `stopPropagation` a placeholder
 * inside a clickable row would start activating the row.
 */
export function ignoreUnavailableActivation(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export const transitionSurface = "transition-colors transition-shadow motion-reduce:transition-none";
export const transitionTransform = "transition-transform motion-reduce:transform-none";

export const textMuted = "text-[color:var(--text-muted)]";
export const raisedCard = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";
const insetCard = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)]";
export const appBackdrop = "app-edge-backdrop";
export const glassOverlaySurface =
  "border border-[color:var(--border-lux)] ring-1 ring-[color:var(--surface-highlight)] backdrop-blur-xl";
export const toggleThumbSurface = "bg-[color:var(--surface-raised)]";
export const panelSubtle =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)] forced-colors:border";
export const sourceCard = `${panelSubtle} transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)]`;
export const answerSurface = "rounded-lg bg-transparent";
export const panel =
  "rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] ring-1 ring-[color:var(--ring-highlight)]";
// Disabled is ENCODED, not faded. `opacity-50` dims the label and the fill
// together, so a disabled primary stayed a large saturated block that still read
// as available, and a disabled secondary's label dropped below 4.5:1. Instead:
// flatten the fill to --surface-subtle, put the label on --disabled, drop the
// shadow, and remove the press affordance. `!` is required because the variant
// classes that follow this base would otherwise win on source order.
// The `aria-disabled:` half is not belt-and-braces: an unavailable placeholder
// carries `aria-disabled="true"` and no native attribute (see
// `ignoreUnavailableActivation`), so without these the control would lose the
// whole encoding and render as available. The `!` also does a second job here —
// it outranks the un-suffixed `hover:` colours these recipes ship, which a
// native `disabled` control never reaches but an `aria-disabled` one does.
export const controlDisabled =
  "disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-subtle)]! disabled:text-[color:var(--disabled)]! disabled:shadow-none! disabled:active:translate-y-0 aria-disabled:cursor-not-allowed aria-disabled:border-[color:var(--border)] aria-disabled:bg-[color:var(--surface-subtle)]! aria-disabled:text-[color:var(--disabled)]! aria-disabled:shadow-none! aria-disabled:active:translate-y-0";
export const controlBase = `inline-flex min-h-tap items-center justify-center gap-2 rounded-lg text-sm font-semibold transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border ${controlDisabled}`;
export const primaryControl = `${controlBase} bg-[color:var(--command)] px-5 text-[color:var(--command-contrast)] shadow-[var(--e1)] hover:bg-[color:var(--command-hover)] hover:shadow-[var(--shadow-hover)]`;
export const floatingControl = `inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border ${controlDisabled}`;
export const toolbarButton = `grid h-tap w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border ${controlDisabled}`;
// Eyebrows are text (section kickers), so they sit on `--text-muted` (≥4.5:1),
// never the decoration tier. Uppercase + tracking keep the kicker role.
export const eyebrowText = "text-2xs font-semibold uppercase leading-4 tracking-label text-[color:var(--text-muted)]";
// A field label is a text node, so it cannot use `--text-soft` (3.07:1) or the
// uppercase eyebrow treatment: weight said "important" while colour said
// "secondary", and the label was quieter than the value it described. Sentence
// case, label weight, full-strength ink.
export const fieldLabel = "mb-1.5 block text-sm font-medium leading-5 text-[color:var(--text)]";
export const fieldControl =
  "field-control h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-sm text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-placeholder)] forced-colors:border aria-[invalid=true]:border-[color:var(--danger)] aria-[invalid=true]:bg-[color:var(--danger-soft)] aria-[invalid=true]:text-[color:var(--danger)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-inset)] disabled:text-[color:var(--disabled)] disabled:shadow-none read-only:cursor-default read-only:bg-[color:var(--surface-subtle)] read-only:text-[color:var(--text-muted)] read-only:shadow-none";
export const fieldControlWithIcon = `${fieldControl} pl-9 pr-3`;
export const fieldControlPlain = `${fieldControl} px-3`;
export const fieldIcon =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--decoration-soft)]";
/** Rounded search container that owns focus. Pair with `searchShellInput`. */
export const searchShell =
  "search-shell flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3";
/** Transparent nested search input. Unlayered CSS, not Tailwind `outline-none`. */
export const searchShellInput = "search-shell-input min-w-0 flex-1 bg-transparent outline-none";
export const shellChip =
  "inline-flex min-h-tap items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]";
export const navPill = `inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border ${controlDisabled}`;
const metadataPillBase =
  "inline-flex items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]";
export const metadataPillDensity = {
  compact: `${metadataPillBase} min-h-6 px-2 text-2xs`,
  dense: `${metadataPillBase} min-h-7 px-2 text-2xs`,
  standard: `${metadataPillBase} min-h-7 px-2 text-xs`,
  roomyCompact: `${metadataPillBase} min-h-8 px-2.5 text-2xs`,
  comfortable: `${metadataPillBase} min-h-8 px-2.5 text-xs`,
  roomy: `${metadataPillBase} min-h-8 px-3 text-xs`,
  tap: `${metadataPillBase} min-h-tap px-3 text-xs`,
  interactiveCompact: `${metadataPillBase} min-h-tap px-2.5 text-2xs sm:min-h-9 sm:px-3`,
} as const;
/** Standard metadata density. Use `metadataPillDensity` when a different named density is intentional. */
export const metadataPill = metadataPillDensity.standard;
export const subtleStatusPill =
  "inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 text-xs font-semibold text-[color:var(--text-muted)]";
export const clinicalDivider = "border-t border-[color:var(--border)]/80";
const iconTile =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
export const iconTilePremium =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
const compactMetadataRow =
  "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold tabular-nums text-[color:var(--text-muted)]";
// Comfortable reading measure for long-form prose (answers, source passages, document text).
export const proseMeasure = "max-w-[68ch]";
// Geist Mono for clinical codes and identifiers: citation/source indices, page and
// chunk numbers, guideline versions, document IDs. Pairs with tabular figures.
export const codeText = "font-mono tabular-nums tracking-tight";

export const chatAnswerText =
  "max-w-[68ch] text-base-minus font-medium leading-prose text-[color:var(--text-heading)] sm:text-base";
export const chatActionRow =
  "flex min-h-tap flex-wrap items-center gap-1.5 text-xs font-semibold text-[color:var(--text-heading)] sm:min-h-8";
export const chatMicroAction = `inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] ${controlDisabled}`;
// Answer "Sources" capsule. `sourceCapsuleHit` is an invisible tap-sized WCAG touch
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
/* Composer chrome has one owner: the unlayered classes in globals.css. These
 * exports are semantic handles only, so recipes and cascade rules cannot fight
 * over input/button dimensions, states, or paint. */
export const chatComposerShellBase = "chat-composer-shell-base";
const chatComposerShellDelta = "chat-composer-shell-delta";
export const chatComposerShell = `${chatComposerShellBase} ${chatComposerShellDelta}`;
export const chatComposerInput = "chat-composer-input search-shell-input";
export const chatComposerIconButton = "chat-composer-icon-button";
export const chatSendButton = "chat-send-button";
export const tableCard =
  "overflow-hidden rounded-lg border border-[color:var(--border)]/80 bg-[color:var(--surface)] shadow-[var(--e1)]";
export const tableCardHeader =
  "border-b border-[color:var(--border)] bg-[color:var(--clinical-chat-table-header)] px-3 py-2.5 text-sm font-semibold text-[color:var(--text-heading)]";
export const tableMicroActionRow =
  "flex min-h-tap flex-wrap items-center gap-1 border-t border-[color:var(--border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] sm:min-h-9";
export const sidebarItem = `flex min-h-tap min-w-0 w-full items-center gap-2 overflow-hidden rounded-lg px-2.5 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] ${controlDisabled}`;
const statusMarkerBase = "inline-block h-2 w-2 shrink-0";
export const statusDotReady = `${statusMarkerBase} rounded-full border-2 border-[color:var(--text-heading)] bg-transparent`;
export const statusDotReview = `${statusMarkerBase} rotate-45 rounded-sm bg-[color:var(--warning)]`;
export const statusDotMuted = `${statusMarkerBase} rounded-full bg-[color:var(--decoration-soft)]`;
export type StatusDotTone = "ready" | "review" | "muted";
const STATUS_DOT_CLASS = {
  ready: statusDotReady,
  review: statusDotReview,
  muted: statusDotMuted,
} as const;

export function StatusDotMarker({
  tone,
  label,
  labelClassName,
}: {
  tone: StatusDotTone;
  label: string;
  labelClassName?: string;
}) {
  return (
    <>
      <span className={STATUS_DOT_CLASS[tone]} aria-hidden="true" />
      <span className={labelClassName}>{label}</span>
    </>
  );
}

export const toneSuccess =
  "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
export const toneDanger =
  "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
export const toneInfo = "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
export const toneWarning =
  "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
const toneWarningQuiet =
  "border-[color:var(--warning-border)]/60 bg-[color:var(--warning-soft)]/45 text-[color:var(--warning)]";
export const toneNeutral =
  "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";

export const searchPageCanvas = "bg-[color:var(--background)] text-[color:var(--text)]";
// Phone bottom-dock clearance lives on #main-content / dashboard <main> via
// --mobile-composer-reserve so it can collapse when the dock hides. Do not bake
// a second dock-sized safe-area pad into page shells.
export const searchPageShell =
  "min-h-0 overflow-x-clip px-3 py-3 pb-4 sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-5 sm:py-5 sm:pb-8 lg:px-6";
// Standalone pages outside the search shell own the OS top inset themselves
// (apple-mobile-web-app-status-bar-style=black-translucent). Bake max(safe-area)
// into the top pad and omit py-* so cn() call sites never rely on Tailwind's
// side-vs-axis utility sort order to win over searchPageShell's py-3/sm:py-5.
export const searchPageShellStandalone =
  "min-h-0 overflow-x-clip px-3 pt-[max(0.75rem,var(--safe-area-top))] pb-4 sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-5 sm:pt-[max(1.25rem,var(--safe-area-top))] sm:pb-8 lg:px-6";
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

export type AsyncButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  busy: boolean;
  busyLabel: string;
  children: ReactNode;
  idleIcon?: ReactNode;
};

/**
 * Shared busy-state contract for async actions. Prefer `Button` with
 * `busy`/`busyLabel` for new call sites — this helper remains for existing
 * forms that pass a ReactNode idle icon. `type` is applied AFTER the spread so
 * a missing type cannot open a surrounding form, while an explicit
 * `type="submit"` still wins.
 */
export function AsyncButton({ busy, busyLabel, children, disabled, idleIcon, type, ...props }: AsyncButtonProps) {
  return (
    <button {...props} type={type ?? "button"} disabled={busy || disabled} aria-busy={busy || undefined}>
      {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : idleIcon}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
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
 * `aria-hidden` icon glyph, a `--spacing-tap` hit area, and the shared focus ring. Pass a
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
        "grid size-tap shrink-0 place-items-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        controlDisabled,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("size-icon-md", iconClassName)} />
    </button>
  );
}

export type NoticeTone = "success" | "warning" | "danger" | "info" | "neutral";

export type InlineNoticeProps = {
  tone: NoticeTone;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  animated?: boolean;
  className?: string;
};

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
}: InlineNoticeProps) {
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

type ToggleSwitchBase = {
  enabled: boolean;
  className?: string;
  disabled?: boolean;
};

export type ToggleSwitchProps = ToggleSwitchBase &
  (
    | {
        /** Operable switch — requires an accessible name. */
        onToggle: () => void;
        "aria-label": string;
      }
    | {
        /** Read-only presentational indicator (no interactive role). */
        onToggle?: undefined;
        "aria-label"?: string;
      }
  );

export function ToggleSwitch({
  enabled,
  className,
  onToggle,
  disabled = false,
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  const track = cn(
    "relative inline-flex h-6 w-10 shrink-0 rounded-full transition",
    enabled ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
    className,
  );
  const knob = (
    <span
      aria-hidden
      className={cn(
        // Gate 9: the knob travels on `transform`, never on `left`/`right`. Track is w-10
        // (40px) with a 16px knob inset 4px each side, so the throw is 40-4-4-16 = 16px.
        "absolute top-1 left-1 h-4 w-4 rounded-full bg-[color:var(--surface)] shadow-sm",
        "transition-transform duration-[var(--duration-base)] motion-reduce:transition-none",
        enabled ? "translate-x-4" : "translate-x-0",
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
          "inline-grid min-h-tap min-w-tap shrink-0 place-items-center rounded-full",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          controlDisabled,
        )}
      >
        <span className={track}>{knob}</span>
      </button>
    );
  }

  // Read-only: expose the state as an image label so assistive tech announces
  // on/off without implying the control can be operated. Unlabeled indicators
  // are decorative — hide them from the accessibility tree.
  return (
    <span
      role={ariaLabel ? "img" : undefined}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel ? `${ariaLabel}: ${enabled ? "on" : "off"}` : undefined}
      className={track}
    >
      {knob}
    </span>
  );
}

type IconComponent = LucideIcon;

export type SourceDesignationBadgeProps = {
  metadata?: SourceMetadataInput;
  className?: string;
};

export function SourceDesignationBadge({ metadata, className }: SourceDesignationBadgeProps) {
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

export type SourceStatusBadgeProps = {
  metadata?: SourceMetadataInput;
  className?: string;
  showTitle?: boolean;
};

export function SourceStatusBadge({ metadata, className, showTitle = true }: SourceStatusBadgeProps) {
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

export type SourceProvenanceProps = { metadata?: SourceMetadataInput };

export function SourceProvenance({ metadata }: SourceProvenanceProps) {
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

export type PanelHeadingProps = {
  icon?: IconComponent;
  title: string;
  description?: string;
};

export function PanelHeading({ icon: Icon, title, description }: PanelHeadingProps) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className={iconTile}>
          <Icon aria-hidden="true" className="size-icon-md sm:size-icon-lg" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h2>
        {description && <p className={cn("mt-1 text-sm leading-6", textMuted)}>{description}</p>}
      </div>
    </div>
  );
}

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & { animationDelay?: string };

export function Skeleton({ className, animationDelay, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-[color:var(--surface-subtle)] bg-no-repeat",
        "bg-[length:200%_100%] bg-[linear-gradient(100deg,transparent_30%,color-mix(in_srgb,var(--surface-highlight)_72%,transparent)_50%,transparent_70%)]",
        "motion-safe:animate-shimmer",
        className,
      )}
      style={animationDelay ? { animationDelay } : undefined}
      {...props}
    />
  );
}

export type LoadingPanelProps = {
  label: string;
  variant?: "spinner" | "skeleton";
  lines?: number;
  layout?: "panel" | "centered";
};

export function LoadingPanel({ label, variant = "spinner", lines = 3, layout = "panel" }: LoadingPanelProps) {
  if (variant === "skeleton") {
    return (
      <div className={`${insetCard} mt-3 space-y-2.5 p-4`} role="status" aria-label={label}>
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} aria-hidden className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        layout === "centered"
          ? "flex min-h-[280px] flex-col items-center justify-center gap-3 text-center text-sm font-medium text-[color:var(--text-muted)]"
          : `${insetCard} mt-3 grid min-h-28 place-items-center p-4 text-center text-sm font-semibold text-[color:var(--text-muted)]`,
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn(layout === "centered" && "flex flex-col items-center gap-3")}>
        <Loader2
          aria-hidden="true"
          className={cn(
            "animate-spin text-[color:var(--clinical-accent)] motion-reduce:animate-none",
            layout === "centered" ? "h-[34px] w-[34px]" : "mx-auto mb-2 h-4 w-4",
          )}
        />
        {label}
      </div>
    </div>
  );
}

export type EmptyStateProps = {
  icon?: IconComponent;
  iconNode?: ReactNode;
  title: string;
  /**
   * Render the title as a heading at this level instead of a paragraph.
   *
   * Deliberately opt-in and deliberately un-defaulted. Most adopted call sites
   * sit inside a card that already owns the heading for that region, so
   * promoting every title would insert a level into the document outline that
   * the surrounding page never declared. The states that DO own their region —
   * the main document-search empty state, `/dsm/search` — pass the level the
   * surrounding outline requires, and their heading is pinned by a test.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Supporting copy. `PanelHeading` calls the same slot `description`. */
  body?: string;
  /**
   * Deprecated alias for `body`, accepted because `PanelHeading` names this slot
   * `description` and passing `description` here used to render nothing at all —
   * silently, with no type error, because `body` was the only recognised name.
   * Prefer `body`; this alias exists so the mistake is impossible rather than
   * invisible, and will be removed once call sites converge.
   */
  description?: string;
  /** Optional controls stay within the shared state surface rather than becoming a second panel. */
  actions?: ReactNode;
  /** Announce a state transition only when the state is introduced dynamically. */
  live?: "off" | "polite" | "assertive";
  tone?: "neutral" | "info" | "danger";
  testId?: string;
  /** Centred presentation for full-panel no-result states; semantics stay identical. */
  align?: "start" | "center";
  /** Clinical-centred states retain a neutral panel with an accent icon and compact action offset. */
  centeredTreatment?: "neutral" | "clinical";
};

export function EmptyState({
  icon: Icon,
  title,
  headingLevel,
  body,
  description,
  actions,
  live = "off",
  tone = "neutral",
  testId,
  align = "start",
  iconNode,
  centeredTreatment = "neutral",
}: EmptyStateProps) {
  const Title = headingLevel ? (`h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6") : "p";
  return (
    <div
      data-testid={testId}
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn(
        align === "center"
          ? "flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] px-6 py-12 text-center"
          : "rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm shadow-[var(--shadow-inset)] sm:p-5",
        tone === "info" && "border-[color:var(--info-border)] bg-[color:var(--info-soft)]",
        tone === "danger" && "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]",
      )}
    >
      <div className={cn(align === "center" ? "contents" : "flex items-start gap-3")}>
        {(Icon || iconNode) && (
          <span
            className={cn(
              "shrink-0",
              align === "center" ? "mb-0.5 h-13 w-13 rounded-xl" : "h-10 w-10 rounded-lg",
              align === "center" && centeredTreatment === "clinical"
                ? "inline-flex items-center justify-center bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : cn(
                    "grid place-items-center",
                    "bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                    tone === "info" && "bg-[color:var(--info-soft)] text-[color:var(--info)]",
                    tone === "danger" && "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
                  ),
            )}
          >
            {Icon ? (
              <Icon
                aria-hidden="true"
                className={align === "center" ? "h-[26px] w-[26px]" : "size-icon-md sm:size-icon-lg"}
              />
            ) : (
              iconNode
            )}
          </span>
        )}
        <div className={cn("min-w-0", align === "center" && "contents")}>
          <Title
            className={cn(
              "font-semibold text-[color:var(--text)]",
              align === "center" && "text-lg-minus font-bold text-[color:var(--text-heading)]",
            )}
          >
            {title}
          </Title>
          {(body ?? description) ? (
            <p
              className={cn(
                "mt-1 leading-6",
                textMuted,
                align === "center" && "m-0 max-w-[44ch] text-sm-minus leading-normal",
              )}
            >
              {body ?? description}
            </p>
          ) : null}
          {actions ? (
            <div
              className={cn(
                align === "center" && centeredTreatment === "clinical" ? "mt-2" : "mt-3 flex flex-wrap gap-2",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
