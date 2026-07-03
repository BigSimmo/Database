"use client";

import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  BadgeCheck,
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
  buttonLabel,
  items,
  onOpenChange,
  onBeforeOpen,
  onAction,
  triggerClassName,
  integrated = false,
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
  integrated?: boolean;
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

  const actionGridClass =
    items.length >= 6
      ? "grid-cols-2 min-[560px]:grid-cols-4"
      : items.length >= 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";
  const headerSubtitle =
    title.toLowerCase() === "answer"
      ? "Source-backed mode"
      : items.find((item) => item.primary)?.description || items[0]?.description || "Mode actions";

  function assignActionRef(element: HTMLButtonElement | null, index: number) {
    itemRefs.current[index] = element;
  }

  return (
    <>
      {open ? (
        <div
          ref={surfaceRef}
          className={cn(
            "absolute z-50 text-[color:var(--text)] motion-safe:animate-action-tray-in",
            integrated
              ? "inset-x-0 bottom-[calc(100%+0.65rem)]"
              : "inset-x-0 bottom-[calc(100%+0.7rem)] sm:bottom-auto sm:top-[calc(100%+0.7rem)] sm:inset-x-auto sm:left-0",
            !integrated && (items.length <= 4 ? "sm:w-[min(22rem,100%)]" : "sm:w-[min(24rem,100%)]"),
          )}
        >
          <div
            className={cn(
              "overflow-hidden border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[0_18px_42px_rgb(15_37_48_/_16%)] ring-1 ring-white/45 dark:ring-white/10",
              integrated ? "rounded-[1.35rem] shadow-[0_20px_48px_rgb(15_37_48_/_18%)]" : "rounded-[1rem]",
            )}
          >
            <div className="grid min-h-[4.1rem] grid-cols-[minmax(8.5rem,0.38fr)_minmax(0,1fr)_3.75rem] overflow-hidden border-b border-[color:var(--border)]/70 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--clinical-accent-soft)_42%,var(--surface)_58%)_0%,color-mix(in_srgb,var(--surface-raised)_92%,var(--clinical-accent-soft)_8%)_100%)]">
              <div className="flex min-w-0 items-center gap-3 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--clinical-accent)_82%,#ffffff_18%)_0%,color-mix(in_srgb,var(--clinical-accent)_68%,var(--primary-strong)_32%)_100%)] px-3.5 text-[color:var(--primary-contrast)] shadow-[inset_0_1px_0_rgb(255_255_255_/_22%)] sm:px-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/25 bg-white/10 text-white shadow-[var(--shadow-inset)]">
                  <TitleIcon className="h-4.5 w-4.5" />
                </span>
                <span className="truncate text-base font-bold leading-none sm:text-lg">{title}</span>
              </div>
              <div className="flex min-w-0 items-center gap-3 border-l border-[color:var(--border)]/45 px-3 sm:px-5">
                <span aria-hidden="true" className="hidden h-7 w-px bg-[color:var(--border)]/80 sm:block" />
                <span className="truncate text-sm font-semibold text-[color:var(--text-heading)] sm:text-base">
                  {headerSubtitle}
                </span>
              </div>
              <button
                type="button"
                onClick={closeAndRestoreFocus}
                className="m-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent)]/28 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
              className={cn("p-2.5", integrated && "p-3 sm:p-3.5")}
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
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-[6px] left-8 h-3 w-3 rotate-45 border-b border-r border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[4px_4px_10px_rgb(15_37_48_/_5%)] sm:hidden"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-[6px] left-8 hidden h-3 w-3 rotate-45 border-l border-t border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[-4px_-4px_10px_rgb(15_37_48_/_5%)] sm:block"
              />
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
