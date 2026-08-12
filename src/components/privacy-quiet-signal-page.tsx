"use client";

import { ChevronDown, ShieldAlert } from "lucide-react";
import { Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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
 * Quiet Signal — production privacy page.
 *
 * Quiet-scroll mockup DNA (`privacy-live-signal-variants`):
 * - Sticky chrome = header + full-bleed amber Important only (no phone chips)
 * - Back + BrandMark + Quiet signal badge; Draft on the right
 * - Processing map: single instrument card (stacks on phone, 3-col from sm+)
 * - Denser accordion with gists; desktop Signal Index
 *
 * Governance copy stays in `privacy-page-content` (pinned by privacy-ui tests).
 */

const atmosphere =
  "bg-[radial-gradient(ellipse_at_8%_-8%,color-mix(in_srgb,var(--warning-bg)_78%,transparent),transparent_34%),radial-gradient(ellipse_at_92%_4%,color-mix(in_srgb,var(--clinical-accent-soft)_48%,transparent),transparent_42%),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_55%,transparent),transparent_18rem),var(--background)]";

/** Content measure aligned to Quiet Signal comps (80rem), not the 1500px search shell. */
const quietContainer = "mx-auto w-full max-w-[80rem]";
const quietPadX = "px-3 sm:px-5 lg:px-8";
const quietPadTop = "pt-[max(0.75rem,var(--safe-area-top))] sm:pt-[max(1.25rem,var(--safe-area-top))]";

function LiveDot() {
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--warning)] opacity-45 motion-reduce:animate-none" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--warning)]" />
    </span>
  );
}

function ProcessingMap() {
  return (
    <section aria-label="Where processing happens" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          Processing map
        </p>
        <p className="text-3xs font-medium text-[color:var(--text-soft)]">Operator must verify regions</p>
      </div>
      {/*
        One instrument for every width — no dual-mount, no horizontal scroll that
        clips External on phone. Stacks below sm; three columns from sm up.
      */}
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)] sm:grid-cols-3">
        {PRIVACY_PROCESSING_MAP.map((cell, index) => (
          <div
            key={cell.place}
            className={cn(
              "min-w-0 px-3.5 py-3 sm:px-4 sm:py-3.5",
              index > 0 && "border-t border-[color:var(--border)] sm:border-t-0 sm:border-l",
            )}
          >
            <p
              className={cn(
                "text-2xs font-extrabold uppercase tracking-[0.12em]",
                cell.tone === "accent" && "text-[color:var(--clinical-accent)]",
                cell.tone === "warn" && "text-[color:var(--warning-text)]",
                cell.tone === "neutral" && "text-[color:var(--text-muted)]",
              )}
            >
              {cell.place}
            </p>
            <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-heading)]">
              {cell.role}
            </p>
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
            <h2 className="m-0">
              <button
                type="button"
                id={triggerId}
                onClick={() => setOpenId(expanded && !expandAll ? "" : section.heading)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className={cn(
                  "group relative flex w-full items-start gap-3 px-3.5 py-3 text-left transition duration-[var(--duration-fast)] hover:bg-[color:var(--surface-subtle)] lg:px-5",
                  searchFocusRing,
                  "min-h-tap lg:min-h-[3.75rem]",
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
                  <span className="block text-sm font-semibold tracking-[-0.015em] text-[color:var(--text-heading)] lg:text-base-minus">
                    {section.heading}
                  </span>
                  {!expanded ? (
                    <span
                      aria-hidden="true"
                      className="mt-1 block text-2xs leading-4 text-[color:var(--text-muted)] lg:text-xs lg:leading-5"
                    >
                      {section.gist}
                    </span>
                  ) : (
                    <span className="mt-1 block text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)] print:hidden">
                      Open
                    </span>
                  )}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-icon-sm shrink-0 text-[color:var(--text-soft)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none print:hidden",
                    expanded && "rotate-180 text-[color:var(--clinical-accent)]",
                  )}
                />
              </button>
            </h2>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!expanded}
              className={cn(
                "border-t border-[color:var(--clinical-accent-border)]/60 bg-[color:var(--surface-wash)] px-3.5 py-3.5 lg:px-5 lg:py-4 lg:pl-[3.75rem]",
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
  const [stickyChromeHeightPx, setStickyChromeHeightPx] = useState(160);

  useEffect(() => {
    const el = stickyChromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      setStickyChromeHeightPx(Math.ceil(el.getBoundingClientRect().height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [noticeOpen]);

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

  useLayoutEffect(() => {
    const heading = pendingScrollHeading.current;
    if (!heading || openId !== heading || expandAll) return;
    pendingScrollHeading.current = null;
    scrollSectionIntoView(heading);
  }, [openId, expandAll]);

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
        className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)]/95 shadow-[var(--shadow-tight)] backdrop-blur-xl"
      >
        <div className={cn(quietPadX, quietPadTop)}>
          <div className={cn(quietContainer, "flex min-h-12 items-center gap-3")}>
            <Suspense fallback={<NavigationBackButton fallbackHref="/" />}>
              <PrivacyPageBackButton />
            </Suspense>
            <BrandMark className="h-10 w-10 shrink-0 lg:h-11 lg:w-11" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className={cn(eyebrowText, "shrink-0")}>{privacyCopy.pageEyebrow}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--warning-text)]">
                  <LiveDot />
                  Quiet<span className="max-sm:hidden"> signal</span>
                </span>
              </div>
              <h1 className="mt-0.5 text-pretty text-base-minus font-semibold tracking-[-0.025em] text-[color:var(--text-heading)] max-sm:leading-snug lg:text-xl">
                {privacyCopy.pageTitle}
              </h1>
            </div>
            <span className="shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
              Draft
            </span>
          </div>
        </div>

        <div className="mt-3 border-y border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]">
          <div className={cn(quietPadX, "py-2.5 lg:py-3")}>
            <div className={cn(quietContainer, "flex items-start gap-3")}>
              <span
                aria-hidden="true"
                className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-[color:var(--warning)]"
              />
              <ShieldAlert className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--warning-text)]">
                  Important
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-[color:var(--text-heading)] lg:text-sm lg:leading-6">
                  {PRIVACY_IMPORTANT_SHORT}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoticeOpen((value) => !value)}
                aria-expanded={noticeOpen}
                aria-controls={noticeId}
                className={cn(
                  "inline-flex min-h-tap shrink-0 items-center gap-1 self-start rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--surface-raised)] px-2.5 text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--warning-bg)]",
                  searchFocusRing,
                )}
              >
                {noticeOpen ? "Less" : "Full"}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-icon-xs transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                    noticeOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
          </div>
          <div
            id={noticeId}
            hidden={!noticeOpen}
            className={cn(
              "border-t border-[color:var(--warning-border)] bg-[color:var(--surface-raised)]",
              quietPadX,
              "py-3 lg:py-3.5",
              "print:block",
            )}
          >
            <div className={quietContainer}>
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-heading)]">
                {PRIVACY_IMPORTANT_FULL}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(quietPadX, "py-4 lg:py-8")}>
        <div className={cn(quietContainer, "grid grid-cols-1 gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)]")}>
          <aside
            className="hidden h-fit rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--shadow-inset)] lg:sticky lg:block"
            style={{ top: stickyChromeHeightPx + 12 }}
          >
            <div className="mb-1.5 flex items-center justify-between px-2.5 pt-1.5">
              <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Signal index
              </p>
              <button
                type="button"
                onClick={() => {
                  setExpandAll((value) => !value);
                  if (expandAll) setOpenId(PRIVACY_SECTIONS[0]?.heading ?? "");
                }}
                className={cn(
                  "min-h-tap rounded-md px-1.5 text-3xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] sm:min-h-8 sm:py-1",
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
                      "relative flex min-h-12 items-center gap-2.5 rounded-xl px-2.5 text-left transition",
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
                          : "bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{section.short}</span>
                      <span className="mt-0.5 block truncate text-3xs leading-3 text-[color:var(--text-soft)]">
                        {section.gist}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-5">
            <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{PRIVACY_DRAFT_DISCLAIMER}</p>
            <ProcessingMap />
            <SectionAccordion
              idPrefix={sectionIdPrefix}
              openId={openId}
              setOpenId={(id) => {
                setExpandAll(false);
                setOpenId(id);
              }}
              expandAll={expandAll}
              sectionRefs={sectionRefs}
              stickyOffsetPx={stickyChromeHeightPx}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
