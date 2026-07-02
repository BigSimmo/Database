import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Layers,
  ListChecks,
  ShieldCheck,
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
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none ${toneClass}`}>
      {children}
    </span>
  );
}

function ActionButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  const baseClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition ${focusRing} [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`;
  return (
    <button
      type="button"
      className={
        primary
          ? `${baseClass} bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-[var(--shadow-tight)]`
          : `${baseClass} border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)]`
      }
    >
      {children}
    </button>
  );
}

function PageHeader() {
  return (
    <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconTile>
              <Stethoscope className="h-4 w-4" />
            </IconTile>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Final RAG answer structure
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text-heading)] sm:text-3xl">
            Answer, sources, clinical notes, evidence
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            Two polished end-to-end mockups using the final hierarchy: direct answer first, compact provenance, clinical
            action triage, and a separate evidence audit.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Decision rule</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="teal">Documents {">"} Sources</Pill>
            <Pill tone="amber">Actions {">"} Clinical notes</Pill>
            <Pill>Trust {">"} Evidence</Pill>
          </div>
        </div>
      </div>
    </header>
  );
}

function MockupSection({
  title,
  body,
  recommended,
  children,
}: {
  title: string;
  body: string;
  recommended?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">{title}</h2>
          {recommended ? <Pill tone="teal">Recommended</Pill> : null}
        </div>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-[color:var(--text-muted)]">{body}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">{children}</div>
    </section>
  );
}

function UserBubble() {
  return (
    <div className="ml-auto max-w-[15rem] rounded-lg border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] px-4 py-3 text-right shadow-[var(--shadow-inset)]">
      <p className="text-sm font-semibold text-[color:var(--text-heading)]">lithium dose in adults</p>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">9:14 AM</p>
    </div>
  );
}

function SafetyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <IconTile tone="amber">
          <AlertTriangle className="h-4 w-4" />
        </IconTile>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Check toxicity risk before applying.</p>
          <p className={`${compact ? "line-clamp-2" : ""} mt-1 text-sm leading-5 text-[color:var(--text-muted)]`}>
            Escalate if vomiting, diarrhoea, tremor, confusion, ataxia, dehydration, or AKI is present.
          </p>
        </div>
      </div>
    </div>
  );
}

function AnswerBlock({ compact = false }: { compact?: boolean }) {
  return (
    <section className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <IconTile>
        <ShieldCheck className="h-4 w-4" />
      </IconTile>
      <div className="min-w-0 space-y-4">
        <p className={`${compact ? "text-[15px] leading-7" : "text-base leading-7"} text-[color:var(--text-heading)]`}>
          For lithium, twice daily dosing is usually spaced by 12 hours. Target level and dose adjustment depend on
          indication, sample timing, renal function, interacting medicines, and local protocol.
        </p>
        <SafetyBanner compact={compact} />
      </div>
    </section>
  );
}

function SourceRow({ title, page, score }: { title: string; page: string; score: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--clinical-chat-teal)]" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{page} - direct support</p>
      </div>
      <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1 text-xs font-bold text-[color:var(--text-muted)]">
        {score}
      </span>
    </div>
  );
}

function SourcesPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconTile>
            <BookOpen className="h-4 w-4" />
          </IconTile>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Sources</h3>
            <p className="text-xs text-[color:var(--text-muted)]">Top documents and passages</p>
          </div>
        </div>
        <Pill tone="teal">4 sources</Pill>
      </div>
      <div className="grid gap-2">
        <SourceRow title="Lithium Clinical Guideline" page="p.3" score="92%" />
        <SourceRow title="Lithium Therapy Guideline" page="p.5" score="84%" />
        {compact ? null : <SourceRow title="Bipolar disorder in adults" page="p.87" score="76%" />}
      </div>
      <div className="mt-3">
        <ActionButton>
          <ExternalLink />
          Open source
        </ActionButton>
      </div>
    </section>
  );
}

function ClinicalNotesPanel({ compact = false }: { compact?: boolean }) {
  const rows = [
    ["Escalate", "Toxicity symptoms or AKI: urgent review.", "red"],
    ["Caution", "Renal impairment, dehydration, or interacting medicines.", "amber"],
    ["Monitor", "Lithium level timing, renal and thyroid function.", "teal"],
  ] as const;

  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconTile>
            <ClipboardCheck className="h-4 w-4" />
          </IconTile>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical notes</h3>
            <p className="text-xs text-[color:var(--text-muted)]">6 notes - source-backed</p>
          </div>
        </div>
        <Pill tone="amber">Safety triage</Pill>
      </div>
      <div className="grid gap-2">
        {rows.map(([label, body, tone]) => (
          <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={tone === "red" ? "red" : tone === "amber" ? "amber" : "teal"}>{label}</Pill>
              <span className="text-xs font-semibold text-[color:var(--text-soft)]">
                {label === "Monitor" ? "planned" : "review"}
              </span>
            </div>
            <p className={`${compact ? "line-clamp-2" : ""} mt-2 text-sm leading-5 text-[color:var(--text-muted)]`}>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidencePanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconTile>
            <Layers className="h-4 w-4" />
          </IconTile>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence</h3>
            <p className="text-xs text-[color:var(--text-muted)]">Trust and audit check</p>
          </div>
        </div>
        <Pill tone="amber">Partial support</Pill>
      </div>
      <div className="grid gap-2">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Claim map</p>
          <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
            Twice-daily timing and toxicity safety-net map to Sources 1-2.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <p className="text-xs font-bold text-[color:var(--text-soft)]">Quotes</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">2</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-700">Gaps</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">1</p>
          </div>
        </div>
        {compact ? null : (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Governance</p>
            <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
              Source status unknown; verify local validation before clinical reliance.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function DesktopChrome({ children, split = false }: { children: ReactNode; split?: boolean }) {
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
          <ActionButton>Scope</ActionButton>
          <ActionButton primary>New chat</ActionButton>
        </div>
      </header>
      <div className={split ? "grid min-h-[calc(48rem-4rem)] grid-cols-[minmax(0,1fr)_19rem]" : "mx-auto max-w-4xl p-6"}>
        {children}
      </div>
    </div>
  );
}

function PhoneChrome({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-[46rem] max-w-[20.5rem] overflow-hidden rounded-[1.65rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-[color:var(--border-strong)]" />
      <header className="flex h-14 items-center justify-between border-b border-[color:var(--border)] px-4">
        <Stethoscope className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
        <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 py-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Mode</p>
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Answer</p>
        </div>
        <Copy className="h-4 w-4 text-[color:var(--text-muted)]" />
      </header>
      {children}
    </div>
  );
}

function MockupOneDesktop() {
  return (
    <DesktopChrome>
      <div className="space-y-5">
        <UserBubble />
        <AnswerBlock />
        <div className="grid gap-3">
          <SourcesPanel />
          <ClinicalNotesPanel />
          <EvidencePanel />
        </div>
      </div>
    </DesktopChrome>
  );
}

function MockupOnePhone() {
  return (
    <PhoneChrome>
      <div className="space-y-4 p-3">
        <UserBubble />
        <AnswerBlock compact />
        <SourcesPanel compact />
        <ClinicalNotesPanel compact />
        <EvidencePanel compact />
      </div>
    </PhoneChrome>
  );
}

function RightAuditRail() {
  return (
    <aside className="border-l border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Open panel</p>
          <h3 className="mt-1 text-base font-semibold text-[color:var(--text-heading)]">Evidence audit</h3>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
          <Pill tone="amber">Partial support</Pill>
          <p className="mt-3 text-sm leading-5 text-[color:var(--text-muted)]">
            Answer claims are supported, but local source validation is unknown.
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Claim map</p>
          <div className="mt-3 grid gap-2 text-sm">
            <p className="rounded-md bg-[color:var(--surface-subtle)] p-2">Timing {">"} Source 1</p>
            <p className="rounded-md bg-[color:var(--surface-subtle)] p-2">Toxicity {">"} Source 2</p>
            <p className="rounded-md bg-amber-50 p-2 text-amber-800">Gap {">"} validation</p>
          </div>
        </div>
        <ActionButton primary>
          <ListChecks />
          Mark reviewed
        </ActionButton>
      </div>
    </aside>
  );
}

function MockupTwoDesktop() {
  return (
    <DesktopChrome split>
      <main className="space-y-5 p-6">
        <UserBubble />
        <AnswerBlock />
        <div className="grid gap-3">
          <SourcesPanel compact />
          <ClinicalNotesPanel compact />
        </div>
      </main>
      <RightAuditRail />
    </DesktopChrome>
  );
}

function MockupTwoPhone() {
  return (
    <PhoneChrome>
      <div className="space-y-4 p-3">
        <UserBubble />
        <AnswerBlock compact />
        <div className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconTile>
                <BookOpen className="h-4 w-4" />
              </IconTile>
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Sources</h3>
                <p className="text-xs text-[color:var(--text-muted)]">4 sources - direct PDFs</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-[color:var(--text-muted)]" />
          </div>
        </div>
        <ClinicalNotesPanel compact />
        <div className="rounded-t-[1.4rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
          <div className="flex items-center gap-2">
            <IconTile>
              <Layers className="h-4 w-4" />
            </IconTile>
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence</h3>
              <p className="text-xs text-[color:var(--text-muted)]">Partial support - 2 quotes - 1 gap</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Claim map</p>
              <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">Timing and toxicity claims map to Sources 1-2.</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Gap</p>
              <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">Source validation unknown.</p>
            </div>
          </div>
        </div>
      </div>
    </PhoneChrome>
  );
}

export default function FinalRagStructureMockupsPage() {
  return (
    <main
      data-final-rag-structure
      className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8"
    >
      <style>{`
        body:has([data-final-rag-structure]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }

        body:has([data-final-rag-structure]) nextjs-portal,
        body:has([data-final-rag-structure]) [data-nextjs-dialog-overlay],
        body:has([data-final-rag-structure]) [data-nextjs-toast],
        body:has([data-final-rag-structure]) [data-nextjs-dev-overlay] {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader />

        <MockupSection
          title="1. Clean stacked answer"
          body="The most balanced default: chat answer first, then three compact cards in the exact final order. Each card opens a focused sheet or drawer."
          recommended
        >
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">PC</p>
            <MockupOneDesktop />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Small phone</p>
            <MockupOnePhone />
          </div>
        </MockupSection>

        <MockupSection
          title="2. Answer with audit rail"
          body="Best when Evidence is open: desktop keeps the answer readable while the audit sits to the side; phone opens Evidence as a focused bottom sheet."
        >
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">PC</p>
            <MockupTwoDesktop />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Small phone</p>
            <MockupTwoPhone />
          </div>
        </MockupSection>
      </div>
    </main>
  );
}
