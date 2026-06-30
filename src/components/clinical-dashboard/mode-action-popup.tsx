"use client";

import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  Heart,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  UploadCloud,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { cn, chatComposerIconButton } from "@/components/ui-primitives";

export type ModeActionSetId = "answer" | "documents" | "tools" | "differentials";

export type ModeActionId =
  | "answer-clinical"
  | "answer-documents"
  | "answer-evidence"
  | "answer-new"
  | "documents-search"
  | "documents-upload"
  | "documents-scope"
  | "documents-recent"
  | "documents-tables"
  | "documents-status"
  | "documents-collections"
  | "documents-viewer"
  | "medication-dose"
  | "medication-safety"
  | "medication-monitoring"
  | "medication-access"
  | "tools-browse"
  | "tools-favourites"
  | "tools-new"
  | "favourites-browse"
  | "favourites-answer"
  | "favourites-tools"
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
      id: "answer-clinical",
      label: "Answer mode",
      shortLabel: "Answer",
      description: "Ask a clinical question",
      icon: Sparkles,
      primary: true,
    },
    { id: "answer-documents", label: "Docs", description: "Search and manage sources", icon: FileText },
    { id: "answer-evidence", label: "Evidence", description: "Review answer sources", icon: ListChecks },
    { id: "answer-new", label: "New answer", shortLabel: "New", description: "Clear the current thread", icon: Plus },
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
      id: "tools-favourites",
      label: "Favourites",
      shortLabel: "Saved",
      description: "Saved clinical tools",
      icon: Heart,
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
  buttonLabel,
  items,
  onOpenChange,
  onBeforeOpen,
  onAction,
  triggerClassName,
}: {
  open: boolean;
  title: string;
  titleIcon: LucideIcon;
  buttonLabel: string;
  items: readonly ModeActionItem[];
  onOpenChange: (open: boolean) => void;
  onBeforeOpen?: () => void;
  onAction: (actionId: ModeActionId) => void;
  triggerClassName?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const closeAndRestoreFocus = useCallback(() => {
    onOpenChange(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, [onOpenChange]);

  useDismissableLayer({
    enabled: open,
    refs: [rootRef, surfaceRef],
    restoreFocusRef: buttonRef,
    onDismiss: () => onOpenChange(false),
  });

  function focusActionItem(index: number) {
    const nextIndex = (index + items.length) % items.length;
    itemRefs.current[nextIndex]?.focus();
  }

  function openWithFocus(index: number) {
    onBeforeOpen?.();
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
    onOpenChange(false);
    onAction(actionId);
  }

  const primaryAction = items[0];
  const PrimaryActionIcon = primaryAction?.icon;
  const secondaryActions = items.slice(1);
  const secondaryGridClass =
    secondaryActions.length >= 6
      ? "grid-cols-4 max-[360px]:grid-cols-3"
      : secondaryActions.length >= 3
        ? "grid-cols-3"
        : "grid-cols-2";

  function assignActionRef(element: HTMLButtonElement | null, index: number) {
    itemRefs.current[index] = element;
  }

  return (
    <>
      {open ? (
        <div
          ref={surfaceRef}
          className={cn(
            "absolute inset-x-0 bottom-[calc(100%+0.7rem)] z-50 text-[color:var(--text)] motion-safe:animate-action-tray-in sm:inset-x-auto sm:left-0",
            items.length <= 4 ? "sm:w-[min(22rem,100%)]" : "sm:w-[min(24rem,100%)]",
          )}
        >
          <div className="overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[0_18px_42px_rgb(15_37_48_/_16%)] ring-1 ring-white/45 dark:ring-white/10">
            <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[color:var(--border)]/70 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[color:var(--clinical-chat-teal)]/18 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
                  <TitleIcon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    Options
                  </span>
                  <span className="block truncate text-[13px] font-bold text-[color:var(--text-heading)]">{title}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={closeAndRestoreFocus}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                aria-label={`Close ${title.toLowerCase()} options`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              id="daily-actions-sheet"
              data-testid="daily-actions-menu"
              role="menu"
              aria-label={title}
              className="p-2.5"
            >
              {primaryAction && PrimaryActionIcon ? (
                <button
                  key={primaryAction.id}
                  ref={(element) => assignActionRef(element, 0)}
                  type="button"
                  role="menuitem"
                  onKeyDown={(event) => handleItemKeyDown(event, 0)}
                  onClick={() => runActionAndClose(primaryAction.id)}
                  className={cn(
                    "group grid min-h-[4.25rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-inset)] transition motion-safe:duration-150",
                    "hover:border-[color:var(--clinical-chat-teal)]/45 hover:bg-[color:var(--clinical-chat-teal-soft)]/35 active:scale-[0.995]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] transition group-hover:bg-[color:var(--surface)]">
                    <PrimaryActionIcon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold leading-5 text-[color:var(--text-heading)]">
                      <span className="sm:hidden">{primaryAction.shortLabel ?? primaryAction.label}</span>
                      <span className="hidden sm:inline">{primaryAction.label}</span>
                    </span>
                    {primaryAction.description ? (
                      <span className="mt-0.5 block truncate text-[11px] font-semibold leading-4 text-[color:var(--text-soft)]">
                        {primaryAction.description}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)] transition group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </button>
              ) : null}
              {secondaryActions.length ? (
                <div
                  className={cn("mt-2 grid gap-1.5 border-t border-[color:var(--border)]/75 pt-2", secondaryGridClass)}
                >
                  {secondaryActions.map((item, secondaryIndex) => {
                    const index = secondaryIndex + 1;
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
                          "group grid min-h-[4.15rem] place-items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-2 text-center shadow-[var(--shadow-inset)] transition motion-safe:duration-150",
                          "hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] active:scale-[0.985]",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                        )}
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition group-hover:border-[color:var(--clinical-chat-teal)]/25 group-hover:text-[color:var(--clinical-chat-teal)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="max-w-full truncate text-[11px] font-bold leading-3 text-[color:var(--text-muted)] group-hover:text-[color:var(--text)]">
                          {item.shortLabel ?? item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[6px] left-8 h-3 w-3 rotate-45 border-b border-r border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[4px_4px_10px_rgb(15_37_48_/_5%)]"
          />
        </div>
      ) : null}

      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          ref={buttonRef}
          className={cn(
            chatComposerIconButton,
            triggerClassName,
            open && "bg-[color:var(--surface-subtle)] text-[color:var(--text)]",
          )}
          aria-label={buttonLabel}
          aria-controls={open ? "daily-actions-sheet" : undefined}
          aria-expanded={open}
          aria-haspopup="menu"
          title={buttonLabel}
          onKeyDown={handleTriggerKeyDown}
          onClick={() => {
            if (!open) onBeforeOpen?.();
            onOpenChange(!open);
          }}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}
