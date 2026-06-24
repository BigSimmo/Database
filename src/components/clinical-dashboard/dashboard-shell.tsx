"use client";

import { BookOpen, ChevronDown, type LucideIcon } from "lucide-react";
import { ReactNode, useCallback, useEffect, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import {
  clinicalDivider,
  cn,
  iconTilePremium,
  navPill,
  panelSubtle,
  sourceCard,
  textMuted,
} from "@/components/ui-primitives";

const mobileSheetMediaQuery = "(max-width: 639px)";

export function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
  testId,
  hideDescriptionOnMobile = false,
  compactMobile = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
  hideDescriptionOnMobile?: boolean;
  compactMobile?: boolean;
}) {
  const alignWhenCompact = compactMobile && hideDescriptionOnMobile ? "items-center sm:items-start" : "items-start";

  return (
    <div
      data-testid={testId}
      className={cn("flex flex-wrap justify-between", alignWhenCompact, compactMobile ? "gap-2 sm:gap-3" : "gap-3")}
    >
      <div className={cn("flex min-w-0", alignWhenCompact, compactMobile ? "gap-2 sm:gap-3" : "gap-3")}>
        <span
          data-section-heading-icon
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
            compactMobile ? "h-7 w-7 sm:h-9 sm:w-9" : "h-9 w-9",
          )}
        >
          <Icon className={cn(compactMobile ? "h-4 w-4 sm:h-4.5 sm:w-4.5" : "h-4.5 w-4.5")} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[color:var(--text-heading)] sm:text-base">{title}</h2>
          {description && (
            <p className={cn("mt-1 text-sm leading-6", textMuted, hideDescriptionOnMobile && "hidden sm:block")}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function UtilityDrawer({
  id,
  title,
  icon: Icon,
  summary,
  mobileSummary,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  mobileInline = false,
}: {
  id?: string;
  title: string;
  icon: LucideIcon;
  summary?: string;
  mobileSummary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  mobileInline?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [usesSheet, setUsesSheet] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileSheetMediaQuery);
    const sync = () => setUsesSheet(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <button
        type="button"
        id={id ? `${id}-mobile-trigger` : undefined}
        onClick={() => setOpen(true)}
        aria-expanded={usesSheet ? open : undefined}
        className={cn(
          "group flex min-h-[56px] w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition motion-safe:duration-150 hover:bg-[color:var(--surface-subtle)] sm:hidden",
          panelSubtle,
          mobileInline && "hidden",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={iconTilePremium}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">{title}</span>
            {(mobileSummary || summary) && (
              <span className={cn("mt-0.5 block truncate text-xs", textMuted)}>{mobileSummary ?? summary}</span>
            )}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-[color:var(--text-muted)] transition motion-safe:duration-150" />
      </button>

      <details
        id={id}
        open={open && (!usesSheet || mobileInline)}
        onToggle={(event) => {
          if (usesSheet && !mobileInline) return;
          const nextOpen = event.currentTarget.open;
          if (nextOpen !== open) setOpen(nextOpen);
        }}
        className={cn("group", mobileInline ? "block" : "hidden sm:block", panelSubtle, className)}
      >
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition motion-safe:duration-150 hover:bg-[color:var(--surface-subtle)]">
          <span className="flex min-w-0 items-center gap-3">
            <span className={iconTilePremium}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--text)]">{title}</span>
              {summary && <span className={cn("mt-0.5 block truncate text-xs", textMuted)}>{summary}</span>}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition motion-safe:duration-150 group-open:rotate-180" />
        </summary>
        {open && (!usesSheet || mobileInline) && <div className={cn(clinicalDivider, "p-4")}>{children}</div>}
      </details>

      <Sheet
        open={usesSheet && open && !mobileInline}
        onClose={() => setOpen(false)}
        title={title}
        description={mobileSummary ?? summary}
        closeLabel={`Close ${title}`}
      >
        <div className="space-y-3">{children}</div>
      </Sheet>
    </>
  );
}

const guideSections = [
  {
    title: "Ask and verify",
    body: "Ask a focused guideline question, then verify linked citations and source passages before use.",
  },
  {
    title: "Top source and citations",
    body: "Use Top source, citation chips, and source cards to open the relevant document page and check the retrieved evidence.",
  },
  {
    title: "Scope",
    body: "Use document scope controls when a question should search only selected guidelines rather than every indexed source.",
  },
  {
    title: "Quotes, images, sources",
    body: "Bottom nav jumps to quotes, diagrams, and source passages. Empty sections had no citations.",
  },
  {
    title: "Upload and indexing",
    body: "Real uploads require Supabase, OpenAI setup, the database schema, and the worker. Demo mode is synthetic only.",
  },
  {
    title: "Copying text",
    body: "Copied drafts are not final clinical notes. Keep the provenance footer and verify source material before using copied text.",
  },
] as const;

export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Clinical KB guide"
      description="Practical use notes for source-backed guideline search."
      closeLabel="Close guide"
      contentClassName="sm:max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {guideSections.map((section) => (
          <article key={section.title} className={cn(sourceCard, "p-3")}>
            <h3 className="text-sm font-semibold text-[color:var(--text)]">{section.title}</h3>
            <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>{section.body}</p>
          </article>
        ))}
      </div>
    </Sheet>
  );
}

export function GuideTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        data-testid="dashboard-guide-trigger"
        onClick={onOpen}
        className={cn(navPill, "px-3")}
        aria-label="Open user guide"
      >
        <BookOpen className="h-4 w-4" />
        Guide
      </button>
    </div>
  );
}
