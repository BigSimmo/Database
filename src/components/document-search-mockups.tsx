import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  FolderOpen,
  ListChecks,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Tag,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

export type DocumentSearchMockupVariant = "command" | "evidence-lens" | "triage-board";

type DocumentFixture = {
  slug: string;
  title: string;
  meta: string;
  summary: string;
  relevance: string;
  metadata: string;
  caution?: string;
  page: string;
  icon: LucideIcon;
  tags: string[];
  active?: boolean;
};

type VariantCopy = {
  eyebrow: string;
  title: string;
  body: string;
  asset: {
    src: string;
    alt: string;
  };
  priorities: string[];
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const documents: DocumentFixture[] = [
  {
    slug: "clozapine-monitoring",
    title: "Clozapine physical health monitoring protocol",
    meta: "Current source - p.12 - table evidence",
    summary: "Monitoring schedule, escalation thresholds, and shared-care checks are visible before opening the PDF.",
    relevance: "High relevance",
    metadata: "Protocol",
    caution: "Review 2026",
    page: "p.12",
    icon: Table2,
    tags: ["Medication", "Monitoring", "Shared care"],
    active: true,
  },
  {
    slug: "acute-agitation-pathway",
    title: "Acute agitation clinical pathway",
    meta: "Local guideline - p.4 - image and flowchart",
    summary:
      "The result row separates pathway evidence from nearby medication references and keeps actions thumb-ready.",
    relevance: "Relevant",
    metadata: "Guideline",
    page: "p.4",
    icon: FileImage,
    tags: ["Risk", "Escalation", "ED"],
  },
  {
    slug: "mental-health-act-forms",
    title: "Mental Health Act forms quick reference",
    meta: "Indexed source - p.2 - form checklist",
    summary: "Fast access to document type, responsible service, and the exact page most likely to answer the search.",
    relevance: "Exact title",
    metadata: "Quick reference",
    page: "p.2",
    icon: ListChecks,
    tags: ["Forms", "Workflow", "Legal"],
  },
];

function highlightedDocumentHref(document: DocumentFixture) {
  const params = new URLSearchParams({
    mode: "documents",
    document: document.slug,
    q: document.active ? "clozapine monitoring table" : document.title,
    page: document.page.replace("p.", ""),
    chunk: document.active ? "monitoring-table" : "best-match",
  });
  return `/mockups/document-search/source?${params.toString()}`;
}

const facets = [
  { label: "Medication", count: 42, icon: Target },
  { label: "Risk", count: 31, icon: ShieldAlert },
  { label: "Forms", count: 18, icon: ListChecks },
  { label: "Tables", count: 64, icon: Table2 },
  { label: "Review due", count: 9, icon: AlertCircle },
];

const variantCopy: Record<DocumentSearchMockupVariant, VariantCopy> = {
  command: {
    eyebrow: "Production candidate",
    title: "Document search command center",
    body: "A compact scanning layout for clinicians who know the term they need and want the right source, page, and action without opening every PDF.",
    asset: {
      src: "/mockups/document-search/source-stack.png",
      alt: "Synthetic layered document stack with highlighted abstract source regions.",
    },
    priorities: ["Fast scan", "Sort and filter clarity", "Active source preview"],
  },
  "evidence-lens": {
    eyebrow: "Evidence lens",
    title: "Search result with source proof in view",
    body: "A split workbench that treats the top result as an evidence object: page, table, image, and match reasoning stay visible together.",
    asset: {
      src: "/mockups/document-search/evidence-preview.png",
      alt: "Synthetic source page connected to abstract table, image, and warning evidence panels.",
    },
    priorities: ["Preview first", "Explain ranking", "Open exact evidence"],
  },
  "triage-board": {
    eyebrow: "Discovery board",
    title: "Document library triage before the query",
    body: "A discovery-first version for browsing recent work, source health, smart facets, and status lanes before running a focused search.",
    asset: {
      src: "/mockups/document-search/triage-map.png",
      alt: "Synthetic document triage board with abstract grouped source cards and status lanes.",
    },
    priorities: ["Recent work", "Source health", "Facet discovery"],
  },
};

function IconTile({ icon: Icon, tone = "accent" }: { icon: LucideIcon; tone?: "accent" | "info" | "neutral" }) {
  const toneClass =
    tone === "info"
      ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]"
      : tone === "neutral"
        ? "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]"
        : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";

  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
        toneClass,
      )}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
    </span>
  );
}

function Pill({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "info" | "success" | "warning" | "danger";
  icon?: LucideIcon;
}) {
  const toneClass =
    tone === "accent"
      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
      : tone === "info"
        ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]"
        : tone === "success"
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : tone === "warning"
            ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
            : tone === "danger"
              ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
              : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]";

  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold leading-none shadow-[var(--shadow-inset)]",
        toneClass,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Button({
  children,
  primary = false,
  icon: Icon,
}: {
  children: ReactNode;
  primary?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition hover:-translate-y-px hover:shadow-[var(--shadow-tight)] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        focusRing,
        primary
          ? "bg-[color:var(--command)] text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)]"
          : "border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-accent-border)]",
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function ActionLink({
  children,
  href,
  primary = false,
  icon: Icon,
}: {
  children: ReactNode;
  href: string;
  primary?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition hover:-translate-y-px hover:shadow-[var(--shadow-tight)] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        focusRing,
        primary
          ? "bg-[color:var(--command)] text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)]"
          : "border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--clinical-accent-border)]",
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

function SectionFrame({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-base font-bold text-[color:var(--text-heading)]">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SearchBar({ compact = false }: { compact?: boolean }) {
  return (
    <form
      className={cn(
        "grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[0_1px_2px_rgb(16_24_40_/_5%),0_8px_22px_rgb(16_24_40_/_8%)]",
        compact ? "max-w-none" : "max-w-3xl",
      )}
    >
      <Search className="ml-2 h-5 w-5 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
      <span className="min-w-0 truncate text-left text-sm font-semibold text-[color:var(--text-soft)] sm:text-base">
        clozapine monitoring table
      </span>
      <button
        type="button"
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]",
          focusRing,
        )}
        aria-label="Search documents"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function ResultRow({ document, dense = false }: { document: DocumentFixture; dense?: boolean }) {
  const Icon = document.icon;
  const openHref = highlightedDocumentHref(document);
  return (
    <article
      className={cn(
        "group rounded-lg border bg-[color:var(--surface)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)]",
        document.active
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/20"
          : "border-[color:var(--border)]",
        dense ? "p-2.5" : "p-3",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
        <IconTile icon={Icon} tone={document.active ? "accent" : "neutral"} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={document.active ? "success" : "accent"} icon={Target}>
              {document.relevance}
            </Pill>
            <Pill tone="info" icon={FileText}>
              {document.metadata}
            </Pill>
            {document.caution ? (
              <Pill tone="warning" icon={AlertCircle}>
                {document.caution}
              </Pill>
            ) : null}
          </div>
          <Link
            href={openHref}
            className={cn(
              "mt-2 block rounded-md text-sm font-extrabold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] sm:text-base",
              focusRing,
            )}
          >
            <span className="line-clamp-2">{document.title}</span>
          </Link>
          <h3 className="sr-only">{document.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            {document.summary}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {document.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex min-h-6 items-center rounded-md bg-[color:var(--surface-subtle)] px-2 text-[11px] font-bold text-[color:var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <Link
          href={openHref}
          aria-label={`Open ${document.title} with highlighted source information`}
          className={cn("hidden min-w-[4.25rem] rounded-md text-right sm:block", focusRing)}
        >
          <p className="nums text-sm font-extrabold text-[color:var(--text-heading)]">{document.page}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Open</p>
          <ExternalLink className="ml-auto mt-2 h-4 w-4 text-[color:var(--text-soft)] transition group-hover:text-[color:var(--clinical-accent)]" />
        </Link>
      </div>
    </article>
  );
}

function PreviewImage({
  asset,
  overlay,
  priority = false,
}: {
  asset: VariantCopy["asset"];
  overlay?: ReactNode;
  priority?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <Image
        src={asset.src}
        alt={asset.alt}
        width={1536}
        height={1024}
        priority={priority}
        className="h-full min-h-[17rem] w-full object-cover"
        sizes="(min-width: 1024px) 36rem, 100vw"
      />
      {overlay ? <div className="absolute inset-x-3 bottom-3">{overlay}</div> : null}
    </div>
  );
}

function MockupHeader({ copy }: { copy: VariantCopy }) {
  return (
    <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <IconTile icon={FileText} />
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
              {copy.eyebrow}
            </p>
          </div>
          <h1 className="mt-4 max-w-4xl text-balance text-2xl font-extrabold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            {copy.body}
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Design priorities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {copy.priorities.map((priority, index) => (
              <Pill key={priority} tone={index === 0 ? "accent" : "neutral"}>
                {priority}
              </Pill>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function CommandMockup({ copy }: { copy: VariantCopy }) {
  return (
    <div className="space-y-5">
      <SectionFrame
        title="Desktop concept"
        body="Search and sort stay above a compact result list, while the selected source preview stays pinned beside it."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-3">
            <SearchBar />
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <Button icon={SlidersHorizontal}>Best match</Button>
              <Button icon={Filter}>Filter</Button>
              <Button icon={FolderOpen}>Browse library</Button>
              <span className="ml-auto text-sm font-bold text-[color:var(--text-muted)]">
                30 matches from 2,065 indexed
              </span>
            </div>
            <div className="grid gap-2.5">
              {documents.map((document) => (
                <ResultRow key={document.title} document={document} />
              ))}
            </div>
          </div>
          <aside className="min-w-0 space-y-3">
            <PreviewImage
              asset={copy.asset}
              priority
              overlay={
                <div className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)]/95 p-3 shadow-[var(--shadow-tight)] backdrop-blur">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                    Active source preview
                  </p>
                  <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                    Open p.12 with table evidence already selected.
                  </p>
                </div>
              }
            />
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Tables" value="8" icon={Table2} />
              <Metric label="Images" value="3" icon={FileImage} />
              <Metric label="Pages" value="12" icon={BookOpen} />
            </div>
          </aside>
        </div>
      </SectionFrame>
      <MobileCommandPreview />
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
      <p className="nums mt-2 text-xl font-extrabold text-[color:var(--text-heading)]">{value}</p>
      <p className="text-xs font-bold text-[color:var(--text-muted)]">{label}</p>
    </div>
  );
}

function MobileShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SectionFrame
      title="Mobile composition"
      body="A phone-width composition proves the same idea can fit around the document-mode bottom composer."
    >
      <div className="mx-auto max-w-[25rem] rounded-[2rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-chrome)] p-3 shadow-[var(--shadow-lux)]">
        <div className="overflow-hidden rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--background)]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
              Documents
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">{title}</h3>
          </div>
          <div className="space-y-3 p-3">{children}</div>
        </div>
      </div>
    </SectionFrame>
  );
}

function MobileCommandPreview() {
  return (
    <MobileShell title="Compact results">
      <SearchBar compact />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["Best", "Tables", "Current", "Local"].map((item, index) => (
          <span
            key={item}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-xs font-bold",
              index === 0
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
            )}
          >
            {item}
          </span>
        ))}
      </div>
      {documents.slice(0, 2).map((document) => (
        <ResultRow key={document.title} document={document} dense />
      ))}
    </MobileShell>
  );
}

function EvidenceLensMockup({ copy }: { copy: VariantCopy }) {
  return (
    <div className="space-y-5">
      <SectionFrame
        title="Desktop concept"
        body="The selected document becomes a source lens: the list, page preview, evidence modules, and ranking explanation are all visible."
      >
        <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <aside className="grid gap-2.5 self-start">
            <SearchBar compact />
            {documents.map((document) => (
              <ResultRow key={document.title} document={document} dense />
            ))}
          </aside>
          <div className="min-w-0 space-y-3">
            <PreviewImage asset={copy.asset} priority />
            <div className="grid gap-3 md:grid-cols-3">
              <EvidenceTile
                icon={Table2}
                title="Table hit"
                body="Monitoring intervals line up with the query."
                tone="success"
              />
              <EvidenceTile
                icon={FileImage}
                title="Image hit"
                body="Visual pathway available from the same source."
                tone="info"
              />
              <EvidenceTile
                icon={AlertCircle}
                title="Review note"
                body="Review date visible before opening."
                tone="warning"
              />
            </div>
          </div>
          <aside className="space-y-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <div className="flex items-center gap-2">
              <IconTile icon={Sparkles} />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Why this result
                </p>
                <h3 className="text-base font-extrabold text-[color:var(--text-heading)]">Direct source support</h3>
              </div>
            </div>
            <ReasonRow label="Matched terms" value="clozapine, monitoring, table" />
            <ReasonRow label="Evidence type" value="Table, PDF text, image" />
            <ReasonRow label="Open target" value="p.12 with first chunk selected" />
            <div className="grid gap-2 pt-1">
              <ActionLink href={highlightedDocumentHref(documents[0])} primary icon={ExternalLink}>
                Open exact page
              </ActionLink>
              <Button icon={Filter}>Scope to source</Button>
            </div>
          </aside>
        </div>
      </SectionFrame>
      <MobileEvidencePreview />
    </div>
  );
}

function EvidenceTile({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: "success" | "info" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
        : "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border", toneClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-extrabold text-[color:var(--text-heading)]">{title}</h3>
      <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{body}</p>
    </div>
  );
}

function ReasonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--text-heading)]">{value}</p>
    </div>
  );
}

function MobileEvidencePreview() {
  return (
    <MobileShell title="Evidence lens">
      <ResultRow document={documents[0]} dense />
      <div className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
          Preview
        </p>
        <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--text-heading)]">
          p.12 table, source text, and review note are stacked before the PDF opens.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Table" value="1" icon={Table2} />
        <Metric label="Image" value="1" icon={FileImage} />
        <Metric label="Quote" value="3" icon={BookOpen} />
      </div>
    </MobileShell>
  );
}

function TriageBoardMockup({ copy }: { copy: VariantCopy }) {
  return (
    <div className="space-y-5">
      <SectionFrame
        title="Desktop concept"
        body="The document mode home can become a launch board: recent sources, smart facets, source health, and a query path share one surface."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-4">
            <SearchBar />
            <div className="grid gap-3 md:grid-cols-3">
              <BoardLane title="Current sources" count="1,842" icon={CheckCircle2} tone="success" />
              <BoardLane title="Review due" count="156" icon={Clock3} tone="warning" />
              <BoardLane title="Needs labels" count="67" icon={Tag} tone="info" />
            </div>
            <PreviewImage asset={copy.asset} priority />
          </div>
          <aside className="space-y-3">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Smart facets</h3>
                <Button icon={ChevronDown}>All</Button>
              </div>
              <div className="mt-3 grid gap-2">
                {facets.map((facet) => (
                  <FacetButton key={facet.label} facet={facet} />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
              <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Recent documents</h3>
              <div className="mt-3 grid gap-2">
                {documents.map((document) => (
                  <div key={document.title} className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] gap-2">
                    <IconTile icon={document.icon} tone="neutral" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[color:var(--text-heading)]">{document.title}</p>
                      <p className="truncate text-xs font-semibold text-[color:var(--text-soft)]">{document.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </SectionFrame>
      <MobileTriagePreview />
    </div>
  );
}

function FacetButton({ facet }: { facet: (typeof facets)[number] }) {
  const Icon = facet.icon;
  return (
    <button
      type="button"
      className={cn(
        "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)]",
        focusRing,
      )}
    >
      <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
      <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">{facet.label}</span>
      <span className="nums text-xs font-bold text-[color:var(--text-soft)]">{facet.count}</span>
    </button>
  );
}

function BoardLane({
  title,
  count,
  icon,
  tone,
}: {
  title: string;
  count: string;
  icon: LucideIcon;
  tone: "success" | "warning" | "info";
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <div className="flex items-center gap-2">
        <Pill tone={tone} icon={icon}>
          {title}
        </Pill>
      </div>
      <p className="nums mt-4 text-3xl font-extrabold text-[color:var(--text-heading)]">{count}</p>
      <p className="mt-1 text-xs font-bold text-[color:var(--text-muted)]">indexed documents</p>
    </div>
  );
}

function MobileTriagePreview() {
  return (
    <MobileShell title="Library board">
      <SearchBar compact />
      <div className="grid grid-cols-2 gap-2">
        <BoardLane title="Current" count="1.8k" icon={CheckCircle2} tone="success" />
        <BoardLane title="Review" count="156" icon={Clock3} tone="warning" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {facets.slice(0, 4).map((facet) => (
          <Pill key={facet.label} icon={facet.icon} tone="accent">
            {facet.label}
          </Pill>
        ))}
      </div>
      <ResultRow document={documents[0]} dense />
    </MobileShell>
  );
}

export function DocumentSearchMockupPage({ variant }: { variant: DocumentSearchMockupVariant }) {
  const copy = variantCopy[variant];
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-3 py-4 pb-28 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <MockupHeader copy={copy} />
        {variant === "command" ? <CommandMockup copy={copy} /> : null}
        {variant === "evidence-lens" ? <EvidenceLensMockup copy={copy} /> : null}
        {variant === "triage-board" ? <TriageBoardMockup copy={copy} /> : null}
      </div>
    </main>
  );
}
