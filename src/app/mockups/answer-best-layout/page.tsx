import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
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
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)] ${toneClass}`}>
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
    <span className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none ${toneClass}`}>
      {children}
    </span>
  );
}

function SourcePill() {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] px-4 text-sm font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] ${focusRing}`}
    >
      <BookOpen className="h-4 w-4" />
      4 sources
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}

function ActionRow() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[color:var(--text)]">
      <button type="button" className={`inline-flex min-h-9 items-center gap-2 rounded-md px-2 ${focusRing}`}>
        <Copy className="h-4 w-4" />
        Copy with sources
      </button>
      <button type="button" aria-label="More answer actions" className={`grid h-9 w-9 place-items-center rounded-md ${focusRing}`}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

function PanelCard({
  icon,
  title,
  meta,
  children,
  accent = "teal",
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  children?: ReactNode;
  accent?: "teal" | "amber" | "red" | "slate";
}) {
  return (
    <button
      type="button"
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 hover:shadow-[var(--shadow-tight)] ${focusRing}`}
    >
      <IconTile tone={accent}>{icon}</IconTile>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[color:var(--text-heading)]">{title}</span>
        <span className="mt-0.5 block text-sm text-[color:var(--text-muted)]">{meta}</span>
        {children}
      </span>
      <ChevronDown className="-rotate-90 h-5 w-5 text-[color:var(--text-muted)]" />
    </button>
  );
}

function ClinicalTriageSummary() {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <Pill tone="red">
        <ShieldAlert className="h-3.5 w-3.5" />
        1 urgent
      </Pill>
      <Pill tone="amber">
        <AlertTriangle className="h-3.5 w-3.5" />
        2 caution
      </Pill>
      <Pill tone="teal">
        <CheckCircle2 className="h-3.5 w-3.5" />
        3 monitor
      </Pill>
    </div>
  );
}

function SafetyInlineNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <IconTile tone="amber">
          <AlertTriangle className="h-4 w-4" />
        </IconTile>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Safety check needed before applying this.</p>
          <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
            Dose and frequency should be checked against renal function, serum level timing, and local protocol.
          </p>
        </div>
      </div>
    </div>
  );
}

function AnswerContent({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="ml-auto max-w-[15rem] rounded-lg border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] px-4 py-3 text-right shadow-[var(--shadow-inset)]">
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">lithium dose in adults</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">9:14 AM</p>
      </div>

      <section className="space-y-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <IconTile>
            <ShieldCheck className="h-4 w-4" />
          </IconTile>
          <div className="min-w-0">
            <p className="text-base leading-7 text-[color:var(--text-heading)]">
              For lithium, twice daily dosing is usually spaced by 12 hours. In acute mania, guidance commonly targets
              0.8-1.2 mmol/L; dose and frequency should be adjusted to response, serum level timing, renal function,
              and local protocol.
            </p>
            <div className="mt-4">
              <SourcePill />
            </div>
          </div>
        </div>

        <div className="pl-0 sm:pl-[3.25rem]">
          <ActionRow />
        </div>

        <div className="pl-0 sm:pl-[3.25rem]">
          <SafetyInlineNotice />
        </div>

        <div className="grid gap-3 pl-0 sm:pl-[3.25rem]">
          <PanelCard
            icon={<ClipboardCheck className="h-4 w-4" />}
            title="Clinical notes"
            meta="6 notes - source-backed"
          >
            <ClinicalTriageSummary />
          </PanelCard>
          <PanelCard icon={<Layers className="h-4 w-4" />} title="Evidence" meta="4 sources - quotes - source map - gaps" />
        </div>
      </section>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="mx-auto max-w-[24.5rem] overflow-hidden rounded-[2rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[color:var(--border-strong)]" />
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Stethoscope className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
          <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Mode</p>
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">Answer</p>
          </div>
          <Sparkles className="h-5 w-5 text-[color:var(--text-muted)]" />
        </div>
      </div>
      <div className="px-3 py-4">
        <AnswerContent compact />
      </div>
      <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
        <div className="flex min-h-12 items-center gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm text-[color:var(--text)] shadow-[var(--shadow-inset)]">
          <span className="text-lg leading-none text-[color:var(--text-muted)]">+</span>
          <span className="min-w-0 flex-1 truncate">lithium dose in adults</span>
          <ExternalLink className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
        </div>
      </div>
    </div>
  );
}

function DesktopMockup() {
  return (
    <div className="min-h-[48rem] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
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
        <div className="flex items-center gap-2">
          <button type="button" className={`rounded-full border border-[color:var(--border)] px-3 py-2 text-sm font-semibold ${focusRing}`}>
            Scope
          </button>
          <button type="button" className={`rounded-full bg-[color:var(--primary)] px-3 py-2 text-sm font-semibold text-white ${focusRing}`}>
            New chat
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <AnswerContent />
      </div>
    </div>
  );
}

function RecommendationStrip() {
  return (
    <div className="grid gap-3 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] md:grid-cols-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Answer</p>
        <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">Direct clinical text, source pill, and actions only.</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Clinical notes</p>
        <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">Monitoring plus safety triage: urgent, caution, monitor.</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Evidence</p>
        <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">Detailed source audit, quotes, gaps, and governance checks.</p>
      </div>
    </div>
  );
}

export default function AnswerBestLayoutPage() {
  return (
    <main
      data-answer-best-layout
      className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8"
    >
      <style>{`
        body:has([data-answer-best-layout]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <IconTile>
                  <FileText className="h-4 w-4" />
                </IconTile>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Recommended answer layout
                </p>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text-heading)] sm:text-3xl">
                Clean chat, clinical triage, evidence audit
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                This replaces the long inline safety-critical source block with a compact safety review inside Clinical
                notes and keeps detailed source material in Evidence.
              </p>
            </div>
            <RecommendationStrip />
          </div>
        </header>

        <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Mockup</p>
            <h2 className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">Recommended final structure</h2>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
              Phone shows the chat flow only. Desktop shows the same answer layout with more breathing room and the same
              compact cards.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-[25rem_minmax(0,1fr)]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Phone</p>
              <PhoneMockup />
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Desktop</p>
              <DesktopMockup />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
