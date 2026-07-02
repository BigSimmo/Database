import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Layers3,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { ReactNode } from "react";

type NoteTone = "monitor" | "caution" | "escalate";

const sources = [
  {
    title: "Lithium Therapy - Initiation and Continuation Guideline",
    meta: "p. 4 - Current - Local",
    score: "100%",
  },
  {
    title: "Lithium monitoring and renal function guidance",
    meta: "p. 2 - Current - Local",
    score: "92%",
  },
  {
    title: "Medication review and toxicity safety-net",
    meta: "p. 8 - Review due",
    score: "84%",
  },
];

const notes: Array<{ tone: NoteTone; title: string; detail: string; source: string }> = [
  {
    tone: "monitor",
    title: "Lithium level timing",
    detail: "Check serum levels after dose changes and once stable. Verify timing against the linked source.",
    source: "Source 1",
  },
  {
    tone: "caution",
    title: "Renal function",
    detail: "Reduce dose or increase review frequency when renal impairment or dehydration risk is present.",
    source: "Source 2",
  },
  {
    tone: "escalate",
    title: "Toxicity triggers",
    detail: "Vomiting, diarrhoea, tremor, confusion, ataxia, or acute kidney injury should prompt urgent review.",
    source: "Source 3",
  },
];

const evidenceRows = [
  ["Dose adjustment", "Direct", "2 citations", "Lithium guideline"],
  ["Level timing", "Direct", "3 citations", "Monitoring guidance"],
  ["Renal caution", "Moderate", "1 citation", "Renal function section"],
] as const;

const planRows = [
  {
    surface: "Answer",
    job: "Give the direct clinical response first, with no source inventory wording.",
    action: "Keep it readable, short, and structured by the question type.",
  },
  {
    surface: "Sources",
    job: "Show where the answer came from.",
    action: "Top documents/passages only: title, page, status, score, open source.",
  },
  {
    surface: "Clinical notes",
    job: "Turn answer content into practical monitoring, caution, and escalation items.",
    action: "Checklist or compact note rail. Include source labels on each item.",
  },
  {
    surface: "Safety-critical",
    job: "Escalate source-backed red flags only when they materially change clinical handling.",
    action: "Fold into Clinical notes as Escalate/Caution unless urgent enough for a banner.",
  },
  {
    surface: "Evidence",
    job: "Audit the answer quality.",
    action: "Support level, evidence map, quotes, tables/images, gaps, and governance warnings.",
  },
] as const;

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

const toneStyles: Record<NoteTone, { label: string; icon: typeof ShieldCheck; chip: string; dot: string }> = {
  monitor: {
    label: "Monitor",
    icon: Activity,
    chip: "border-teal-200 bg-teal-50 text-teal-800",
    dot: "bg-teal-600",
  },
  caution: {
    label: "Caution",
    icon: AlertTriangle,
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  escalate: {
    label: "Escalate",
    icon: ShieldAlert,
    chip: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-600",
  },
};

function IconPill({
  icon: Icon,
  children,
  tone = "neutral",
}: {
  icon: typeof ShieldCheck;
  children: ReactNode;
  tone?: "neutral" | "teal" | "amber" | "red" | "blue";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "blue"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)]";
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function SurfaceFrame({
  title,
  subtitle,
  recommended,
  children,
}: {
  title: string;
  subtitle: string;
  recommended?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h2>
            {recommended ? (
              <IconPill icon={CheckCircle2} tone="teal">
                Recommended
              </IconPill>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        {children}
      </div>
    </section>
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

function SourceList({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-2">
      {sources.map((source, index) => (
        <article
          key={source.title}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5"
        >
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
            {index === 0 ? source.score : `#${index + 1}`}
          </span>
        </article>
      ))}
    </div>
  );
}

function ClinicalNoteRows({ dense = false }: { dense?: boolean }) {
  return (
    <div className="grid gap-2">
      {notes.map((note) => {
        const tone = toneStyles[note.tone];
        const Icon = tone.icon;
        return (
          <article
            key={note.title}
            className={[
              "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
              dense ? "p-2.5" : "p-3",
            ].join(" ")}
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-md border ${tone.chip}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">{note.title}</p>
                <p
                  className={
                    dense
                      ? "mt-1 line-clamp-1 text-xs text-[color:var(--text-muted)]"
                      : "mt-1 text-xs leading-5 text-[color:var(--text-muted)]"
                  }
                >
                  {note.detail}
                </p>
              </div>
              <span className="rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--text-muted)]">
                {note.source}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AnswerCard({ safetyBanner = false }: { safetyBanner?: boolean }) {
  return (
    <article className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      {safetyBanner ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold leading-5 text-red-800">
          Urgent source-backed caution: toxicity symptoms or acute kidney injury should prompt immediate review.
        </div>
      ) : null}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <span className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-medium leading-7 text-[color:var(--text-heading)]">
            Lithium dosing should be guided by serum levels, tolerability, renal function, interacting medicines, and
            documented clinical response. Use lower or slower dosing when renal risk or toxicity risk is present.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <IconPill icon={BookOpen} tone="teal">
              3 sources
            </IconPill>
            <IconPill icon={ClipboardCheck} tone="amber">
              3 clinical notes
            </IconPill>
            <IconPill icon={Layers3} tone="blue">
              Evidence: direct
            </IconPill>
          </div>
        </div>
      </div>
    </article>
  );
}

function EvidenceMini() {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence audit</p>
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Support map, quotes, tables, gaps</p>
        </div>
        <IconPill icon={ShieldCheck} tone="teal">
          Good support
        </IconPill>
      </div>
      <div className="mt-3 grid gap-1.5">
        {evidenceRows.map(([section, support, citations, source]) => (
          <div
            key={section}
            className="grid grid-cols-[minmax(0,1.1fr)_auto] gap-2 rounded-md bg-[color:var(--surface-subtle)] px-2.5 py-2 text-xs"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-[color:var(--text-heading)]">{section}</span>
              <span className="mt-0.5 block truncate text-[color:var(--text-muted)]">{source}</span>
            </span>
            <span className="text-right font-semibold text-[color:var(--text)]">
              {support}
              <span className="block font-normal text-[color:var(--text-muted)]">{citations}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecommendedStack() {
  return (
    <SurfaceFrame
      title="Option 1 - Answer stack"
      subtitle="One logical answer hierarchy. Sources verify provenance; Clinical notes carry actions and safety; Evidence audits support."
      recommended
    >
      <div className="mx-auto h-[760px] max-w-[440px] overflow-y-auto bg-[color:var(--surface-raised)] p-3">
        <div className="mb-3 ml-auto w-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text-heading)]">
          lithium dosing
        </div>
        <AnswerCard />

        <section className="mt-3 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Sources</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Open source documents first</p>
            </div>
            <ActionButton icon={ExternalLink}>Open all</ActionButton>
          </div>
          <div className="mt-3">
            <SourceList compact />
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical notes</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Monitor, caution, escalation</p>
            </div>
            <div className="flex gap-1.5">
              <IconPill icon={Activity} tone="teal">
                Monitor
              </IconPill>
              <IconPill icon={AlertTriangle} tone="amber">
                Caution
              </IconPill>
            </div>
          </div>
          <ClinicalNoteRows dense />
        </section>

        <div className="mt-3">
          <EvidenceMini />
        </div>
        <footer className="sticky bottom-0 mt-3 grid grid-cols-2 gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-raised)] py-3">
          <ActionButton icon={Copy}>Copy answer</ActionButton>
          <ActionButton icon={Plus} primary>
            Add notes
          </ActionButton>
        </footer>
      </div>
    </SurfaceFrame>
  );
}

function SourceReviewDesk() {
  return (
    <SurfaceFrame
      title="Option 2 - Source review desk"
      subtitle="Best for users who verify every answer. It makes the source list equal weight with the answer."
    >
      <div className="mx-auto h-[760px] max-w-[440px] overflow-y-auto bg-[color:var(--surface-raised)] p-3">
        <section className="mb-3 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Sources</p>
              <p className="text-xs text-[color:var(--text-muted)]">Ranked by answer use</p>
            </div>
            <ExternalLink className="h-4 w-4 text-[color:var(--primary)]" />
          </div>
          <SourceList compact />
        </section>
        <div className="mb-3 flex flex-wrap gap-2">
          <IconPill icon={BookOpen} tone="teal">
            Source-backed
          </IconPill>
          <IconPill icon={Layers3} tone="blue">
            Moderate-high support
          </IconPill>
        </div>
        <div className="min-w-0">
          <AnswerCard />
          <section className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical notes</p>
              <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" />
            </div>
            <ClinicalNoteRows dense />
          </section>
          <div className="mt-3">
            <EvidenceMini />
          </div>
        </div>
      </div>
    </SurfaceFrame>
  );
}

function SafetyFirstLayout() {
  return (
    <SurfaceFrame
      title="Option 3 - Safety escalation layout"
      subtitle="Best for high-risk answers. It only appears when source text contains material escalation or caution findings."
    >
      <div className="mx-auto h-[760px] max-w-[440px] overflow-y-auto bg-[color:var(--surface-raised)] p-3">
        <AnswerCard safetyBanner />
        <section className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-red-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-red-900">Safety-critical findings</p>
              <p className="mt-1 text-xs leading-5 text-red-800">
                Show this only for urgent source-backed findings. Otherwise, keep safety items inside Clinical notes.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {notes
              .filter((note) => note.tone !== "monitor")
              .map((note) => (
                <article key={note.title} className="rounded-lg border border-red-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-red-950">{note.title}</p>
                    <SourceButtonLabel label={note.source} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-red-800">{note.detail}</p>
                </article>
              ))}
          </div>
        </section>
        <section className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">Sources to verify</p>
            <BookOpen className="h-4 w-4 text-[color:var(--primary)]" />
          </div>
          <SourceList compact />
        </section>
        <div className="mt-3">
          <EvidenceMini />
        </div>
      </div>
    </SurfaceFrame>
  );
}

function SourceButtonLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-800">
      <ExternalLink className="h-3 w-3" />
      {label}
    </span>
  );
}

function PlanTable() {
  return (
    <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-lux)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
          <ClipboardCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Recommended RAG answer structure</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Order the UI by user intent, not by internal model output.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        {planRows.map((row, index) => (
          <article
            key={row.surface}
            className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">
              <span className="nums mr-2 text-[color:var(--clinical-chat-teal)]">{index + 1}</span>
              {row.surface}
            </p>
            <p className="text-sm leading-6 text-[color:var(--text)]">{row.job}</p>
            <p className="text-sm leading-6 text-[color:var(--text-muted)]">{row.action}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function RagAnswerStructureMockupsPage() {
  return (
    <main className="min-h-screen bg-[color:var(--surface)] px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--clinical-chat-teal)]">
            RAG answer structure
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
            One hierarchy for answer, sources, evidence, notes, and safety
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
            The best fit for the current RAG is not another drawer. It is a clear answer stack: direct answer first,
            source provenance second, clinical action notes third, and detailed evidence audit on demand.
          </p>
        </header>

        <PlanTable />

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <RecommendedStack />
          <SourceReviewDesk />
          <SafetyFirstLayout />
        </div>
      </div>
    </main>
  );
}
