"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  Heart,
  ListChecks,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  UploadCloud,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { cn, chatComposerIconButton } from "@/components/ui-primitives";

export type ModeActionSetId = "answer" | "documents" | "services" | "favourites" | "tools" | "differentials";
export type ModeActionPlacement = "up" | "down";

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
  | "favourites-browse"
  | "favourites-sets"
  | "medication-dose"
  | "medication-safety"
  | "medication-monitoring"
  | "medication-access"
  | "tools-browse"
  | "tools-new"
  | "differentials-build"
  | "differentials-criteria"
  | "differentials-documents"
  | "differentials-evidence";

export type ModeActionItem = {
  id: ModeActionId;
  label: string;
  shortLabel?: string;
  description?: string;
  icon: LucideIcon;
  primary?: boolean;
};

const modeActionSets = {
  answer: [
    {
      id: "documents-upload",
      label: "Add document",
      description: "Upload a source",
      icon: FileText,
    },
    {
      id: "documents-search",
      label: "Search library",
      shortLabel: "Search",
      description: "Find indexed sources",
      icon: Search,
    },
    {
      id: "documents-scope",
      label: "Scope sources",
      shortLabel: "Scope",
      description: "Limit source scope",
      icon: Filter,
    },
    { id: "documents-tables", label: "Tables", description: "Search table evidence", icon: Table2 },
    { id: "documents-viewer", label: "PDFs", description: "Open source PDFs", icon: FileText },
    { id: "answer-quotes", label: "Quotes", description: "Review cited passages", icon: Quote },
    {
      id: "answer-evidence-map",
      label: "Evidence map",
      shortLabel: "Evidence map",
      description: "Trace source support",
      icon: ListChecks,
    },
    {
      id: "tools-browse",
      label: "Clinical tools",
      shortLabel: "Tools",
      description: "Open clinical tools",
      icon: Wrench,
    },
  ],
  documents: [
    {
      id: "documents-search",
      label: "Search documents",
      shortLabel: "Search",
      description: "Find indexed clinical sources",
      icon: Search,
      primary: true,
    },
    {
      id: "documents-upload",
      label: "Upload PDF",
      shortLabel: "Upload",
      description: "Add a source to the library",
      icon: UploadCloud,
    },
    {
      id: "documents-scope",
      label: "Set scope",
      shortLabel: "Scope",
      description: "Limit answers to selected sources",
      icon: Filter,
    },
    { id: "documents-recent", label: "Recent documents", shortLabel: "Recent", icon: Clock3 },
    { id: "documents-tables", label: "Tables", icon: Table2 },
    { id: "documents-status", label: "Status", icon: BadgeCheck },
    { id: "documents-collections", label: "Collections", shortLabel: "Folders", icon: FolderOpen },
    { id: "documents-viewer", label: "Open source", shortLabel: "Open", icon: ExternalLink },
  ],
  services: [
    {
      id: "services-search",
      label: "Search services",
      shortLabel: "Search",
      description: "Find service records",
      icon: Search,
      primary: true,
    },
    {
      id: "services-pathways",
      label: "Pathways",
      description: "Find referral pathways",
      icon: ListChecks,
    },
    {
      id: "services-records",
      label: "Records",
      description: "Browse verified services",
      icon: FileText,
    },
  ],
  favourites: [
    {
      id: "favourites-browse",
      label: "Browse favourites",
      shortLabel: "Browse",
      description: "Open saved clinical items",
      icon: Heart,
      primary: true,
    },
    {
      id: "favourites-sets",
      label: "Saved sets",
      shortLabel: "Sets",
      description: "Review grouped favourites",
      icon: FolderOpen,
    },
  ],
  tools: [
    {
      id: "tools-browse",
      label: "Browse tools",
      shortLabel: "Browse",
      description: "Open the applications registry",
      icon: Wrench,
      primary: true,
    },
    {
      id: "tools-new",
      label: "New answer",
      shortLabel: "New",
      description: "Clear the current thread",
      icon: Sparkles,
    },
  ],
  differentials: [
    {
      id: "differentials-build",
      label: "Build differential",
      shortLabel: "Build",
      description: "Start a structured differential",
      icon: GitBranch,
      primary: true,
    },
    {
      id: "differentials-criteria",
      label: "Compare criteria",
      shortLabel: "Criteria",
      description: "Review distinguishing features",
      icon: ListChecks,
    },
    {
      id: "differentials-documents",
      label: "Source documents",
      shortLabel: "Sources",
      description: "Search supporting documents",
      icon: FileText,
    },
    {
      id: "differentials-evidence",
      label: "Evidence",
      description: "Review cited support",
      icon: ShieldCheck,
    },
  ],
} as const satisfies Record<ModeActionSetId, readonly ModeActionItem[]>;

export function modeActionItemsFor(setId: ModeActionSetId): readonly ModeActionItem[] {
  return modeActionSets[setId];
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
  integrated?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [placement, setPlacement] = useState<ModeActionPlacement>("up");
  const [surfaceMaxHeight, setSurfaceMaxHeight] = useState<number | null>(null);
  const [bodyMaxHeight, setBodyMaxHeight] = useState<number | null>(null);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const canSwitchMode = Boolean(modeOptions?.length && onModeSelect);
  const selectedModeOption = modeOptions?.find((mode) => mode.id === selectedModeId);

  const closeAndRestoreFocus = useCallback(() => {
    setModeSelectorOpen(false);
    onOpenChange(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, [onOpenChange, setModeSelectorOpen]);

  useDismissableLayer({
    enabled: open,
    refs: [rootRef, surfaceRef],
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
    const anchor = surfaceRef.current?.parentElement ?? rootRef.current?.parentElement ?? rootRef.current;
    if (!anchor) return;

    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const rect = anchor.getBoundingClientRect();
    const edgePadding = 12;
    const availableAbove = Math.max(0, rect.top - viewportTop - edgePadding);
    const availableBelow = Math.max(0, viewportBottom - rect.bottom - edgePadding);
    const nextPlacement: ModeActionPlacement = availableBelow > availableAbove + 40 ? "down" : "up";
    const available = nextPlacement === "up" ? availableAbove : availableBelow;
    const nextSurfaceMaxHeight = Math.max(220, Math.floor(Math.min(available, viewportHeight - edgePadding * 2)));
    const nextBodyMaxHeight = Math.max(156, nextSurfaceMaxHeight - 92);

    setPlacement((current) => (current === nextPlacement ? current : nextPlacement));
    setSurfaceMaxHeight((current) => (current === nextSurfaceMaxHeight ? current : nextSurfaceMaxHeight));
    setBodyMaxHeight((current) => (current === nextBodyMaxHeight ? current : nextBodyMaxHeight));
  }, []);

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

  const actionGridClass =
    items.length >= 6
      ? "grid-cols-2 min-[560px]:grid-cols-4"
      : items.length >= 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";
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
    if (!open) return;
    updatePlacement();
  }, [items.length, open, title, updatePlacement]);

  useEffect(() => {
    if (!open) return;
    onPlacementChange?.(placement);
  }, [onPlacementChange, open, placement]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, updatePlacement]);

  const surfaceStyle = {
    "--mode-action-max-height": surfaceMaxHeight ? `${surfaceMaxHeight}px` : undefined,
    "--mode-action-body-max-height": bodyMaxHeight ? `${bodyMaxHeight}px` : undefined,
  } as CSSProperties;

  return (
    <>
      {open ? (
        <div
          ref={surfaceRef}
          data-placement={placement}
          style={surfaceStyle}
          className={cn(
            "mode-action-surface absolute z-50 text-[color:var(--text)]",
            integrated ? "inset-x-0" : "inset-x-0 sm:inset-x-auto sm:left-0",
            placement === "up" ? "bottom-[calc(100%-1px)]" : "top-[calc(100%-1px)]",
            !integrated && (items.length <= 4 ? "sm:w-[min(22rem,100%)]" : "sm:w-[min(24rem,100%)]"),
          )}
        >
          <div
            className={cn(
              "mode-action-panel overflow-hidden border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[0_18px_42px_rgb(15_37_48_/_16%)] ring-1 ring-white/45 dark:ring-white/10",
              integrated ? "rounded-[1.35rem] shadow-[0_20px_48px_rgb(15_37_48_/_18%)]" : "rounded-[1rem]",
            )}
          >
            <div className="mode-action-header border-b border-white/15">
              <div className="mode-action-selector-shell">
                <button
                  type="button"
                  ref={modeButtonRef}
                  disabled={!canSwitchMode}
                  aria-haspopup={canSwitchMode ? "menu" : undefined}
                  aria-expanded={canSwitchMode ? modeSelectorOpen : undefined}
                  aria-controls={modeSelectorOpen ? "mode-action-mode-menu" : undefined}
                  onKeyDown={handleModeButtonKeyDown}
                  onClick={() => canSwitchMode && setModeSelectorOpen((current) => !current)}
                  className="mode-action-mode-button"
                >
                  <span className="mode-action-mode-icon">
                    <TitleIcon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 truncate">{title}</span>
                  {canSwitchMode ? (
                    <ChevronDown
                      className={cn("h-4.5 w-4.5 shrink-0 transition", modeSelectorOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
                {modeSelectorOpen && modeOptions?.length ? (
                  <div
                    id="mode-action-mode-menu"
                    role="menu"
                    aria-label="Choose search mode"
                    className="mode-action-mode-menu polished-scroll"
                  >
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
                          {active ? <Check className="h-4 w-4 text-[color:var(--clinical-accent)]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="mode-action-header-summary">
                <span aria-hidden="true" className="mode-action-header-divider" />
                <span className="min-w-0 truncate">{headerSubtitle}</span>
              </div>
              <button
                type="button"
                onClick={closeAndRestoreFocus}
                className="mode-action-close"
                aria-label={`Close ${title.toLowerCase()} options`}
              >
                <BadgeCheck className="h-4.5 w-4.5" />
              </button>
            </div>
            <div
              id="daily-actions-sheet"
              data-testid="daily-actions-menu"
              role="menu"
              aria-label={title}
              className={cn("mode-action-body polished-scroll p-2.5", integrated && "p-3 sm:p-3.5")}
            >
              <div className={cn("grid gap-2", actionGridClass)}>
                {items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      ref={(element) => assignActionRef(element, index)}
                      type="button"
                      role="menuitem"
                      onKeyDown={(event) => handleItemKeyDown(event, index)}
                      onClick={() => runActionAndClose(item.id)}
                      className={cn(
                        "group grid min-h-[4.6rem] place-items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-2 text-center shadow-[var(--shadow-inset)] transition motion-safe:duration-150 sm:min-h-[4.85rem]",
                        "hover:border-[color:var(--clinical-accent)]/32 hover:bg-[color:var(--clinical-accent-soft)]/24 active:scale-[0.985]",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                      )}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)] transition group-hover:text-[color:var(--clinical-accent)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="max-w-full text-balance text-xs font-bold leading-4 text-[color:var(--text-heading)]">
                        {item.shortLabel ?? item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {!integrated ? (
            <>
              {placement === "up" ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-[6px] left-8 h-3 w-3 rotate-45 border-b border-r border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[4px_4px_10px_rgb(15_37_48_/_5%)]"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-[6px] left-8 h-3 w-3 rotate-45 border-l border-t border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[-4px_-4px_10px_rgb(15_37_48_/_5%)]"
                />
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          ref={buttonRef}
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
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}
