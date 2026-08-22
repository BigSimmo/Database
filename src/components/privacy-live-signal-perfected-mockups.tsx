"use client";

import { ArrowLeft, ChevronDown, ShieldAlert } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cn, eyebrowText } from "@/components/ui-primitives";

/** Nearest overflow-y scroller (the device frame), not the document. */
function findScrollContainer(start: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start?.parentElement ?? null;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Scroll a target into a local container only — `scrollIntoView` would yank every
 * scrollable ancestor, including the mockup review page (see phone-mode-sheet-yes).
 * Prefer the live sticky chrome height (Important expanded/collapsed) over a fixed
 * scroll-margin, falling back to the target's computed `scroll-margin-top`.
 */
function scrollContainerToTarget(container: HTMLElement, target: HTMLElement, stickyChrome: HTMLElement | null) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const chromeHeight =
    stickyChrome?.getBoundingClientRect().height ?? (Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
  container.scrollTop += targetRect.top - containerRect.top - chromeHeight;
}

/**
 * Live Signal — style polish pass (direction 03).
 *
 * Craft goals vs prior perfected frame:
 * - Important is full-bleed under sticky chrome (true fused signal, not an inset card)
 * - Phone jump chips live inside the sticky stack so navigation never scrolls away
 * - Desktop defaults to one open section (signal, not a wall of text)
 * - Collapsed rows keep scannable gists; expanded rows get a soft accent wash + spine
 * - Region strip is a quiet instrument with a single eyebrow, not three loud chips
 *
 * Governance headings + bodies match production (`tests/privacy-ui.test.ts`).
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const DRAFT =
  "This is draft product information based on the repository's configured behaviour. It is not legal advice, a final privacy policy, or an assertion of governance approval.";

const IMPORTANT_SHORT =
  "Do not enter identifiable patient details. Processing may include Singapore and the OpenAI API.";

const IMPORTANT_FULL =
  "Do not enter identifiable patient details such as names, dates of birth, or record numbers. Requests are processed by the application service in Singapore. With external provider mode configured, question text may be sent to the OpenAI API for retrieval embedding even when the final response is source-only; model-backed answer synthesis also sends the question and selected evidence.";

type Section = {
  heading: string;
  short: string;
  gist: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    heading: "What this tool is",
    short: "Tool",
    gist: "Clinical reference KB — not a patient-record system",
    body: "Clinical KB is a knowledge base over clinical reference material. It is not a patient-record system and its provider-backed features do not ask for patient identifiers. The Safety Plan Generator accepts sensitive working content and support contacts but deliberately omits a patient-identifier field.",
  },
  {
    heading: "What is collected",
    short: "Collected",
    gist: "Questions, docs, telemetry — safety-plan work stays in-tab",
    body: "Questions, generated answers, account identifiers, administrator-provided documents, retrieved excerpts, document metadata, and operational or retrieval telemetry may be processed. Free text and source material can contain sensitive information. Safety-plan working content is different: it remains in the current browser tab and is not sent to the application service or stored by Clinical KB.",
  },
  {
    heading: "How questions are handled",
    short: "Questions",
    gist: "Hashed query logs · answers omitted · short cache TTL",
    body: "Raw question text is not written to query logs by default; logs use a keyed one-way hash. Generated answer text is also omitted from durable query logs by default. A short-lived response cache can contain the answer while its read TTL is valid.",
  },
  {
    heading: "Where data is stored and processed",
    short: "Regions",
    gist: "Sydney storage · Singapore app + worker",
    body: "Documents, extracted evidence, metadata, account records, and owner-scoped operational records are stored in the configured Supabase project in Sydney. The production application and ingestion worker currently run on Railway in Singapore, so questions, retrieved evidence, answers, and ingestion material are processed in or transit through Singapore. File buckets are private and links are time-limited. The operator must verify deployed regions and contractual controls.",
  },
  {
    heading: "External provider processing",
    short: "Providers",
    gist: "OpenAI embedding / synthesis may leave Australia",
    body: "When external provider mode is configured, question text may be sent to the OpenAI API to create a retrieval embedding, including when the final response is source-only. When model-backed answer synthesis is used, the question and selected source excerpts are also sent. This processing may occur outside Australia. The operator must verify provider regions, retention terms, contracts, and cross-border obligations.",
  },
  {
    heading: "Retention",
    short: "Retention",
    gist: "30-day queries · 90-day logs · hourly cache purge",
    body: "Repository migrations configure 30-day retention for RAG query records, 90-day retention for retrieval logs and query-miss telemetry, and a bounded hourly purge of expired response-cache rows when the database scheduler is available. The operator must verify that those scheduled jobs are active. Administrator-provided documents remain until removed under the applicable process. Safety-plan working content has no Clinical KB retention: it is discarded when the component is cleared or the tab is closed. Clipboard, print, and PDF copies are outside the app and must follow the organisation's approved record-handling process.",
  },
  {
    heading: "Your responsibilities",
    short: "You",
    gist: "No identifiers · verify sources · report issues",
    body: "Do not enter patient-identifiable information. In the Safety Plan Generator, add any patient identifier only after export through your organisation's approved clinical-record process. Documents are added only through the administrator backend; administrators must use authorised material. Keep access credentials private, review original linked sources before relying on clinical output, and report suspected privacy or access issues through your organisation's approved process.",
  },
];

const atmosphere =
  "bg-[radial-gradient(ellipse_at_8%_-8%,color-mix(in_srgb,var(--warning-bg)_78%,transparent),transparent_34%),radial-gradient(ellipse_at_92%_4%,color-mix(in_srgb,var(--clinical-accent-soft)_48%,transparent),transparent_42%),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_55%,transparent),transparent_18rem),var(--background)]";

function BrandMark({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[0.7rem] bg-[color:var(--text-heading)] font-black tracking-[-0.06em] text-[color:var(--surface)] shadow-[var(--shadow-inset)]",
        size === "sm" ? "h-10 w-10 text-2xs" : "h-11 w-11 text-xs",
      )}
    >
      KB
    </span>
  );
}

function BackControl() {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label="Go back"
      className={cn(
        "inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition duration-[var(--duration-fast)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] active:translate-y-px",
        focusRing,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

function StatusBar() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-11 shrink-0 items-end justify-between px-5 pb-1.5 text-3xs font-semibold tabular-nums text-[color:var(--text-heading)]"
    >
      <span>9:41</span>
      <span className="absolute left-1/2 top-2 h-7 w-28 -translate-x-1/2 rounded-full bg-[color:var(--text-heading)]" />
      <span className="tracking-tight">■■■ ▮</span>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--warning)] opacity-45 motion-reduce:animate-none" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--warning)]" />
    </span>
  );
}

function RegionTicker({ compact = false }: { compact?: boolean }) {
  const cells = [
    { place: "Sydney", role: "Supabase storage", tone: "accent" as const },
    { place: "Singapore", role: "App + worker", tone: "neutral" as const },
    { place: "External", role: "OpenAI API", tone: "warn" as const },
  ];

  return (
    <section aria-label="Where processing happens" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          Processing map
        </p>
        {!compact ? (
          <p className="text-3xs font-medium text-[color:var(--text-soft)]">Operator must verify regions</p>
        ) : null}
      </div>
      {compact ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cells.map((cell) => (
            <span
              key={cell.place}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-2xs font-semibold",
                cell.tone === "accent" &&
                  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
                cell.tone === "warn" &&
                  "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]",
                cell.tone === "neutral" &&
                  "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
              )}
            >
              <span className="font-extrabold uppercase tracking-[0.08em]">{cell.place}</span>
              <span className="opacity-40">·</span>
              <span>{cell.role}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
          {cells.map((cell, index) => (
            <div
              key={cell.place}
              className={cn("min-w-0 px-4 py-3.5", index > 0 && "border-l border-[color:var(--border)]")}
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
              <p className="mt-1 truncate text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-heading)]">
                {cell.role}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StickySignalChrome({
  phone,
  noticeOpen,
  onToggleNotice,
  noticePanelId,
  openId,
  onSelectSection,
  chromeRef,
}: {
  phone: boolean;
  noticeOpen: boolean;
  onToggleNotice: () => void;
  noticePanelId: string;
  openId: string;
  onSelectSection: (heading: string) => void;
  chromeRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={chromeRef}
      className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)]/95 shadow-[var(--e1)] backdrop-blur-xl"
    >
      <div className={cn(phone ? "px-3 pt-3" : "px-8 pt-5")}>
        <div className={cn("flex min-h-12 items-center gap-3", !phone && "mx-auto max-w-[80rem]")}>
          <BackControl />
          <BrandMark size={phone ? "sm" : "md"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={eyebrowText}>Privacy</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--warning-text)]">
                <LiveDot />
                Live signal
              </span>
            </div>
            <h1
              className={cn(
                "font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]",
                phone ? "truncate text-base-minus" : "text-xl",
              )}
            >
              Privacy & data handling
            </h1>
          </div>
          <span className="shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
            Draft
          </span>
        </div>
      </div>

      {/* Full-bleed fused obligation — no side inset, reads as chrome not a card */}
      <div className="mt-3 border-y border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]">
        <div className={cn("flex items-start gap-3", phone ? "px-3 py-2.5" : "mx-auto max-w-[80rem] px-8 py-3")}>
          <span
            aria-hidden="true"
            className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-[color:var(--warning)]"
          />
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--warning-text)]">
              Important
            </p>
            <p
              className={cn(
                "mt-0.5 font-semibold text-[color:var(--text-heading)]",
                phone ? "text-xs leading-5" : "text-sm leading-6",
              )}
            >
              {IMPORTANT_SHORT}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleNotice}
            aria-expanded={noticeOpen}
            aria-controls={noticePanelId}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1 self-start rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--surface-raised)] px-2.5 text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--warning-bg)]",
              focusRing,
            )}
          >
            {noticeOpen ? "Less" : "Full"}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                noticeOpen && "rotate-180",
              )}
            />
          </button>
        </div>
        {/* Keep mounted (hidden) so aria-controls IDREF stays valid when collapsed. */}
        <div
          id={noticePanelId}
          hidden={!noticeOpen}
          className={cn(
            "border-t border-[color:var(--warning-border)] bg-[color:var(--surface-raised)]",
            phone ? "px-3 py-3" : "mx-auto max-w-[80rem] px-8 py-3.5",
          )}
        >
          <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-heading)]">{IMPORTANT_FULL}</p>
        </div>
      </div>

      {phone ? (
        <div className="border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((section, index) => {
              const active = openId === section.heading;
              return (
                <button
                  key={section.heading}
                  type="button"
                  onClick={() => onSelectSection(section.heading)}
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-2xs font-semibold transition",
                    focusRing,
                    active
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                  )}
                >
                  <span className="nums opacity-70">{String(index + 1).padStart(2, "0")}</span>
                  {section.short}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionAccordion({
  phone,
  openId,
  setOpenId,
  expandAll,
  sectionRefs,
  idPrefix,
}: {
  phone: boolean;
  openId: string;
  setOpenId: (id: string) => void;
  expandAll: boolean;
  sectionRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  idPrefix: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
      {SECTIONS.map((section, index) => {
        const expanded = expandAll || openId === section.heading;
        // Prefix with per-frame useId() so desktop + phone comps on one page never collide.
        const panelId = `${idPrefix}-section-${index}`;
        return (
          <div
            key={section.heading}
            ref={(node) => {
              sectionRefs.current[section.heading] = node;
            }}
            className={cn(
              // Clear sticky chrome (header + Important [+ phone chips]) when jump-scrolling.
              phone ? "scroll-mt-[12.5rem]" : "scroll-mt-[10.5rem]",
              index > 0 && "border-t border-[color:var(--border)]",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(expanded && !expandAll ? "" : section.heading)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className={cn(
                "group relative flex w-full items-start gap-3 py-3.5 text-left transition duration-[var(--duration-fast)] hover:bg-[color:var(--surface-subtle)]",
                focusRing,
                phone ? "min-h-14 px-3.5" : "min-h-[4.25rem] px-5",
                expanded && "bg-[color:var(--clinical-accent-soft)]/45",
              )}
            >
              {expanded ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
                />
              ) : null}
              <span
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
                <span
                  className={cn(
                    "block font-semibold tracking-[-0.015em] text-[color:var(--text-heading)]",
                    phone ? "text-sm" : "text-base-minus",
                  )}
                >
                  {section.heading}
                </span>
                {!expanded ? (
                  <span
                    className={cn(
                      "mt-1 block text-[color:var(--text-muted)]",
                      phone ? "text-2xs leading-4" : "text-xs leading-5",
                    )}
                  >
                    {section.gist}
                  </span>
                ) : (
                  <span className="mt-1 block text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                    Open
                  </span>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "mt-1.5 h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                  expanded && "rotate-180 text-[color:var(--clinical-accent)]",
                )}
              />
            </button>
            <div
              id={panelId}
              hidden={!expanded}
              className={cn(
                "border-t border-[color:var(--clinical-accent-border)]/60 bg-[color:var(--surface-wash)]",
                phone ? "px-3.5 py-3.5" : "px-5 py-4 pl-[3.75rem]",
              )}
            >
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LiveSignalPerfectedFrame({ phone = false }: { phone?: boolean }) {
  const noticeId = useId();
  const sectionIdPrefix = useId();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stickyChromeRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollHeading = useRef<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [openId, setOpenId] = useState(SECTIONS[0]?.heading ?? "");
  const [expandAll, setExpandAll] = useState(false);
  // Desktop index sticky offset must track live chrome height (Important open / text zoom).
  const [stickyChromeHeightPx, setStickyChromeHeightPx] = useState<number | null>(null);

  useEffect(() => {
    const el = stickyChromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      setStickyChromeHeightPx(el.getBoundingClientRect().height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [noticeOpen, phone]);

  const scrollSectionIntoView = (heading: string) => {
    const target = sectionRefs.current[heading];
    if (!target) return;
    const container = findScrollContainer(target);
    if (!container) return;
    scrollContainerToTarget(container, target, stickyChromeRef.current);
  };

  const selectSection = (heading: string) => {
    // Re-tapping the active row leaves openId/expandAll unchanged, so the layout
    // effect would not run — scroll immediately in that no-op state path.
    if (!expandAll && openId === heading) {
      pendingScrollHeading.current = null;
      scrollSectionIntoView(heading);
      return;
    }
    pendingScrollHeading.current = heading;
    setExpandAll(false);
    setOpenId(heading);
  };

  // Scroll after React commits so collapsing the previous panel (or leaving expand-all)
  // has already shifted layout; synchronous scrollIntoView measured the stale heights.
  useLayoutEffect(() => {
    const heading = pendingScrollHeading.current;
    if (!heading || openId !== heading || expandAll) return;
    pendingScrollHeading.current = null;
    scrollSectionIntoView(heading);
  }, [openId, expandAll]);

  return (
    <div className={cn("min-h-full", atmosphere)}>
      <StickySignalChrome
        phone={phone}
        noticeOpen={noticeOpen}
        onToggleNotice={() => setNoticeOpen((value) => !value)}
        noticePanelId={noticeId}
        openId={openId}
        onSelectSection={selectSection}
        chromeRef={stickyChromeRef}
      />

      <div
        className={cn(
          phone
            ? "space-y-4 px-3 py-4"
            : // Frame-width layout (not viewport sm:/lg:) so the desktop comp keeps its index rail
              // even when the reviewer window is narrow.
              "mx-auto grid max-w-[80rem] grid-cols-[16.5rem_minmax(0,1fr)] gap-8 px-8 py-8",
        )}
      >
        {!phone ? (
          <aside
            className="sticky h-fit rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--shadow-inset)]"
            style={{
              top: stickyChromeHeightPx != null ? `${stickyChromeHeightPx}px` : "13.5rem",
            }}
          >
            <div className="mb-1.5 flex items-center justify-between px-2.5 pt-1.5">
              <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Signal index
              </p>
              <button
                type="button"
                onClick={() => {
                  // Read expandAll before the queued toggle so on→off can reset openId in the
                  // same tick (keeps one row open); off→on skips the reset so every row expands.
                  setExpandAll((value) => !value);
                  if (expandAll) setOpenId(SECTIONS[0]?.heading ?? "");
                }}
                className={cn(
                  "rounded-md px-1.5 py-1 text-3xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
                  focusRing,
                )}
              >
                {expandAll ? "Collapse" : "Expand all"}
              </button>
            </div>
            <nav aria-label="Privacy sections" className="grid gap-0.5">
              {SECTIONS.map((section, index) => {
                const active = !expandAll && openId === section.heading;
                return (
                  <button
                    key={section.heading}
                    type="button"
                    onClick={() => selectSection(section.heading)}
                    className={cn(
                      "relative flex min-h-12 items-center gap-2.5 rounded-xl px-2.5 text-left transition",
                      focusRing,
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
        ) : null}

        <div className="min-w-0 space-y-5">
          <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p>
          <RegionTicker compact={phone} />
          <SectionAccordion
            phone={phone}
            idPrefix={sectionIdPrefix}
            openId={openId}
            setOpenId={(id) => {
              setExpandAll(false);
              setOpenId(id);
            }}
            expandAll={!phone && expandAll}
            sectionRefs={sectionRefs}
          />
        </div>
      </div>
    </div>
  );
}

function DeviceChrome({
  label,
  widthLabel,
  phone = false,
  children,
}: {
  label: string;
  widthLabel: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[24rem]")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{widthLabel}</span>
      </div>
      <div
        className={cn(
          "overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]",
          phone ? "rounded-[1.85rem]" : "rounded-2xl",
        )}
      >
        {phone ? <StatusBar /> : null}
        <div className="h-[50rem] overflow-y-auto overscroll-contain">
          {/*
            Section jump clearance lives only on each section's scroll-mt-*.
            Do not also set scroll-pt here — scrollIntoView / margin-aware
            container scroll would compound the two and land mid-frame.
          */}
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyLiveSignalPerfectedMockups() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Privacy · Live Signal · style polish
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Live Signal — perfected
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Full-bleed sticky Important, phone jump chips locked into the sticky stack, one-open desktop default with
            index gists, and quieter processing map. Same governance wording. Amber only for the obligation.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {[
              "Full-bleed sticky signal",
              "Chips never scroll away",
              "Index shows gists",
              "One section open by default",
              "Safe-area back control",
            ].map((item) => (
              <li
                key={item}
                className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 py-1 text-3xs font-extrabold text-[color:var(--clinical-accent)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-6 bg-[color:var(--surface-wash)] px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:px-8">
        <DeviceChrome label="Desktop" widthLabel="1440 × 900">
          <LiveSignalPerfectedFrame />
        </DeviceChrome>
        <DeviceChrome label="Phone" widthLabel="390 × 844" phone>
          <LiveSignalPerfectedFrame phone />
        </DeviceChrome>
      </div>
    </main>
  );
}
