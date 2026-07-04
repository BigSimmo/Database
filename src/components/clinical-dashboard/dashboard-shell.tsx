"use client";

import { BookOpen, ChevronDown, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Sheet, type SheetMobileSize } from "@/components/ui/sheet";
import { clinicalDivider, cn, iconTilePremium, navPill, panelSubtle, textMuted } from "@/components/ui-primitives";

const sheetMediaQueries = {
  sm: "(max-width: 639px)",
  lg: "(max-width: 1023px)",
} as const;

type UtilityDrawerSheetBreakpoint = keyof typeof sheetMediaQueries;

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
          <h2 className="text-base-minus font-semibold text-[color:var(--text-heading)] sm:text-base">{title}</h2>
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
  sheetHeaderLeading,
  sheetTitleAccessory,
  sheetDescriptionContent,
  sheetHeaderActions,
  sheetHeaderClassName,
  sheetTitleClassName,
  sheetCloseButtonClassName,
  sheetChildrenClassName,
  sheetContentClassName,
  sheetContentStyle,
  sheetBodyClassName,
  sheetDescription,
  sheetBreakpoint = "sm",
  sheetMobileSize,
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
  sheetHeaderLeading?: ReactNode;
  sheetTitleAccessory?: ReactNode;
  sheetDescriptionContent?: ReactNode;
  sheetHeaderActions?: ReactNode;
  sheetHeaderClassName?: string;
  sheetTitleClassName?: string;
  sheetCloseButtonClassName?: string;
  sheetChildrenClassName?: string;
  sheetContentClassName?: string;
  sheetContentStyle?: CSSProperties;
  sheetBodyClassName?: string;
  sheetDescription?: string | null;
  sheetBreakpoint?: UtilityDrawerSheetBreakpoint;
  sheetMobileSize?: SheetMobileSize;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [usesSheet, setUsesSheet] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const open = controlledOpen ?? uncontrolledOpen;
  const sheetTriggerClassName = sheetBreakpoint === "lg" ? "lg:hidden" : "sm:hidden";
  const inlineDrawerClassName = sheetBreakpoint === "lg" ? "hidden lg:block" : "hidden sm:block";
  const triggerClassName = cn(
    "flex min-h-[56px] w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition motion-safe:duration-150 hover:bg-[color:var(--surface-subtle)]",
    className,
  );
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(sheetMediaQueries[sheetBreakpoint]);
    const sync = () => setUsesSheet(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [sheetBreakpoint]);

  return (
    <>
      <button
        ref={mobileTriggerRef}
        type="button"
        id={id ? `${id}-mobile-trigger` : undefined}
        onClick={() => setOpen(true)}
        aria-expanded={usesSheet ? open : undefined}
        className={cn("group", sheetTriggerClassName, triggerClassName, mobileInline && "hidden")}
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
        className={cn("group overflow-hidden", mobileInline ? "block" : inlineDrawerClassName, panelSubtle)}
      >
        <summary className={triggerClassName}>
          <span className="flex min-w-0 items-center gap-3">
            <span className={iconTilePremium}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--text)]">{title}</span>
              {summary ? (
                <>
                  {mobileInline && mobileSummary ? (
                    <span className={cn("mt-0.5 block text-xs leading-4 sm:hidden", textMuted)}>{mobileSummary}</span>
                  ) : null}
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-xs",
                      textMuted,
                      mobileInline && mobileSummary && "hidden sm:block",
                    )}
                  >
                    {summary}
                  </span>
                </>
              ) : null}
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
        description={sheetDescription === undefined ? (mobileSummary ?? summary) : (sheetDescription ?? undefined)}
        closeLabel={`Close ${title}`}
        headerLeading={sheetHeaderLeading}
        titleAccessory={sheetTitleAccessory}
        descriptionContent={sheetDescriptionContent}
        headerActions={sheetHeaderActions}
        headerClassName={sheetHeaderClassName}
        titleClassName={sheetTitleClassName}
        closeButtonClassName={sheetCloseButtonClassName}
        contentClassName={sheetContentClassName}
        contentStyle={sheetContentStyle}
        bodyClassName={sheetBodyClassName}
        mobileSize={sheetMobileSize}
        returnFocusRef={mobileTriggerRef}
        portal
      >
        <div className={cn("space-y-3", sheetChildrenClassName)}>{children}</div>
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
      contentClassName="font-sans sm:max-w-2xl"
      titleClassName="text-[17px] font-semibold tracking-normal sm:text-lg"
      bodyClassName="p-4 sm:p-5"
      closeButtonClassName="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {guideSections.map((section) => (
          <article
            key={section.title}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]"
          >
            <h3 className="text-sm-minus font-semibold leading-5 text-[color:var(--text-heading)] sm:text-sm">
              {section.title}
            </h3>
            <p className={cn("mt-1 text-sm-minus font-normal leading-5 sm:text-sm sm:leading-6", textMuted)}>
              {section.body}
            </p>
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
