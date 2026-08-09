"use client";

import { ArrowLeft, ChevronDown, Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { PhoneHeaderCollapsePortal } from "@/components/clinical-dashboard/phone-header-collapse-portal";
import { DocumentSectionList, DocumentSectionTrack } from "@/components/document-viewer/section-nav";
import { toDocumentSections, type PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageChromeMetrics } from "@/components/in-page-nav/use-in-page-chrome-metrics";
import { usePageSectionWeights } from "@/components/in-page-nav/use-page-section-weights";
import { Sheet } from "@/components/ui/sheet";
import { cn, pageContainer } from "@/components/ui-primitives";

export type InPageNavHeaderProps = {
  /** `label` is the mode home's name: shown from `sm`, and the aria-label at every width. */
  back: { href: string; label: string };
  title: string;
  /**
   * Information pages keep their large record title in the body, so the header
   * title is a `<span>` and the page still has exactly one `<h1>`. Pages whose
   * header *is* the only title (the document viewer shape) pass `"h1"`.
   */
  titleAs?: "span" | "h1";
  sections: readonly PageSection[];
  activeId: string | null;
  onSelectSection: (id: string) => void;
  /** Section-sheet heading. Defaults to `title`. */
  sectionSheetTitle?: string;
  /**
   * Contents of the actions sheet. Omit and no ellipsis control is rendered at
   * all — a page with no actions gets no button that opens an empty sheet.
   *
   * A function form receives a callback that closes the sheet, for a client page
   * whose actions run handlers. Plain `ReactNode` exists because four of the
   * converted information pages are Server Components: React cannot pass a
   * function across that boundary, but server-rendered JSX passed as a slot is
   * fine. Those pages' actions are `<Link>`s, and the sheet closes on the
   * `pathname` change they cause.
   */
  actions?: ReactNode | ((close: () => void) => ReactNode);
  /** Actions-sheet heading, e.g. "This service". */
  actionsTitle?: string;
  actionsDescription?: string;
  /** Noun in the actions control labels, e.g. "service" -> "Open service actions". */
  actionsNoun?: string;
  /** `"service"` yields `service-detail-header`, `service-section-trigger`, and so on. */
  testIdPrefix: string;
  className?: string;
  /** Inner row width. Defaults to the shared `pageContainer`. */
  containerClassName?: string;
};

/**
 * The repository's default in-page navigation, codified in
 * `docs/search-chrome-behaviour.md` ("Default in-page navigation template"):
 * back control, title carrying the active section on line two behind a chevron
 * disclosure, ellipsis page actions, and a weighted segment track pinned to the
 * header's bottom edge.
 *
 * Extracted from the differentials detail page, which built the template by hand
 * first. `DocumentViewer` still carries its own copy — it owns the `<h1>`, uses
 * the `edge-glass-header` treatment, and is pinned by visual baselines, so
 * converging it is a separate change rather than half of this one.
 *
 * `relative` on the header is load-bearing: the track is absolutely positioned
 * against it, and a `static` phone header would let the track escape to whichever
 * ancestor happens to be positioned. `sm:sticky` applies only from `sm`, because
 * below that `PhoneHeaderCollapsePortal` moves this subtree into the universal
 * header's collapse row, which owns the scroll motion — this must never grow a
 * scroll-hide hook of its own.
 */
export function InPageNavHeader({
  back,
  title,
  titleAs = "span",
  sections,
  activeId,
  onSelectSection,
  sectionSheetTitle,
  actions,
  actionsTitle,
  actionsDescription,
  actionsNoun = "page",
  testIdPrefix,
  className,
  containerClassName,
}: InPageNavHeaderProps) {
  // Both sheets record the route they were opened on rather than a bare
  // boolean, so navigating closes them without an effect that resets state.
  // This is load-bearing, not tidiness: most page actions are `<Link>`s, and
  // action JSX passed in from a Server Component has no way to call `close()`.
  // Deriving from the pathname covers every link generically, and matches the
  // shell already resetting phone scroll state on navigation (search-chrome
  // invariant 14).
  // `null` is the closed sentinel and must never be a value `currentPath` can
  // take: `usePathname()` returns null outside a router (which is how this
  // renders in DOM tests), and a null-vs-null match would read as open.
  const currentPath = usePathname() ?? "";
  const [sectionSheetPath, setSectionSheetPath] = useState<string | null>(null);
  const [actionsPath, setActionsPath] = useState<string | null>(null);
  const sectionSheetOpen = sectionSheetPath !== null && sectionSheetPath === currentPath;
  const actionsOpen = actionsPath !== null && actionsPath === currentPath;
  const setSectionSheetOpen = (open: boolean) => setSectionSheetPath(open ? currentPath : null);
  const setActionsOpen = (open: boolean) => setActionsPath(open ? currentPath : null);
  const sectionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  useInPageChromeMetrics();

  const measuredWeights = usePageSectionWeights(sections);
  const documentSections = toDocumentSections(sections, measuredWeights);
  const activeIndex = documentSections.findIndex((section) => section.id === activeId);
  const activeSection = documentSections[activeIndex] ?? documentSections[0];
  const ActiveIcon = activeSection?.icon;
  const TitleTag = titleAs;

  return (
    <>
      <PhoneHeaderCollapsePortal>
        <header
          data-testid={`${testIdPrefix}-detail-header`}
          data-inpage-sticky-header=""
          className={cn(
            "relative z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 sm:sticky sm:top-0 sm:px-6 lg:px-8",
            className,
          )}
        >
          <div className={cn(containerClassName ?? pageContainer, "flex min-h-12 min-w-0 items-center gap-2")}>
            <Link
              href={back.href}
              aria-label={`Back to ${back.label.toLowerCase()}`}
              className="inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{back.label}</span>
            </Link>
            {documentSections.length > 0 ? (
              // The title is the section-list disclosure. Line two names where
              // you are, which the track can place but never label.
              <button
                type="button"
                ref={sectionTriggerRef}
                onClick={() => setSectionSheetOpen(true)}
                aria-expanded={sectionSheetOpen}
                aria-haspopup="dialog"
                data-testid={`${testIdPrefix}-section-trigger`}
                className="focus-ring-tab flex min-h-tap min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left transition hover:bg-[color:var(--surface-subtle)]"
              >
                <span className="min-w-0 flex-1">
                  <TitleTag className="block truncate text-sm font-semibold leading-tight text-[color:var(--text-heading)] sm:text-base">
                    {title}
                  </TitleTag>
                  {activeSection && ActiveIcon ? (
                    <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
                      <ActiveIcon className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{activeSection.label}</span>
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)] transition motion-reduce:transition-none",
                    sectionSheetOpen && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <TitleTag className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-heading)] sm:text-base">
                {title}
              </TitleTag>
            )}
            {actions ? (
              <button
                type="button"
                ref={actionsTriggerRef}
                onClick={() => setActionsOpen(true)}
                aria-label={`Open ${actionsNoun} actions`}
                aria-haspopup="dialog"
                aria-expanded={actionsOpen}
                title={`${actionsNoun.charAt(0).toUpperCase()}${actionsNoun.slice(1)} actions`}
                data-testid={`${testIdPrefix}-actions-trigger`}
                className="focus-ring-tab ml-auto grid h-tap w-tap shrink-0 place-items-center rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]"
              >
                <Ellipsis className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </button>
            ) : null}
          </div>
          <DocumentSectionTrack sections={documentSections} activeId={activeSection?.id ?? null} />
        </header>
      </PhoneHeaderCollapsePortal>
      {/* Both sheets are siblings of the portal, never children of it: a sheet
          inside the collapse row would be carried away with the header when the
          shared chrome scroll-hides. */}
      <Sheet
        open={sectionSheetOpen}
        onClose={() => setSectionSheetOpen(false)}
        title={sectionSheetTitle ?? title}
        description={
          activeSection
            ? `${activeSection.label} · ${Math.max(activeIndex + 1, 1)} of ${documentSections.length}`
            : undefined
        }
        closeLabel="Close section list"
        returnFocusRef={sectionTriggerRef}
        testId={`${testIdPrefix}-section-sheet`}
      >
        <DocumentSectionList
          sections={documentSections}
          activeId={activeSection?.id ?? null}
          onSelect={(id) => {
            onSelectSection(id);
            setSectionSheetOpen(false);
          }}
        />
      </Sheet>
      {actions ? (
        <Sheet
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          title={actionsTitle ?? `This ${actionsNoun}`}
          description={actionsDescription}
          closeLabel={`Close ${actionsNoun} actions`}
          returnFocusRef={actionsTriggerRef}
          testId={`${testIdPrefix}-actions-sheet`}
        >
          {typeof actions === "function" ? actions(() => setActionsOpen(false)) : actions}
        </Sheet>
      ) : null}
    </>
  );
}
