"use client";

import { ChevronDown, MapPin, ShieldAlert } from "lucide-react";
import { Suspense, useEffect, useId, useRef, useState } from "react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { NavigationBackButton } from "@/components/navigation-back-button";
import { PrivacyPageBackButton } from "@/components/privacy-page-back-button";
import { cn, eyebrowText, searchPageCanvas, searchFocusRing } from "@/components/ui-primitives";
import {
  PRIVACY_DRAFT_DISCLAIMER,
  PRIVACY_IMPORTANT_FULL,
  PRIVACY_IMPORTANT_SHORT,
  PRIVACY_PROCESSING_MAP,
  PRIVACY_SECTIONS,
} from "@/lib/privacy-page-content";
import { privacyCopy } from "@/lib/ui-copy";

/**
 * Production privacy page.
 *
 * Page structure:
 * - Compact sticky navigation header
 * - In-flow introduction, Important notice, and processing overview
 * - Processing map is the mockup instrument strip — never rounded-full “circle” chips
 * - Accordion with numbered gists; desktop Signal Index
 *
 * Governance copy stays in `privacy-page-content` (pinned by privacy-ui tests).
 */

const atmosphere =
  "bg-[radial-gradient(ellipse_at_8%_-8%,color-mix(in_srgb,var(--warning-bg)_78%,transparent),transparent_34%),radial-gradient(ellipse_at_92%_4%,color-mix(in_srgb,var(--clinical-accent-soft)_48%,transparent),transparent_42%),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_55%,transparent),transparent_18rem),var(--background)]";

/** Readable content measure for the privacy document, not the 1500px search shell. */
const pageContainer = "mx-auto w-full max-w-[80rem]";
const pagePadX = "px-4 sm:px-6 lg:px-8";
/** Same safe-area top pad as `searchPageShellStandalone` — owned here for sticky chrome. */
const pagePadTop = "pt-[max(0.75rem,var(--safe-area-top))] sm:pt-[max(1rem,var(--safe-area-top))]";

/**
 * Precision instrument — three equal cells at every width.
 * Soft tone washes + MapPin marks; never horizontal pill/circle chips that clip External.
 */
function ProcessingMap({ density = "comfortable" }: { density?: "comfortable" | "compact" }) {
  const compact = density === "compact";
  return (
    <section aria-label="Where processing happens" className={cn(compact ? "space-y-1.5" : "space-y-2")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
          Processing map
        </p>
        <p className="text-3xs font-medium text-[color:var(--text-muted)]">Operator must verify regions</p>
      </div>
      <div
        className={cn(
          "grid grid-cols-3 overflow-hidden rounded-2xl border border-[color:var(--border)] shadow-[var(--shadow-inset)]",
          "bg-[color:var(--surface-raised)]",
        )}
      >
        {PRIVACY_PROCESSING_MAP.map((cell, index) => (
          <div
            key={cell.place}
            className={cn(
              "relative min-w-0",
              compact ? "px-2 py-2 sm:px-3 sm:py-2.5" : "px-2.5 py-2.5 sm:px-4 sm:py-3.5",
              index > 0 && "border-l border-[color:var(--border)]",
              cell.tone === "accent" && "bg-[color:var(--clinical-accent-soft)]/55",
              cell.tone === "warn" && "bg-[color:var(--warning-bg)]/80",
              cell.tone === "neutral" && "bg-[color:var(--surface-subtle)]/80",
            )}
          >
            <div className={cn("flex items-start", compact ? "gap-1" : "gap-1.5")}>
              <MapPin
                aria-hidden="true"
                className={cn(
                  "mt-0.5 shrink-0 opacity-80",
                  compact ? "h-3 w-3" : "h-3.5 w-3.5",
                  cell.tone === "accent" && "text-[color:var(--clinical-accent)]",
                  cell.tone === "warn" && "text-[color:var(--warning-text)]",
                  cell.tone === "neutral" && "text-[color:var(--text-muted)]",
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-extrabold uppercase tracking-kicker",
                    compact ? "text-3xs leading-3" : "text-3xs leading-3 sm:text-2xs sm:leading-4",
                    cell.tone === "accent" && "text-[color:var(--clinical-accent)]",
                    cell.tone === "warn" && "text-[color:var(--warning-text)]",
                    cell.tone === "neutral" && "text-[color:var(--text-muted)]",
                  )}
                >
                  {cell.place}
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-semibold tracking-display text-[color:var(--text-heading)]",
                    compact ? "text-2xs leading-4" : "text-2xs leading-4 sm:text-sm sm:leading-5",
                  )}
                >
                  {cell.role}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionAccordion({
  openId,
  setOpenId,
  expandAll,
  sectionRefs,
  idPrefix,
  stickyOffsetPx,
}: {
  openId: string;
  setOpenId: (id: string) => void;
  expandAll: boolean;
  sectionRefs: React.RefObject<Record<string, HTMLElement | null>>;
  idPrefix: string;
  stickyOffsetPx: number;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]",
        "print:overflow-visible",
      )}
    >
      {PRIVACY_SECTIONS.map((section, index) => {
        const expanded = expandAll || openId === section.heading;
        const panelId = `${idPrefix}-section-${index}`;
        const triggerId = `${idPrefix}-trigger-${index}`;
        return (
          <section
            key={section.heading}
            ref={(node) => {
              sectionRefs.current[section.heading] = node;
            }}
            style={{ scrollMarginTop: stickyOffsetPx + 12 }}
            className={cn(index > 0 && "border-t border-[color:var(--border)]", "print:break-inside-avoid")}
          >
            <h3 className="m-0">
              <button
                type="button"
                id={triggerId}
                onClick={() => setOpenId(expanded && !expandAll ? "" : section.heading)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className={cn(
                  "group relative flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition duration-[var(--duration-fast)] hover:bg-[color:var(--surface-subtle)] sm:gap-3 sm:px-3.5 sm:py-3 lg:px-5",
                  searchFocusRing,
                  "min-h-tap lg:min-h-[calc(var(--spacing-tap)+0.75rem)]",
                  expanded && "bg-[color:var(--clinical-accent-soft)]/45",
                )}
              >
                {expanded ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)] print:hidden"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "nums mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-2xs font-extrabold",
                    expanded
                      ? "bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                      : "bg-[color:var(--surface-subtle)] text-[color:var(--clinical-accent)]",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-display text-[color:var(--text-heading)] lg:text-base-minus">
                    {section.heading}
                  </span>
                  {!expanded ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 block text-2xs leading-4 text-[color:var(--text-muted)] sm:mt-1 lg:text-xs lg:leading-5"
                    >
                      {section.gist}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--clinical-accent)] print:hidden sm:mt-1">
                      Open
                    </span>
                  )}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-icon-sm shrink-0 text-[color:var(--text-muted)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none print:hidden",
                    expanded && "rotate-180 text-[color:var(--clinical-accent)]",
                  )}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!expanded}
              className={cn(
                "border-t border-[color:var(--clinical-accent-border)]/60 bg-[color:var(--surface-wash)] px-3 py-3 sm:px-3.5 sm:py-3.5 lg:px-5 lg:py-4 lg:pl-[calc(var(--spacing-tap)+0.75rem)]",
                "print:block",
              )}
            >
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function PrivacyQuietSignalPage() {
  const noticeId = useId();
  const sectionIdPrefix = useId();
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const stickyChromeRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollHeading = useRef<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [openId, setOpenId] = useState(PRIVACY_SECTIONS[0]?.heading ?? "");
  const [expandAll, setExpandAll] = useState(false);
  const [stickyChromeHeightPx, setStickyChromeHeightPx] = useState(80);
  // When enlarged text makes the header taller than the viewport, sticky chrome
  // would cover every accordion hit target — drop sticky in that case.
  const [chromeSticky, setChromeSticky] = useState(true);

  useEffect(() => {
    const el = stickyChromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      setStickyChromeHeightPx(height);
      setChromeSticky(height < window.innerHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollSectionIntoView = (heading: string) => {
    const target = sectionRefs.current[heading];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectSection = (heading: string) => {
    if (!expandAll && openId === heading) {
      pendingScrollHeading.current = null;
      scrollSectionIntoView(heading);
      return;
    }
    pendingScrollHeading.current = heading;
    setExpandAll(false);
    setOpenId(heading);
  };

  useEffect(() => {
    const heading = pendingScrollHeading.current;
    if (!heading || openId !== heading || expandAll) return;
    pendingScrollHeading.current = null;
    scrollSectionIntoView(heading);
  }, [openId, expandAll]);

  const toggleExpandAll = () => {
    setExpandAll((value) => !value);
    if (expandAll) setOpenId(PRIVACY_SECTIONS[0]?.heading ?? "");
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        searchPageCanvas,
        atmosphere,
        "min-h-dvh focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
      )}
    >
      <div
        ref={stickyChromeRef}
        data-testid="privacy-sticky-chrome"
        data-sticky={chromeSticky ? "true" : "false"}
        className={cn(
          chromeSticky && "sticky top-0",
          "z-30 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)]/95 shadow-[var(--e1)] backdrop-blur-xl",
        )}
      >
        <div className={cn(pagePadX, pagePadTop, "pb-2.5 sm:pb-3")}>
          <div className={cn(pageContainer, "flex min-h-tap items-center gap-2.5 sm:gap-3")}>
            <Suspense fallback={<NavigationBackButton fallbackHref="/" />}>
              <PrivacyPageBackButton />
            </Suspense>
            <BrandMark className="h-9 w-9 shrink-0 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
            <div className="min-w-0 flex-1">
              <p className={cn(eyebrowText, "shrink-0")}>{privacyCopy.pageEyebrow}</p>
              <p className="mt-0.5 truncate text-sm font-semibold tracking-display text-[color:var(--text-heading)] sm:text-base-minus lg:text-lg">
                Data handling
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(pagePadX, "py-5 sm:py-7 lg:py-10")}>
        <div className={cn(pageContainer, "space-y-5 sm:space-y-6")}>
          <header className="max-w-[48rem]">
            <p className={cn(eyebrowText, "text-[color:var(--clinical-accent)]")}>Privacy overview</p>
            <h1 className="mt-2 text-balance text-2xl font-semibold tracking-display text-[color:var(--text-heading)] sm:text-3xl lg:text-4xl">
              {privacyCopy.pageTitle}
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
              Understand what information Clinical KB handles, where it is processed, how long it is retained, and what
              you need to do before using it.
            </p>
            <p
              data-testid="privacy-draft-disclaimer"
              className="max-w-[68ch] text-xs font-semibold leading-5 text-[color:var(--warning-text)]"
            >
              {PRIVACY_DRAFT_DISCLAIMER}
            </p>
          </header>

          <section
            aria-labelledby="privacy-important-heading"
            className="overflow-hidden rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] shadow-[var(--shadow-inset)]"
          >
            <div className="flex flex-wrap items-start gap-2.5 p-3 sm:flex-nowrap sm:gap-3 sm:p-4">
              <span
                aria-hidden="true"
                className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-[color:var(--warning)]"
              />
              <ShieldAlert className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2
                  id="privacy-important-heading"
                  className="text-2xs font-extrabold uppercase tracking-kicker text-[color:var(--warning-text)]"
                >
                  Before you use Clinical KB
                </h2>
                <p className="mt-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)] sm:leading-6">
                  {PRIVACY_IMPORTANT_SHORT}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoticeOpen((value) => !value)}
                aria-expanded={noticeOpen}
                aria-controls={noticeId}
                className={cn(
                  "inline-flex min-h-tap shrink-0 items-center justify-center gap-1 self-start rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--surface-raised)] px-2.5 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--warning-text)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--warning-bg)] max-sm:w-full",
                  searchFocusRing,
                )}
              >
                {noticeOpen ? "Show less" : "Read more"}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-icon-xs transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                    noticeOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
            <div
              id={noticeId}
              hidden={!noticeOpen}
              className="border-t border-[color:var(--warning-border)] bg-[color:var(--surface-raised)] px-4 py-3 sm:px-5 sm:py-4 print:block"
            >
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-heading)]">
                {PRIVACY_IMPORTANT_FULL}
              </p>
            </div>
          </section>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)] sm:p-4">
            <ProcessingMap density="compact" />
          </div>
        </div>
      </div>

      <div className={cn(pagePadX, "pb-8 lg:pb-12")}>
        <div className={cn(pageContainer, "grid grid-cols-1 gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8")}>
          <aside
            className="hidden h-fit rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--shadow-inset)] lg:sticky lg:block"
            style={{ top: chromeSticky ? stickyChromeHeightPx + 12 : 12 }}
          >
            <div className="mb-1.5 flex items-center justify-between px-2.5 pt-1.5">
              <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
                On this page
              </p>
              <button
                type="button"
                onClick={toggleExpandAll}
                className={cn(
                  "min-h-tap rounded-md px-1.5 text-3xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] sm:min-h-8 sm:py-1",
                  searchFocusRing,
                )}
              >
                {expandAll ? "Collapse" : "Expand all"}
              </button>
            </div>
            <nav aria-label="Privacy sections" className="grid gap-0.5">
              {PRIVACY_SECTIONS.map((section, index) => {
                const active = !expandAll && openId === section.heading;
                return (
                  <button
                    key={section.heading}
                    type="button"
                    onClick={() => selectSection(section.heading)}
                    className={cn(
                      "relative flex min-h-tap w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-xl px-2.5 text-left transition",
                      searchFocusRing,
                      active
                        ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "nums grid h-6 w-6 shrink-0 place-items-center rounded-md text-3xs font-extrabold",
                        active
                          ? "bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                          : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{section.short}</span>
                      <span className="mt-0.5 block truncate text-3xs leading-3 text-[color:var(--text-muted)]">
                        {section.gist}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={eyebrowText}>Privacy details</p>
                <h2 className="mt-1 text-lg font-semibold tracking-display text-[color:var(--text-heading)] sm:text-xl">
                  How your information is handled
                </h2>
              </div>
              <button
                type="button"
                onClick={toggleExpandAll}
                className={cn(
                  "inline-flex min-h-tap shrink-0 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 text-3xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--clinical-accent-soft)] lg:hidden",
                  searchFocusRing,
                )}
              >
                {expandAll ? "Collapse" : "Expand all"}
              </button>
            </div>
            <SectionAccordion
              idPrefix={sectionIdPrefix}
              openId={openId}
              setOpenId={(id) => {
                setExpandAll(false);
                setOpenId(id);
              }}
              expandAll={expandAll}
              sectionRefs={sectionRefs}
              stickyOffsetPx={chromeSticky ? stickyChromeHeightPx : 0}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
