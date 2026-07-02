import {
  Activity,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileSearch,
  Layers3,
  ListChecks,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Table2,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "neutral" | "teal" | "amber" | "red" | "blue";
type NoteTone = "monitor" | "caution" | "escalate";

const answerText =
  "Lithium dosing should be guided by serum levels, tolerability, renal function, interacting medicines, and documented clinical response. Use lower or slower dosing when renal risk or toxicity risk is present.";

const sources = [
  {
    title: "Lithium Therapy - Initiation and Continuation Guideline",
    meta: "p. 4 - Current - Local",
    score: "100%",
    tag: "Primary",
  },
  {
    title: "Lithium monitoring and renal function guidance",
    meta: "p. 2 - Current - Local",
    score: "92%",
    tag: "Monitoring",
  },
  {
    title: "Medication review and toxicity safety-net",
    meta: "p. 8 - Review due",
    score: "84%",
    tag: "Safety",
  },
] as const;

const notes: Array<{ tone: NoteTone; title: string; detail: string; source: string; action: string }> = [
  {
    tone: "monitor",
    title: "Lithium level timing",
    detail: "Check serum levels after dose changes and once stable.",
    source: "Source 1",
    action: "Time level",
  },
  {
    tone: "caution",
    title: "Renal function",
    detail: "Reduce dose or increase review frequency when renal impairment or dehydration risk is present.",
    source: "Source 2",
    action: "Review dose",
  },
  {
    tone: "escalate",
    title: "Toxicity triggers",
    detail: "Vomiting, diarrhoea, tremor, confusion, ataxia, or acute kidney injury should prompt urgent review.",
    source: "Source 3",
    action: "Escalate",
  },
] as const;

const evidenceRows = [
  ["Dose adjustment", "Direct", "2 citations", "Lithium guideline"],
  ["Level timing", "Direct", "3 citations", "Monitoring guidance"],
  ["Renal caution", "Moderate", "1 citation", "Renal function section"],
] as const;

const toneClass: Record<Tone, string> = {
  neutral: "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)]",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
};

const noteTone: Record<NoteTone, { label: string; icon: typeof ShieldCheck; tone: Tone; dot: string; panel: string }> =
  {
    monitor: {
      label: "Monitor",
      icon: Activity,
      tone: "teal",
      dot: "bg-teal-600",
      panel: "border-teal-200 bg-teal-50/55",
    },
    caution: {
      label: "Caution",
      icon: AlertTriangle,
      tone: "amber",
      dot: "bg-amber-500",
      panel: "border-amber-200 bg-amber-50/60",
    },
    escalate: {
      label: "Escalate",
      icon: ShieldAlert,
      tone: "red",
      dot: "bg-red-600",
      panel: "border-red-200 bg-red-50/65",
    },
  };

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

function Pill({
  icon: Icon,
  tone = "neutral",
  children,
}: {
  icon?: typeof ShieldCheck;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${toneClass[tone]}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  children,
  primary = false,
}: {
  icon: typeof ShieldCheck;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold",
        primary
          ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)]"
          : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-heading)]",
        focus,
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function PageIntro() {
  return (
    <header className="mb-7 max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--clinical-chat-teal)]">
        Responsive RAG answer system
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
        Best design for answer, sources, notes, safety, and evidence
      </h1>
      <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
        Each surface has two completed mockups: a mobile treatment and a desktop or larger-screen treatment. The system
        keeps the answer readable while making provenance, clinical action, and audit detail available without
        competing.
      </p>
    </header>
  );
}

function PairSection({
  id,
  title,
  rationale,
  mobile,
  desktop,
}: {
  id: string;
  title: string;
  rationale: string;
  mobile: ReactNode;
  desktop: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-3 max-w-4xl">
        <h2 className="text-xl font-semibold text-[color:var(--text-heading)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{rationale}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <MockupFrame label="Mobile">{mobile}</MockupFrame>
        <MockupFrame label="Desktop / larger screens">{desktop}</MockupFrame>
      </div>
    </section>
  );
}

function MockupFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">{label}</p>
      <div className="overflow-x-auto rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        {children}
      </div>
    </div>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-[680px] max-w-[390px] flex-col overflow-hidden bg-[color:var(--surface)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Stethoscope className="h-4 w-4" />
        </span>
        <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-bold text-[color:var(--text-heading)]">
          Answer
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Plus className="h-4 w-4" />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2">
        <div className="flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 shadow-[var(--shadow-inset)]">
          <Plus className="h-4 w-4 text-[color:var(--text-muted)]" />
          <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-muted)]">
            Ask a clinical question...
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-contrast)]">
            <ExternalLink className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function DesktopShell({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="grid h-[680px] min-w-[820px] grid-cols-[minmax(0,1fr)_minmax(17rem,0.62fr)] overflow-hidden bg-[color:var(--surface)]">
      <main className="min-w-0 overflow-y-auto p-5">{children}</main>
      <aside className="min-w-0 overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
        {side}
      </aside>
    </div>
  );
}

function AnswerBubble({ dense = false }: { dense?: boolean }) {
  return (
    <article className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <span className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p
            className={
              dense
                ? "text-[15px] font-medium leading-6 text-[color:var(--text-heading)]"
                : "text-base font-medium leading-7 text-[color:var(--text-heading)]"
            }
          >
            {answerText}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill icon={BookOpen} tone="teal">
              3 sources
            </Pill>
            <Pill icon={ClipboardCheck} tone="amber">
              3 clinical notes
            </Pill>
            <Pill icon={Layers3} tone="blue">
              Evidence direct
            </Pill>
          </div>
        </div>
      </div>
    </article>
  );
}

function SourceRow({ source, compact = false }: { source: (typeof sources)[number]; compact?: boolean }) {
  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5">
      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" />
      <div className="min-w-0">
        <p
          className={
            compact
              ? "line-clamp-1 text-sm font-semibold text-[color:var(--text-heading)]"
              : "line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--text-heading)]"
          }
        >
          {source.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{source.meta}</p>
      </div>
      <span className="nums rounded border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--text-muted)]">
        {source.score}
      </span>
    </article>
  );
}

function NoteRow({ note, compact = false }: { note: (typeof notes)[number]; compact?: boolean }) {
  const tone = noteTone[note.tone];
  const Icon = tone.icon;
  return (
    <article className={`rounded-lg border p-3 ${tone.panel}`}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-md border ${toneClass[tone.tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">{note.title}</p>
          <p
            className={
              compact
                ? "mt-1 line-clamp-1 text-xs text-[color:var(--text-muted)]"
                : "mt-1 text-xs leading-5 text-[color:var(--text-muted)]"
            }
          >
            {note.detail}
          </p>
        </div>
        <span className="rounded border border-[color:var(--border)] bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--text-muted)]">
          {note.source}
        </span>
      </div>
    </article>
  );
}

function EvidenceMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-2">
      {evidenceRows.map(([section, support, citations, source]) => (
        <article
          key={section}
          className={
            compact
              ? "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5"
              : "grid grid-cols-[minmax(0,1fr)_7rem_7rem_minmax(0,1fr)] gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
          }
        >
          {compact ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">{section}</p>
                <Pill tone={support === "Direct" ? "teal" : "amber"}>{support}</Pill>
              </div>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {citations} - {source}
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{section}</p>
              <p className="text-sm font-semibold text-teal-700">{support}</p>
              <p className="text-sm text-[color:var(--text-muted)]">{citations}</p>
              <p className="truncate text-sm text-[color:var(--text-muted)]">{source}</p>
            </>
          )}
        </article>
      ))}
    </div>
  );
}

function AnswerMobile() {
  return (
    <PhoneShell>
      <div className="mb-3 ml-auto w-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm font-semibold text-[color:var(--text-heading)]">
        lithium dosing
      </div>
      <AnswerBubble />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ActionButton icon={BookOpen}>Sources</ActionButton>
        <ActionButton icon={ClipboardCheck}>Notes</ActionButton>
        <ActionButton icon={Layers3}>Evidence</ActionButton>
      </div>
    </PhoneShell>
  );
}

function AnswerDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Answer controls</p>
          <Pill icon={BookOpen} tone="teal">
            Source-backed
          </Pill>
          <Pill icon={Layers3} tone="blue">
            Direct evidence
          </Pill>
          <ActionButton icon={Copy}>Copy with sources</ActionButton>
        </div>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="ml-auto w-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 py-2 text-sm font-semibold text-[color:var(--text-heading)]">
          lithium dosing
        </div>
        <AnswerBubble />
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">
            Why this answer is structured this way
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            The answer stays readable and avoids source inventory language. Provenance, clinical actions, and audit
            detail are exposed as separate controls immediately below it.
          </p>
        </section>
      </div>
    </DesktopShell>
  );
}

function SourcesMobile() {
  return (
    <PhoneShell>
      <div className="rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
        <header className="border-b border-[color:var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Sources</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                Open the source document before relying on details.
              </p>
            </div>
            <Pill tone="teal">3</Pill>
          </div>
        </header>
        <div className="grid gap-2 p-3">
          {sources.map((source) => (
            <SourceRow key={source.title} source={source} />
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

function SourcesDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Source actions</p>
          <ActionButton icon={ExternalLink} primary>
            Open primary source
          </ActionButton>
          <ActionButton icon={FileSearch}>Compare sources</ActionButton>
        </div>
      }
    >
      <section className="mx-auto max-w-3xl rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-lux)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Sources behind this answer</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Ranked by answer use and ready to open.</p>
          </div>
          <Pill icon={BookOpen} tone="teal">
            3 sources
          </Pill>
        </div>
        <div className="grid gap-2">
          {sources.map((source) => (
            <SourceRow key={source.title} source={source} />
          ))}
        </div>
      </section>
    </DesktopShell>
  );
}

function NotesMobile() {
  return (
    <PhoneShell>
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        <header className="border-b border-[color:var(--border)] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Clinical notes</h3>
              <p className="mt-1 text-xs font-semibold text-teal-700">Monitor - Caution - Escalate</p>
            </div>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-[color:var(--border)] px-3 py-3">
          <Pill icon={Activity} tone="teal">
            Monitor 1
          </Pill>
          <Pill icon={AlertTriangle} tone="amber">
            Caution 1
          </Pill>
          <Pill icon={ShieldAlert} tone="red">
            Escalate 1
          </Pill>
        </div>
        <div className="grid gap-2 p-3">
          {notes.map((note) => (
            <NoteRow key={note.title} note={note} />
          ))}
        </div>
      </section>
    </PhoneShell>
  );
}

function NotesDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Use notes for</p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            Practical actions extracted from answer sections. Each item keeps its source label visible.
          </p>
          <ActionButton icon={Plus} primary>
            Add all notes
          </ActionButton>
        </div>
      }
    >
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Clinical notes</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Actionable checklist derived from the answer.</p>
          </div>
          <ActionButton icon={Copy}>Copy notes</ActionButton>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteRow key={note.title} note={note} />
          ))}
        </div>
      </section>
    </DesktopShell>
  );
}

function SafetyMobile() {
  return (
    <PhoneShell>
      <AnswerBubble dense />
      <section className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-red-700">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-red-950">Escalate from clinical notes</h3>
            <p className="mt-1 text-xs leading-5 text-red-800">
              Toxicity symptoms or acute kidney injury should prompt urgent review.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <NoteRow note={notes[2]} />
        </div>
      </section>
    </PhoneShell>
  );
}

function SafetyDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <Pill icon={ShieldAlert} tone="red">
            Interrupt only when urgent
          </Pill>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            Normal safety content belongs inside Clinical notes as Caution or Escalate.
          </p>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl space-y-3">
        <AnswerBubble />
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-red-700">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-red-950">Safety-critical source finding</h3>
                <p className="mt-1 text-sm leading-6 text-red-800">
                  Use a red banner only when the source-backed finding materially changes immediate handling.
                </p>
              </div>
            </div>
            <ActionButton icon={ExternalLink}>Source</ActionButton>
          </div>
        </section>
      </div>
    </DesktopShell>
  );
}

function EvidenceMobile() {
  return (
    <PhoneShell>
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        <header className="border-b border-[color:var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Evidence</h3>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">Audit support, tables, quotes, and gaps.</p>
            </div>
            <Pill icon={ShieldCheck} tone="teal">
              Direct
            </Pill>
          </div>
        </header>
        <div className="grid grid-cols-3 border-b border-[color:var(--border)] text-center">
          {[
            ["3", "Sources"],
            ["2", "Quotes"],
            ["1", "Table"],
          ].map(([count, label]) => (
            <div key={label} className="border-r border-[color:var(--border)] px-2 py-3 last:border-r-0">
              <p className="nums text-lg font-semibold text-[color:var(--text-heading)]">{count}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--text-muted)]">{label}</p>
            </div>
          ))}
        </div>
        <div className="p-3">
          <EvidenceMap compact />
        </div>
      </section>
    </PhoneShell>
  );
}

function EvidenceDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence sections</p>
          <Pill icon={BookOpen} tone="teal">
            Sources
          </Pill>
          <Pill icon={Table2} tone="blue">
            Tables
          </Pill>
          <Pill icon={ListChecks} tone="amber">
            Gaps
          </Pill>
        </div>
      }
    >
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Evidence audit</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Detailed support map for review after reading the answer and checking sources.
            </p>
          </div>
          <Pill icon={ShieldCheck} tone="teal">
            Direct support
          </Pill>
        </div>
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_7rem_7rem_minmax(0,1fr)] gap-3 px-3 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
          <span>Answer section</span>
          <span>Support</span>
          <span>Citations</span>
          <span>Top source</span>
        </div>
        <EvidenceMap />
      </section>
    </DesktopShell>
  );
}

export default function RagAnswerResponsiveMockupsPage() {
  return (
    <main className="min-h-screen bg-[color:var(--surface)] px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageIntro />
        <div className="space-y-8">
          <PairSection
            id="answer"
            title="1. Answer"
            rationale="The answer is the primary object. It should read like a clinician wrote it, with provenance controls nearby but not mixed into the prose."
            mobile={<AnswerMobile />}
            desktop={<AnswerDesktop />}
          />
          <PairSection
            id="sources"
            title="2. Sources"
            rationale="Sources are quick provenance, not the full evidence audit. Show the top passages and make opening the source document obvious."
            mobile={<SourcesMobile />}
            desktop={<SourcesDesktop />}
          />
          <PairSection
            id="clinical-notes"
            title="3. Clinical notes"
            rationale="Clinical notes translate the answer into monitor, caution, and escalation actions. The source label stays visible per item."
            mobile={<NotesMobile />}
            desktop={<NotesDesktop />}
          />
          <PairSection
            id="safety-critical"
            title="4. Safety-critical"
            rationale="Safety-critical should not be a routine page. It is a banner treatment for urgent source-backed findings; otherwise it lives in Clinical notes."
            mobile={<SafetyMobile />}
            desktop={<SafetyDesktop />}
          />
          <PairSection
            id="evidence"
            title="5. Evidence"
            rationale="Evidence is the audit workspace: support levels, evidence map, quotes, tables, gaps, and governance warnings."
            mobile={<EvidenceMobile />}
            desktop={<EvidenceDesktop />}
          />
        </div>
      </div>
    </main>
  );
}
