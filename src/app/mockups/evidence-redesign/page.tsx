import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Link2,
  ListChecks,
  Quote,
  Search,
  Target,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

const sources = [
  {
    title: "Synthetic lithium monitoring protocol",
    meta: "p.1 - moderate support",
    excerpt:
      "Escalate review when vomiting, diarrhoea, dehydration, acute kidney injury, interacting medicines, tremor, confusion, or ataxia are present.",
    status: "Direct",
    tone: "good",
  },
  {
    title: "Lithium toxicity safety-net",
    meta: "p.1 - direct quote",
    excerpt: "Lithium levels are checked 5 to 7 days after initiation or dose change, then repeated until stable.",
    status: "Direct",
    tone: "good",
  },
  {
    title: "Local source status",
    meta: "governance check",
    excerpt: "Source status is unknown and the document has not been locally validated.",
    status: "Caution",
    tone: "warn",
  },
] as const;

const evidenceStats = [
  ["Support", "Partial"],
  ["Sources", "2"],
  ["Quotes", "2"],
  ["Gaps", "1"],
] as const;

function IconTile({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "green" | "slate" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "slate"
          ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
          : "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]";

  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" | "amber" | "green" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "teal"
          ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]";

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold leading-none ${toneClass}`}
    >
      {children}
    </span>
  );
}

function ActionButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  const baseClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition hover:-translate-y-px hover:shadow-[var(--shadow-tight)] active:translate-y-0 ${focusRing} [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`;
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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconTile>
              <Layers className="h-4 w-4" />
            </IconTile>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Evidence redesign
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text-heading)] sm:text-3xl">
            Evidence without the clutter
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            Three refined directions for the Evidence surface: source-first, support-first, and map-first. Each keeps
            the important audit information visible without turning the answer into a dense dashboard.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Design rule</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="teal">Sources first</Pill>
            <Pill tone="green">Support visible</Pill>
            <Pill tone="amber">Gaps separated</Pill>
          </div>
        </div>
      </div>
    </header>
  );
}

function MockupPair({
  title,
  body,
  recommended = false,
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
      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)]">{children}</div>
    </section>
  );
}

function MockupFrame({ label, children }: { label: string; children: ReactNode }) {
  const frameClass = label === "Desktop" ? "hidden min-w-0 overflow-hidden md:block" : "min-w-0 overflow-hidden";
  return (
    <div className={frameClass}>
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
      <div className="overflow-x-auto pb-2">{children}</div>
    </div>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-[53rem] max-w-[22.75rem] overflow-hidden rounded-[1.75rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[color:var(--border-strong)]" />
      {children}
    </div>
  );
}

function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-[53rem] min-w-[42rem] max-w-[45rem] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] xl:min-w-0">
      {children}
    </div>
  );
}

function EvidenceHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconTile>
              <Layers className="h-4 w-4" />
            </IconTile>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[color:var(--text-heading)]">Evidence</h3>
              <p className="truncate text-sm text-[color:var(--text-muted)]">2 sources - 2 quotes - 1 gap</p>
            </div>
          </div>
          {compact ? null : (
            <p className="mt-3 text-sm leading-5 text-[color:var(--text-muted)]">
              Check source support, exact passages, and gaps before relying on the answer.
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close evidence"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] ${focusRing}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function StatStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-4"}`}>
      {evidenceStats.map(([label, value]) => (
        <div
          key={label}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function SourceCard({ source, dense = false }: { source: (typeof sources)[number]; dense?: boolean }) {
  const tone = source.tone === "warn" ? "amber" : "green";
  return (
    <article className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${source.tone === "warn" ? "bg-amber-500" : "bg-emerald-500"}`}
        />
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{source.title}</h4>
          <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{source.meta}</p>
        </div>
        <Pill tone={tone}>{source.status}</Pill>
      </div>
      <p className={`mt-3 text-sm leading-5 text-[color:var(--text-muted)] ${dense ? "line-clamp-2" : ""}`}>
        {source.excerpt}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-semibold text-[color:var(--clinical-chat-teal)] ${focusRing}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open source
        </button>
        <button
          type="button"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-semibold text-[color:var(--text-muted)] ${focusRing}`}
        >
          <Filter className="h-3.5 w-3.5" />
          Scope
        </button>
      </div>
    </article>
  );
}

function ReviewPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[color:var(--text-heading)]">Answer review</h4>
          <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
            Mark what needs attention without changing the answer.
          </p>
        </div>
        <Pill tone="green">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Reviewed
        </Pill>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton>
          <CheckCircle2 />
          Verified
        </ActionButton>
        <ActionButton>
          <AlertTriangle />
          Needs correction
        </ActionButton>
        <ActionButton>
          <Search />
          Missing source
        </ActionButton>
      </div>
    </section>
  );
}

function TabRow({ compact = false }: { compact?: boolean }) {
  const tabs = [
    ["Sources", "2", Layers],
    ["Map", "2", BookOpen],
    ["Quotes", "2", Quote],
    ["Gaps", "1", AlertTriangle],
  ] as const;
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1 px-1" role="tablist" aria-label="Evidence sections">
        {tabs.map(([label, count, Icon], index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === 0}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold ${focusRing} ${
              index === 0
                ? "border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]"
            } ${compact ? "min-h-11" : ""}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="nums opacity-75">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VariantOnePhone() {
  return (
    <PhoneShell>
      <EvidenceHeader compact />
      <div className="space-y-3 p-3">
        <StatStrip compact />
        <TabRow compact />
        <div className="space-y-2">
          {sources.slice(0, 2).map((source) => (
            <SourceCard key={source.title} source={source} dense />
          ))}
        </div>
        <ReviewPanel />
      </div>
    </PhoneShell>
  );
}

function VariantOneDesktop() {
  return (
    <DesktopShell>
      <div className="grid min-h-[53rem] grid-cols-[14.5rem_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <EvidenceHeader compact />
          <div className="mt-4 space-y-3">
            <StatStrip compact />
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Focus</p>
              <p className="mt-2 text-sm leading-5 text-[color:var(--text-muted)]">
                Top sources first. Governance warnings are visible but secondary.
              </p>
            </div>
          </div>
        </aside>
        <section className="grid grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Source-first audit</h3>
                <p className="text-sm text-[color:var(--text-muted)]">Review the passages that support the answer.</p>
              </div>
              <ActionButton primary>
                <Copy />
                Copy evidence
              </ActionButton>
            </div>
          </div>
          <div className="grid content-start gap-3 p-4">
            {sources.map((source) => (
              <SourceCard key={source.title} source={source} />
            ))}
            <ReviewPanel />
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
            <ActionButton>
              <FileText />
              Open PDF
            </ActionButton>
            <ActionButton>
              <Filter />
              Scope document
            </ActionButton>
          </footer>
        </section>
      </div>
    </DesktopShell>
  );
}

function SupportScale() {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Support</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--text-heading)]">Partial</p>
        </div>
        <IconTile tone="amber">
          <AlertTriangle className="h-4 w-4" />
        </IconTile>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1">
        <span className="h-2 rounded-l-full bg-emerald-400" />
        <span className="h-2 bg-amber-400" />
        <span className="h-2 rounded-r-full bg-[color:var(--border-strong)]" />
      </div>
      <p className="mt-3 text-sm leading-5 text-[color:var(--text-muted)]">
        Direct sources support the safety-netting answer, but local validation status is unknown.
      </p>
    </div>
  );
}

function CompactEvidenceRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
      <IconTile tone="slate">{icon}</IconTile>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</h4>
        <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}

function VariantTwoPhone() {
  return (
    <PhoneShell>
      <EvidenceHeader compact />
      <div className="space-y-3 p-3">
        <SupportScale />
        <CompactEvidenceRow
          icon={<Layers className="h-4 w-4" />}
          title="Sources"
          body="2 relevant passages from the lithium protocol."
        />
        <CompactEvidenceRow
          icon={<Quote className="h-4 w-4" />}
          title="Quotes"
          body="2 short source excerpts available for checking wording."
        />
        <CompactEvidenceRow
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Gap"
          body="Local validation status is unknown; verify before clinical reliance."
        />
        <ActionButton primary>
          <ExternalLink />
          Open source review
        </ActionButton>
      </div>
    </PhoneShell>
  );
}

function VariantTwoDesktop() {
  return (
    <DesktopShell>
      <div className="grid min-h-[53rem] grid-rows-[auto_minmax(0,1fr)_auto]">
        <EvidenceHeader />
        <div className="grid gap-4 p-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="space-y-3">
            <SupportScale />
            <ReviewPanel />
          </aside>
          <section className="grid content-start gap-3">
            <CompactEvidenceRow
              icon={<Layers className="h-4 w-4" />}
              title="Source support"
              body="2 source passages directly support the answer's monitoring and toxicity safety-netting statements."
            />
            <CompactEvidenceRow
              icon={<Quote className="h-4 w-4" />}
              title="Exact quotes"
              body="Short excerpts are shown only when needed; the default view avoids a wall of text."
            />
            <CompactEvidenceRow
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Governance gap"
              body="The source is not locally validated. Show the warning clearly, but keep it separate from the evidence itself."
            />
            <CompactEvidenceRow
              icon={<ClipboardCheck className="h-4 w-4" />}
              title="Clinician action"
              body="Open the source PDF, scope to the document, or mark the evidence as verified/corrected."
            />
          </section>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
          <ActionButton>
            <BookOpen />
            Sources
          </ActionButton>
          <ActionButton primary>
            <CheckCircle2 />
            Mark reviewed
          </ActionButton>
        </footer>
      </div>
    </DesktopShell>
  );
}

function MapNode({ title, body, tone = "teal" }: { title: string; body: string; tone?: "teal" | "amber" | "green" }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            tone === "amber"
              ? "bg-amber-500"
              : tone === "green"
                ? "bg-emerald-500"
                : "bg-[color:var(--clinical-chat-teal)]"
          }`}
        />
        <h4 className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</h4>
      </div>
      <p className="mt-2 text-sm leading-5 text-[color:var(--text-muted)]">{body}</p>
    </div>
  );
}

function VariantThreePhone() {
  return (
    <PhoneShell>
      <EvidenceHeader compact />
      <div className="space-y-3 p-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <div className="flex items-center gap-2">
            <IconTile>
              <Target className="h-4 w-4" />
            </IconTile>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Evidence map
              </p>
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Answer to source</p>
            </div>
          </div>
        </div>
        <MapNode
          title="Answer claim"
          body="Toxicity safety-netting should include GI symptoms, tremor, confusion, ataxia, dehydration, and acute kidney injury."
        />
        <div className="ml-5 h-8 border-l border-[color:var(--border-strong)]" />
        <MapNode
          title="Supporting passage"
          body="The lithium protocol lists the same escalation triggers."
          tone="green"
        />
        <div className="ml-5 h-8 border-l border-[color:var(--border-strong)]" />
        <MapNode title="Gap" body="Local validation status unknown." tone="amber" />
      </div>
    </PhoneShell>
  );
}

function VariantThreeDesktop() {
  return (
    <DesktopShell>
      <div className="grid min-h-[53rem] grid-rows-[auto_minmax(0,1fr)]">
        <EvidenceHeader />
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Evidence map</h3>
                <p className="text-sm text-[color:var(--text-muted)]">
                  Trace each important answer claim back to its support.
                </p>
              </div>
              <Pill tone="teal">
                <Link2 className="h-3.5 w-3.5" />2 mapped claims
              </Pill>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <MapNode title="Claim" body="Lithium toxicity symptoms require escalation review." />
              <MapNode
                title="Source passage"
                body="Vomiting, diarrhoea, dehydration, AKI, tremor, confusion, and ataxia listed."
                tone="green"
              />
              <MapNode title="Gap" body="Source status unknown; verify document governance." tone="amber" />
              <MapNode title="Claim" body="Lithium levels are checked after initiation or dose changes." />
              <MapNode
                title="Source passage"
                body="Levels checked 5 to 7 days after initiation or dose change until stable."
                tone="green"
              />
              <MapNode title="Action" body="Open source PDF before copying into clinical documentation." tone="teal" />
            </div>
          </section>
          <aside className="space-y-3">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Best for</p>
              <p className="mt-2 text-sm leading-5 text-[color:var(--text-muted)]">
                Governance review, disputed answers, or when a clinician asks why the answer is supported.
              </p>
            </div>
            <ActionButton primary>
              <BookOpen />
              Open mapped source
            </ActionButton>
            <ActionButton>
              <ListChecks />
              Show quotes
            </ActionButton>
          </aside>
        </div>
      </div>
    </DesktopShell>
  );
}

export default function EvidenceRedesignPage() {
  return (
    <main
      data-evidence-redesign
      className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8"
    >
      <style>{`
        body:has([data-evidence-redesign]) form:has([data-testid="global-search-input"]) {
          display: none !important;
        }

        body:has([data-evidence-redesign]) nextjs-portal,
        body:has([data-evidence-redesign]) [data-nextjs-dialog-overlay],
        body:has([data-evidence-redesign]) [data-nextjs-toast],
        body:has([data-evidence-redesign]) [data-nextjs-dev-overlay] {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader />

        <MockupPair
          title="1. Source-first audit"
          body="Recommended. The clinician sees the source list first, with support labels, short excerpts, and only the essential actions."
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
          title="2. Support review"
          body="A calmer version for routine answers. It starts with the support status, then presents only sources, quotes, gaps, and review actions."
        >
          <MockupFrame label="Phone">
            <VariantTwoPhone />
          </MockupFrame>
          <MockupFrame label="Desktop">
            <VariantTwoDesktop />
          </MockupFrame>
        </MockupPair>

        <MockupPair
          title="3. Evidence map"
          body="Best for difficult or disputed answers. It maps answer claims to source passages and separates governance gaps from clinical content."
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
