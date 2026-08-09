"use client";

import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronDown,
  Clock,
  Download,
  Ellipsis,
  Link2,
  Menu,
  MessageSquarePlus,
  Pill,
  Printer,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

/**
 * Design scratch: a breadcrumb header for record pages that have no in-page
 * sections.
 *
 * `docs/search-chrome-behaviour.md` makes the DocumentViewer header the default
 * for **in-page navigation** — back control, title + active-section disclosure,
 * ellipsis actions, weighted segment track. Eight pages use
 * `InformationPageBreadcrumbs` instead (factsheets, services, forms, DSM,
 * specifiers, formulation, medications), and they have nothing for that track to
 * measure: there is no section index, so the disclosure opens a sheet listing
 * one thing and the track renders a single full-width segment.
 *
 * What those pages do have is a breadcrumb row followed by a wrapping toolbar.
 * On a 390 px phone the factsheet detail page spends three wrapped rows —
 * roughly 250 px — on crumb, reading-level segment, Save and Download PDF
 * before the first word of content, and none of it is sticky, so the return
 * path scrolls away with it.
 *
 * These three directions keep the document header's row grammar and drop the
 * parts that only make sense when a page has sections.
 */

const parent = { label: "All factsheets", href: "/factsheets/search" };
const pageTitle = "Sertraline";
const pageBrand = "(Zoloft)";

type VariantId = "crumb" | "action" | "mode";
type FrameState = "rest" | "scrolled";
type ReadingLevel = "easy" | "standard";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const sheetActions: Array<{ label: string; detail: string; icon: LucideIcon }> = [
  { label: "Download PDF", detail: "Print-styled patient copy", icon: Download },
  { label: "Save factsheet", detail: "Adds to Favourites", icon: Bookmark },
  { label: "Copy link", detail: "Share with a colleague", icon: Link2 },
  { label: "Print", detail: "Uses the same print stylesheet", icon: Printer },
];

const variants: Array<{
  id: VariantId;
  title: string;
  verdict: string;
  description: string;
  notes: string[];
  fits: string;
}> = [
  {
    id: "crumb",
    title: "Crumb rail",
    verdict: "Leanest · widest reuse",
    description:
      "Identity and return, nothing else. The row is back control, page title, ellipsis — the document header with the section disclosure and the segment track removed rather than left empty. Every page action moves into the actions sheet, so the body carries no toolbar at all.",
    notes: [
      "One 56 px row replaces the crumb row plus the wrapped toolbar: about 190 px back on a 390 px phone.",
      "Title is a `<span>`; the page keeps its `<h1>` in the hero, so there is still exactly one heading.",
      'Back control is icon-only below `sm` and always carries `aria-label="Back to all factsheets"`.',
      "Costs one tap to reach Download PDF — the honest price of the smallest header.",
    ],
    fits: "Forms, DSM criteria, specifiers, formulation — pages whose actions are secondary to reading.",
  },
  {
    id: "action",
    title: "Action rail",
    verdict: "Keeps the primary action in reach",
    description:
      "The same row, with the page's one primary action promoted to a pinned pill: icon-only on a phone, icon and label from `sm`. Everything else stays in the ellipsis sheet. This is what makes the header worth pinning — the action you came for is reachable from any scroll position, not only from the top of the page.",
    notes: [
      "Exactly one promoted action. A second pill is what turned the original toolbar into three rows.",
      "The pill is the same 48 px target as the ellipsis and sits inside the row, not below it.",
      "Sheet keeps the full action list, including the promoted one, so the sheet is never a partial menu.",
      "Promoted action is a page-level prop, not a fixed slot: services promote Refer, factsheets promote Download PDF.",
    ],
    fits: "Factsheets, services, medications — pages with one obvious verb.",
  },
  {
    id: "mode",
    title: "Crumb rail + mode track",
    verdict: "Handles a page-level view mode",
    description:
      "The action rail plus a segmented control on the header's bottom edge, in the exact slot the document header gives `DocumentSectionTrack`. It reads as the same family, but the segments switch how the page renders rather than where you are in it — which is what the factsheet reading level actually is.",
    notes: [
      "Occupies the track slot, so the header stays two conceptual bands, not three stacked rows.",
      "Segments are `aria-pressed` toggles in a labelled group, not tabs — no panel semantics, no roving focus.",
      "Renders only when the page has a mode; otherwise the header is direction 02 exactly.",
      "Active segment uses `--clinical-accent` on the underline, matching the track's active styling.",
    ],
    fits: "Factsheets (Easy read / Standard) and medications (Adult / Paediatric).",
  },
];

/* ---------------- shared chrome ---------------- */

/** Stand-in for the universal phone search header the real header portals under. */
function UniversalPhoneHeader({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center gap-2 bg-[color:var(--surface)] px-3 py-2 transition",
        hidden && "hidden",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Menu className="h-5 w-5" />
      </span>
      <span className="inline-flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-tight)]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)]">
          <BookOpen className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">Factsheets</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
      </span>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--text-muted)]">
        <MessageSquarePlus className="h-4 w-4" />
      </span>
    </div>
  );
}

function BackControl({ showLabel }: { showLabel: boolean }) {
  return (
    <span
      aria-label={`Back to ${parent.label.toLowerCase()}`}
      className={cn(
        "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full pl-1.5 text-sm font-semibold text-[color:var(--text-muted)]",
        showLabel ? "pr-3" : "pr-1.5",
        focusRing,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
      {showLabel ? <span className="whitespace-nowrap">{parent.label}</span> : null}
    </span>
  );
}

function HeaderTitle() {
  return (
    <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-[color:var(--text-heading)]">
      {pageTitle} <span className="font-medium text-[color:var(--text-muted)]">{pageBrand}</span>
    </span>
  );
}

function PrimaryActionPill({ showLabel }: { showLabel: boolean }) {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label={showLabel ? undefined : "Download PDF"}
      title="Download PDF"
      className={cn(
        "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-xl bg-[color:var(--command)] font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)]",
        showLabel ? "px-3 text-sm" : "w-tap justify-center px-0",
        focusRing,
      )}
    >
      <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
      {showLabel ? "Download PDF" : null}
    </button>
  );
}

function ActionsTrigger() {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label="Open factsheet actions"
      aria-haspopup="dialog"
      className={cn(
        "grid h-tap w-tap shrink-0 place-items-center rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]",
        focusRing,
      )}
    >
      <Ellipsis aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
    </button>
  );
}

function ModeTrack({ level }: { level: ReadingLevel }) {
  return (
    <div
      role="group"
      aria-label="Reading level"
      className="-mx-3 mt-1.5 flex items-stretch gap-0 border-t border-[color:var(--border)] px-3"
    >
      {(
        [
          ["easy", "Easy read"],
          ["standard", "Standard"],
        ] as const
      ).map(([value, label]) => {
        const active = value === level;
        return (
          <button
            key={value}
            type="button"
            onClick={() => undefined}
            aria-pressed={active}
            className={cn(
              "relative min-h-11 flex-1 text-xs font-bold transition",
              active ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            {label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full",
                active ? "bg-[color:var(--clinical-accent)]" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- the three headers ---------------- */

function BreadcrumbHeader({
  variant,
  wide = false,
  level = "easy",
}: {
  variant: VariantId;
  /** `true` renders the `sm+` shape: visible ancestor label and action labels. */
  wide?: boolean;
  level?: ReadingLevel;
}) {
  return (
    <header
      data-variant={variant}
      className={cn(
        "relative z-30 shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2",
        wide && "px-6",
      )}
    >
      <div className="flex min-h-12 min-w-0 items-center gap-2">
        <BackControl showLabel={wide} />
        <HeaderTitle />
        {variant === "crumb" ? null : <PrimaryActionPill showLabel={wide} />}
        <ActionsTrigger />
      </div>
      {variant === "mode" ? <ModeTrack level={level} /> : null}
    </header>
  );
}

/* ---------------- page body under the header ---------------- */

function HeroCard() {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)] p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--surface)] text-[color:var(--clinical-accent)]">
          <Pill aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-3xs font-black uppercase tracking-label text-[color:var(--clinical-accent)]">
            Medications
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--text-muted)]">
            <Clock aria-hidden="true" className="h-3 w-3" />
            Updated Jul 2026 · 6 min read
          </p>
        </div>
      </div>
      <h1 className="mt-3 text-xl font-bold leading-tight tracking-[-0.03em] text-[color:var(--text-heading)]">
        {pageTitle} <span className="font-medium text-[color:var(--text-muted)]">{pageBrand}</span>
      </h1>
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">
        A commonly used SSRI for depression and anxiety — how it works, how to take it, and what to expect.
      </p>
    </div>
  );
}

function GlanceCard() {
  return (
    <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3.5">
      <p className="text-3xs font-black uppercase tracking-label text-[color:var(--clinical-accent)]">At a glance</p>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
        {[
          ["Drug class", "SSRI antidepressant"],
          ["Common brand", "Zoloft"],
          ["Usual dose", "50–200 mg daily"],
          ["Takes effect", "2–6 weeks"],
        ].map(([term, detail]) => (
          <div key={term} className="min-w-0">
            <dt className="text-3xs text-[color:var(--text-muted)]">{term}</dt>
            <dd className="mt-0.5 truncate text-xs font-bold text-[color:var(--text-heading)]">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ProseBlock({ heading }: { heading: string }) {
  return (
    <section className="mt-4">
      <h2 className="text-base font-bold tracking-[-0.02em] text-[color:var(--text-heading)]">{heading}</h2>
      <div className="mt-2.5 space-y-2">
        {[1, 0.92, 0.97, 0.7].map((width, index) => (
          <div
            key={index}
            style={{ width: `${width * 100}%` }}
            className="h-1.5 rounded-full bg-[color:var(--border-strong)]/35"
          />
        ))}
      </div>
    </section>
  );
}

function PageBody({ scrolled }: { scrolled: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)] px-3 py-3">
      {scrolled ? (
        <>
          <ProseBlock heading="What is sertraline?" />
          <ProseBlock heading="How to take it" />
          <ProseBlock heading="Side effects" />
        </>
      ) : (
        <>
          <HeroCard />
          <GlanceCard />
          <ProseBlock heading="What is sertraline?" />
        </>
      )}
    </div>
  );
}

/* ---------------- the toolbar being replaced ---------------- */

function TodayHeader() {
  return (
    <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
      <div className="flex min-h-tap items-center gap-1.5 text-xs font-semibold text-[color:var(--text-muted)]">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        <span>{parent.label}</span>
        <span aria-hidden="true" className="text-[color:var(--text-soft)]">
          ›
        </span>
        <span className="truncate font-bold text-[color:var(--text-heading)]">{pageTitle}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1">
          <span className="inline-flex min-h-8 items-center rounded-md bg-[color:var(--surface)] px-2.5 text-xs font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-tight)]">
            Easy read
          </span>
          <span className="inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-bold text-[color:var(--text-muted)]">
            Standard
          </span>
        </span>
        <span className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)]">
          <Bookmark aria-hidden="true" className="h-4 w-4" />
          Save
        </span>
        <span className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]">
          <Download aria-hidden="true" className="h-4 w-4" />
          Download PDF
        </span>
      </div>
    </div>
  );
}

/* ---------------- frames ---------------- */

const stateCopy: Record<FrameState, string> = {
  rest: "At rest · page top",
  scrolled: "Scrolled · chrome revealed",
};

function PhoneFrame({
  children,
  caption,
  tone = "quiet",
}: {
  children: React.ReactNode;
  caption: string;
  tone?: "quiet" | "warn";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "mb-2 text-3xs font-black uppercase tracking-[0.12em]",
          tone === "warn" ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-soft)]",
        )}
      >
        {caption}
      </p>
      <div className="relative flex h-[26rem] w-[320px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </div>
  );
}

function VariantFrame({ variant, state }: { variant: VariantId; state: FrameState }) {
  return (
    <PhoneFrame caption={stateCopy[state]}>
      <UniversalPhoneHeader />
      <BreadcrumbHeader variant={variant} level={state === "scrolled" ? "standard" : "easy"} />
      <PageBody scrolled={state === "scrolled"} />
    </PhoneFrame>
  );
}

function ActionsSheetPreview() {
  return (
    <div className="w-[320px] max-w-full rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[color:var(--text-heading)]">This factsheet</p>
        <span className="text-3xs font-semibold text-[color:var(--text-soft)]">Shared `Sheet`</span>
      </div>
      <p className="mt-0.5 text-3xs text-[color:var(--text-muted)]">Sertraline · updated Jul 2026</p>
      <ul className="mt-2.5 space-y-1">
        {sheetActions.map(({ label, detail, icon: Icon }) => (
          <li key={label}>
            <span className="flex min-h-tap items-center gap-2.5 rounded-lg px-2 text-left">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">{label}</span>
                <span className="block truncate text-3xs text-[color:var(--text-muted)]">{detail}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariantShowcase({ variant, number }: { variant: (typeof variants)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${variant.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Direction {String(number).padStart(2, "0")} · {variant.verdict}
          </p>
          <h2
            id={`${variant.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {variant.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {variant.description}
        </p>
      </div>

      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {variant.notes.map((note) => (
          <li
            key={note}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
          >
            {note}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-start gap-4">
        <VariantFrame variant={variant.id} state="rest" />
        <VariantFrame variant={variant.id} state="scrolled" />
        <div className="min-w-0">
          <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            `sm+` · sticky, labels visible
          </p>
          <div className="w-[420px] max-w-full overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
            <BreadcrumbHeader variant={variant.id} wide />
            <div className="bg-[color:var(--background)] px-4 py-3">
              <ProseBlock heading="What is sertraline?" />
            </div>
          </div>
          <p className="mt-2 max-w-[420px] text-3xs leading-5 text-[color:var(--text-soft)]">{variant.fits}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- page ---------------- */

export function BreadcrumbHeaderMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Record pages · Breadcrumb header
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            A sticky header for pages that have no sections
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            `InPageNavHeader` is the repository default for in-page navigation, and it is the wrong shape for the eight
            pages that use `InformationPageBreadcrumbs`: they have no section index, so its disclosure opens a sheet
            listing one item and its weighted track renders one full-width segment. These three directions keep that
            header&rsquo;s row grammar — back, title, ellipsis, one owner for scroll — and replace the section machinery
            with what breadcrumb pages actually carry: a return path and a small set of page actions.
          </p>
          <dl className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              [
                "Scroll ownership",
                "Below `sm` the header portals into `#phone-header-collapse-addon-slot` and hides with the universal chrome. No second scroll-hide hook, ever.",
              ],
              [
                "Sticky at `sm+`",
                "`sticky top-0`, `z-30`, opaque `--surface`, `border-b` — the same pinning the document header uses.",
              ],
              [
                "One heading",
                "The header title is a `<span>`; the page keeps its `<h1>` in the hero, so nothing gains a second `<h1>`.",
              ],
            ].map(([term, detail]) => (
              <div
                key={term}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
              >
                <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  {term}
                </dt>
                <dd className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{detail}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="mt-9 border-t border-[color:var(--border)] pt-8" aria-labelledby="today-title">
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
            Today · what is being replaced
          </p>
          <h2
            id="today-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            Crumb row, then a toolbar that wraps
          </h2>
          <div className="mt-5 flex flex-wrap items-start gap-4">
            <PhoneFrame caption="Factsheet detail · 390 px" tone="warn">
              <UniversalPhoneHeader />
              <TodayHeader />
              <PageBody scrolled={false} />
            </PhoneFrame>
            <ul className="grid max-w-md gap-2">
              {[
                "Three rows of chrome before the first line of content, and the toolbar wraps differently per page depending on how many actions it has.",
                "Nothing is sticky: scroll to the side-effects section and the way back to the factsheet list is gone.",
                "The reading-level segment is a view mode, but it sits in the row reserved for verbs, so it reads as a third action.",
                "Save and Download PDF are full-width-ish pills competing with each other; neither is clearly primary.",
              ].map((problem) => (
                <li
                  key={problem}
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
                >
                  {problem}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-10 space-y-12">
          {variants.map((variant, index) => (
            <VariantShowcase key={variant.id} variant={variant} number={index + 1} />
          ))}
        </div>

        <section className="mt-12 border-t border-[color:var(--border)] pt-8" aria-labelledby="sheet-title">
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Shared by all three
          </p>
          <h2
            id="sheet-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            The actions sheet is the whole toolbar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
            The ellipsis opens the same `Sheet` the document header uses, listing every page action including any
            promoted one. A page with no actions renders no ellipsis at all rather than a control that opens an empty
            sheet — the behaviour `InPageNavHeader` already has.
          </p>
          <div className="mt-5">
            <ActionsSheetPreview />
          </div>
        </section>
      </div>
    </main>
  );
}
