"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  Loader2,
  Search,
  Sparkles,
  Table2,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";

type DocumentListItem = {
  id: string;
  title?: string | null;
  file_name?: string | null;
  status?: string | null;
};

type DocumentsPayload = {
  documents?: DocumentListItem[];
};

type ChunkSearchResult = {
  id: string;
  page_number?: number | null;
  chunk_index?: number | null;
  section_heading?: string | null;
  snippet?: string | null;
  score?: number | null;
};

type ChunkSearchPayload = {
  results?: ChunkSearchResult[];
};

type DocumentDetailPayload = {
  chunks?: ChunkSearchResult[];
};

type ResolverState =
  { status: "opening"; message: string; liveHref?: string } | { status: "mock"; message: string; liveHref?: string };

type MockSourceDocument = {
  slug: string;
  title: string;
  fileName: string;
  kind: string;
  defaultPage: number;
  pageCount: number;
  status: string;
  review: string;
  section: string;
  summary: string;
  tags: string[];
  matchedTerms: string[];
  evidence: Array<{ label: string; value: string; icon: typeof Table2; tone: "success" | "info" | "warning" }>;
  passage: string[];
  tableRows: Array<[string, string, string]>;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const defaultQuery = "clozapine monitoring table";

const mockSources: MockSourceDocument[] = [
  {
    slug: "clozapine-monitoring",
    title: "Clozapine physical health monitoring protocol",
    fileName: "clozapine-physical-health-monitoring.pdf",
    kind: "Protocol",
    defaultPage: 12,
    pageCount: 18,
    status: "Current",
    review: "Review 2026",
    section: "Blood test monitoring table",
    summary:
      "Mock source preview for the command-centre handoff. It keeps the exact page, table evidence, and actions visible without requiring private document authentication.",
    tags: ["Medication", "Monitoring", "Shared care"],
    matchedTerms: ["clozapine", "monitoring", "table"],
    evidence: [
      { label: "Table evidence", value: "8 rows", icon: Table2, tone: "success" },
      { label: "PDF page", value: "p.12", icon: FileText, tone: "info" },
      { label: "Review note", value: "2026", icon: AlertCircle, tone: "warning" },
    ],
    passage: [
      "Monitoring requirements are grouped by treatment stage and missed-dose interval.",
      "Restart and escalation decisions should be checked against the local protocol table.",
      "Shared-care transfer requires the monitoring schedule and review responsibility to be visible.",
    ],
    tableRows: [
      ["Stable treatment", "Continue scheduled FBC/ANC checks", "Routine review"],
      ["Missed dose 48-72h", "Restart pathway and monitoring check", "Prescriber review"],
      ["Review due", "Confirm local protocol currency", "Document source status"],
    ],
  },
  {
    slug: "acute-agitation-pathway",
    title: "Acute agitation clinical pathway",
    fileName: "acute-agitation-clinical-pathway.pdf",
    kind: "Guideline",
    defaultPage: 4,
    pageCount: 9,
    status: "Current",
    review: "Local pathway",
    section: "Flowchart and escalation pathway",
    summary:
      "Mock source preview showing how image and flowchart evidence can stay attached to the selected search result.",
    tags: ["Risk", "Escalation", "ED"],
    matchedTerms: ["agitation", "pathway", "flowchart"],
    evidence: [
      { label: "Image evidence", value: "flowchart", icon: FileImage, tone: "info" },
      { label: "PDF page", value: "p.4", icon: FileText, tone: "success" },
      { label: "Risk pathway", value: "visible", icon: AlertCircle, tone: "warning" },
    ],
    passage: [
      "The pathway separates immediate safety steps from medication and senior review prompts.",
      "Flowchart evidence remains visible before opening the full source file.",
      "Escalation points are grouped so the result can be scoped or used for a follow-up answer.",
    ],
    tableRows: [
      ["Immediate risk", "Use local safety pathway", "Escalate"],
      ["De-escalation", "Document response and triggers", "Review"],
      ["Senior input", "Confirm local governance", "Open source"],
    ],
  },
  {
    slug: "mental-health-act-forms",
    title: "Mental Health Act forms quick reference",
    fileName: "mental-health-act-forms-reference.pdf",
    kind: "Quick reference",
    defaultPage: 2,
    pageCount: 6,
    status: "Indexed",
    review: "Form checklist",
    section: "Forms and documentation",
    summary:
      "Mock source preview for form-heavy results, keeping the document type and target page obvious from the handoff.",
    tags: ["Forms", "Workflow", "Legal"],
    matchedTerms: ["forms", "workflow", "reference"],
    evidence: [
      { label: "Checklist", value: "forms", icon: BadgeCheck, tone: "success" },
      { label: "PDF page", value: "p.2", icon: FileText, tone: "info" },
      { label: "Workflow", value: "legal", icon: AlertCircle, tone: "warning" },
    ],
    passage: [
      "The quick reference groups forms by use case and required documentation step.",
      "The handoff preserves the target page so users can inspect the original source quickly.",
      "Scope and answer actions remain available from the selected source preview.",
    ],
    tableRows: [
      ["Assessment", "Open form checklist", "Confirm status"],
      ["Transfer", "Check required document", "Open source"],
      ["Review", "Record local governance", "Scope"],
    ],
  },
];

async function fetchJson<T>(url: string, signal: AbortSignal, authorizationHeader: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", ...authorizationHeader },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}.`);
  }
  return (await response.json()) as T;
}

function pageFor(result: ChunkSearchResult | undefined) {
  return Math.max(1, Number(result?.page_number ?? 1));
}

function documentSearchTerm(query: string, documentHint: string) {
  const lowered = `${documentHint} ${query}`.toLowerCase();
  if (lowered.includes("clozapine")) return "clozapine";
  if (lowered.includes("agitation")) return "agitation";
  if (lowered.includes("mental health act")) return "mental health act";
  return query.split(/\s+/).slice(0, 3).join(" ") || defaultQuery;
}

function liveDocumentHref(documentId: string, result: ChunkSearchResult | undefined) {
  const params = new URLSearchParams({ page: String(pageFor(result)) });
  if (result?.id) params.set("chunk", result.id);
  return `/documents/${documentId}?${params.toString()}`;
}

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function mockSourceFor(documentHint: string, query: string) {
  const normalized = `${documentHint} ${query}`.toLowerCase();
  return (
    mockSources.find((source) => normalized.includes(source.slug) || normalized.includes(source.title.toLowerCase())) ??
    (normalized.includes("agitation")
      ? mockSources.find((source) => source.slug === "acute-agitation-pathway")
      : null) ??
    (normalized.includes("mental health act") || normalized.includes("forms")
      ? mockSources.find((source) => source.slug === "mental-health-act-forms")
      : null) ??
    mockSources[0]
  );
}

function TonePill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "accent" | "info" | "success" | "warning" | "neutral";
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
            : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]";
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center rounded-md border px-2.5 text-xs font-bold shadow-[var(--shadow-inset)]",
        toneClass,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function EvidenceCard({ label, value, icon: Icon, tone }: MockSourceDocument["evidence"][number]) {
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
      <p className="mt-3 text-sm font-extrabold text-[color:var(--text-heading)]">{label}</p>
      <p className="mt-1 text-xs font-bold text-[color:var(--text-muted)]">{value}</p>
    </div>
  );
}

function MockDocumentPagePreview({ source, page, chunk }: { source: MockSourceDocument; page: number; chunk: string }) {
  return (
    <section
      aria-label="Mock highlighted source page"
      className="overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
            Mock source page
          </p>
          <h2 className="mt-1 truncate text-base font-extrabold text-[color:var(--text-heading)]">{source.section}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <TonePill tone="accent">p.{page}</TonePill>
          <TonePill tone="info">{chunk.replaceAll("-", " ")}</TonePill>
        </div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
          <div className="space-y-2">
            <span className="block h-3 w-44 rounded bg-[color:var(--text-soft)]/45" />
            <span className="block h-2.5 w-72 max-w-full rounded bg-[color:var(--border-strong)]" />
            <span className="block h-2.5 w-60 max-w-full rounded bg-[color:var(--border)]" />
          </div>
          <div className="mt-5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3">
            <p className="text-sm font-bold leading-6 text-[color:var(--text-heading)]">{source.passage[0]}</p>
          </div>
          <div className="mt-4 space-y-2">
            {source.passage.slice(1).map((line) => (
              <p key={line} className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                {line}
              </p>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-[color:var(--border)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[color:var(--clinical-chat-table-header)] text-[color:var(--text-muted)]">
                <tr>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 font-extrabold">Source row</th>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 font-extrabold">What to review</th>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 font-extrabold">Action</th>
                </tr>
              </thead>
              <tbody>
                {source.tableRows.map((row, index) => (
                  <tr key={row.join(":")} className={index === 1 ? "bg-[color:var(--clinical-accent-soft)]" : ""}>
                    {row.map((cell) => (
                      <td key={cell} className="border-b border-[color:var(--border)] px-3 py-2 font-semibold">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="grid content-start gap-2">
          {Array.from({ length: 4 }).map((_, index) => {
            const pageNumber = Math.max(1, page - 1 + index);
            const active = pageNumber === page;
            return (
              <div
                key={pageNumber}
                className={cn(
                  "rounded-lg border bg-[color:var(--surface)] p-2 shadow-[var(--shadow-inset)]",
                  active
                    ? "border-[color:var(--clinical-accent)] ring-1 ring-[color:var(--clinical-accent)]/20"
                    : "border-[color:var(--border)]",
                )}
              >
                <p className="nums text-xs font-extrabold text-[color:var(--text-heading)]">p.{pageNumber}</p>
                <div className="mt-2 space-y-1">
                  <span className="block h-1.5 w-full rounded bg-[color:var(--border-strong)]" />
                  <span className="block h-1.5 w-4/5 rounded bg-[color:var(--border)]" />
                  <span
                    className={cn(
                      "block h-6 rounded",
                      active ? "bg-[color:var(--clinical-accent-soft)]" : "bg-[color:var(--surface-subtle)]",
                    )}
                  />
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </section>
  );
}

function MockSourceWorkbench({
  source,
  page,
  chunk,
  query,
  message,
  liveHref,
}: {
  source: MockSourceDocument;
  page: number;
  chunk: string;
  query: string;
  message: string;
  liveHref?: string;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-4 shadow-[var(--shadow-inset)]">
        <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
              Mock source preview
            </p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight text-[color:var(--text-heading)]">
              {source.title}
            </h1>
            <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--text-muted)]">{message}</p>
          </div>
          {liveHref ? (
            <Link
              href={liveHref}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)]",
                focusRing,
              )}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open live document
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <MockDocumentPagePreview source={source} page={page} chunk={chunk} />
          <div className="grid gap-3 md:grid-cols-3">
            {source.evidence.map((item) => (
              <EvidenceCard key={item.label} {...item} />
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Target className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Why this result
                </p>
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Direct source support</h2>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Query
                </dt>
                <dd className="mt-1 font-bold text-[color:var(--text-heading)]">{query}</dd>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Matched terms
                </dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {source.matchedTerms.map((term) => (
                    <TonePill key={term} tone="accent">
                      {term}
                    </TonePill>
                  ))}
                </dd>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Source metadata
                </dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  <TonePill tone="success">{source.status}</TonePill>
                  <TonePill tone="warning">{source.review}</TonePill>
                  <TonePill tone="info">{source.kind}</TonePill>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Actions</h2>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)]",
                  focusRing,
                )}
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Open mock page
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)]",
                  focusRing,
                )}
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                Scope to source
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]",
                  focusRing,
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Answer from this source
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function DocumentSearchLiveOpener() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authorizationHeader, status: authStatus } = useAuthSession();
  const query = searchParams.get("q")?.trim() || defaultQuery;
  const documentHint = searchParams.get("document")?.trim() || "clozapine";
  const mockSource = useMemo(() => mockSourceFor(documentHint, query), [documentHint, query]);
  const requestedPage = numberParam(searchParams.get("page"), mockSource.defaultPage);
  const chunk = searchParams.get("chunk")?.trim() || "best-match";
  const [state, setState] = useState<ResolverState>({
    status: "opening",
    message: "Finding an indexed document and matching source chunk.",
  });

  const lookupTerm = useMemo(() => documentSearchTerm(query, documentHint), [documentHint, query]);

  useEffect(() => {
    const controller = new AbortController();

    async function openLiveDocument() {
      if (authStatus === "loading") {
        setState({ status: "opening", message: "Checking browser document access." });
        return;
      }

      try {
        setState({ status: "opening", message: "Finding a real indexed document." });
        const documentParams = new URLSearchParams({
          limit: "20",
          includeMeta: "false",
          status: "indexed",
          q: lookupTerm,
        });
        let payload = await fetchJson<DocumentsPayload>(
          `/api/documents?${documentParams.toString()}`,
          controller.signal,
          authorizationHeader,
        );
        let documents = (payload.documents ?? []).filter((document) => document.status === "indexed");

        if (documents.length === 0) {
          const fallbackParams = new URLSearchParams({ limit: "20", includeMeta: "false", status: "indexed" });
          payload = await fetchJson<DocumentsPayload>(
            `/api/documents?${fallbackParams.toString()}`,
            controller.signal,
            authorizationHeader,
          );
          documents = (payload.documents ?? []).filter((document) => document.status === "indexed");
        }

        if (documents.length === 0) {
          setState({
            status: "mock",
            message:
              "No indexed live document was available for this lookup. This mock preview shows the intended source handoff.",
          });
          return;
        }

        setState({ status: "opening", message: "Selecting the best matching chunk." });
        let best: { document: DocumentListItem; result?: ChunkSearchResult; score: number } | null = null;

        for (const document of documents.slice(0, 8)) {
          const chunkParams = new URLSearchParams({ q: query, limit: "1" });
          const searchPayload = await fetchJson<ChunkSearchPayload>(
            `/api/documents/${document.id}/search?${chunkParams.toString()}`,
            controller.signal,
            authorizationHeader,
          );
          const result = searchPayload.results?.[0];
          const score = Number(result?.score ?? 0);
          if (result && (!best || score > best.score)) {
            best = { document, result, score };
          }
        }

        if (!best) {
          const document = documents[0];
          const detailPayload = await fetchJson<DocumentDetailPayload>(
            `/api/documents/${document.id}?page=1&pageLimit=1&chunkLimit=1`,
            controller.signal,
            authorizationHeader,
          );
          best = { document, result: detailPayload.chunks?.[0], score: 0 };
        }

        const liveHref = liveDocumentHref(best.document.id, best.result);
        setState({
          status: "opening",
          message: `Opening ${best.document.title ?? best.document.file_name ?? "document"} in the live viewer.`,
          liveHref,
        });
        router.replace(liveHref);
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "mock",
          message:
            error instanceof Error
              ? `${error.message} Showing the mock source preview instead.`
              : "The live document could not be opened. Showing the mock source preview instead.",
        });
      }
    }

    void openLiveDocument();
    return () => controller.abort();
  }, [authStatus, authorizationHeader, lookupTerm, query, router]);

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-3 py-4 pb-28 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <Link
          href="/documents/search?mode=documents"
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)]",
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to mockup
        </Link>

        {state.status === "opening" ? (
          <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                  Live document handoff
                </p>
                <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[color:var(--text-heading)]">
                  Opening the actual document
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{state.message}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[color:var(--info-border)] bg-[color:var(--info-soft)] px-2.5 text-xs font-bold text-[color:var(--info)]">
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    {query}
                  </span>
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-bold text-[color:var(--clinical-accent)]">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    actual viewer route
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <MockSourceWorkbench
            source={mockSource}
            page={requestedPage}
            chunk={chunk}
            query={query}
            message={state.message}
            liveHref={state.liveHref}
          />
        )}
      </div>
    </main>
  );
}
