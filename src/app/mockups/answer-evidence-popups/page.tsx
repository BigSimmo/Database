import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  Layers,
  ListChecks,
  Maximize2,
  Quote,
  Search,
  ShieldAlert,
  Table2,
  Target,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

const sources = [
  ["Clozapine physical health protocol", "p.12 - current policy", "Direct", "92%"],
  ["Clozapine monitoring table image evidence", "p.14 - locally reviewed", "Table", "86%"],
  ["Shared-care communication checklist", "p.7 - review due", "Related", "71%"],
] as const;

const tabs = [
  ["Tables", "1", ListChecks],
  ["Sources", "3", Layers],
  ["Images", "2", FileImage],
  ["Quotes", "2", Quote],
  ["PDFs", "2", FileText],
  ["Map", "4", BookOpen],
] as const;

const tableRows = [
  ["FBC/ANC", "Baseline, weekly initially, then per protocol", "Hold/escalate if ANC threshold breached"],
  [
    "Myocarditis",
    "Symptoms, pulse, troponin/CRP where locally required",
    "Urgent review for fever, chest pain, dyspnoea",
  ],
  ["Metabolic", "Weight, waist, lipids, glucose/HbA1c", "Shared-care follow-up"],
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-accent)]";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]">
                  <Layers className="h-4 w-4" />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Clinical KB mockup
                </p>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                Answer evidence popup states
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                A polished set of evidence popups showing what clinicians see before opening source PDFs: source
                previews, evidence tabs, review controls, table expansion, and weak-support warnings.
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Design priorities
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="success">Verify source first</Pill>
                <Pill>Fast source opening</Pill>
                <Pill>Mobile sheet parity</Pill>
              </div>
            </div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "info" | "success" | "warn" }) {
  const toneClass =
    tone === "success"
      ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : tone === "warn"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
        : tone === "info"
          ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]";
  return (
    <span
      className={`inline-flex min-h-7 max-w-full shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold leading-none shadow-[var(--shadow-inset)] ${toneClass} [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`}
    >
      {children}
    </span>
  );
}

function Action({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  const baseClass = `inline-flex min-h-10 max-w-full min-w-0 items-center justify-center gap-2 rounded-md px-3 text-center text-xs font-semibold leading-tight transition duration-160 ease-[var(--ease-spring)] hover:-translate-y-px hover:shadow-[var(--shadow-tight)] active:translate-y-0 active:scale-[0.99] ${focusRing} [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 sm:min-h-11 sm:text-sm`;
  return (
    <button
      type="button"
      className={
        primary
          ? `${baseClass} bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-[var(--shadow-tight)]`
          : `${baseClass} border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-accent)]/35`
      }
    >
      {children}
    </button>
  );
}

function CloseButton({ label = "Close popup" }: { label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition duration-160 ease-[var(--ease-spring)] hover:border-[color:var(--clinical-accent)]/35 hover:text-[color:var(--text)] active:scale-[0.98] ${focusRing} sm:h-11 sm:w-11`}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function SourceCapsule() {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded="true"
      className={`mt-2 inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[color:var(--clinical-accent)]/25 bg-[color:var(--clinical-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition duration-160 ease-[var(--ease-spring)] hover:-translate-y-px hover:border-[color:var(--clinical-accent)]/45 hover:shadow-[var(--shadow-tight)] active:scale-[0.99] ${focusRing}`}
    >
      <span className="min-w-0 truncate">Source-backed</span>
      <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[color:var(--surface-raised)] px-2 text-2xs font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        3
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

function SourceRows() {
  return (
    <div className="mt-3 grid gap-1.5" role="list" aria-label="Sources behind this answer">
      {sources.map(([title, meta, support, score], index) => (
        <div key={title} role="listitem">
          <button
            type="button"
            className={`grid min-h-[56px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 text-left transition hover:border-[color:var(--clinical-accent)]/35 hover:bg-[color:var(--surface-raised)] ${focusRing}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${index === 2 ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
              <span className="block truncate text-xs text-[color:var(--text-muted)]">{meta}</span>
            </span>
            <span className="grid min-w-[4.75rem] justify-items-end gap-1">
              <Pill tone={support === "Related" ? "warn" : "success"}>{support}</Pill>
              <span className="nums text-2xs font-semibold text-[color:var(--text-soft)]">{score}</span>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

function ButtonText({ children }: { children: ReactNode }) {
  return <span className="min-w-0 truncate">{children}</span>;
}

function DesktopSourcePreviewDemo() {
  return (
    <div className="relative min-h-[24rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <p className="max-w-[68ch] text-base-minus font-medium leading-[1.56] text-[color:var(--text-heading)]">
        Clozapine monitoring should include FBC/ANC, myocarditis symptoms, metabolic checks, constipation prevention,
        and shared-care communication.
      </p>
      <div className="relative mt-3 w-fit">
        <SourceCapsule />
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] z-10 w-[min(100%,36rem)] motion-safe:animate-pop-in"
        >
          <SourcePreviewPopover />
        </div>
      </div>
      <p className="mt-24 max-w-[68ch] text-xs leading-5 text-[color:var(--text-muted)]">
        The answer body stays in place. The preview floats above nearby content instead of pushing the support card
        down.
      </p>
    </div>
  );
}

function SourcePreviewPopover() {
  return (
    <div className="max-w-xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-elevated)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Source preview</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
            Check the best passage, status, and source action before opening the PDF.
          </p>
        </div>
        <Pill tone="success">3 sources</Pill>
      </div>
      <SourceRows />
      <blockquote className="mt-3 border-l-2 border-[color:var(--clinical-accent)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]">
        &ldquo;Monitor FBC/ANC, myocarditis symptoms, metabolic risk, constipation, and shared-care communication during
        clozapine initiation.&rdquo;
      </blockquote>
      <ActionRow>
        <Action>
          <ExternalLink className="h-3.5 w-3.5" />
          <ButtonText>Open source</ButtonText>
        </Action>
        <Action>
          <Copy className="h-3.5 w-3.5" />
          <ButtonText>Copy quote</ButtonText>
        </Action>
        <Action>
          <BookOpen className="h-3.5 w-3.5" />
          <ButtonText>View cited section</ButtonText>
        </Action>
      </ActionRow>
    </div>
  );
}

function MobileSheetFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)] sm:max-w-md">
      <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] p-3 sm:p-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">{description}</p>
        </div>
        <CloseButton label={`Close ${title.toLowerCase()} sheet`} />
      </div>
      <div className="max-h-[min(34rem,78dvh)] overflow-y-auto p-3 sm:p-4">{children}</div>
    </div>
  );
}

function EvidenceTabs({ selected }: { selected: string }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <div className="flex min-w-max gap-1 px-1" role="tablist" aria-label="Evidence sections">
        {tabs.map(([label, count, Icon]) => {
          const active = label === selected;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              className={`inline-flex min-h-10 max-w-[8rem] items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none transition hover:-translate-y-px hover:shadow-[var(--shadow-tight)] ${focusRing} sm:min-h-11 sm:max-w-none sm:px-3 ${
                active
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--clinical-accent)]/35 hover:bg-[color:var(--surface-raised)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{label}</span>
              <span className="nums inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-raised)] px-1 text-2xs opacity-90 shadow-[var(--shadow-inset)]">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
      <p className="text-sm font-semibold text-[color:var(--text)]">Clinical verification</p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
        Mark whether the linked evidence is safe to use, needs correction, or is source-insufficient.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill tone="success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Verified
        </Pill>
        <Pill tone="warn">
          <AlertCircle className="h-3.5 w-3.5" />
          Needs correction
        </Pill>
        <Pill tone="warn">
          <ShieldAlert className="h-3.5 w-3.5" />
          Source insufficient
        </Pill>
      </div>
    </section>
  );
}

function EvidenceSummaryMini({ selected }: { selected: string }) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">{selected} evidence</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
            Showing only the items used to support this answer.
          </p>
        </div>
        <Pill tone="success">Source-backed</Pill>
      </div>
    </section>
  );
}

function TablePreview({ expanded = false }: { expanded?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] ${expanded ? "" : "shadow-[var(--shadow-tight)]"}`}
    >
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-[color:var(--border)] bg-[color:var(--clinical-chat-table-header)] px-3 py-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <span className="min-w-0 truncate">Clozapine monitoring schedule</span>
        {expanded ? (
          <Pill tone="warn">Verify against source</Pill>
        ) : (
          <button
            type="button"
            aria-label="Expand clozapine monitoring table"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)]/35 hover:text-[color:var(--clinical-accent)] ${focusRing}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-[color:var(--surface-subtle)]">
              {["Domain", "Monitoring", "Action"].map((header) => (
                <th
                  key={header}
                  className="border-b border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[color:var(--text)]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row[0]} className="even:bg-[color:var(--surface-subtle)]/35">
                {row.map((cell) => (
                  <td
                    key={cell}
                    className="border-t border-[color:var(--border)]/70 px-3 py-2 align-top leading-5 text-[color:var(--text)]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceCards() {
  return (
    <div className="grid gap-2">
      {sources.map(([title, meta, support, score]) => (
        <article
          key={title}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
            <span
              className={`mt-2 h-2 w-2 rounded-full ${support === "Related" ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`}
            />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">{meta}</p>
            </div>
            <span className="grid justify-items-end gap-1">
              <Pill tone={support === "Related" ? "warn" : "success"}>{support}</Pill>
              <span className="nums text-2xs font-semibold text-[color:var(--text-soft)]">{score}</span>
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--text-muted)]">
            Passage supports monitoring and escalation wording. Open source to inspect the highlighted PDF section.
          </p>
          <ActionRow>
            <Action>
              <ExternalLink className="h-3.5 w-3.5" />
              <ButtonText>Open source</ButtonText>
            </Action>
            <Action>
              <Filter className="h-3.5 w-3.5" />
              <ButtonText>Scope to this</ButtonText>
            </Action>
          </ActionRow>
        </article>
      ))}
    </div>
  );
}

function QuoteCards() {
  return (
    <div className="grid gap-2">
      {[1, 2].map((item) => (
        <article
          key={item}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Exact quote</p>
            <Pill>{item === 1 ? "p.12" : "p.14"}</Pill>
          </div>
          <blockquote className="mt-2 border-l-2 border-[color:var(--clinical-accent)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]">
            &ldquo;FBC/ANC monitoring, myocarditis symptoms, metabolic review and constipation prevention should be
            checked during initiation and ongoing care.&rdquo;
          </blockquote>
          <ActionRow>
            <Action>
              <Copy className="h-3.5 w-3.5" />
              <ButtonText>Copy</ButtonText>
            </Action>
            <Action>
              <Search className="h-3.5 w-3.5" />
              <ButtonText>Ask about quote</ButtonText>
            </Action>
          </ActionRow>
        </article>
      ))}
    </div>
  );
}

function ImageEvidence() {
  const items = [
    { label: "Table crop", icon: Table2, body: "Monitoring domains extracted from a table image." },
    { label: "PDF page region", icon: FileImage, body: "Page crop used to check source layout and nearby wording." },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ label, icon: Icon, body }) => (
        <figure
          key={label}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]"
        >
          <div className="grid min-h-28 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] sm:min-h-32">
            <div className="grid justify-items-center gap-2">
              <Icon className="h-9 w-9 text-[color:var(--clinical-accent)]" />
              <Pill>p.14</Pill>
            </div>
          </div>
          <figcaption className="mt-3">
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">{label}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{body}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function PdfLinks() {
  return (
    <div className="grid gap-2">
      {["Clozapine physical health protocol", "Shared-care communication checklist"].map((title, index) => (
        <button
          type="button"
          key={title}
          className={`grid min-h-[56px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 text-left shadow-[var(--shadow-tight)] transition hover:-translate-y-px hover:border-[color:var(--clinical-accent)]/35 hover:shadow-[var(--shadow-elevated)] ${focusRing}`}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--text)]">{title}</span>
            <span className="block truncate text-xs text-[color:var(--text-muted)]">
              {index === 0 ? "Main source" : "Supporting source"} · opens at page {index === 0 ? 12 : 7}
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <Pill>{index === 0 ? "p.12" : "p.7"}</Pill>
            <ExternalLink className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
          </span>
        </button>
      ))}
    </div>
  );
}

function EvidenceMap() {
  const rows = [
    ["Monitoring", "Moderate", "2", "Current / locally reviewed"],
    ["Escalation", "Strong", "3", "Current / locally reviewed"],
    ["Metabolic review", "Partial", "1", "Review due"],
  ] as const;
  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-[color:var(--surface-subtle)]">
          <tr>
            {["Section", "Support", "Citations", "Source status"].map((header) => (
              <th
                key={header}
                className="border-b border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[color:var(--text)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="even:bg-[color:var(--surface-subtle)]/35">
              {row.map((cell) => (
                <td key={cell} className="border-t border-[color:var(--border)]/70 px-3 py-2 text-[color:var(--text)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileEvidencePanel({ selected }: { selected: string }) {
  return (
    <MobileSheetFrame
      title="Evidence"
      description="Sources, quotes, tables, images, PDFs, and support map for this answer."
    >
      <div className="space-y-3">
        {selected === "Tables" ? <FeedbackPanel /> : <EvidenceSummaryMini selected={selected} />}
        <EvidenceTabs selected={selected} />
        {selected === "Tables" ? <TablePreview /> : null}
        {selected === "Sources" ? <SourceCards /> : null}
        {selected === "Images" ? <ImageEvidence /> : null}
        {selected === "Quotes" ? <QuoteCards /> : null}
        {selected === "PDFs" ? <PdfLinks /> : null}
        {selected === "Map" ? <EvidenceMap /> : null}
      </div>
    </MobileSheetFrame>
  );
}

function DesktopEvidenceModal() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-label="Evidence"
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)] motion-safe:animate-dialog-rise motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] p-3 sm:p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Evidence</h3>
              <Pill tone="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Source-backed
              </Pill>
            </div>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
              Review by evidence type. The answer stays in place behind a dimmed backdrop.
            </p>
          </div>
          <CloseButton label="Close evidence" />
        </div>
        <div className="max-h-[min(44rem,88dvh)] overflow-y-auto p-3 sm:p-4">
          <div className="space-y-3">
            <FeedbackPanel />
            <EvidenceTabs selected="Map" />
            <EvidenceMap />
            <SourceCards />
          </div>
        </div>
      </div>
    </div>
  );
}

function TableDialog() {
  return (
    <div className="rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] p-4">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Clozapine monitoring table</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Expanded from visual evidence. Use the source PDF for final verification.
          </p>
        </div>
        <CloseButton label="Close expanded table" />
      </div>
      <div className="p-4">
        <TablePreview expanded />
      </div>
    </div>
  );
}

function WeakEvidencePopup() {
  return (
    <div className="rounded-lg border border-[color:var(--warning)]/30 border-l-4 border-l-[color:var(--warning)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence support is limited</h3>
            <Pill tone="warn">Do not copy into notes</Pill>
          </div>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            Treat this as source finding only. The closest indexed passages are nearby, but they do not directly support
            a clinical answer yet.
          </p>
          <ActionRow>
            <Action>
              <ExternalLink className="h-3.5 w-3.5" />
              <ButtonText>Open closest passage</ButtonText>
            </Action>
            <Action>
              <Target className="h-3.5 w-3.5" />
              <ButtonText>Restrict to current local sources</ButtonText>
            </Action>
          </ActionRow>
        </div>
      </div>
    </div>
  );
}

export default function AnswerEvidencePopupsMockupPage() {
  return (
    <Shell>
      <div className="grid gap-6">
        <Section
          title="1. Desktop source capsule preview"
          body="Anchored floating popover opened from the source-backed capsule. The answer body stays in place with no layout reflow."
        >
          <DesktopSourcePreviewDemo />
        </Section>

        <Section
          title="2. Mobile source bottom sheet"
          body="Same source preview content, rendered through the responsive sheet on small screens."
        >
          <MobileSheetFrame
            title="Sources behind this answer"
            description="Preview sources first, then open the source document when needed."
          >
            <SourcePreviewPopover />
          </MobileSheetFrame>
        </Section>

        <Section
          title="3. Mobile evidence sheet tabs"
          body="Each card shows the same mobile sheet with a different selected tab. Content is intentionally compact so users can scan before opening a source."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {["Tables", "Sources", "Images", "Quotes", "PDFs", "Map"].map((tab) => (
              <div key={tab} className="min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  {tab} tab
                </p>
                <MobileEvidencePanel selected={tab} />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="4. Desktop evidence modal"
          body="Centered sheet modal with a stronger backdrop, wider evidence panel, and a refined rise-in entrance on desktop."
        >
          <DesktopEvidenceModal />
        </Section>

        <Section
          title="5. Expanded table dialog"
          body="Opened from a table preview/fullscreen action in the evidence area."
        >
          <TableDialog />
        </Section>

        <Section
          title="6. Weak evidence / source gap popup"
          body="Warning state for nearby retrieval matches that do not directly support a clinical answer."
        >
          <WeakEvidencePopup />
        </Section>
      </div>
    </Shell>
  );
}
