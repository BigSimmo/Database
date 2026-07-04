"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  ImageIcon,
  Layers3,
  List,
  MessageSquareText,
  MoreVertical,
  PanelRight,
  Quote,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { documentEvidenceHref, documentReaderHref, documentsSearchHref } from "@/lib/document-flow-routes";

type EvidenceType = "table" | "quote" | "image" | "related";

type EvidenceFixture = {
  id: string;
  type: EvidenceType;
  label: string;
  title: string;
  body: string;
  page: number;
  section: string;
  chunk: string;
  terms: string[];
  relevance: number;
  accent: "teal" | "amber" | "blue" | "violet";
};

type DocumentFixture = {
  slug: string;
  title: string;
  shortTitle: string;
  source: string;
  kind: string;
  version: string;
  status: "Current" | "Review due";
  review: string;
  updated: string;
  relevance: number;
  page: number;
  chunk: string;
  snippet: string;
  terms: string[];
  evidence: EvidenceFixture[];
  pdfPath: string;
  previewImagePath: string;
};

type EvidenceTab = "Table" | "Quote" | "Image" | "Source page" | "Context";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const documents: DocumentFixture[] = [
  {
    slug: "clozapine-monitoring",
    title: "Clozapine prescribing and monitoring guidelines",
    shortTitle: "Clozapine monitoring guidelines",
    source: "Clinical Guidelines",
    kind: "Therapeutic Guidelines",
    version: "v3.2",
    status: "Current",
    review: "Review 2026",
    updated: "24 May 2024",
    relevance: 92,
    page: 12,
    chunk: "monitoring-table",
    snippet: "Hematological monitoring schedule table for clozapine, including frequency and action thresholds.",
    terms: ["clozapine", "monitoring", "table", "CRP", "routine monitoring", "frequency"],
    pdfPath: "/demo-documents/synthetic-clozapine-monitoring-with-image.pdf",
    previewImagePath: "/demo-documents/clozapine-table.png",
    evidence: [
      {
        id: "monitoring-table",
        type: "table",
        label: "Table 3",
        title: "Hematological monitoring schedule",
        body: "Treatment duration, frequency, test, and action threshold for patients on clozapine.",
        page: 12,
        section: "4.1.2",
        chunk: "chunk 18",
        terms: ["routine monitoring", "frequency", "ANC"],
        relevance: 92,
        accent: "teal",
      },
      {
        id: "infection-quote",
        type: "quote",
        label: "Quote",
        title: "Patient advice for infection symptoms",
        body: "Patients should be informed about the need for regular blood tests and advised to report symptoms of infection.",
        page: 12,
        section: "4.1.2",
        chunk: "chunk 19",
        terms: ["baseline", "weekly", "neutrophil count"],
        relevance: 86,
        accent: "amber",
      },
      {
        id: "infection-image",
        type: "image",
        label: "Figure 2",
        title: "Signs of infection",
        body: "Visual warning signs used alongside monitoring requirements.",
        page: 13,
        section: "4.1.3",
        chunk: "image 04",
        terms: ["infection", "fever", "clinical warning"],
        relevance: 78,
        accent: "blue",
      },
      {
        id: "related-thresholds",
        type: "related",
        label: "Table 1",
        title: "Monitoring checklist and key thresholds",
        body: "Related threshold checklist from the same guideline family.",
        page: 4,
        section: "4.1.1",
        chunk: "chunk 06",
        terms: ["thresholds", "checklist"],
        relevance: 74,
        accent: "violet",
      },
    ],
  },
  {
    slug: "psychotropic-handbook",
    title: "Psychotropic medications monitoring handbook",
    shortTitle: "Psychotropic monitoring handbook",
    source: "Reference",
    kind: "Clinical KB Repository",
    version: "v2.1",
    status: "Current",
    review: "Review 2026",
    updated: "12 Apr 2024",
    relevance: 84,
    page: 18,
    chunk: "psychotropic-monitoring",
    snippet: "Monitoring requirements and frequency for antipsychotic medicines, including clozapine-specific checks.",
    terms: ["monitoring", "frequency", "table"],
    pdfPath: "/demo-documents/synthetic-lithium-monitoring.pdf",
    previewImagePath: "/demo-documents/clozapine-table.png",
    evidence: [],
  },
  {
    slug: "quick-reference",
    title: "Clozapine: Safe Prescribing Quick Reference",
    shortTitle: "Safe prescribing quick reference",
    source: "Guideline Summary",
    kind: "Clinical KB Repository",
    version: "v1.4",
    status: "Current",
    review: "Review 2026",
    updated: "10 Mar 2024",
    relevance: 78,
    page: 4,
    chunk: "monitoring-checklist",
    snippet: "Monitoring checklist and key thresholds for safe prescribing workflows.",
    terms: ["clozapine", "monitoring", "checklist"],
    pdfPath: "/demo-documents/synthetic-clozapine-monitoring-with-image.pdf",
    previewImagePath: "/demo-documents/clozapine-table.png",
    evidence: [],
  },
  {
    slug: "neutropenia-management",
    title: "Neutropenia management in clozapine therapy",
    shortTitle: "Neutropenia management",
    source: "Clinical Review",
    kind: "Clinical KB Repository",
    version: "v1.0",
    status: "Review due",
    review: "Review 2025",
    updated: "15 Feb 2024",
    relevance: 72,
    page: 9,
    chunk: "anc-interventions",
    snippet: "ANC monitoring and clinical intervention guidance for neutropenia risk.",
    terms: ["ANC", "neutrophil count", "monitoring"],
    pdfPath: "/demo-documents/synthetic-clozapine-monitoring-with-image.pdf",
    previewImagePath: "/demo-documents/clozapine-table.png",
    evidence: [],
  },
  {
    slug: "community-protocols",
    title: "Community mental health protocols",
    shortTitle: "Community mental health protocols",
    source: "Procedure",
    kind: "Clinical KB Repository",
    version: "v5.0",
    status: "Current",
    review: "Review 2026",
    updated: "22 Jan 2024",
    relevance: 65,
    page: 16,
    chunk: "community-monitoring",
    snippet: "Medication monitoring protocols for shared care and community follow-up.",
    terms: ["monitoring", "protocol"],
    pdfPath: "/demo-documents/synthetic-risk-flow-with-image.pdf",
    previewImagePath: "/demo-documents/risk-flow.png",
    evidence: [],
  },
];

const defaultDocument = documents[0];
const defaultQuery = "clozapine monitoring table";
const sourceCategoryCounts = [
  ["All sources", "Sample 2,065"],
  ["Guidelines", "Sample 842"],
  ["Procedures", "Sample 468"],
  ["Reference", "Sample 411"],
  ["Education", "Sample 344"],
  ["Policies", "-"],
] as const;
const libraryCategoryCounts = [
  ["Favorites", "Sample 23"],
  ["Recent", "Sample 12"],
  ["My notes", "Sample 8"],
] as const;
const monitoringTableHeadings = ["Treatment duration", "Frequency", "Test", "Action threshold"] as const;
const monitoringTableRows = [
  ["0 - 18 weeks", "Weekly", "Full Blood Count (ANC)", "ANC < 1.5 x10^9/L"],
  ["18 weeks - 1 year", "Fortnightly", "Full Blood Count (ANC)", "ANC < 1.5 x10^9/L"],
  ["> 1 year", "4 weekly", "Full Blood Count (ANC)", "ANC < 1.0 x10^9/L"],
] as const;

function documentHref(document: DocumentFixture, query = defaultQuery) {
  return documentReaderHref({
    document: document.slug,
    query,
    page: String(document.page),
    chunk: document.chunk,
  });
}

function evidenceHref(document: DocumentFixture, evidence: EvidenceFixture, query = defaultQuery) {
  return documentEvidenceHref({
    document: document.slug,
    evidence: evidence.id,
    query,
    page: String(evidence.page),
    chunk: evidence.id,
  });
}

function findDocument(slug: string | null) {
  return documents.find((document) => document.slug === slug) ?? defaultDocument;
}

function findEvidence(document: DocumentFixture, id: string | null) {
  return document.evidence.find((evidence) => evidence.id === id) ?? primaryEvidence(document);
}

function searchHref(query = defaultQuery) {
  return documentsSearchHref({ query });
}

function primaryEvidence(document: DocumentFixture) {
  return document.evidence[0] ?? defaultDocument.evidence[0];
}

function primaryEvidenceLabel(document: DocumentFixture) {
  const evidence = primaryEvidence(document);
  if (evidence.type === "table") return evidence.label;
  if (evidence.type === "quote") return "Quote";
  if (evidence.type === "image") return evidence.label;
  return "Related";
}

function evidenceTypeLabel(type: EvidenceType) {
  if (type === "table") return "Table evidence";
  if (type === "quote") return "Quote evidence";
  if (type === "image") return "Image evidence";
  return "Related evidence";
}

function Pill({
  children,
  active = false,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  active?: boolean;
  tone?: "neutral" | "teal" | "green" | "amber" | "blue" | "violet";
  icon?: LucideIcon;
}) {
  const toneClass =
    active || tone === "teal"
      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
      : tone === "green"
        ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
        : tone === "amber"
          ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
          : tone === "blue"
            ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]"
            : tone === "violet"
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]";
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold shadow-[var(--shadow-inset)]",
        toneClass,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function IconButton({ label, icon: Icon, active = false }: { label: string; icon: LucideIcon; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-lg border transition",
        focusRing,
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-raised)]",
      )}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
    </button>
  );
}

function FileTile({ label = "PDF" }: { label?: string }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-xs font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
      {label}
    </span>
  );
}

function CategoryRailSection({
  title,
  items,
  activeLabel,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
  activeLabel?: string;
}) {
  return (
    <section className="space-y-1">
      <h2 className="px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{title}</h2>
      {items.map(([label, count]) => {
        const active = label === activeLabel;
        return (
          <button
            key={label}
            type="button"
            className={cn(
              "grid min-h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold transition",
              focusRing,
              active
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-raised)] hover:text-[color:var(--text-heading)]",
            )}
          >
            <span className="truncate">{label}</span>
            <span className="nums text-xs font-bold text-[color:var(--text-soft)]">{count}</span>
          </button>
        );
      })}
    </section>
  );
}

function DocumentSearchCategoryRail() {
  return (
    <aside className="hidden border-r border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-4 max-xl:!hidden xl:block">
      <div className="sticky top-4 space-y-6">
        <CategoryRailSection title="Documents" items={sourceCategoryCounts} activeLabel="All sources" />
        <CategoryRailSection title="My library" items={libraryCategoryCounts} />
        <section className="space-y-1">
          <h2 className="px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Tools
          </h2>
          {[
            ["Compare", BarChart3],
            ["Collections", Layers3],
            ["Uploads", Download],
          ].map(([label, Icon]) =>
            (() => {
              const ToolIcon = Icon as LucideIcon;
              return (
                <button
                  key={label as string}
                  type="button"
                  className={cn(
                    "inline-flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-raised)] hover:text-[color:var(--text-heading)]",
                    focusRing,
                  )}
                >
                  <ToolIcon className="h-4 w-4" aria-hidden="true" />
                  {label as string}
                </button>
              );
            })(),
          )}
        </section>
      </div>
    </aside>
  );
}

function SearchResultMobileCard({
  document,
  query,
  selected,
}: {
  document: DocumentFixture;
  query: string;
  selected: boolean;
}) {
  const evidence = primaryEvidence(document);
  return (
    <article
      className={cn(
        "rounded-lg border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
        selected
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/35 shadow-[inset_3px_0_0_var(--clinical-accent),var(--shadow-inset)]"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold text-[color:var(--clinical-accent)]">
            <EvidenceTypeIcon type={evidence.type} className="h-4 w-4 shrink-0" />
            <span className="truncate">{evidenceTypeLabel(evidence.type)}</span>
            <span className="text-[color:var(--text-soft)]">·</span>
            <span className="shrink-0">p.{evidence.page}</span>
            <span className="text-[color:var(--text-soft)]">·</span>
            <span className="shrink-0">{evidence.relevance}%</span>
          </div>
        </div>
        {selected ? <Pill active>Best match</Pill> : <IconButton label="More result actions" icon={MoreVertical} />}
      </div>
      <div className="mt-3 flex min-w-0 gap-3">
        <div className="shrink-0">
          <FileTile />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={documentHref(document, query)}
            className={cn(
              "block line-clamp-2 text-base font-extrabold leading-5 text-[color:var(--text-heading)]",
              focusRing,
            )}
          >
            {document.title}
          </Link>
          <p className="mt-1 line-clamp-1 text-xs font-semibold text-[color:var(--text-muted)]">
            {document.kind} · {document.version}
          </p>
          <h2 className="mt-2 line-clamp-1 text-sm font-extrabold text-[color:var(--clinical-accent)]">
            {evidence.title}
          </h2>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{evidence.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill tone={document.status === "Current" ? "green" : "amber"} icon={CheckCircle2}>
          {document.status}
        </Pill>
        <Pill>{primaryEvidenceLabel(document)}</Pill>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <Link
          href={documentHref(document, query)}
          className={cn(
            "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]",
            focusRing,
          )}
        >
          Open document
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={evidenceHref(document, evidence, query)}
          className={cn(
            "inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]",
            focusRing,
          )}
        >
          Open evidence
        </Link>
      </div>
    </article>
  );
}

function DocumentShell({ children, hideSidebar = false }: { children: ReactNode; hideSidebar?: boolean }) {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
      <div className="flex min-h-[calc(100dvh-4rem)]">
        {!hideSidebar ? (
          <aside className="hidden w-14 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface)] lg:flex lg:flex-col lg:items-center lg:gap-2 lg:py-4">
            <IconButton label="Documents" icon={FileText} active />
            <IconButton label="Search" icon={Search} />
            <IconButton label="Library" icon={BookOpen} />
            <IconButton label="Evidence" icon={Layers3} />
            <div className="mt-auto" />
            <IconButton label="Bookmarks" icon={Bookmark} />
          </aside>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}

function evidenceIcon(type: EvidenceType) {
  if (type === "table") return Table2;
  if (type === "quote") return Quote;
  if (type === "image") return FileImage;
  return Layers3;
}

function evidenceTone(type: EvidenceType): "teal" | "amber" | "blue" | "violet" {
  if (type === "table") return "teal";
  if (type === "quote") return "amber";
  if (type === "image") return "blue";
  return "violet";
}

function EvidenceTypeIcon({ type, className }: { type: EvidenceType; className?: string }) {
  if (type === "table") return <Table2 className={className} aria-hidden="true" />;
  if (type === "quote") return <Quote className={className} aria-hidden="true" />;
  if (type === "image") return <FileImage className={className} aria-hidden="true" />;
  return <Layers3 className={className} aria-hidden="true" />;
}

function MonitoringRowCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-2">
      {monitoringTableRows.map((row, rowIndex) => (
        <article
          key={row[0]}
          className={cn(
            "grid grid-cols-[4rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
            rowIndex === 1 && "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]",
          )}
        >
          <div className="grid place-items-center border-r border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)]/60 text-[color:var(--clinical-accent)]">
            <Table2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className={cn("p-3", compact && "p-2.5")}>
            <h3 className="text-base font-extrabold text-[color:var(--text-heading)]">{row[0]}</h3>
            <dl className="mt-2 grid grid-cols-[7.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              {monitoringTableHeadings.slice(1).map((heading, index) => (
                <div key={heading} className="contents">
                  <dt className="font-bold text-[color:var(--text-muted)]">{heading}</dt>
                  <dd className="font-semibold text-[color:var(--text-heading)]">{row[index + 1]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}

export function MasterDocumentSearch() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || defaultQuery;
  const [type, setType] = useState<"all" | EvidenceType>("all");

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    return documents.filter((document) => {
      const matchesQuery =
        document.title.toLowerCase().includes(lowered) ||
        document.snippet.toLowerCase().includes(lowered) ||
        document.terms.some((term) => lowered.includes(term.toLowerCase()) || term.toLowerCase().includes(lowered));
      const matchesType = type === "all" || document.evidence.some((item) => item.type === type);
      return matchesQuery || matchesType || document.slug === defaultDocument.slug;
    });
  }, [query, type]);

  return (
    <DocumentShell>
      <div className="grid min-h-[calc(100dvh-4rem)] xl:grid-cols-[12rem_minmax(0,1fr)]">
        <DocumentSearchCategoryRail />
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] min-w-0 w-full max-w-[104rem] flex-col px-3 py-4 pb-24 sm:px-5 md:pb-12 lg:px-6">
          <header className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                  Documents
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                  <span className="md:hidden">Find source evidence</span>
                  <span className="hidden md:inline">Search command centre</span>
                </h1>
                <p className="mt-1 text-base font-medium leading-6 text-[color:var(--text-muted)] md:hidden">
                  Search documents, tables, quotes, and images
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[color:var(--text-muted)] max-sm:w-full">
                <Pill tone="green" icon={CheckCircle2}>
                  Sample · 2,065 indexed
                </Pill>
                <span className="hidden sm:inline-flex" title="Coming soon">
                  <Pill icon={Bookmark}>Save search</Pill>
                </span>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className={cn(
                    "ml-auto grid h-11 w-11 cursor-not-allowed place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-soft)] opacity-60 sm:hidden",
                  )}
                  aria-label="More search actions (coming soon)"
                >
                  <MoreVertical className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {[
                ["all", "Sources"],
                ["table", "Tables"],
                ["quote", "Quotes"],
                ["image", "Images"],
                ["related", "Related"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key as "all" | EvidenceType)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold shadow-[var(--shadow-inset)]",
                    focusRing,
                    type === key
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                      : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)]",
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                disabled
                title="Coming soon"
                className={cn(
                  "inline-flex min-h-9 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 text-xs font-bold text-[color:var(--success)] opacity-70 shadow-[var(--shadow-inset)] md:hidden",
                )}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Current
              </button>
              <button
                className={cn(
                  "inline-flex min-h-9 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-bold text-[color:var(--text-soft)] opacity-70 shadow-[var(--shadow-inset)]",
                )}
                type="button"
                disabled
                title="Coming soon"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                More filters
              </button>
              <div className="ml-auto hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-1 opacity-70 shadow-[var(--shadow-inset)] sm:flex">
                <span className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)]">
                  <Table2 className="h-3.5 w-3.5" />
                  Table
                </span>
                <span className="inline-flex min-h-8 items-center gap-1 rounded-md px-3 text-xs font-bold text-[color:var(--text-muted)]">
                  <List className="h-3.5 w-3.5" />
                  List
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between md:hidden">
              <p className="text-lg font-extrabold text-[color:var(--text-heading)]">{filtered.length} results</p>
              <button
                type="button"
                disabled
                title="Coming soon"
                className={cn(
                  "inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-soft)] opacity-70 shadow-[var(--shadow-inset)]",
                )}
              >
                Sort: Relevance
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <section className="mt-4 hidden min-h-0 flex-1 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] md:block">
            <div className="grid min-w-[58rem] grid-cols-[minmax(20rem,1.7fr)_minmax(17rem,1.25fr)_9rem_8rem_5rem] border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
              <span>Document</span>
              <span>Evidence</span>
              <span>Status</span>
              <span>Relevance</span>
              <span>Actions</span>
            </div>
            <div className="overflow-x-auto">
              {filtered.map((document, index) => (
                <article
                  key={document.slug}
                  className={cn(
                    "grid min-w-[58rem] grid-cols-[minmax(20rem,1.7fr)_minmax(17rem,1.25fr)_9rem_8rem_5rem] items-center gap-3 border-b border-[color:var(--border)] px-4 py-3",
                    index === 0 &&
                      "bg-[color:var(--clinical-accent-soft)]/30 shadow-[inset_3px_0_0_var(--clinical-accent)]",
                  )}
                >
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <FileTile />
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        {index === 0 ? <Pill active>Best match</Pill> : <Pill>Relevant</Pill>}
                      </div>
                      <Link
                        href={documentHref(document, query)}
                        className={cn(
                          "mt-1 block line-clamp-2 text-sm font-extrabold leading-5 text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)]",
                          focusRing,
                        )}
                      >
                        {document.title}
                      </Link>
                      <p className="mt-1 truncate text-xs font-semibold text-[color:var(--text-muted)]">
                        {document.kind} · {document.version} · {document.source}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <Pill icon={Table2}>{primaryEvidenceLabel(document)}</Pill>
                      <Pill>p.{document.page}</Pill>
                      <Pill>{document.chunk}</Pill>
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-[color:var(--text-muted)]">
                      {document.snippet}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Pill tone={document.status === "Current" ? "green" : "amber"}>{document.status}</Pill>
                    <p className="text-xs font-semibold text-[color:var(--text-muted)]">{document.review}</p>
                    <p className="text-xs font-semibold text-[color:var(--text-soft)]">{document.updated}</p>
                  </div>
                  <div>
                    <p className="nums text-sm font-extrabold text-[color:var(--clinical-accent)]">
                      {document.relevance}%
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-[color:var(--border)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--clinical-accent)]"
                        style={{ width: `${document.relevance}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={documentHref(document, query)}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text-heading)]",
                        focusRing,
                      )}
                      aria-label={`Open ${document.title}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-4 grid gap-3 md:hidden" aria-label="Document results">
            {filtered.map((document, index) => (
              <SearchResultMobileCard key={document.slug} document={document} query={query} selected={index === 0} />
            ))}
          </section>
        </div>
      </div>
    </DocumentShell>
  );
}

function DocumentPreview({ selectedEvidence }: { selectedEvidence: EvidenceFixture }) {
  return (
    <div className="relative mx-auto max-w-4xl rounded-lg border border-[color:var(--border-lux)] bg-white p-5 shadow-[0_16px_45px_rgb(15_23_42_/_10%)]">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-extrabold text-[color:var(--clinical-accent)]">
            4.1.2 Routine monitoring schedule
          </p>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--text-heading)]">
            <mark className="rounded bg-amber-100 px-1">Regular haematological monitoring</mark> is essential to reduce
            risk and ensure treatment can continue safely.{" "}
            <a className="font-bold text-[color:var(--clinical-accent)]">Table 3</a> outlines the recommended monitoring
            schedule.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold text-[color:var(--text-heading)]">
            Table 3.{" "}
            <span className="font-semibold">Haematological monitoring schedule for patients on clozapine.</span>
          </h3>
          <div className="sm:hidden">
            <MonitoringRowCards compact />
          </div>
        </div>
        <div className="hidden overflow-x-auto rounded-lg border border-[color:var(--clinical-accent-border)] sm:block">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="bg-[color:var(--clinical-accent-soft)]">
              <tr>
                {monitoringTableHeadings.map((heading) => (
                  <th
                    key={heading}
                    className="border border-[color:var(--border)] px-3 py-2 font-extrabold text-[color:var(--text-heading)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitoringTableRows.map((row, rowIndex) => (
                <tr key={row[0]} className={rowIndex === 1 ? "bg-[color:var(--clinical-accent-soft)]/70" : undefined}>
                  {row.map((cell) => (
                    <td
                      key={cell}
                      className="border border-[color:var(--border)] px-3 py-3 font-medium text-[color:var(--text-heading)]"
                    >
                      {selectedEvidence.type === "table" && rowIndex === 0 ? (
                        <mark className="rounded bg-amber-100 px-1 py-0.5">{cell}</mark>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <blockquote className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
          “Patients should be informed about the need for regular blood tests and advised to report symptoms of
          infection immediately.”
        </blockquote>
        <div className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 sm:grid-cols-4">
          {["Fever", "Tachycardia", "Shortness of breath", "Chest pain"].map((label) => (
            <div
              key={label}
              className="grid place-items-center gap-2 text-center text-xs font-bold text-[color:var(--text-muted)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]">
                <ImageIcon className="h-5 w-5" />
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectorTabs({ active, onChange }: { active: string; onChange: (tab: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-[color:var(--border)] px-4">
      {["Evidence", "Summary", "Details", "Versions", "Notes"].map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "min-h-12 border-b-2 px-2 text-sm font-bold transition",
            focusRing,
            active === tab
              ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
              : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function EvidenceCard({
  document,
  evidence,
  query,
  selected,
}: {
  document: DocumentFixture;
  evidence: EvidenceFixture;
  query: string;
  selected: boolean;
}) {
  const Icon = evidenceIcon(evidence.type);
  return (
    <Link
      href={evidenceHref(document, evidence, query)}
      aria-label={`Open evidence ${evidence.label} ${evidence.title}`}
      className={cn(
        "grid gap-2 rounded-lg border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] transition hover:-translate-y-px hover:shadow-[var(--shadow-tight)]",
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/20"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Pill tone={evidenceTone(evidence.type)} icon={Icon}>
          {evidence.label}
        </Pill>
        <span className="nums rounded-full bg-[color:var(--clinical-accent)] px-2 py-1 text-xs font-extrabold text-white">
          {evidence.relevance}
        </span>
      </div>
      <h3 className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">{evidence.title}</h3>
      <p className="line-clamp-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{evidence.body}</p>
      <p className="text-xs font-bold text-[color:var(--text-soft)]">
        Page {evidence.page} · Section {evidence.section}
      </p>
    </Link>
  );
}

export function MasterDocumentReader() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || defaultQuery;
  const document = findDocument(searchParams.get("document"));
  const selectedEvidence = findEvidence(document, searchParams.get("chunk"));
  const [tab, setTab] = useState("Evidence");
  const [filter, setFilter] = useState<"all" | EvidenceType>("all");
  const [mobileEvidenceOpen, setMobileEvidenceOpen] = useState(false);
  const evidenceItems = filter === "all" ? document.evidence : document.evidence.filter((item) => item.type === filter);

  return (
    <DocumentShell>
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
          <div className="flex min-h-11 items-center gap-2">
            <Link
              href={searchHref(query)}
              className={cn("grid h-10 w-10 place-items-center rounded-lg text-[color:var(--text-heading)]", focusRing)}
              aria-label="Back to results"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold text-[color:var(--text-heading)]">
              {document.shortTitle}
            </h1>
            <IconButton label="Bookmark document" icon={Bookmark} />
            <IconButton label="More document actions" icon={MoreVertical} />
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <Pill tone="green">{document.status}</Pill>
            <Pill>{document.version}</Pill>
            <Pill>p.{document.page} / 84</Pill>
          </div>
          <div className="mt-3 grid grid-cols-3 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-1 shadow-[var(--shadow-inset)]">
            {[
              ["Read", BookOpen],
              ["Evidence", List],
              ["Summary", FileText],
            ].map(([label, Icon], index) => {
              const TabIcon = Icon as LucideIcon;
              return (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => {
                    if (label === "Evidence") setMobileEvidenceOpen(true);
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-extrabold",
                    focusRing,
                    index === 0
                      ? "bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
                      : "text-[color:var(--text-heading)]",
                  )}
                >
                  <TabIcon className="h-4 w-4" aria-hidden="true" />
                  {label as string}
                </button>
              );
            })}
          </div>
        </header>
      </div>
      <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[17rem_minmax(0,1fr)_25rem]">
        <aside className="hidden border-r border-[color:var(--border)] bg-[color:var(--surface)] lg:block">
          <div className="space-y-4 p-4">
            <Link
              href={searchHref(query)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]",
                focusRing,
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to results
            </Link>
            <div className="flex gap-3">
              <FileTile />
              <div>
                <h1 className="text-base font-extrabold leading-5 text-[color:var(--text-heading)]">
                  {document.shortTitle}
                </h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill>{document.version}</Pill>
                  <Pill tone="green">{document.status}</Pill>
                </div>
              </div>
            </div>
            <a
              href={document.pdfPath}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-bold text-[color:var(--clinical-accent)]",
                focusRing,
              )}
            >
              Open source PDF
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="border-t border-[color:var(--border)] p-4">
            <div className="flex border-b border-[color:var(--border)]">
              <button
                className="min-h-11 border-b-2 border-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent)]"
                type="button"
              >
                Outline
              </button>
              <button className="min-h-11 px-4 text-sm font-bold text-[color:var(--text-muted)]" type="button">
                Thumbnails
              </button>
            </div>
            <nav className="mt-3 space-y-1 text-sm font-semibold text-[color:var(--text-muted)]">
              {[
                "Introduction",
                "Clozapine overview",
                "Prescribing clozapine",
                "Monitoring",
                "Managing abnormalities",
                "Appendices",
              ].map((item, index) => (
                <div
                  key={item}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-lg px-2",
                    index === 3 && "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
                  )}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  {index + 1} {item}
                </div>
              ))}
              <div className="ml-5 rounded-lg bg-[color:var(--clinical-accent-soft)] px-3 py-2 text-[color:var(--clinical-accent)]">
                4.1.2 Monitoring schedule
              </div>
            </nav>
          </div>
        </aside>

        <section className="min-w-0 bg-[color:var(--surface-subtle)]">
          <div className="sticky top-0 z-10 hidden min-h-16 flex-wrap items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 lg:flex">
            <Pill tone="green">Current version</Pill>
            <span className="text-sm font-bold text-[color:var(--text-muted)]">
              {document.version} · Published 12 May 2024
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Pill>Page {document.page} / 84</Pill>
              <Pill>100%</Pill>
              <IconButton label="Search this document" icon={Search} />
              <IconButton label="Download" icon={Download} />
            </div>
          </div>
          <div className="space-y-4 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 lg:pb-5">
            <DocumentPreview selectedEvidence={selectedEvidence} />
            <div className="mx-auto hidden max-w-4xl flex-wrap items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-soft)] sm:flex">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-[color:var(--text-heading)]">Highlighted hit 1 of 3</p>
                <p className="truncate text-xs font-semibold text-[color:var(--text-muted)]">
                  {selectedEvidence.title}
                </p>
              </div>
              <button
                type="button"
                className={cn(
                  "rounded-lg border border-[color:var(--border-lux)] px-3 py-2 text-xs font-bold",
                  focusRing,
                )}
              >
                Previous
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg border border-[color:var(--border-lux)] px-3 py-2 text-xs font-bold",
                  focusRing,
                )}
              >
                Next
              </button>
              <button
                type="button"
                className={cn("rounded-lg px-3 py-2 text-xs font-bold text-[color:var(--clinical-accent)]", focusRing)}
              >
                Clear highlights
              </button>
            </div>
            <div className="mx-auto hidden max-w-3xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-2 shadow-[var(--shadow-soft)] sm:grid">
              <IconButton label="Composer options" icon={PanelRight} />
              <input
                className="min-h-11 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold outline-none"
                placeholder="Ask about this document"
              />
              <button
                type="button"
                aria-label="Ask about this document"
                className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--command)] text-[color:var(--command-contrast)]"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </section>

        <aside className="hidden border-l border-[color:var(--border)] bg-[color:var(--surface)] lg:block">
          <InspectorTabs active={tab} onChange={setTab} />
          <div className="space-y-4 p-4">
            {tab === "Evidence" ? (
              <>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[
                    ["all", `All ${document.evidence.length}`],
                    ["table", "Tables 1"],
                    ["quote", "Quotes 1"],
                    ["image", "Images 1"],
                    ["related", "Related 1"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key as "all" | EvidenceType)}
                      className={cn(
                        "inline-flex min-h-9 shrink-0 items-center rounded-lg border px-3 text-xs font-bold",
                        focusRing,
                        filter === key
                          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                          : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <section>
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    Matched terms
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {document.terms.map((term) => (
                      <Pill key={term}>{term}</Pill>
                    ))}
                  </div>
                </section>
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">
                      Evidence in this document
                    </h2>
                    <Pill active>{evidenceItems.length}</Pill>
                  </div>
                  {evidenceItems.map((evidence) => (
                    <EvidenceCard
                      key={evidence.id}
                      document={document}
                      evidence={evidence}
                      query={query}
                      selected={evidence.id === selectedEvidence.id}
                    />
                  ))}
                </section>
              </>
            ) : tab === "Summary" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Document summary</h2>
                <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                  This guideline contains monitoring schedules, patient advice, and threshold-based actions for
                  clozapine treatment. The strongest match is Table 3 on page 12.
                </p>
                <Pill active icon={Sparkles}>
                  Best evidence: Table 3
                </Pill>
              </div>
            ) : (
              <div className="grid gap-3">
                {[
                  ["Source", document.source],
                  ["Version", document.version],
                  ["Review status", document.review],
                  ["Updated", document.updated],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
                  >
                    <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[color:var(--text-heading)]">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
      <div className="lg:hidden">
        <div
          className={cn(
            "fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[0_18px_60px_rgb(15_23_42_/_18%)]",
            mobileEvidenceOpen ? "max-h-[62dvh] overflow-y-auto p-3" : "p-2",
          )}
        >
          {mobileEvidenceOpen ? (
            <div>
              <div
                className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[color:var(--border-strong)]"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Evidence on this page</h2>
                  <p className="text-xs font-semibold text-[color:var(--text-muted)]">
                    Page {document.page} · Section 4.1.2
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileEvidenceOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-bold text-[color:var(--clinical-accent)]",
                    focusRing,
                  )}
                >
                  Collapse
                </button>
              </div>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                {[
                  ["all", `All ${document.evidence.length}`],
                  ["table", "Tables 1"],
                  ["quote", "Quotes 1"],
                  ["image", "Images 1"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key as "all" | EvidenceType)}
                    className={cn(
                      "inline-flex min-h-9 shrink-0 items-center rounded-lg border px-3 text-xs font-bold",
                      focusRing,
                      filter === key
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                {evidenceItems.map((evidence) => (
                  <EvidenceCard
                    key={evidence.id}
                    document={document}
                    evidence={evidence}
                    query={query}
                    selected={evidence.id === selectedEvidence.id}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 divide-x divide-[color:var(--border)]">
              {[
                ["Search", Search],
                ["Evidence", List],
                ["Compare", BarChart3],
                ["Note", MessageSquareText],
              ].map(([label, Icon]) => {
                const ActionIcon = Icon as LucideIcon;
                return (
                  <button
                    key={label as string}
                    type="button"
                    onClick={() => {
                      if (label === "Evidence") setMobileEvidenceOpen(true);
                    }}
                    className={cn(
                      "inline-flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold text-[color:var(--text-heading)]",
                      focusRing,
                    )}
                  >
                    <ActionIcon className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                    {label as string}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DocumentShell>
  );
}

function ExtractedTable({ activeTab }: { activeTab: EvidenceTab }) {
  if (activeTab === "Quote") {
    return (
      <blockquote className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-lg font-semibold leading-8 text-[color:var(--text-heading)]">
        “Patients should be informed about the need for regular blood tests and advised to report symptoms of infection
        immediately.”
      </blockquote>
    );
  }
  if (activeTab === "Image") {
    return (
      <div className="grid gap-3 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)] p-5 sm:grid-cols-4">
        {["Fever", "Temperature", "Skin signs", "Clinical review"].map((label) => (
          <div
            key={label}
            className="grid place-items-center gap-3 rounded-lg bg-white p-4 text-center text-sm font-bold text-[color:var(--text-heading)]"
          >
            <FileImage className="h-9 w-9 text-[color:var(--info)]" />
            {label}
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="sm:hidden">
        <MonitoringRowCards />
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] sm:block">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead className="bg-[color:var(--surface-subtle)]">
            <tr>
              {monitoringTableHeadings.map((heading) => (
                <th
                  key={heading}
                  className="border border-[color:var(--border)] px-4 py-3 font-extrabold text-[color:var(--text-heading)]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monitoringTableRows.map((row, index) => (
              <tr key={row[0]} className={index === 1 ? "bg-[color:var(--clinical-accent-soft)]" : undefined}>
                {row.map((cell) => (
                  <td
                    key={cell}
                    className="border border-[color:var(--border)] px-4 py-4 font-medium text-[color:var(--text-heading)]"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MasterEvidenceDetail() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || defaultQuery;
  const document = findDocument(searchParams.get("document"));
  const evidence = findEvidence(document, searchParams.get("evidence") ?? searchParams.get("chunk"));
  const [tab, setTab] = useState<EvidenceTab>(
    evidence.type === "quote" ? "Quote" : evidence.type === "image" ? "Image" : "Table",
  );

  return (
    <DocumentShell hideSidebar>
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
          <div className="flex min-h-11 items-center gap-3">
            <Link
              href={documentHref(document, query)}
              className={cn("grid h-11 w-11 place-items-center rounded-lg text-[color:var(--text-heading)]", focusRing)}
              aria-label="Back to document"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </Link>
            <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">Evidence</h1>
            <Pill icon={Table2}>
              {evidence.label} · p.{evidence.page}
            </Pill>
            <div className="ml-auto">
              <IconButton label="More evidence actions" icon={MoreVertical} />
            </div>
          </div>
        </header>
      </div>
      <div className="mx-auto max-w-[104rem] px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-6">
        <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 lg:flex">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--text-muted)]">
              <Link href={searchHref(query)}>Documents</Link>
              <ChevronRight className="h-4 w-4" />
              <Link href={documentHref(document, query)}>{document.shortTitle}</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-[color:var(--text-heading)]">{evidence.label}</span>
            </nav>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">Evidence detail</h1>
              <Pill active icon={ShieldCheck}>
                Reusable source object
              </Pill>
            </div>
          </div>
          <Link
            href={documentHref(document, query)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]",
              focusRing,
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to document
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_28rem]">
          <section className="min-w-0 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]">
            <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--border)] px-3">
              {(["Table", "Quote", "Image", "Source page", "Context"] as EvidenceTab[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={cn(
                    "inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold",
                    focusRing,
                    tab === item
                      ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                      : "border-transparent text-[color:var(--text-muted)]",
                  )}
                >
                  {item === "Table" ? (
                    <Table2 className="h-4 w-4" />
                  ) : item === "Quote" ? (
                    <Quote className="h-4 w-4" />
                  ) : item === "Image" ? (
                    <FileImage className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {item}
                </button>
              ))}
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Pill active icon={ShieldCheck}>
                    Reusable source object
                  </Pill>
                  <h2 className="mt-3 text-xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-2xl">
                    {evidence.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {evidence.body}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill active>{evidence.relevance}% relevance</Pill>
                    <Pill tone="green" icon={ShieldCheck}>
                      High confidence
                    </Pill>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]",
                      focusRing,
                    )}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]",
                      focusRing,
                    )}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy table
                  </button>
                </div>
              </div>
              <ExtractedTable activeTab={tab} />
              <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Source page</h3>
                  <Link
                    href={documentHref(document, query)}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)]",
                      focusRing,
                    )}
                  >
                    Open document
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-muted)]">
                  Page {evidence.page} in {document.title}
                </p>
                <div className="mt-4 grid grid-cols-[repeat(5,minmax(7rem,1fr))] gap-3 overflow-x-auto pb-1">
                  {[10, 11, 12, 13, 14].map((page) => (
                    <div
                      key={page}
                      className={cn(
                        "rounded-lg border bg-[color:var(--surface)] p-2 text-center shadow-[var(--shadow-inset)]",
                        page === evidence.page &&
                          "border-[color:var(--clinical-accent)] ring-1 ring-[color:var(--clinical-accent)]",
                      )}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded border border-[color:var(--border)] bg-white">
                        <Image
                          src={document.previewImagePath}
                          alt={`Source page ${page}`}
                          fill
                          sizes="10rem"
                          className="object-cover opacity-75"
                        />
                        {page === evidence.page ? (
                          <div className="absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded border-2 border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)]/15" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-bold text-[color:var(--text-muted)]">{page}</p>
                    </div>
                  ))}
                </div>
              </section>
              <p className="rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)] p-3 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
                This reusable source object preserves exact content, page context, and metadata for citation,
                comparison, and answer reuse.
              </p>
              <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-extrabold text-[color:var(--text-heading)]">
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                    Source details
                  </span>
                  <ChevronDown className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
                </summary>
                <dl className="mt-4 grid gap-3 text-sm">
                  {[
                    ["Page", `Page ${evidence.page}`],
                    ["Section", `Section ${evidence.section}`],
                    ["Chunk ID", evidence.chunk],
                    ["Relevance", `${evidence.relevance}% relevance`],
                    ["Reliability", "High confidence"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                      <dt className="font-bold text-[color:var(--text-muted)]">{label}</dt>
                      <dd className="font-semibold text-[color:var(--text-heading)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          </section>

          <aside className="hidden self-start rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] lg:block">
            <div className="border-b border-[color:var(--border)] p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                Source document
              </p>
              <div className="mt-3 flex gap-3">
                <FileTile />
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold leading-5 text-[color:var(--text-heading)]">
                    {document.title}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">
                    {document.version} · Published 12 May 2024
                  </p>
                  <Link
                    href={documentHref(document, query)}
                    className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)]"
                  >
                    Open full document
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-4">
              {[
                ["Page", `Page ${evidence.page}`],
                ["Section", `Section ${evidence.section}`],
                ["Chunk ID", evidence.chunk],
                ["Indexed", "24 May 2024 · 10:21 AEST"],
                ["Source", "clinical-documents/clozapine-guidelines-v3.2.pdf"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm">
                  <span className="font-bold text-[color:var(--text-muted)]">{label}</span>
                  <span className="font-semibold text-[color:var(--text-heading)]">{value}</span>
                </div>
              ))}
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Matched terms
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {evidence.terms.map((term) => (
                    <Pill key={term}>{term}</Pill>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Relevance
                </p>
                <p className="nums mt-1 text-2xl font-extrabold text-[color:var(--clinical-accent)]">
                  {evidence.relevance}% relevance
                </p>
                <div className="mt-2 h-2 rounded-full bg-[color:var(--border)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--clinical-accent)]"
                    style={{ width: `${evidence.relevance}%` }}
                  />
                </div>
              </div>
              <Pill tone="green">Current</Pill>
              <div className="grid gap-2">
                <Link
                  href={documentHref(document, query)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]",
                    focusRing,
                  )}
                >
                  Open full document
                  <ExternalLink className="h-4 w-4" />
                </Link>
                {[
                  ["Cite", Quote],
                  ["Compare sources", BarChart3],
                  ["Use in answer", MessageSquareText],
                  ["Save evidence", Bookmark],
                  ["Copy evidence ID", Copy],
                ].map(([label, Icon]) => (
                  <button
                    key={label as string}
                    type="button"
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]",
                      focusRing,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)_4rem] gap-2 rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-2 shadow-[0_18px_60px_rgb(15_23_42_/_18%)] lg:hidden">
        <button
          type="button"
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-extrabold text-[color:var(--command-contrast)]",
            focusRing,
          )}
        >
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          Use in answer
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-extrabold text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          <Quote className="h-4 w-4" aria-hidden="true" />
          Cite
        </button>
        <button
          type="button"
          aria-label="More evidence actions"
          className={cn(
            "grid min-h-12 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </DocumentShell>
  );
}

export function MasterDocumentIndex() {
  return (
    <DocumentShell hideSidebar>
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6">
        <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <Pill active icon={ShieldCheck}>
            Master document flow
          </Pill>
          <h1 className="mt-4 max-w-4xl text-3xl font-extrabold text-[color:var(--text-heading)]">
            Search, read, and reuse evidence without broken document loading.
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            This mockup uses bundled document assets and source objects, so the full flow works without private API
            access.
          </p>
        </header>
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          {[
            ["Search command centre", "Ranking and selection", searchHref(), Search],
            ["Document reader", "Reading and context", documentHref(defaultDocument), BookOpen],
            [
              "Evidence detail",
              "Exact reusable source object",
              evidenceHref(defaultDocument, defaultDocument.evidence[0]),
              Layers3,
            ],
          ].map(([title, body, href, Icon]) => (
            <Link
              key={title as string}
              href={href as string}
              className={cn(
                "group rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-[color:var(--clinical-accent-border)]",
                focusRing,
              )}
            >
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-extrabold text-[color:var(--text-heading)]">{title as string}</h2>
              <p className="mt-1 text-sm font-semibold text-[color:var(--text-muted)]">{body as string}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)]">
                Open
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </DocumentShell>
  );
}
