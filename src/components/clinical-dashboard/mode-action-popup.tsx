"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  TriangleAlert,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  GitCompareArrows,
  Heart,
  ListChecks,
  Lock,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Tags,
  UploadCloud,
  Waypoints,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { Sheet } from "@/components/ui/sheet";
import { cn, chatComposerIconButton, toolbarButton } from "@/components/ui-primitives";

export type ModeActionSetId =
  | "answer"
  | "documents"
  | "services"
  | "forms"
  | "favourites"
  | "tools"
  | "differentials"
  | "specifiers"
  | "prescribing";
export type ModeActionPlacement = "up" | "down";

type IntegratedSurfaceLayout = {
  placement: ModeActionPlacement;
  left: number;
  width: number;
  caretLeft: number;
  top?: number;
  bottom?: number;
};

// The menu is a single-column vertical list; heights estimate one row per item so
// the anchored popover can pick an up/down placement and a scroll cap that fit.
function estimateActionListHeights(itemCount: number, integrated: boolean) {
  const rowHeight = 60;
  const rowGap = 6;
  const bodyPadding = integrated ? 24 : 20;
  const minBodyHeight = itemCount * rowHeight + Math.max(0, itemCount - 1) * rowGap + bodyPadding;
  const headerHeight = 76;
  return { minBodyHeight, minSurfaceHeight: minBodyHeight + headerHeight, headerHeight };
}

export type ModeActionModeOption = {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export type ModeActionId =
  | "answer-quotes"
  | "answer-evidence-map"
  | "answer-new"
  | "documents-search"
  | "documents-upload"
  | "documents-scope"
  | "documents-recent"
  | "documents-tables"
  | "documents-status"
  | "documents-collections"
  | "documents-viewer"
  | "services-search"
  | "services-pathways"
  | "services-records"
  | "services-documents"
  | "forms-records"
  | "forms-documents"
  | "favourites-browse"
  | "favourites-sets"
  | "medication-dose"
  | "medication-safety"
  | "medication-monitoring"
  | "medication-escalation"
  | "medication-access"
  | "tools-browse"
  | "tools-new"
  | "differentials-build"
  | "differentials-criteria"
  | "differentials-documents"
  | "differentials-evidence"
  | "specifiers-search"
  | "specifiers-builder"
  | "specifiers-compare"
  | "specifiers-map";

export type ModeActionItem = {
  id: ModeActionId;
  label: string;
  shortLabel?: string;
  description?: string;
  icon: LucideIcon;
  primary?: boolean;
};

// One curated, primary-first action list per mode. Keep the accessible name of each
// item (its `label`) test-stable: Answer must expose "Scope"; Documents "Upload PDF".
const modeActionSets = {
  answer: [
    {
      id: "answer-new",
      label: "New question",
      description: "Clear the current thread",
      icon: MessageSquarePlus,
      primary: true,
    },
    { id: "documents-upload", label: "Add document", description: "Upload a source to the library", icon: UploadCloud },
    { id: "documents-scope", label: "Scope", description: "Limit answers to chosen sources", icon: Filter },
    {
      id: "answer-evidence-map",
      label: "View evidence",
      description: "Trace quotes and source support",
      icon: ListChecks,
    },
    { id: "documents-search", label: "Search library", description: "Find indexed sources", icon: Search },
    { id: "tools-browse", label: "Clinical tools", description: "Open clinical tools", icon: Wrench },
  ],
  documents: [
    {
      id: "documents-upload",
      label: "Upload PDF",
      description: "Add a source to the library",
      icon: UploadCloud,
      primary: true,
    },
    { id: "documents-scope", label: "Scope sources", description: "Limit answers to selected sources", icon: Filter },
    { id: "documents-recent", label: "Recent documents", description: "Browse recently updated", icon: Clock3 },
    { id: "documents-collections", label: "Collections", description: "Open document folders", icon: FolderOpen },
    { id: "documents-tables", label: "Tables", description: "Search table evidence", icon: Table2 },
    { id: "documents-viewer", label: "Open source PDF", description: "View a source document", icon: FileText },
  ],
  services: [
    {
      id: "services-records",
      label: "Browse directory",
      description: "Verified service records",
      icon: ShieldCheck,
      primary: true,
    },
    { id: "services-pathways", label: "Referral pathways", description: "Find referral pathways", icon: ListChecks },
    { id: "services-documents", label: "Find in documents", description: "Search supporting guidance", icon: FileText },
  ],
  forms: [
    {
      id: "forms-records",
      label: "Browse form library",
      description: "Open clinical forms",
      icon: FolderOpen,
      primary: true,
    },
    { id: "forms-documents", label: "Find in documents", description: "Search supporting guidance", icon: FileText },
  ],
  favourites: [
    {
      id: "favourites-browse",
      label: "Browse favourites",
      description: "Open saved clinical items",
      icon: Heart,
      primary: true,
    },
    { id: "favourites-sets", label: "Saved sets", description: "Review grouped favourites", icon: FolderOpen },
  ],
  tools: [
    {
      id: "tools-browse",
      label: "Browse tools",
      description: "Open the applications registry",
      icon: Wrench,
      primary: true,
    },
    { id: "tools-new", label: "New answer", description: "Clear the current thread", icon: Sparkles },
  ],
  differentials: [
    {
      id: "differentials-build",
      label: "Build differential",
      description: "Start a structured differential",
      icon: GitBranch,
      primary: true,
    },
    {
      id: "differentials-criteria",
      label: "Compare criteria",
      description: "Review distinguishing features",
      icon: ListChecks,
    },
    {
      id: "differentials-documents",
      label: "Supporting documents",
      description: "Search supporting documents",
      icon: FileText,
    },
    { id: "differentials-evidence", label: "View evidence", description: "Review cited support", icon: ShieldCheck },
  ],
  specifiers: [
    {
      id: "specifiers-search",
      label: "Find a specifier",
      description: "Match presentation features",
      icon: Tags,
      primary: true,
    },
    {
      id: "specifiers-builder",
      label: "Build wording",
      description: "Assemble diagnostic wording",
      icon: ListChecks,
    },
    {
      id: "specifiers-compare",
      label: "Compare specifiers",
      description: "Clarify close clinical calls",
      icon: GitCompareArrows,
    },
    { id: "specifiers-map", label: "Specifier map", description: "Browse by diagnostic role", icon: Waypoints },
  ],
  prescribing: [
    {
      id: "medication-dose",
      label: "Dose & thresholds",
      description: "Check dosing and thresholds",
      icon: CalendarDays,
      primary: true,
    },
    {
      id: "medication-safety",
      label: "Contraindications",
      description: "Cautions and interactions",
      icon: ShieldCheck,
    },
    { id: "medication-monitoring", label: "Monitoring", description: "Baseline and ongoing checks", icon: Activity },
    {
      id: "medication-escalation",
      label: "Escalation criteria",
      description: "Red flags and urgent review",
      icon: TriangleAlert,
    },
    { id: "medication-access", label: "Documentation", description: "Required forms and eligibility", icon: Lock },
  ],
} as const satisfies Record<ModeActionSetId, readonly ModeActionItem[]>;

export function modeActionItemsFor(setId: ModeActionSetId): readonly ModeActionItem[] {
  return modeActionSets[setId];
}

function assignTriggerRef(ref: Ref<HTMLButtonElement> | undefined, element: HTMLButtonElement | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(element);
    return;
  }
  ref.current = element;
}

export function ModeActionPopup({
  open,
  title,
  titleIcon: TitleIcon,
  subtitle,
  buttonLabel,
  items,
  modeOptions,
  selectedModeId,
  onOpenChange,
  onBeforeOpen,
  onAction,
  onModeSelect,
  onPlacementChange,
  triggerClassName,
  integrated = false,
  integratedChipRow = true,
  useSheet = false,
  triggerRef,
  dismissIgnoreRefs,
}: {
  open: boolean;
  title: string;
  titleIcon: LucideIcon;
  subtitle?: string;
  buttonLabel: string;
  items: readonly ModeActionItem[];
  modeOptions?: readonly ModeActionModeOption[];
  selectedModeId?: string;
  onOpenChange: (open: boolean) => void;
  onBeforeOpen?: () => void;
  onAction: (actionId: ModeActionId) => void;
  onModeSelect?: (modeId: string) => void;
  onPlacementChange?: (placement: ModeActionPlacement) => void;
  triggerClassName?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  integrated?: boolean;
  /** When false, the integrated menu skips the footer chip-row clearance offset. */
  integratedChipRow?: boolean;
  /** Render the actions in a bottom sheet / centred dialog (phones + tablets ≤1023px)
   *  instead of the anchored desktop popover. */
  useSheet?: boolean;
  /** Header-owned controls (e.g. app mode trigger) that must stay clickable above the portaled menu. */
  dismissIgnoreRefs?: readonly RefObject<HTMLElement | null>[];
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const actionDescId = useId();
  const [placement, setPlacement] = useState<ModeActionPlacement>("up");
  const [surfaceMaxHeight, setSurfaceMaxHeight] = useState<number | null>(null);
  const [bodyMaxHeight, setBodyMaxHeight] = useState<number | null>(null);
  const [integratedSurfaceLayout, setIntegratedSurfaceLayout] = useState<IntegratedSurfaceLayout | null>(null);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const canSwitchMode = Boolean(modeOptions?.length && onModeSelect);
  const selectedModeOption = modeOptions?.find((mode) => mode.id === selectedModeId);

  const closeAndRestoreFocus = useCallback(() => {
    setModeSelectorOpen(false);
    onOpenChange(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, [onOpenChange, setModeSelectorOpen]);

  // The sheet owns its own focus trap, Escape, and backdrop dismissal; only the
  // anchored popover needs the outside-click dismissable layer.
  useDismissableLayer({
    enabled: open && !useSheet,
    refs: [rootRef, surfaceRef, ...(dismissIgnoreRefs ?? [])],
    restoreFocusRef: buttonRef,
    onDismiss: () => {
      setModeSelectorOpen(false);
      onOpenChange(false);
    },
  });

  function focusActionItem(index: number) {
    const nextIndex = (index + items.length) % items.length;
    itemRefs.current[nextIndex]?.focus();
  }

  const updatePlacement = useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = buttonRef.current ?? rootRef.current?.parentElement ?? rootRef.current;
    if (!anchor) return;

    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const rect = anchor.getBoundingClientRect();
    const edgePadding = 12;
    const availableAbove = Math.max(0, rect.top - viewportTop - edgePadding);
    const availableBelow = Math.max(0, viewportBottom - rect.bottom - edgePadding);
    const { minSurfaceHeight, headerHeight } = estimateActionListHeights(items.length, integrated);
    const detachedUpOffset = 16;
    const integratedDownOffset = integratedChipRow ? 58 : 14;
    const detachedDownOffset = integrated ? integratedDownOffset : 14;
    const spaceAbove = Math.max(0, availableAbove - detachedUpOffset);
    const spaceBelow = Math.max(0, availableBelow - detachedDownOffset);

    let nextPlacement: ModeActionPlacement;
    if (integrated) {
      const canFitAbove = spaceAbove >= minSurfaceHeight;
      const canFitBelow = spaceBelow >= minSurfaceHeight;
      if (canFitAbove && !canFitBelow) {
        nextPlacement = "up";
      } else if (canFitBelow && !canFitAbove) {
        nextPlacement = "down";
      } else {
        // In-flow hero composers sit above page content; opening upward avoids
        // clipping inside scroll containers and the dead space below centred homes.
        nextPlacement = spaceBelow > spaceAbove + 80 ? "down" : "up";
      }
    } else {
      nextPlacement = availableBelow > availableAbove + 40 ? "down" : "up";
    }

    // Cap an upward-opening menu so it stays clear of the sticky header + mode
    // switcher (which otherwise gets covered, blocking its pointer events) when the
    // trigger sits low enough that a full-height list would reach the top nav.
    const headerSafeInset = 84;
    const upwardHeightLimit = Math.max(0, rect.top - viewportTop - headerSafeInset);
    const available = nextPlacement === "up" ? Math.min(spaceAbove, upwardHeightLimit) : spaceBelow;
    const nextSurfaceMaxHeight = Math.max(220, Math.floor(Math.min(available, viewportHeight - edgePadding * 2)));
    const nextBodyMaxHeight = Math.max(156, nextSurfaceMaxHeight - headerHeight);

    setPlacement((current) => (current === nextPlacement ? current : nextPlacement));
    setSurfaceMaxHeight((current) => (current === nextSurfaceMaxHeight ? current : nextSurfaceMaxHeight));
    setBodyMaxHeight((current) => (current === nextBodyMaxHeight ? current : nextBodyMaxHeight));

    if (integrated) {
      const maxSurfaceWidth = Math.min(window.innerWidth - edgePadding * 2, 384);
      const surfaceLeft = Math.max(edgePadding, Math.min(rect.left, window.innerWidth - maxSurfaceWidth - edgePadding));
      setIntegratedSurfaceLayout({
        placement: nextPlacement,
        left: surfaceLeft,
        width: maxSurfaceWidth,
        // Keep the caret centred on the "+" trigger even when the surface is
        // clamped to the viewport edge and no longer starts at the trigger.
        caretLeft: Math.max(20, rect.left - surfaceLeft + rect.width / 2),
        ...(nextPlacement === "up"
          ? { bottom: window.innerHeight - rect.top + 14 }
          : { top: rect.bottom + integratedDownOffset }),
      });
    } else {
      setIntegratedSurfaceLayout(null);
    }
  }, [integrated, integratedChipRow, items.length]);

  function openWithFocus(index: number) {
    onBeforeOpen?.();
    setModeSelectorOpen(false);
    updatePlacement();
    onOpenChange(true);
    window.requestAnimationFrame(() => focusActionItem(index));
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    openWithFocus(event.key === "ArrowUp" ? items.length - 1 : 0);
  }

  function handleItemKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusActionItem(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusActionItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusActionItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusActionItem(items.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
    }
  }

  function runActionAndClose(actionId: ModeActionId) {
    setModeSelectorOpen(false);
    onOpenChange(false);
    onAction(actionId);
  }

  function focusModeOption(index: number) {
    if (!modeOptions?.length) return;
    const nextIndex = (index + modeOptions.length) % modeOptions.length;
    modeOptionRefs.current[nextIndex]?.focus();
  }

  const selectedModeIndex = Math.max(0, modeOptions?.findIndex((mode) => mode.id === selectedModeId) ?? 0);

  function openModeSelectorWithFocus(index: number) {
    if (!canSwitchMode) return;
    setModeSelectorOpen(true);
    window.requestAnimationFrame(() => focusModeOption(index));
  }

  function handleModeButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openModeSelectorWithFocus(selectedModeIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openModeSelectorWithFocus(selectedModeIndex - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setModeSelectorOpen(false);
    }
  }

  function handleModeOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModeOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusModeOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusModeOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      if (modeOptions?.length) focusModeOption(modeOptions.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setModeSelectorOpen(false);
      window.requestAnimationFrame(() => modeButtonRef.current?.focus());
    }
  }

  function selectMode(mode: ModeActionModeOption) {
    if (mode.disabled) return;
    onModeSelect?.(mode.id);
    setModeSelectorOpen(false);
    window.requestAnimationFrame(() => modeButtonRef.current?.focus());
  }

  const headerSubtitle =
    subtitle ||
    (title.toLowerCase() === "answer"
      ? "Source-backed mode"
      : selectedModeOption?.description ||
        items.find((item) => item.primary)?.description ||
        items[0]?.description ||
        "Mode actions");

  function assignActionRef(element: HTMLButtonElement | null, index: number) {
    itemRefs.current[index] = element;
  }

  useLayoutEffect(() => {
    if (!open || useSheet) return;
    updatePlacement();
  }, [items.length, open, title, updatePlacement, useSheet]);

  useEffect(() => {
    if (open) return;
    queueMicrotask(() => setIntegratedSurfaceLayout(null));
  }, [open]);

  useEffect(() => {
    if (!open || useSheet) return;
    onPlacementChange?.(placement);
  }, [onPlacementChange, open, placement, useSheet]);

  useEffect(() => {
    if (!open || useSheet) return;

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    window.visualViewport?.addEventListener("resize", updatePlacement);
    window.visualViewport?.addEventListener("scroll", updatePlacement);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
      window.visualViewport?.removeEventListener("resize", updatePlacement);
      window.visualViewport?.removeEventListener("scroll", updatePlacement);
    };
  }, [open, updatePlacement, useSheet]);

  const surfaceStyle = {
    "--mode-action-max-height": surfaceMaxHeight ? `${surfaceMaxHeight}px` : undefined,
    "--mode-action-body-max-height": bodyMaxHeight ? `${bodyMaxHeight}px` : undefined,
    ...(integrated && integratedSurfaceLayout
      ? {
          left: `${integratedSurfaceLayout.left}px`,
          width: `${integratedSurfaceLayout.width}px`,
          "--mode-action-caret-left": `${integratedSurfaceLayout.caretLeft}px`,
          ...(integratedSurfaceLayout.top !== undefined ? { top: `${integratedSurfaceLayout.top}px` } : {}),
          ...(integratedSurfaceLayout.bottom !== undefined ? { bottom: `${integratedSurfaceLayout.bottom}px` } : {}),
        }
      : {}),
  } as CSSProperties;

  const integratedDownOffsetClass = integratedChipRow ? "top-[calc(100%+3.65rem)]" : "top-[calc(100%+0.875rem)]";

  // Shared, presentation-agnostic action list — the same rows render inside the
  // desktop popover and the phone/tablet sheet. Each row's accessible name is its
  // `label`; the secondary description is exposed via aria-describedby (kept out of
  // the name so exact-match tests like "Scope"/"Upload PDF" hold).
  function renderActionRows() {
    return (
      <div
        id="daily-actions-sheet"
        data-testid="daily-actions-menu"
        role="menu"
        aria-label={title}
        className={cn("polished-scroll", useSheet ? "" : cn("mode-action-body p-2.5", integrated && "p-3 sm:p-3.5"))}
      >
        <div className="grid gap-1.5">
          {items.map((item, index) => {
            const Icon = item.icon;
            const descriptionId = item.description ? `${actionDescId}-${index}` : undefined;
            return (
              <button
                key={item.id}
                ref={(element) => assignActionRef(element, index)}
                type="button"
                role="menuitem"
                aria-describedby={descriptionId}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
                onClick={() => runActionAndClose(item.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border px-3 text-left transition motion-safe:duration-150",
                  useSheet ? "min-h-14 py-2" : "min-h-12 py-1.5",
                  item.primary
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/45 hover:bg-[color:var(--clinical-accent-soft)]/60"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--clinical-accent)]/40 hover:bg-[color:var(--clinical-accent-soft)]/24",
                  "active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition",
                    item.primary
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span
                      id={descriptionId}
                      aria-hidden="true"
                      className="mt-0.5 block truncate text-xs font-medium text-[color:var(--text-soft)]"
                    >
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-hover:text-[color:var(--clinical-accent)]"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // In-place mode picker: while the header's mode switcher is open, the popover
  // body swaps the action rows for this list (same scroll area, so it can never
  // be clipped by the panel the way a layered dropdown was). Escape or a second
  // press of the title returns to the actions.
  function renderModeList() {
    if (!modeOptions?.length) return null;
    return (
      <div
        id="mode-action-mode-menu"
        role="menu"
        aria-label="Choose search mode"
        className="mode-action-body polished-scroll p-2.5"
      >
        <div className="grid gap-1.5">
          {modeOptions.map((mode, index) => {
            const Icon = mode.icon;
            const active = mode.id === selectedModeId;
            return (
              <button
                key={mode.id}
                ref={(element) => {
                  modeOptionRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={mode.disabled}
                onKeyDown={(event) => handleModeOptionKeyDown(event, index)}
                onClick={() => selectMode(mode)}
                className={cn("mode-action-mode-option", active && "mode-action-mode-option-active")}
              >
                <span className="mode-action-mode-option-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{mode.label}</span>
                  {mode.description ? (
                    <span className="block truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                      {mode.description}
                    </span>
                  ) : null}
                </span>
                {active ? (
                  <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Statement form (not a JSX ternary): react-hooks/refs treats helpers invoked
  // conditionally inside JSX as possible non-render callbacks and then flags the
  // ref writes/handlers inside both list renderers.
  function renderPopoverBody() {
    if (modeSelectorOpen && modeOptions?.length) return renderModeList();
    return renderActionRows();
  }

  // Desktop popover header — same anatomy as the Sheet header the ≤1023px surface
  // uses (accent icon tile + stacked title/subtitle + close), so the menu reads as
  // one design across breakpoints. The title doubles as the mode switcher; the
  // subtitle sits on its own full-width line so it can never be crushed.
  function renderPopoverHeader() {
    return (
      <div className="relative z-[1] flex items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 py-3.5">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
        >
          <TitleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            ref={modeButtonRef}
            disabled={!canSwitchMode}
            aria-haspopup={canSwitchMode ? "menu" : undefined}
            aria-expanded={canSwitchMode ? modeSelectorOpen : undefined}
            aria-controls={modeSelectorOpen ? "mode-action-mode-menu" : undefined}
            onKeyDown={handleModeButtonKeyDown}
            onClick={() => canSwitchMode && setModeSelectorOpen((current) => !current)}
            className={cn(
              "-mx-1.5 flex max-w-full items-center gap-1 rounded-lg px-1.5 py-0.5 text-left transition",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              canSwitchMode ? "hover:bg-[color:var(--surface-subtle)]" : "cursor-default",
            )}
          >
            <span className="min-w-0 truncate text-base font-semibold text-[color:var(--text-heading)]">{title}</span>
            {canSwitchMode ? (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition",
                  modeSelectorOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            ) : null}
          </button>
          <p className="truncate text-sm leading-5 text-[color:var(--text-muted)]">
            {modeSelectorOpen ? "Choose search mode" : headerSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={closeAndRestoreFocus}
          className={toolbarButton}
          aria-label={`Close ${title.toLowerCase()} options`}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const actionSurface =
    open && !useSheet ? (
      <div
        ref={surfaceRef}
        data-placement={placement}
        style={surfaceStyle}
        className={cn(
          "mode-action-surface z-50 text-[color:var(--text)]",
          integrated && integratedSurfaceLayout ? "fixed" : "absolute",
          integrated && integratedSurfaceLayout
            ? null
            : integrated
              ? "inset-x-0"
              : "inset-x-0 sm:inset-x-auto sm:left-0",
          !integrated || !integratedSurfaceLayout
            ? placement === "up"
              ? "bottom-[calc(100%+0.875rem)]"
              : integrated
                ? integratedDownOffsetClass
                : "top-[calc(100%+0.875rem)]"
            : null,
          !integrated && "sm:w-[min(24rem,100%)]",
        )}
      >
        <div
          className={cn(
            "mode-action-panel overflow-hidden border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[0_18px_42px_rgb(15_37_48_/_16%)] ring-1 ring-white/45 dark:ring-white/10",
            integrated ? "rounded-[1.35rem] shadow-[0_20px_48px_rgb(15_37_48_/_18%)]" : "rounded-[1rem]",
          )}
        >
          {renderPopoverHeader()}
          {renderPopoverBody()}
        </div>
      </div>
    ) : null;

  return (
    <>
      {useSheet && open ? (
        <Sheet
          open={open}
          onClose={closeAndRestoreFocus}
          title={title}
          description={headerSubtitle}
          closeLabel={`Close ${title.toLowerCase()} options`}
          returnFocusRef={buttonRef}
          headerLeading={
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
              <TitleIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          }
          mobilePlacement="bottom"
          mobileSize="content"
          portal
        >
          {renderActionRows()}
        </Sheet>
      ) : integrated && open && typeof document !== "undefined" ? (
        createPortal(actionSurface, document.body)
      ) : (
        actionSurface
      )}

      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          ref={(element) => {
            buttonRef.current = element;
            assignTriggerRef(triggerRef, element);
          }}
          className={cn(
            chatComposerIconButton,
            triggerClassName,
            open && "bg-[color:var(--surface-subtle)] text-[color:var(--text)] motion-safe:rotate-45",
          )}
          aria-label={buttonLabel}
          aria-controls={open ? "daily-actions-sheet" : undefined}
          aria-expanded={open}
          aria-haspopup="menu"
          title={buttonLabel}
          onKeyDown={handleTriggerKeyDown}
          onClick={() => {
            if (!open) {
              onBeforeOpen?.();
              setModeSelectorOpen(false);
              updatePlacement();
            } else {
              setModeSelectorOpen(false);
            }
            onOpenChange(!open);
          }}
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}
