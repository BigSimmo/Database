import Image from "next/image";
import type { Metadata } from "next";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  FileImage,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  ListChecks,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Evidence Option Mockups - Clinical KB",
  description: "Clinical KB evidence mockups in the app visual style.",
};

type Tone = "source" | "success" | "warning" | "info" | "neutral";

const evidenceItems = [
  {
    title: "ANC monitoring frequency table",
    kind: "Table",
    source: "Clozapine physical health protocol",
    meta: "p.12 - 97% direct",
    body: "Blood monitoring cadence, baseline checks, and action thresholds.",
    icon: Table2,
    tone: "source",
  },
  {
    title: "Constipation escalation passage",
    kind: "Quote",
    source: "Clozapine safety bulletin",
    meta: "p.4 - exact quote",
    body: "Same-day review wording for severe constipation symptoms.",
    icon: Quote,
    tone: "info",
  },
  {
    title: "Observation pathway image",
    kind: "Image",
    source: "Acute behavioural disturbance pathway",
    meta: "p.8 - visual",
    body: "Page crop, diagram labels, and neighbouring source text.",
    icon: FileImage,
    tone: "neutral",
  },
  {
    title: "Lithium toxicity document span",
    kind: "Document span",
    source: "Lithium monitoring guideline",
    meta: "p.6 - review due",
    body: "Threshold wording retained with governance warning.",
    icon: FileText,
    tone: "warning",
  },
] as const;

const tableRows = [
  ["Baseline", "FBC, LFT, U&E, lipids, glucose", "Before initiation"],
  ["Weekly", "FBC/ANC", "Initial titration"],
  ["Escalate", "Chest pain, fever, constipation", "Urgent review"],
] as const;

const evidenceTypes = [
  ["Tables", "621", Table2],
  ["Quotes", "8,904", Quote],
  ["Images", "2,840", FileImage],
  ["PDF regions", "4,221", FileSearch],
  ["Documents", "1,834", FileText],
] as const;

function toneClass(tone: Tone) {
  if (tone === "source") return "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]";
  if (tone === "success") return "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
  if (tone === "warning") return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  if (tone === "info") return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
  return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, tone = "source" }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)] ${toneClass(tone)}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function Action({ children, icon: Icon, primary = false }: { children: ReactNode; icon?: LucideIcon; primary?: boolean }) {
  return (
    <button
      type="button"
      className={
        primary
          ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-3 text-sm font-semibold text-white shadow-[var(--shadow-tight)]"
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
      }
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function SearchControl({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex min-h-[56px] items-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 shadow-[var(--shadow-lux)] ring-1 ring-white/35">
      <Search className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-muted)]">{placeholder}</span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white">
        <Sparkles className="h-4 w-4" />
      </span>
    </div>
  );
}

function AppTopBar({ active = "Evidence" }: { active?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
            <ListChecks className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical Guide</p>
            <p className="truncate text-xs font-medium text-[color:var(--text-soft)]">Source-backed evidence workspace</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["Answer", "Documents", "Evidence", "Favourites"].map((item) => (
            <span
              key={item}
              className={`inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold ${
                item === active
                  ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                  : "text-[color:var(--text-muted)]"
              }`}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Frame({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
          <h3 className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">{title}</h3>
        </div>
        <Pill tone="source">
          <CheckCircle2 className="h-3.5 w-3.5" />
          App-native mockup
        </Pill>
      </div>
      <div className="bg-[color:var(--background)] p-4">{children}</div>
    </article>
  );
}

function EvidenceCard({ item, compact = false }: { item: (typeof evidenceItems)[number]; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
        <IconTile icon={item.icon} tone={item.tone as Tone} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill>{item.kind}</Pill>
            <Pill tone={item.tone as Tone}>{item.meta}</Pill>
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[color:var(--text-heading)]">{item.title}</h4>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.body}</p>
          {!compact ? <p className="mt-2 text-xs font-semibold text-[color:var(--text-soft)]">{item.source}</p> : null}
        </div>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EvidenceTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]">
      <div className="grid grid-cols-[0.8fr_1.25fr_1fr] bg-[color:var(--clinical-chat-table-header)] text-xs font-bold text-[color:var(--text-heading)]">
        <span className="border-r border-[color:var(--border)] p-2">Stage</span>
        <span className="border-r border-[color:var(--border)] p-2">Evidence</span>
        <span className="p-2">Action</span>
      </div>
      {tableRows.map(([stage, evidence, action]) => (
        <div key={stage} className="grid grid-cols-[0.8fr_1.25fr_1fr] border-t border-[color:var(--border)] text-xs text-[color:var(--text-muted)]">
          <span className="border-r border-[color:var(--border)] p-2 font-semibold text-[color:var(--text-heading)]">{stage}</span>
          <span className="border-r border-[color:var(--border)] p-2">{evidence}</span>
          <span className="p-2">{action}</span>
        </div>
      ))}
    </div>
  );
}

function MockupHome() {
  return (
    <Frame label="Mockup 1" title="Evidence Home - Object Library">
      <div className="space-y-4">
        <AppTopBar />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
          <aside className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Evidence objects</p>
            <div className="mt-3 grid gap-2">
              {evidenceTypes.map(([label, count, Icon], index) => (
                <button
                  key={label}
                  type="button"
                  className={`flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm font-semibold shadow-[var(--shadow-inset)] ${
                    index === 0
                      ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                  <span className="nums text-xs">{count}</span>
                </button>
              ))}
            </div>
          </aside>
          <main className="space-y-3">
            <SearchControl placeholder="Search tables, figures, quotes, PDF regions, and document spans..." />
            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
                <IconTile icon={Table2} />
                <h4 className="mt-3 text-lg font-semibold text-[color:var(--text-heading)]">Tables as first-class evidence</h4>
                <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">Rows, image crop, source page, confidence, and provenance together.</p>
                <div className="mt-3">
                  <EvidenceTable />
                </div>
              </section>
              <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
                <IconTile icon={ImageIcon} tone="neutral" />
                <h4 className="mt-3 text-lg font-semibold text-[color:var(--text-heading)]">Images with inspection tools</h4>
                <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">Page crops, labels, region highlights, and neighbouring text.</p>
                <Image src="/demo-documents/risk-flow.png" alt="Risk flow evidence preview" width={240} height={72} loading="eager" unoptimized className="mt-3 w-full rounded-lg border border-[color:var(--border)] object-contain shadow-[var(--shadow-inset)]" />
              </section>
            </div>
          </main>
          <aside className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Review queue</p>
            <div className="mt-3 grid gap-2">
              {evidenceItems.slice(0, 3).map((item) => (
                <EvidenceCard key={item.title} item={item} compact />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

function MockupSearch() {
  return (
    <Frame label="Mockup 2" title="Evidence Search - Filtered Results">
      <div className="space-y-4">
        <AppTopBar />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Filters</p>
              <Filter className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
            </div>
            <div className="mt-3 grid gap-2">
              {["Evidence type", "Clinical topic", "Source status", "Document family", "Confidence"].map((item) => (
                <button key={item} type="button" className="flex min-h-11 items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
                  {item}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </aside>
          <main className="space-y-3">
            <SearchControl placeholder="Find evidence for constipation escalation in clozapine..." />
            <div className="flex flex-wrap gap-2">
              {evidenceTypes.map(([label, count, Icon], index) => (
                <Pill key={label} tone={index === 0 ? "source" : "neutral"}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <span className="nums text-[10px]">{count}</span>
                </Pill>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-2">
                {evidenceItems.map((item) => (
                  <EvidenceCard key={item.title} item={item} />
                ))}
              </div>
              <aside className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2">
                  <IconTile icon={Layers3} />
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-heading)]">Live preview</p>
                    <p className="text-xs text-[color:var(--text-muted)]">Selected table evidence</p>
                  </div>
                </div>
                <div className="mt-3">
                  <EvidenceTable />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Action icon={Copy}>Copy citation</Action>
                  <Action primary icon={ExternalLink}>Open source</Action>
                </div>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </Frame>
  );
}

function MockupDetail() {
  return (
    <Frame label="Mockup 3" title="Evidence Detail - Quote and Source Span">
      <div className="space-y-4">
        <AppTopBar />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="space-y-3">
            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <IconTile icon={Quote} tone="info" />
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <Pill tone="info">Quote evidence</Pill>
                      <Pill tone="success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Source-backed
                      </Pill>
                      <Pill>p.4</Pill>
                    </div>
                    <h4 className="mt-2 text-xl font-semibold text-[color:var(--text-heading)]">Constipation escalation passage</h4>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">Clozapine safety bulletin - locally reviewed source.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Action icon={Copy}>Copy quote</Action>
                  <Action primary icon={ExternalLink}>Open source</Action>
                </div>
              </div>
            </section>
            <figure className="rounded-xl border border-[color:var(--border-lux)] border-l-4 border-l-[color:var(--clinical-chat-teal)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <blockquote className="text-base font-semibold leading-7 text-[color:var(--text-heading)]">
                &quot;Patients reporting severe constipation, abdominal pain, vomiting, or reduced bowel motions require same-day clinical review.&quot;
              </blockquote>
              <figcaption className="mt-3 text-xs font-semibold text-[color:var(--text-soft)]">Clozapine safety bulletin, p.4 - exact extracted quote</figcaption>
            </figure>
            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Neighbouring document context</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {["Previous paragraph", "Selected quote", "Next paragraph"].map((label, index) => (
                  <div key={label} className={`rounded-lg border p-3 ${index === 1 ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)]" : "border-[color:var(--border)] bg-[color:var(--surface)]"}`}>
                    <p className="text-sm font-semibold text-[color:var(--text-heading)]">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{index === 1 ? "Direct wording used for answer support." : "Nearby safety wording retained for context."}</p>
                  </div>
                ))}
              </div>
            </section>
          </main>
          <aside className="space-y-3">
            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Citation packet</p>
              <div className="mt-3 grid gap-2">
                {["Document title", "Page number", "Section heading", "Quote span", "Review status"].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
                    <span className="text-xs font-semibold text-[color:var(--text-muted)]">{item}</span>
                    <BadgeCheck className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Related objects</p>
              <div className="mt-3 grid gap-2">
                {evidenceItems.filter((item) => item.kind !== "Quote").slice(0, 3).map((item) => (
                  <EvidenceCard key={item.title} item={item} compact />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

export default function EvidenceOptionMockupsPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <IconTile icon={ListChecks} />
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Clinical KB evidence option</p>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
                App-native evidence mockups
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                Three responsive mockups using the current Clinical KB style for tables, images, quotes, PDFs, and document spans.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Action primary icon={Search}>Search evidence</Action>
              <Action icon={FolderOpen}>Browse objects</Action>
              <Action icon={ShieldCheck}>Review sources</Action>
            </div>
          </div>
        </header>

        <MockupHome />
        <MockupSearch />
        <MockupDetail />
      </div>
    </main>
  );
}
