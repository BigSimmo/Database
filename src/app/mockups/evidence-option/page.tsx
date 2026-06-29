import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileImage,
  FileSearch,
  FileText,
  Filter,
  Layers3,
  Library,
  ListChecks,
  PanelRightOpen,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  SplitSquareHorizontal,
  Table2,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Premium Evidence Mockups - Clinical KB",
  description: "Premium ChatGPT-style evidence workspace mockups.",
};

type Tone = "green" | "amber" | "blue" | "graphite";

const evidenceItems = [
  {
    title: "ANC monitoring frequency table",
    kind: "Table",
    source: "Clozapine physical health protocol",
    meta: "p. 12 - 97% direct support",
    summary: "Baseline and ongoing blood monitoring cadence with hold thresholds.",
    icon: Table2,
    tone: "green",
  },
  {
    title: "Constipation escalation passage",
    kind: "Quote",
    source: "Clozapine safety bulletin",
    meta: "p. 4 - exact quote",
    summary: "Same-day review wording for severe constipation and abdominal symptoms.",
    icon: Quote,
    tone: "blue",
  },
  {
    title: "Observation pathway crop",
    kind: "Image",
    source: "Acute behavioural disturbance pathway",
    meta: "p. 8 - visual extraction",
    summary: "Diagram labels, observation frequency, and escalation checkpoints.",
    icon: FileImage,
    tone: "graphite",
  },
  {
    title: "Lithium toxicity threshold span",
    kind: "Document span",
    source: "Lithium monitoring guideline",
    meta: "p. 6 - review due",
    summary: "Older local passage retained with date and governance warning.",
    icon: FileText,
    tone: "amber",
  },
] as const;

const tableRows = [
  ["Baseline", "FBC, LFT, U&E, lipids, glucose", "Before initiation"],
  ["Weekly", "FBC/ANC", "Initial titration phase"],
  ["Escalate", "Chest pain, fever, severe constipation", "Urgent medical review"],
] as const;

const sourceKinds = [
  ["Tables", "621", Table2],
  ["Quotes", "8,904", Quote],
  ["Images", "2,840", FileImage],
  ["PDF regions", "4,221", FileSearch],
  ["Document pages", "1,834", FileText],
] as const;

function tone(t: Tone) {
  if (t === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (t === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (t === "blue") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function Badge({ children, variant = "graphite" }: { children: ReactNode; variant?: Tone }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium ${tone(variant)}`}
    >
      {children}
    </span>
  );
}

function Glyph({ icon: Icon, variant = "graphite" }: { icon: LucideIcon; variant?: Tone }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${tone(variant)}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function GhostButton({
  children,
  icon: Icon,
  primary = false,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        primary
          ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#101010] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgb(0_0_0_/_14%)]"
          : "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-[0_1px_0_rgb(0_0_0_/_4%)]"
      }
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Premium evidence direction</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function Frame({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-white shadow-[0_24px_80px_rgb(15_15_15_/_8%)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-950">{title}</h3>
        </div>
        <Badge variant="green">
          <Eye className="h-3.5 w-3.5" />
          Premium mockup
        </Badge>
      </div>
      <div className="bg-[radial-gradient(circle_at_top_left,rgb(16_163_127_/_0.08),transparent_34%),linear-gradient(180deg,#ffffff,#f8f9f8)] p-5">
        {children}
      </div>
    </article>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex min-h-13 items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 shadow-[0_14px_50px_rgb(15_15_15_/_8%)]">
      <Search className="h-4 w-4 shrink-0 text-emerald-700" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-600">{placeholder}</span>
      <span className="hidden rounded-full bg-[#101010] px-3 py-1.5 text-xs font-semibold text-white sm:inline-flex">
        Ask evidence
      </span>
    </div>
  );
}

function EvidenceCard({ item, compact = false }: { item: (typeof evidenceItems)[number]; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_40px_rgb(0_0_0_/_5%)]">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
        <Glyph icon={item.icon} variant={item.tone as Tone} />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge>{item.kind}</Badge>
            <Badge variant={item.tone as Tone}>{item.meta}</Badge>
          </div>
          <h4 className="mt-3 text-sm font-semibold text-zinc-950">{item.title}</h4>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{item.summary}</p>
          {!compact ? <p className="mt-2 text-xs font-semibold text-zinc-500">{item.source}</p> : null}
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EvidenceTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-[0.8fr_1.3fr_1fr] bg-zinc-950 text-xs font-semibold text-white">
        <span className="border-r border-white/10 p-3">Stage</span>
        <span className="border-r border-white/10 p-3">Evidence</span>
        <span className="p-3">Action</span>
      </div>
      {tableRows.map(([stage, evidence, action]) => (
        <div key={stage} className="grid grid-cols-[0.8fr_1.3fr_1fr] border-t border-zinc-100 text-xs text-zinc-600">
          <span className="border-r border-zinc-100 p-3 font-semibold text-zinc-950">{stage}</span>
          <span className="border-r border-zinc-100 p-3">{evidence}</span>
          <span className="p-3">{action}</span>
        </div>
      ))}
    </div>
  );
}

function TopNav() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-zinc-200 bg-white/90 px-3 py-2 shadow-[0_12px_50px_rgb(0_0_0_/_7%)]">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#101010] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-zinc-950">Clinical KB Evidence</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {["Home", "Search", "Tables", "Images", "Quotes"].map((item, index) => (
          <span
            key={item}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${index === 0 ? "bg-zinc-950 text-white" : "text-zinc-600"}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function HomeOne() {
  return (
    <Frame label="Home 1" title="AI evidence studio">
      <div className="space-y-5">
        <TopNav />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <div className="rounded-[1.6rem] bg-[#101010] p-6 text-white shadow-[0_24px_90px_rgb(0_0_0_/_18%)]">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">Evidence workspace</p>
              <h4 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal">
                Ask across every document part with source-grade confidence.
              </h4>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Search images, extracted tables, exact quotes, PDF regions, and source spans without leaving the answer
                workflow.
              </p>
              <div className="mt-5">
                <SearchBar placeholder="Find the exact table, quote, or image behind clozapine monitoring..." />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {sourceKinds.slice(0, 3).map(([label, count, Icon], index) => (
                <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <Glyph icon={Icon} variant={index === 0 ? "green" : index === 1 ? "blue" : "graphite"} />
                  <p className="mt-3 text-sm font-semibold text-zinc-950">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-950">{count}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-[1.4rem] border border-zinc-200 bg-white p-4 shadow-[0_12px_50px_rgb(0_0_0_/_6%)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Priority review</p>
            <div className="mt-4 space-y-3">
              {evidenceItems.map((item) => (
                <EvidenceCard key={item.title} item={item} compact />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

function HomeTwo() {
  return (
    <Frame label="Home 2" title="Object-first evidence library">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-[1.4rem] bg-zinc-950 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Library objects</p>
          <div className="mt-4 grid gap-2">
            {sourceKinds.map(([label, count, Icon], index) => (
              <div
                key={label}
                className={`flex items-center justify-between rounded-2xl px-3 py-3 ${index === 0 ? "bg-white text-zinc-950" : "bg-white/6 text-white/75"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span className="text-xs font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </aside>
        <div className="space-y-4">
          <SearchBar placeholder="Search across tables, figures, document text, images, and citations..." />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-zinc-200 bg-white p-5">
              <Glyph icon={Table2} variant="green" />
              <h4 className="mt-4 text-xl font-semibold text-zinc-950">Tables as first-class evidence</h4>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Extracted rows, image crop, source page, confidence, and quote-level provenance in one place.
              </p>
              <div className="mt-4">
                <EvidenceTable />
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-zinc-200 bg-white p-5">
              <Glyph icon={FileImage} variant="graphite" />
              <h4 className="mt-4 text-xl font-semibold text-zinc-950">Images with inspection tools</h4>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Page crops, figure labels, region highlights, and source text shown together.
              </p>
              <Image
                src="/demo-documents/risk-flow.png"
                alt="Risk flow evidence preview"
                width={240}
                height={72}
                loading="eager"
                unoptimized
                className="mt-4 w-full rounded-2xl border border-zinc-200 object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function HomeThree() {
  return (
    <Frame label="Home 3" title="Conversation-led evidence home">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[1.6rem] border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgb(0_0_0_/_7%)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#101010] text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-950">What evidence do you need?</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Ask for a document part directly, then refine by source, date, type, confidence, or clinical domain.
              </p>
              <div className="mt-4 grid gap-2">
                {[
                  "Show the table behind ANC monitoring",
                  "Find the exact constipation quote",
                  "Open the pathway image and neighbouring text",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="flex min-h-11 items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-left text-sm font-semibold text-zinc-800"
                  >
                    {prompt}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <aside className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Quality signal</p>
          <div className="mt-4 space-y-3">
            {[
              ["Extraction", "Strong", "green"],
              ["Lineage", "Complete", "green"],
              ["Currency", "6 review due", "amber"],
              ["Answer use", "High", "blue"],
            ].map(([label, value, variant]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="text-sm font-medium text-zinc-600">{label}</span>
                <Badge variant={variant as Tone}>{value}</Badge>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Frame>
  );
}

function SearchOne() {
  return (
    <Frame label="Search 1" title="Premium ranked search">
      <div className="space-y-5">
        <SearchBar placeholder="clozapine myocarditis monitoring table" />
        <div className="flex flex-wrap gap-2">
          {sourceKinds.map(([label, count, Icon], index) => (
            <button
              key={label}
              type="button"
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${index === 0 ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="text-xs opacity-65">{count}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            {evidenceItems.map((item) => (
              <EvidenceCard key={item.title} item={item} />
            ))}
          </div>
          <aside className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Glyph icon={PanelRightOpen} variant="green" />
              <div>
                <p className="text-sm font-semibold text-zinc-950">Live preview</p>
                <p className="text-xs text-zinc-500">ANC monitoring frequency table</p>
              </div>
            </div>
            <div className="mt-4">
              <EvidenceTable />
            </div>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

function SearchTwo() {
  return (
    <Frame label="Search 2" title="Filter-led source finding">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Filters</p>
            <Filter className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="mt-4 grid gap-2">
            {["Evidence type", "Clinical topic", "Source status", "Document family", "Confidence"].map((item) => (
              <button
                key={item}
                type="button"
                className="flex min-h-11 items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-700"
              >
                {item}
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </aside>
        <div className="space-y-4">
          <SearchBar placeholder="Find evidence for constipation escalation in clozapine" />
          <div className="grid gap-3 lg:grid-cols-2">
            {evidenceItems.map((item) => (
              <EvidenceCard key={item.title} item={item} compact />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function SearchThree() {
  return (
    <Frame label="Search 3" title="Answer-support clustering">
      <div className="space-y-5">
        <div className="rounded-[1.4rem] bg-zinc-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">Evidence query</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <h4 className="text-2xl font-semibold">What supports weekly ANC monitoring during clozapine initiation?</h4>
            <GhostButton primary icon={Sparkles}>
              Build evidence pack
            </GhostButton>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Direct support", count: "9 items", icon: Target, tone: "green" },
            { label: "Nearby context", count: "11 items", icon: Layers3, tone: "blue" },
            { label: "Conflicts / gaps", count: "3 items", icon: ShieldCheck, tone: "amber" },
          ].map(({ label, count, icon, tone: variant }) => (
            <div key={label} className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
              <Glyph icon={icon} variant={variant as Tone} />
              <p className="mt-3 text-sm font-semibold text-zinc-950">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-950">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function DetailHeader({
  title,
  kind,
  icon,
  variant,
}: {
  title: string;
  kind: string;
  icon: LucideIcon;
  variant: Tone;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Glyph icon={icon} variant={variant} />
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={variant}>{kind}</Badge>
            <Badge variant="green">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Source-backed
            </Badge>
            <Badge>p. 12</Badge>
          </div>
          <h4 className="mt-3 text-2xl font-semibold text-zinc-950">{title}</h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Clozapine physical health protocol - indexed June 2026 - locally reviewed source.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <GhostButton icon={Copy}>Copy citation</GhostButton>
        <GhostButton primary icon={ExternalLink}>
          Open source
        </GhostButton>
      </div>
    </div>
  );
}

function DetailTable() {
  return (
    <Frame label="Detail 1" title="Table evidence detail">
      <div className="space-y-5">
        <DetailHeader title="ANC monitoring frequency table" kind="Table evidence" icon={Table2} variant="green" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-4">
            <EvidenceTable />
            <div className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Extracted source image</p>
              <Image
                src="/demo-documents/clozapine-table.png"
                alt="Extracted clozapine monitoring table evidence"
                width={240}
                height={208}
                loading="eager"
                unoptimized
                className="mt-4 max-h-[21rem] w-full rounded-2xl border border-zinc-200 object-contain"
              />
            </div>
          </div>
          <aside className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Why it ranks</p>
            <div className="mt-4 space-y-3">
              {[
                "Direct table match",
                "Medication + monitoring terms",
                "Current local policy",
                "High OCR confidence",
              ].map((item) => (
                <p key={item} className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <BadgeCheck className="h-4 w-4 text-emerald-700" />
                  {item}
                </p>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

function DetailImage() {
  return (
    <Frame label="Detail 2" title="Image evidence detail">
      <div className="space-y-5">
        <DetailHeader
          title="Rapid tranquillisation observation pathway"
          kind="Image evidence"
          icon={FileImage}
          variant="graphite"
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Page crop and labels</p>
              <Badge variant="blue">Visual extraction</Badge>
            </div>
            <Image
              src="/demo-documents/risk-flow.png"
              alt="Extracted risk flow image evidence"
              width={240}
              height={72}
              loading="eager"
              unoptimized
              className="mt-4 max-h-[30rem] w-full rounded-2xl border border-zinc-200 object-contain"
            />
          </div>
          <aside className="space-y-3">
            <div className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Extracted labels</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Observation frequency",
                  "Escalation",
                  "Senior review",
                  "Vital signs",
                  "Sedation score",
                  "Document dose",
                ].map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
              </div>
            </div>
            <GhostButton icon={SplitSquareHorizontal}>Compare to page text</GhostButton>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

function DetailQuote() {
  return (
    <Frame label="Detail 3" title="Quote and document-span detail">
      <div className="space-y-5">
        <DetailHeader title="Constipation escalation passage" kind="Quote evidence" icon={Quote} variant="blue" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-3">
            {[
              "Patients reporting severe constipation, abdominal pain, vomiting, or reduced bowel motions require same-day clinical review.",
              "Monitoring frequency should be increased where clinical status changes, supply is interrupted, or blood results approach action thresholds.",
            ].map((quote, index) => (
              <figure
                key={quote}
                className={`rounded-[1.4rem] border bg-white p-5 shadow-[0_12px_45px_rgb(0_0_0_/_5%)] ${index === 0 ? "border-zinc-950" : "border-zinc-200"}`}
              >
                <blockquote className="text-lg font-semibold leading-8 text-zinc-950">&quot;{quote}&quot;</blockquote>
                <figcaption className="mt-4 text-xs font-semibold text-zinc-500">
                  Clozapine safety bulletin, p. {index === 0 ? "4" : "12"}
                </figcaption>
              </figure>
            ))}
          </div>
          <aside className="rounded-[1.4rem] border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Citation packet</p>
            <div className="mt-4 space-y-3">
              {["Document title", "Page number", "Section heading", "Quote span", "Review status"].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between border-b border-zinc-100 pb-3 last:border-b-0"
                >
                  <span className="text-sm font-medium text-zinc-600">{item}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </Frame>
  );
}

export default function EvidenceOptionMockupsPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-9">
        <header className="overflow-hidden rounded-[1.75rem] bg-[#101010] p-6 text-white shadow-[0_30px_120px_rgb(0_0_0_/_22%)]">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-zinc-950">
                  <ListChecks className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                  Clinical KB evidence option
                </p>
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Premium mockups for document evidence
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/68">
                A completely new ChatGPT premium direction for tables, images, quotes, PDF regions, source packs, and
                document spans.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <GhostButton primary icon={Search}>
                  Search evidence
                </GhostButton>
                <GhostButton icon={Library}>Browse library</GhostButton>
                <GhostButton icon={BookOpen}>Review sources</GhostButton>
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Included</p>
              <div className="mt-4 grid gap-3">
                {[
                  ["Home", "3 premium entry directions"],
                  ["Search", "3 result workflows"],
                  ["Detail", "3 evidence-type pages"],
                ].map(([label, body]) => (
                  <div key={label} className="rounded-2xl bg-white px-4 py-3 text-zinc-950">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-zinc-500">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <Section
          title="Home Page Directions"
          body="Three premium home concepts for entering the evidence system: studio, object library, and conversation-led workspace."
        >
          <HomeOne />
          <HomeTwo />
          <HomeThree />
        </Section>

        <Section
          title="Search Page Directions"
          body="Three search patterns for source discovery, filtered retrieval, and evidence-pack creation."
        >
          <SearchOne />
          <SearchTwo />
          <SearchThree />
        </Section>

        <Section
          title="Individual Evidence Page Directions"
          body="Three detail pages designed around document object types: table, image, and exact quote/span evidence."
        >
          <DetailTable />
          <DetailImage />
          <DetailQuote />
        </Section>
      </div>
    </main>
  );
}
