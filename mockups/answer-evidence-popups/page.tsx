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
  ["Clozapine physical health protocol", "p.12 - current", "92%"],
  ["Clozapine monitoring table image evidence", "p.14 - locally reviewed", "86%"],
  ["Shared-care communication checklist", "p.7 - review due", "71%"],
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

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]">
              <Layers className="h-4 w-4" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Clinical KB mockup
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)]">
            Answer evidence popup states
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            Static mockups of the current popup and drawer patterns opened from answer evidence: source preview,
            evidence sheet tabs, desktop drawer, table expansion, and weak-evidence states.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
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
      className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Action({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      className={
        primary
          ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-3 text-sm font-semibold text-[color:var(--primary-contrast)] shadow-[var(--shadow-tight)]"
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)]"
      }
    >
      {children}
    </button>
  );
}

function SourceRows() {
  return (
    <div className="mt-3 grid gap-1.5" role="list" aria-label="Sources behind this answer">
      {sources.map(([title, meta, score], index) => (
        <div
          key={title}
          className="grid min-h-[44px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2"
          role="listitem"
        >
          <span
            className={`h-2 w-2 rounded-full ${index === 2 ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
            <span className="block truncate text-xs text-[color:var(--text-muted)]">{meta}</span>
          </span>
          <Pill>{score}</Pill>
        </div>
      ))}
    </div>
  );
}

function SourcePreviewPopover() {
  return (
    <div className="max-w-xl rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-elevated)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Sources behind this answer
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
            Preview first, then open the source document when needed.
          </p>
        </div>
        <Pill>3 sources</Pill>
      </div>
      <SourceRows />
      <blockquote className="mt-3 border-l-2 border-[color:var(--clinical-chat-teal)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]">
        &ldquo;Monitor FBC/ANC, myocarditis symptoms, metabolic risk, constipation, and shared-care communication during
        clozapine initiation.&rdquo;
      </blockquote>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Action>
          <ExternalLink className="h-3.5 w-3.5" />
          Open PDF drawer
        </Action>
        <Action>
          <Copy className="h-3.5 w-3.5" />
          Copy quote
        </Action>
        <Action>
          <BookOpen className="h-3.5 w-3.5" />
          View section
        </Action>
      </div>
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
    <div className="overflow-hidden rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)] sm:max-w-md">
      <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] p-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{description}</p>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[31rem] overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function EvidenceTabs({ selected }: { selected: string }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1 px-1" role="tablist" aria-label="Evidence sections">
        {tabs.map(([label, count, Icon]) => {
          const active = label === selected;
          return (
            <button
              key={label}
              type="button"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold ${
                active
                  ? "border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="nums text-[11px] opacity-80">{count}</span>
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
      <p className="text-sm font-semibold text-[color:var(--text)]">Answer review</p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
        Capture misses for retrieval and RAG evals without changing the answer.
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

function TablePreview({ expanded = false }: { expanded?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] ${expanded ? "" : "shadow-[var(--shadow-tight)]"}`}
    >
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-[color:var(--border)] bg-[color:var(--clinical-chat-table-header)] px-3 py-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <span>Clozapine monitoring schedule</span>
        {expanded ? (
          <Pill tone="warn">Verify against source</Pill>
        ) : (
          <Maximize2 className="h-4 w-4 text-[color:var(--text-muted)]" />
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
      {sources.map(([title, meta, score]) => (
        <article
          key={title}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
            <span className="mt-2 h-2 w-2 rounded-full bg-[color:var(--success)]" />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">{meta}</p>
            </div>
            <Pill>{score}</Pill>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--text-muted)]">
            Retrieved passage includes monitoring, escalation, and shared-care follow-up wording.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Action>
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Action>
            <Action>
              <Filter className="h-3.5 w-3.5" />
              Scope
            </Action>
          </div>
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
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Exact quote</p>
          <blockquote className="mt-2 border-l-2 border-[color:var(--clinical-chat-teal)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]">
            &ldquo;FBC/ANC monitoring, myocarditis symptoms, metabolic review and constipation prevention should be checked
            during initiation and ongoing care.&rdquo;
          </blockquote>
          <div className="mt-3 flex flex-wrap gap-2">
            <Action>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Action>
            <Action>
              <Search className="h-3.5 w-3.5" />
              Ask follow-up
            </Action>
          </div>
        </article>
      ))}
    </div>
  );
}

function ImageEvidence() {
  const items = [
    { label: "Table crop", icon: Table2 },
    { label: "PDF page region", icon: FileImage },
  ] as const;

  return (
    <div className="grid gap-3">
      {items.map(({ label, icon: Icon }) => (
        <figure
          key={label}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]"
        >
          <div className="grid min-h-36 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
            <Icon className="h-10 w-10 text-[color:var(--clinical-chat-teal)]" />
          </div>
          <figcaption className="mt-3">
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">{label}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
              Clozapine monitoring visual evidence, page 14.
            </p>
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
        <div
          key={title}
          className="flex min-h-[52px] items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--text)]">{title}</span>
            <span className="block truncate text-xs text-[color:var(--text-muted)]">
              {index === 0 ? "Main source" : "Supporting source"} - page {index === 0 ? 12 : 7}
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
        </div>
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
    <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
      <table className="w-full text-left text-sm">
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
      <div className="space-y-4">
        <FeedbackPanel />
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

function DesktopEvidenceDrawer() {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-elevated)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Evidence</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">3 sources, 2 quotes, 1 table, 2 images</p>
        </div>
        <Pill tone="success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Source-backed
        </Pill>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-3">
          <FeedbackPanel />
          <EvidenceMap />
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Pinned source</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text)]">Clozapine physical health protocol</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill tone="success">Current</Pill>
              <Pill>Locally reviewed</Pill>
            </div>
          </div>
          <SourceCards />
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
          <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Clinical table</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">Expanded table preview from visual evidence.</p>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
          <X className="h-4 w-4" />
        </button>
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
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence support is limited</h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            Treat this as a source-finding result until the linked passage is verified. Closest sources are shown, but
            there is no strong direct answer support.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Action>
              <ExternalLink className="h-3.5 w-3.5" />
              Open closest source
            </Action>
            <Action>
              <Target className="h-3.5 w-3.5" />
              Limit to local/current sources
            </Action>
          </div>
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
          body="Small inline popover opened from the source-backed capsule underneath the natural-language answer."
        >
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <p className="max-w-[68ch] text-[15px] font-medium leading-[1.56] text-[color:var(--text-heading)]">
              Clozapine monitoring should include FBC/ANC, myocarditis symptoms, metabolic checks, constipation
              prevention, and shared-care communication.
            </p>
            <button className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--clinical-chat-teal)]/18 bg-[color:var(--clinical-chat-teal-soft)] px-3 text-xs font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
              Source-backed - 3 sources
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="mt-3">
              <SourcePreviewPopover />
            </div>
          </div>
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
          body="The unified evidence popup uses tabs. Each mockup below shows one selected state."
        >
          <div className="grid gap-4 lg:grid-cols-2">
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
          title="4. Desktop evidence drawer"
          body="Desktop evidence expands as an inline drawer with review controls, support map, pinned source, and cited excerpts."
        >
          <DesktopEvidenceDrawer />
        </Section>

        <Section
          title="5. Expanded table dialog"
          body="Opened from a table preview/fullscreen action in the evidence area."
        >
          <TableDialog />
        </Section>

        <Section
          title="6. Weak evidence / source gap popup"
          body="Warning state shown when retrieval returns nearby sources but not enough direct support."
        >
          <WeakEvidencePopup />
        </Section>
      </div>
    </Shell>
  );
}
