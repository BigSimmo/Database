import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Layers,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

function IconTile({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "red" | "slate" }) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-600"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "slate"
          ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
          : "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]";

  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" | "amber" | "red" }) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "teal"
          ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]";

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none ${toneClass}`}
    >
      {children}
    </span>
  );
}

function SourceBadge() {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] px-4 text-sm font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] ${focusRing}`}
    >
      <BookOpen className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">Source-backed · 4 sources</span>
      <ChevronDown className="h-4 w-4 shrink-0" />
    </button>
  );
}

function ActionButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold ${focusRing} ${
        primary
          ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-[var(--shadow-tight)]"
          : "border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)]"
      } [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`}
    >
      {children}
    </button>
  );
}

function EntryCard({
  icon,
  title,
  meta,
  children,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 ${focusRing}`}
    >
      <IconTile>{icon}</IconTile>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[color:var(--text-heading)]">{title}</span>
        <span className="mt-0.5 block text-sm text-[color:var(--text-muted)]">{meta}</span>
        {children}
      </span>
      <ChevronDown className="-rotate-90 h-5 w-5 text-[color:var(--text-muted)]" />
    </button>
  );
}

function AnswerContent({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="ml-auto max-w-[15rem] rounded-lg border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] px-4 py-3 text-right shadow-[var(--shadow-inset)]">
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">lithium dose in adults</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">9:14 AM</p>
      </div>

      <section className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <IconTile>
          <ShieldCheck className="h-4 w-4" />
        </IconTile>
        <div className="min-w-0 space-y-4">
          <p
            className={`${compact ? "text-[15px] leading-7" : "text-base leading-7"} text-[color:var(--text-heading)]`}
          >
            For lithium, twice daily dosing is usually spaced by 12 hours. Dose and target level should be adjusted to
            indication, serum-level timing, renal function, interacting medicines, and local protocol.
          </p>
          <SourceBadge />
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[color:var(--text)]">
            <button type="button" className={`inline-flex min-h-9 items-center gap-2 rounded-md px-2 ${focusRing}`}>
              <Copy className="h-4 w-4" />
              Copy with sources
            </button>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-[var(--shadow-inset)]">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <IconTile tone="amber">
                <AlertTriangle className="h-4 w-4" />
              </IconTile>
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">Urgent safety check</p>
                <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
                  Escalate if toxicity symptoms, dehydration, or AKI are present.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <EntryCard
              icon={<ClipboardCheck className="h-4 w-4" />}
              title="Clinical notes"
              meta="6 notes · 1 escalate · 2 caution · 3 monitor"
            >
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="red">Escalate</Pill>
                <Pill tone="amber">Caution</Pill>
                <Pill tone="teal">Monitor</Pill>
              </div>
            </EntryCard>
            <EntryCard icon={<Layers className="h-4 w-4" />} title="Evidence" meta="Partial support · 2 quotes · 1 gap">
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="amber">Partial</Pill>
                <Pill>Claim map</Pill>
                <Pill>Quotes</Pill>
              </div>
            </EntryCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourcesPopover() {
  return (
    <div className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Sources behind this answer</h3>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">Fast provenance only. Open PDFs here.</p>
        </div>
        <Pill tone="teal">4 sources</Pill>
      </div>
      <div className="grid gap-2">
        {[
          ["Lithium Clinical Guideline", "p.3 · current · 92%"],
          ["Lithium Therapy Guideline", "p.5 · direct · 84%"],
          ["Bipolar disorder in adults", "p.87 · related · 76%"],
        ].map(([title, meta]) => (
          <div
            key={title}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--clinical-chat-teal)]" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
              <span className="block truncate text-xs text-[color:var(--text-muted)]">{meta}</span>
            </span>
            <ExternalLink className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ClinicalNotesSheet() {
  return (
    <div className="rounded-t-[1.5rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconTile>
            <ClipboardCheck className="h-4 w-4" />
          </IconTile>
          <div>
            <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Clinical notes</h3>
            <p className="text-sm text-[color:var(--text-muted)]">Safety is triaged here</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close clinical notes"
          className={`grid h-10 w-10 place-items-center rounded-md border border-[color:var(--border)] ${focusRing}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        <Pill tone="red">Escalate 1</Pill>
        <Pill tone="amber">Caution 2</Pill>
        <Pill tone="teal">Monitor 3</Pill>
      </div>
      <div className="mt-4 grid gap-2">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-700">Escalate</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">
            Possible lithium toxicity or AKI
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-700">Caution</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">
            Renal impairment, dehydration, interacting medicines
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-chat-teal)]">
            Monitor
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">
            Level timing, renal function, thyroid function
          </p>
        </div>
      </div>
    </div>
  );
}

function DesktopMockup() {
  return (
    <div className="min-h-[56rem] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <header className="flex h-16 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-5">
        <div className="flex items-center gap-3">
          <IconTile>
            <Stethoscope className="h-4 w-4" />
          </IconTile>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Clinical KB</p>
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">Answer mode</p>
          </div>
        </div>
        <ActionButton primary>New chat</ActionButton>
      </header>
      <div className="grid min-h-[calc(56rem-4rem)] grid-cols-[minmax(0,1fr)_22rem]">
        <main className="mx-auto w-full max-w-3xl p-6">
          <AnswerContent />
        </main>
        <aside className="border-l border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <SourcesPopover />
          <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Open panel behavior
            </p>
            <p className="mt-2 text-sm leading-5 text-[color:var(--text-muted)]">
              Sources opens as this compact popover/drawer. Clinical notes and Evidence open separately, not as chat
              tabs.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="mx-auto min-h-[58rem] max-w-[21rem] overflow-hidden rounded-[1.7rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-[color:var(--border-strong)]" />
      <header className="flex h-14 items-center justify-between border-b border-[color:var(--border)] px-4">
        <Stethoscope className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
        <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 py-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Mode</p>
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Answer</p>
        </div>
        <Copy className="h-4 w-4 text-[color:var(--text-muted)]" />
      </header>
      <div className="space-y-4 p-3">
        <AnswerContent compact />
        <ClinicalNotesSheet />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <IconTile>
              <ShieldCheck className="h-4 w-4" />
            </IconTile>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Proposed answer layout
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text-heading)] sm:text-3xl">
            Compact sources, focused panels
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            Sources stays as the compact badge under the answer. Clinical notes and Evidence remain inline entry cards;
            detailed content opens in sheets or drawers.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Safety-critical decision
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="amber">Urgent banner</Pill>
            <Pill tone="red">Escalate in notes</Pill>
            <Pill>No standalone section</Pill>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function CompactAnswerEntryPointsPage() {
  return (
    <main
      data-compact-answer-entry-points
      className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8"
    >
      <style>{`
        body:has([data-compact-answer-entry-points]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }

        body:has([data-compact-answer-entry-points]) nextjs-portal,
        body:has([data-compact-answer-entry-points]) [data-nextjs-dialog-overlay],
        body:has([data-compact-answer-entry-points]) [data-nextjs-toast],
        body:has([data-compact-answer-entry-points]) [data-nextjs-dev-overlay] {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader />
        <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">Recommended interaction model</h2>
              <Pill tone="teal">No top-level mobile tabs</Pill>
            </div>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
              The chat stream stays linear and compact. Tabs/segmented controls only appear inside opened sheets, such
              as Clinical notes triage or Evidence audit.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">PC</p>
              <DesktopMockup />
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Small phone
              </p>
              <PhoneMockup />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
