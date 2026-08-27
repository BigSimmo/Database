"use client";

import {
  ArrowLeft,
  ChevronDown,
  Compass,
  Download,
  ExternalLink,
  FileImage,
  FileSearch,
  FileText,
  ListTree,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

type FrameState = "rest" | "scrolled" | "sheet" | "actions";

const documentTitle = "Clinical practice guideline for schizophrenia";

/**
 * Mirrors the real viewer sections. `collapsible` marks the ones that render as
 * `<details name="document-viewer-section">` — an exclusive accordion, so a jump
 * has to open the target before scrolling to it.
 */
const sections: Array<{ label: string; detail: string; icon: LucideIcon; collapsible: boolean }> = [
  { label: "Overview", detail: "84 pages", icon: Compass, collapsible: false },
  { label: "High-yield summary", detail: "8 points", icon: Sparkles, collapsible: true },
  { label: "PDF preview", detail: "p. 12 / 84", icon: FileText, collapsible: false },
  { label: "Pinned evidence", detail: "27 passages", icon: Quote, collapsible: false },
  { label: "Indexed source text", detail: "312 chunks", icon: FileSearch, collapsible: true },
  { label: "Tables and diagrams", detail: "6 visuals", icon: FileImage, collapsible: true },
  { label: "Indexing details", detail: "v3 · OCR", icon: ShieldCheck, collapsible: true },
];

const activeIndex = 3;
const activeSection = sections[activeIndex];

const frameCopy: Record<FrameState, { label: string; note: string }> = {
  rest: {
    label: "At rest",
    note: "Exactly the header that ships today. The only change is a chevron after the title.",
  },
  scrolled: {
    label: "Scrolled — chrome hidden",
    note: "Both headers hide on the shared signal and leave zero reserve. Nothing floats over the document.",
  },
  sheet: {
    label: "Sections sheet",
    note: "The existing Sheet component. Costs no permanent height and never touches the scroll signal.",
  },
  actions: {
    label: "Actions sheet — second entry",
    note: "Jump to section added above the actions that already live here. Still zero new chrome.",
  },
};

const budget = [
  { label: "Ships today", header: 48, row: 48, extra: 0, tone: "neutral" as const },
  { label: "This proposal", header: 48, row: 48, extra: 0, tone: "good" as const },
  { label: "Fused row (Approach 01)", header: 48, row: 56, extra: 0, tone: "bad" as const },
  { label: "Fused row + status bar", header: 48, row: 48, extra: 44, tone: "bad" as const },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function UniversalHeader() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)]">
        <ListTree aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
        Documents
      </span>
      <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

/**
 * The document header exactly as it ships: back, title, scope, actions — 48 px.
 * The single change is that the title is now a disclosure for the sections sheet.
 */
function DocumentHeader({ expanded, sheetId }: { expanded: boolean; sheetId?: string }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1.5">
      <span className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </span>
      <button
        type="button"
        onClick={() => undefined}
        aria-expanded={expanded}
        aria-controls={sheetId}
        className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left", focusRing)}
      >
        <span className="min-w-0 truncate text-sm-minus font-semibold text-[color:var(--text-heading)]">
          {documentTitle}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]", expanded && "rotate-180")}
        />
      </button>
      <span className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Target aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Plus aria-hidden="true" className="h-5 w-5" />
      </span>
    </div>
  );
}

function SectionRow({ index }: { index: number }) {
  const section = sections[index];
  const selected = index === activeIndex;
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
        focusRing,
        selected
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
        />
      ) : null}
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs font-bold">{section.label}</span>
      <span className="nums shrink-0 text-3xs font-semibold text-[color:var(--text-soft)]">{section.detail}</span>
      {section.collapsible ? (
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
      ) : (
        <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      )}
    </button>
  );
}

function SheetShell({
  id,
  title,
  caption,
  children,
}: {
  id: string;
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 z-10 bg-[color:var(--text-heading)]/35" />
      <div
        id={id}
        role="dialog"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 z-20 max-h-[78%] overflow-y-auto rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 pb-3 pt-2 shadow-[var(--shadow-lux)]"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
        />
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
        <p className="mb-2 mt-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">{caption}</p>
        {children}
      </div>
    </>
  );
}

function SectionsSheet({ id }: { id: string }) {
  return (
    <SheetShell
      id={id}
      title="Jump to section"
      caption={`${activeSection.label} · ${activeIndex + 1} of ${sections.length} — a chevron marks a section that opens first`}
    >
      <ul className="space-y-0.5">
        {sections.map((section, index) => (
          <li key={section.label}>
            <SectionRow index={index} />
          </li>
        ))}
      </ul>
    </SheetShell>
  );
}

function ActionsSheet({ id }: { id: string }) {
  return (
    <SheetShell id={id} title="This document" caption="Jump, search, answer, open, or scope this source.">
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5">
        <p className="px-1.5 pb-1 pt-0.5 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          Jump to section
        </p>
        {[activeIndex, activeIndex + 1].map((index) => (
          <SectionRow key={sections[index].label} index={index} />
        ))}
        <button
          type="button"
          onClick={() => undefined}
          className={cn(
            "flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-3xs font-bold text-[color:var(--clinical-accent)]",
            focusRing,
          )}
        >
          All {sections.length} sections
          <ChevronDown aria-hidden="true" className="h-3 w-3 -rotate-90" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[
          [Search, "Search in document"],
          [Sparkles, "Answer from this"],
          [ExternalLink, "Open original PDF"],
          [Download, "Download PDF"],
        ].map(([Icon, label]) => (
          <span
            key={label as string}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-3xs font-bold text-[color:var(--text)]"
          >
            {(() => {
              const Glyph = Icon as LucideIcon;
              return <Glyph aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" />;
            })()}
            <span className="min-w-0 truncate">{label as string}</span>
          </span>
        ))}
      </div>
    </SheetShell>
  );
}

function Canvas({ offset = false }: { offset?: boolean }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-[color:var(--background)] p-3">
      {offset ? (
        <div className="mb-3 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/35" />
        </div>
      ) : null}
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Quote aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              Source passages
            </p>
            {/* The section heading is already on screen — which is why the chrome
                does not need to repeat it. */}
            <h4 className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{activeSection.label}</h4>
          </div>
        </div>
        <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/55" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/40" />
        </div>
      </section>
      <div className="mt-3 space-y-3">
        {[0, 1, 2].map((block) => (
          <div key={block} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="h-1.5 w-1/2 rounded-full bg-[color:var(--text-heading)]/12" />
            <div className="mt-2.5 space-y-2">
              <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
              <div className="h-1 w-9/12 rounded-full bg-[color:var(--border-strong)]/35" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneFrame({ state }: { state: FrameState }) {
  const sectionsSheetId = useId();
  const actionsSheetId = useId();
  const { label, note } = frameCopy[state];
  const chromeHidden = state === "scrolled";

  return (
    <figure className="m-0 w-[340px] max-w-full min-w-0">
      <figcaption className="mb-2">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{label}</p>
      </figcaption>
      <div
        data-state={state}
        className="relative flex h-[30rem] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        {chromeHidden ? null : (
          <>
            <UniversalHeader />
            <DocumentHeader
              expanded={state === "sheet"}
              // Title disclosure owns only the sections sheet; the actions sheet
              // is a separate surface and must not share this controlled id.
              sheetId={state === "sheet" ? sectionsSheetId : undefined}
            />
          </>
        )}
        <Canvas offset={chromeHidden} />
        {state === "sheet" ? <SectionsSheet id={sectionsSheetId} /> : null}
        {state === "actions" ? <ActionsSheet id={actionsSheetId} /> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{note}</p>
    </figure>
  );
}

function ChromeBudget() {
  const max = Math.max(...budget.map((row) => row.header + row.row + row.extra));

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        Permanent phone chrome
      </p>
      <ul className="mt-3 space-y-3">
        {budget.map((row) => {
          const total = row.header + row.row + row.extra;

          return (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    "text-xs font-bold",
                    row.tone === "good" ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text)]",
                  )}
                >
                  {row.label}
                </span>
                <span className="nums shrink-0 text-3xs font-black text-[color:var(--text-muted)]">{total} px</span>
              </div>
              <div className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[color:var(--surface-inset)]">
                <span
                  aria-hidden="true"
                  style={{ width: `${(row.header / max) * 100}%` }}
                  className="block h-full rounded-l-full bg-[color:var(--border-strong)]/70"
                />
                <span
                  aria-hidden="true"
                  style={{ width: `${(row.row / max) * 100}%` }}
                  className={cn(
                    "block h-full",
                    row.tone === "good"
                      ? "bg-[color:var(--clinical-accent)]"
                      : row.tone === "bad"
                        ? "bg-[color:var(--danger)]/55"
                        : "bg-[color:var(--border-strong)]",
                  )}
                />
                {row.extra ? (
                  <span
                    aria-hidden="true"
                    style={{ width: `${(row.extra / max) * 100}%` }}
                    className="block h-full bg-[color:var(--danger)]/55"
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-5 text-[color:var(--text-muted)]">
        The proposal is byte-for-byte the chrome that ships today. Every earlier direction bought navigation with
        permanent reading height.
      </p>
    </div>
  );
}

export function DocumentPhoneZeroChromeMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Phone navigation, zero new chrome
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Navigation that costs no reading height
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            The title stays in the header row that already ships, and becomes the disclosure for the section list. The
            pane is the bottom sheet the viewer already uses for document actions. No new bar, no second scroll owner,
            no floating control that survives the hide.
          </p>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section aria-labelledby="frames-title">
            <h2 id="frames-title" className="sr-only">
              Phone frames
            </h2>
            <div className="flex flex-wrap items-start gap-5">
              {(["rest", "scrolled", "sheet", "actions"] as FrameState[]).map((state) => (
                <PhoneFrame key={state} state={state} />
              ))}
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <ChromeBudget />
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Why it does not fight the scroll signal
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[color:var(--text-muted)]">
                {[
                  "Nothing new is sticky, so there is nothing new to hide or reveal.",
                  "The trigger is the existing header — it hides with it and returns with it.",
                  "A sheet is not chrome: it opens above the content and leaves no reserve behind.",
                  "The active section is never repeated in the header; the content heading already says it.",
                  "While the header is hidden, navigation waits — exactly as back, scope and actions do today.",
                ].map((point) => (
                  <li key={point} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-[color:var(--clinical-accent)]"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
