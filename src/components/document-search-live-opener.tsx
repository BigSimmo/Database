"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ExternalLink, FileText, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";

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
  { status: "opening"; message: string; liveHref?: string } | { status: "error"; message: string; liveHref?: string };

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const defaultQuery = "clozapine monitoring table";

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
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

export function DocumentSearchLiveOpener() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || defaultQuery;
  const documentHint = searchParams.get("document")?.trim() || "clozapine";
  const [state, setState] = useState<ResolverState>({
    status: "opening",
    message: "Finding an indexed document and matching source chunk.",
  });

  const lookupTerm = useMemo(() => documentSearchTerm(query, documentHint), [documentHint, query]);

  useEffect(() => {
    const controller = new AbortController();

    async function openLiveDocument() {
      try {
        setState({ status: "opening", message: "Finding a real indexed document." });
        const documentParams = new URLSearchParams({
          limit: "20",
          includeMeta: "false",
          q: lookupTerm,
        });
        let payload = await fetchJson<DocumentsPayload>(
          `/api/documents?${documentParams.toString()}`,
          controller.signal,
        );
        let documents = (payload.documents ?? []).filter((document) => document.status === "indexed");

        if (documents.length === 0) {
          payload = await fetchJson<DocumentsPayload>("/api/documents?limit=20&includeMeta=false", controller.signal);
          documents = (payload.documents ?? []).filter((document) => document.status === "indexed");
        }

        if (documents.length === 0) {
          setState({
            status: "error",
            message: "No indexed documents are available to open in the live viewer.",
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
          status: "error",
          message: error instanceof Error ? error.message : "The live document could not be opened.",
        });
      }
    }

    void openLiveDocument();
    return () => controller.abort();
  }, [lookupTerm, query, router]);

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-3 py-4 pb-28 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/mockups/document-search-command?mode=documents"
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)]",
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to mockup
        </Link>

        <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
              {state.status === "opening" ? (
                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                Live document handoff
              </p>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[color:var(--text-heading)]">
                {state.status === "opening" ? "Opening the actual document" : "Could not open the actual document"}
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

          {state.liveHref ? (
            <Link
              href={state.liveHref}
              className={cn(
                "mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)]",
                focusRing,
              )}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open live document
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
