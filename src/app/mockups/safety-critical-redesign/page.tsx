import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileSearch,
  Flame,
  Layers3,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "teal" | "amber" | "red" | "blue" | "neutral";

const answerText =
  "Lithium dosing should be guided by serum levels, tolerability, renal function, interacting medicines, and documented clinical response.";

const safetyFindings = [
  {
    label: "Escalate",
    title: "Toxicity symptoms",
    detail: "Vomiting, diarrhoea, tremor, confusion, ataxia, or acute kidney injury should prompt urgent review.",
    source: "Source 3",
  },
  {
    label: "Caution",
    title: "Renal impairment",
    detail: "Reduce dose or increase monitoring frequency when renal function changes or dehydration risk is present.",
    source: "Source 2",
  },
  {
    label: "Monitor",
    title: "Level timing",
    detail: "Check serum lithium level after dose changes and when clinically stable.",
    source: "Source 1",
  },
] as const;

const toneClass: Record<Tone, string> = {
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)]",
};

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

function Pill({
  icon: Icon,
  tone = "neutral",
  children,
}: {
  icon?: typeof ShieldAlert;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${toneClass[tone]}`}>
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
  icon: typeof ShieldAlert;
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

function PageHeader() {
  return (
    <header className="mb-7 max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--clinical-chat-teal)]">
        Safety-critical redesign
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[color:var(--text-heading)] sm:text-3xl">
        Three polished treatments for urgent source-backed safety findings
      </h1>
      <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
        Safety-critical should interrupt only when a source-backed finding materially changes immediate handling. These
        mockups keep the warning clear without turning every caution into an alarm.
      </p>
    </header>
  );
}

function MockupPair({
  title,
  summary,
  mobile,
  desktop,
}: {
  title: string;
  summary: string;
  mobile: ReactNode;
  desktop: ReactNode;
}) {
  return (
    <section className="scroll-mt-6">
      <div className="mb-3 max-w-4xl">
        <h2 className="text-xl font-semibold text-[color:var(--text-heading)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{summary}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <MockupFrame label="Phone">{mobile}</MockupFrame>
        <MockupFrame label="Desktop">{desktop}</MockupFrame>
      </div>
    </section>
  );
}

function MockupFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">{label}</p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        {children}
      </div>
    </div>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-[700px] w-[min(100%,390px)] flex-col overflow-hidden bg-[color:var(--surface)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Stethoscope className="h-4 w-4" />
        </span>
        <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-bold text-[color:var(--text-heading)]">
          Answer
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Plus className="h-4 w-4" />
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2">
        <div className="flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 shadow-[var(--shadow-inset)]">
          <Plus className="h-4 w-4 text-[color:var(--text-muted)]" />
          <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-muted)]">Ask a clinical question...</span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-contrast)]">
            <ExternalLink className="h-4 w-4" />
          </span>
        </div>
      </footer>
    </div>
  );
}

function DesktopShell({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="grid h-[700px] w-[820px] grid-cols-[minmax(0,1fr)_minmax(17rem,0.6fr)] overflow-hidden bg-[color:var(--surface)]">
      <main className="min-w-0 overflow-y-auto p-5">{children}</main>
      <aside className="min-w-0 overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
        {side}
      </aside>
    </div>
  );
}

function AnswerCard() {
  return (
    <article className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <span className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-medium leading-7 text-[color:var(--text-heading)]">{answerText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill icon={BookOpen} tone="teal">3 sources</Pill>
            <Pill icon={ClipboardCheck} tone="amber">3 clinical notes</Pill>
            <Pill icon={Layers3} tone="blue">Evidence direct</Pill>
          </div>
        </div>
      </div>
    </article>
  );
}

function FindingCard({
  finding,
  compact = false,
}: {
  finding: (typeof safetyFindings)[number];
  compact?: boolean;
}) {
  const tone = finding.label === "Escalate" ? "red" : finding.label === "Caution" ? "amber" : "teal";
  const Icon = finding.label === "Escalate" ? ShieldAlert : finding.label === "Caution" ? AlertTriangle : Activity;
  return (
    <article className={`rounded-lg border p-3 ${toneClass[tone]}`}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-white/75">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">{finding.title}</p>
          <p className={compact ? "mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-muted)]" : "mt-1 text-xs leading-5 text-[color:var(--text-muted)]"}>
            {finding.detail}
          </p>
        </div>
        <span className="rounded border border-white/70 bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--text-muted)]">
          {finding.source}
        </span>
      </div>
    </article>
  );
}

function AnswerInterruptPhone() {
  return (
    <PhoneShell>
      <div className="mb-3 ml-auto w-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm font-semibold text-[color:var(--text-heading)]">
        lithium toxicity
      </div>
      <section className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 shadow-[0_12px_30px_rgb(185_28_28_/_10%)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-red-700">
            <Flame className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-red-950">Safety-critical finding</p>
            <p className="mt-1 text-xs leading-5 text-red-800">
              Toxicity symptoms or acute kidney injury should prompt urgent review.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton icon={ExternalLink}>Open source</ActionButton>
          <ActionButton icon={ClipboardCheck} primary>Add note</ActionButton>
        </div>
      </section>
      <AnswerCard />
    </PhoneShell>
  );
}

function AnswerInterruptDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <Pill icon={ShieldAlert} tone="red">Interrupt only when urgent</Pill>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            This treatment belongs above the answer only when the finding changes immediate clinical handling.
          </p>
          <ActionButton icon={ExternalLink} primary>Open primary source</ActionButton>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-red-700">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-red-950">Safety-critical source finding</p>
              <p className="mt-1 text-sm leading-6 text-red-800">
                Vomiting, diarrhoea, tremor, confusion, ataxia, or acute kidney injury should prompt urgent review.
              </p>
            </div>
            <Pill icon={BookOpen} tone="red">Source 3</Pill>
          </div>
        </div>
        <AnswerCard />
      </div>
    </DesktopShell>
  );
}

function NotesTriagePhone() {
  return (
    <PhoneShell>
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        <header className="border-b border-[color:var(--border)] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Safety notes</h3>
              <p className="mt-1 text-xs font-semibold text-red-700">Escalate - Caution - Monitor</p>
            </div>
          </div>
        </header>
        <div className="grid gap-2 p-3">
          {safetyFindings.map((finding) => (
            <FindingCard key={finding.title} finding={finding} compact />
          ))}
        </div>
      </section>
    </PhoneShell>
  );
}

function NotesTriageDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">How to use this</p>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">
            Most safety findings should live here, not as a separate alarming page.
          </p>
          <ActionButton icon={Copy}>Copy safety notes</ActionButton>
        </div>
      }
    >
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Safety notes</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Triage source-backed findings by action type.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill icon={ShieldAlert} tone="red">Escalate 1</Pill>
            <Pill icon={AlertTriangle} tone="amber">Caution 1</Pill>
            <Pill icon={Activity} tone="teal">Monitor 1</Pill>
          </div>
        </div>
        <div className="grid gap-3">
          {safetyFindings.map((finding) => (
            <FindingCard key={finding.title} finding={finding} />
          ))}
        </div>
      </section>
    </DesktopShell>
  );
}

function SourceReviewPhone() {
  return (
    <PhoneShell>
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-lux)]">
        <header className="border-b border-[color:var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Verify safety finding</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">Source-backed escalation review.</p>
            </div>
            <Pill icon={ShieldAlert} tone="red">Urgent</Pill>
          </div>
        </header>
        <div className="grid gap-3 p-3">
          <FindingCard finding={safetyFindings[0]} />
          <article className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Source passage</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-heading)]">
              Review for tremor, confusion, ataxia, gastrointestinal symptoms, dehydration, and renal deterioration.
            </p>
          </article>
          <ActionButton icon={ExternalLink} primary>Open source document</ActionButton>
        </div>
      </section>
    </PhoneShell>
  );
}

function SourceReviewDesktop() {
  return (
    <DesktopShell
      side={
        <div className="space-y-3">
          <Pill icon={BookOpen} tone="teal">Source 3</Pill>
          <Pill icon={Layers3} tone="blue">Direct support</Pill>
          <ActionButton icon={FileSearch} primary>Open source document</ActionButton>
          <ActionButton icon={CheckCircle2}>Mark verified</ActionButton>
        </div>
      }
    >
      <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4">
        <div className="mb-4 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Safety verification panel</h3>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
              Use this when the user needs to inspect the cited passage before acting.
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <FindingCard finding={safetyFindings[0]} />
          <article className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Source passage</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-heading)]">
              Review for tremor, confusion, ataxia, gastrointestinal symptoms, dehydration, and renal deterioration.
              If present, seek urgent clinical review and check renal function and serum lithium level.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill icon={BookOpen} tone="teal">p. 8</Pill>
              <Pill icon={ShieldCheck} tone="blue">Direct match</Pill>
            </div>
          </article>
        </div>
      </section>
    </DesktopShell>
  );
}

export default function SafetyCriticalRedesignMockupsPage() {
  return (
    <main
      data-safety-critical-redesign
      className="min-h-screen bg-[color:var(--surface)] px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 text-[color:var(--text)] sm:px-6 lg:px-8"
    >
      <style>{`
        body:has([data-safety-critical-redesign]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-7xl">
        <PageHeader />
        <div className="space-y-8">
          <MockupPair
            title="1. Answer interrupt"
            summary="Best when the source-backed finding changes immediate clinical handling. It appears above the answer and then gets out of the way."
            mobile={<AnswerInterruptPhone />}
            desktop={<AnswerInterruptDesktop />}
          />
          <MockupPair
            title="2. Safety notes triage"
            summary="Best default. Safety-critical content is folded into Clinical notes as Escalate, Caution, or Monitor."
            mobile={<NotesTriagePhone />}
            desktop={<NotesTriageDesktop />}
          />
          <MockupPair
            title="3. Source verification panel"
            summary="Best when the clinician needs the exact cited passage before acting. It pairs the finding with the source excerpt and actions."
            mobile={<SourceReviewPhone />}
            desktop={<SourceReviewDesktop />}
          />
        </div>
      </div>
    </main>
  );
}
