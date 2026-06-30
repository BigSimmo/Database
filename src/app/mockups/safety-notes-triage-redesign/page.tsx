import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  ListChecks,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { ReactNode } from "react";

type FindingTone = "escalate" | "caution" | "monitor";

const findings: Array<{
  id: string;
  tone: FindingTone;
  label: string;
  title: string;
  body: string;
  action: string;
  source: string;
  timing: string;
}> = [
  {
    id: "toxicity",
    tone: "escalate",
    label: "Escalate",
    title: "Possible lithium toxicity",
    body: "Vomiting, diarrhoea, tremor, confusion, ataxia, or acute kidney injury should prompt urgent clinical review.",
    action: "Escalate now",
    source: "Source 3",
    timing: "Immediate",
  },
  {
    id: "renal",
    tone: "caution",
    label: "Caution",
    title: "Renal function or dehydration risk",
    body: "Review dose and monitoring frequency when renal function changes, dehydration occurs, or interacting medicines are added.",
    action: "Review dose",
    source: "Source 2",
    timing: "Before next dose",
  },
  {
    id: "level",
    tone: "monitor",
    label: "Monitor",
    title: "Lithium level timing",
    body: "Check serum lithium after dose changes and once clinically stable; interpret levels against timing and renal status.",
    action: "Time level",
    source: "Source 1",
    timing: "Scheduled",
  },
];

const toneStyles: Record<
  FindingTone,
  {
    accent: string;
    soft: string;
    border: string;
    text: string;
    icon: typeof ShieldAlert;
    dot: string;
  }
> = {
  escalate: {
    accent: "bg-red-600 text-white",
    soft: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: ShieldAlert,
    dot: "bg-red-500",
  },
  caution: {
    accent: "bg-amber-500 text-amber-950",
    soft: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: AlertTriangle,
    dot: "bg-amber-500",
  },
  monitor: {
    accent: "bg-teal-600 text-white",
    soft: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    icon: Activity,
    dot: "bg-teal-500",
  },
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: FindingTone | "neutral" }) {
  const toneClass =
    tone === "neutral"
      ? "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]"
      : `${toneStyles[tone].border} ${toneStyles[tone].soft} ${toneStyles[tone].text}`;

  return (
    <span
      className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none shadow-[var(--shadow-inset)] ${toneClass} [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`}
    >
      {children}
    </span>
  );
}

function ActionButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  const baseClass = `inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold leading-tight transition hover:-translate-y-px hover:shadow-[var(--shadow-tight)] active:translate-y-0 ${focusRing} [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`;

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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Clinical KB mockup
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
            Safety notes triage redesign
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            Three refinements of the second safety mockup: compact triage first, source-backed actions second, and
            detailed evidence only when the clinician opens a note.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Improvements made
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="escalate">Urgent items first</Pill>
            <Pill tone="caution">Caution is separate</Pill>
            <Pill tone="monitor">Mobile bottom sheet</Pill>
          </div>
        </div>
      </div>
    </header>
  );
}

function MockupPair({
  eyebrow,
  title,
  body,
  recommended,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  recommended?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{eyebrow}</p>
            {recommended ? <Pill tone="monitor">Recommended direction</Pill> : null}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">{title}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[color:var(--text-muted)]">{body}</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[25rem_minmax(0,1fr)]">{children}</div>
    </section>
  );
}

function MockupFrame({ label, children }: { label: string; children: ReactNode }) {
  const frameClass = label === "Desktop" ? "hidden min-w-0 overflow-hidden md:block" : "min-w-0 overflow-hidden";

  return (
    <div className={frameClass}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
      </div>
      <div className="overflow-x-auto pb-2">{children}</div>
    </div>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-[48rem] max-w-[24.5rem] overflow-hidden rounded-[2rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[color:var(--border-strong)]" />
      <div className="px-3 pb-4 pt-3">{children}</div>
    </div>
  );
}

function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[48rem] min-w-[46rem] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] xl:min-w-0">
      {children}
    </div>
  );
}

function SheetHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
              <ClipboardCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[color:var(--text-heading)]">Safety notes</h3>
              <p className="truncate text-xs font-semibold text-[color:var(--clinical-chat-teal)]">Source-backed</p>
            </div>
          </div>
          {compact ? null : (
            <p className="mt-3 text-sm leading-5 text-[color:var(--text-muted)]">
              Prioritised clinical cautions from the answer. Open a note for source detail and exact evidence.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={`grid h-9 w-9 place-items-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] ${focusRing}`}
            aria-label="Open in full panel"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`grid h-9 w-9 place-items-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] ${focusRing}`}
            aria-label="Copy safety notes"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function TriageChips() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Pill tone="escalate">
        <ShieldAlert />
        1 urgent
      </Pill>
      <Pill tone="caution">
        <AlertTriangle />
        1 caution
      </Pill>
      <Pill tone="monitor">
        <Activity />
        1 monitor
      </Pill>
    </div>
  );
}

function FindingCard({ finding, dense = false }: { finding: (typeof findings)[number]; dense?: boolean }) {
  const style = toneStyles[finding.tone];
  const Icon = style.icon;

  return (
    <article
      className={`rounded-lg border ${style.border} ${style.soft} p-3 shadow-[var(--shadow-inset)] ${dense ? "space-y-2" : "space-y-3"}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-md ${style.accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-bold uppercase tracking-[0.08em] ${style.text}`}>{finding.label}</span>
            <span className="text-xs font-semibold text-[color:var(--text-soft)]">{finding.timing}</span>
          </div>
          <h4 className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{finding.title}</h4>
        </div>
        <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-muted)]">
          {finding.source}
        </span>
      </div>
      <p className={`${dense ? "line-clamp-2" : ""} text-sm leading-5 text-[color:var(--text-muted)]`}>{finding.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionButton primary={finding.tone === "escalate"}>{finding.action}</ActionButton>
        <button
          type="button"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold ${style.text} hover:bg-white/60 ${focusRing}`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Evidence
        </button>
      </div>
    </article>
  );
}

function VariantOnePhone() {
  return (
    <PhoneShell>
      <SheetHeader compact />
      <div className="space-y-3 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-1 py-3">
        <TriageChips />
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-red-600 text-white">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-700">Escalate first</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                Possible toxicity overrides routine monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2 py-3">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} dense />
        ))}
      </div>
      <footer className="sticky bottom-0 -mx-3 mt-4 grid grid-cols-3 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)]">
        <button className={`min-h-12 text-xs font-semibold text-[color:var(--clinical-chat-teal)] ${focusRing}`} type="button">
          Source
        </button>
        <button className={`min-h-12 text-xs font-semibold text-[color:var(--text)] ${focusRing}`} type="button">
          Copy
        </button>
        <button className={`min-h-12 text-xs font-semibold text-[color:var(--clinical-chat-teal)] ${focusRing}`} type="button">
          Add
        </button>
      </footer>
    </PhoneShell>
  );
}

function VariantOneDesktop() {
  return (
    <DesktopShell>
      <div className="grid min-h-[48rem] grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <SheetHeader compact />
          <div className="mt-4 space-y-3">
            <TriageChips />
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Design change</p>
              <p className="mt-2 text-sm leading-5 text-[color:var(--text-muted)]">
                The panel now separates urgent escalation, cautions, and routine monitoring before showing individual
                notes.
              </p>
            </div>
          </div>
        </aside>
        <section className="grid grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Safety notes from answer</h3>
                <p className="text-sm text-[color:var(--text-muted)]">3 prioritised findings, each linked to a source.</p>
              </div>
              <ActionButton primary>
                <Plus />
                Add to note
              </ActionButton>
            </div>
          </div>
          <div className="grid content-start gap-3 p-4">
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
            <ActionButton>
              <BookOpen />
              Sources
            </ActionButton>
            <ActionButton>
              <Copy />
              Copy
            </ActionButton>
          </footer>
        </section>
      </div>
    </DesktopShell>
  );
}

function VariantTwoPhone() {
  return (
    <PhoneShell>
      <SheetHeader compact />
      <div className="space-y-3 py-3">
        {findings.map((finding, index) => {
          const style = toneStyles[finding.tone];
          const Icon = style.icon;
          return (
            <article key={finding.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
              <div className="grid justify-items-center">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${style.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {index < findings.length - 1 ? <span className="mt-1 h-full min-h-10 w-px bg-[color:var(--border)]" /> : null}
              </div>
              <div className={`rounded-lg border ${style.border} ${style.soft} p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-xs font-bold uppercase tracking-[0.08em] ${style.text}`}>{finding.label}</span>
                  <span className="text-xs font-semibold text-[color:var(--text-soft)]">{finding.source}</span>
                </div>
                <h4 className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">{finding.title}</h4>
                <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{finding.body}</p>
                <div className="mt-3">
                  <ActionButton primary={finding.tone === "escalate"}>{finding.action}</ActionButton>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </PhoneShell>
  );
}

function VariantTwoDesktop() {
  return (
    <DesktopShell>
      <div className="grid min-h-[48rem] grid-rows-[auto_minmax(0,1fr)]">
        <SheetHeader />
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Escalation ladder</h3>
                <p className="text-sm text-[color:var(--text-muted)]">Read from top to bottom: urgent, caution, monitor.</p>
              </div>
              <Pill tone="escalate">Urgent path visible</Pill>
            </div>
            <div className="grid gap-3">
              {findings.map((finding, index) => {
                const style = toneStyles[finding.tone];
                const Icon = style.icon;
                return (
                  <article
                    key={finding.id}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border ${style.border} ${style.soft} p-3`}
                  >
                    <span className={`grid h-11 w-11 place-items-center rounded-lg ${style.accent}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-[0.08em] ${style.text}`}>
                          Step {index + 1} - {finding.label}
                        </span>
                        <span className="text-xs font-semibold text-[color:var(--text-soft)]">{finding.timing}</span>
                      </div>
                      <h4 className="mt-1 text-base font-semibold text-[color:var(--text-heading)]">{finding.title}</h4>
                      <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{finding.body}</p>
                    </div>
                    <div className="grid justify-items-end gap-2">
                      <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 py-1 text-xs font-bold text-[color:var(--text-muted)]">
                        {finding.source}
                      </span>
                      <ActionButton primary={finding.tone === "escalate"}>{finding.action}</ActionButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <aside className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Why this improves it</p>
            <div className="mt-3 space-y-3 text-sm leading-5 text-[color:var(--text-muted)]">
              <p>It avoids a flat checklist by making clinical priority visible.</p>
              <p>It keeps sources available without letting source inventory dominate the safety task.</p>
              <p>It scales well to desktop because the action and evidence controls stay aligned.</p>
            </div>
          </aside>
        </div>
      </div>
    </DesktopShell>
  );
}

function MatrixCell({ finding }: { finding: (typeof findings)[number] }) {
  const style = toneStyles[finding.tone];
  const Icon = style.icon;

  return (
    <article className={`rounded-lg border ${style.border} bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-md ${style.accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${style.soft} ${style.text}`}>{finding.label}</span>
      </div>
      <h4 className="mt-3 text-sm font-semibold text-[color:var(--text-heading)]">{finding.title}</h4>
      <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{finding.body}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-[color:var(--surface-subtle)] p-2">
          <span className="block font-bold text-[color:var(--text-soft)]">Action</span>
          <span className="mt-1 block font-semibold text-[color:var(--text-heading)]">{finding.action}</span>
        </div>
        <div className="rounded-md bg-[color:var(--surface-subtle)] p-2">
          <span className="block font-bold text-[color:var(--text-soft)]">Evidence</span>
          <span className="mt-1 block font-semibold text-[color:var(--text-heading)]">{finding.source}</span>
        </div>
      </div>
    </article>
  );
}

function VariantThreePhone() {
  return (
    <PhoneShell>
      <SheetHeader compact />
      <div className="space-y-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-700">Highest priority</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">Toxicity symptoms</p>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Total</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">3 notes</p>
          </div>
        </div>
        {findings.map((finding) => (
          <MatrixCell key={finding.id} finding={finding} />
        ))}
      </div>
    </PhoneShell>
  );
}

function VariantThreeDesktop() {
  return (
    <DesktopShell>
      <div className="grid min-h-[48rem] grid-rows-[auto_minmax(0,1fr)_auto]">
        <SheetHeader />
        <div className="p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-700">Escalate</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-heading)]">1</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">urgent item</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-700">Caution</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-heading)]">1</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">dose or renal review</p>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">Monitor</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-heading)]">1</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">scheduled check</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {findings.map((finding) => (
              <MatrixCell key={finding.id} finding={finding} />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Evidence remains secondary</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Safety notes expose source links, but detailed audit stays in Evidence.
                </p>
              </div>
              <ActionButton>
                <ListChecks />
                Open audit
              </ActionButton>
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
          <ActionButton>
            <CheckCircle2 />
            Add all safe notes
          </ActionButton>
          <ActionButton primary>
            <Stethoscope />
            Apply triage
          </ActionButton>
        </footer>
      </div>
    </DesktopShell>
  );
}

export default function SafetyNotesTriageRedesignPage() {
  return (
    <main
      data-safety-notes-triage-redesign
      className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8"
    >
      <style>{`
        body:has([data-safety-notes-triage-redesign]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader />

        <MockupPair
          eyebrow="Mockup 1"
          title="Triage strip"
          body="Closest to the second mockup, but cleaner: a compact category strip, one urgent summary, then source-backed notes with actions."
          recommended
        >
          <MockupFrame label="Phone">
            <VariantOnePhone />
          </MockupFrame>
          <MockupFrame label="Desktop">
            <VariantOneDesktop />
          </MockupFrame>
        </MockupPair>

        <MockupPair
          eyebrow="Mockup 2"
          title="Escalation ladder"
          body="Best when the safety panel needs to teach priority order. It reads like a clinical sequence rather than a generic list."
        >
          <MockupFrame label="Phone">
            <VariantTwoPhone />
          </MockupFrame>
          <MockupFrame label="Desktop">
            <VariantTwoDesktop />
          </MockupFrame>
        </MockupPair>

        <MockupPair
          eyebrow="Mockup 3"
          title="Safety action matrix"
          body="Best for larger screens and governance review. It makes category, action, timing, and evidence visible in a structured grid."
        >
          <MockupFrame label="Phone">
            <VariantThreePhone />
          </MockupFrame>
          <MockupFrame label="Desktop">
            <VariantThreeDesktop />
          </MockupFrame>
        </MockupPair>
      </div>
    </main>
  );
}
