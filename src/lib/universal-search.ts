import { demoSearch } from "@/lib/demo-data";
import { fetchRelatedDocuments } from "@/lib/document-enrichment";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { rankDifferentialRecords } from "@/lib/differentials";
import { formRecords, rankFormRecords, type FormRecord } from "@/lib/forms";
import { rowToMedicationRecord } from "@/lib/medication-records";
import { defaultMedicationRecords, fetchOwnerMedicationRowsWithSeed } from "@/lib/medication-seed";
import { medicationIndication, rankMedicationRecords, type MedicationRecord } from "@/lib/medications";
import { searchChunksWithTelemetry } from "@/lib/rag";
import { rowToServiceRecord } from "@/lib/registry-records";
import { fetchOwnerRegistryRowsWithSeed } from "@/lib/registry-seed";
import { rankServiceRecords, serviceRecords, type ServiceRecord } from "@/lib/services";
import { rankToolRecords } from "@/lib/tools-catalog";
import type { SearchResult } from "@/lib/types";

// Server-side federated cross-entity search: one parallel in-process fan-out to the document
// retrieval pipeline plus the shared registry rankers (medications, services, forms,
// differentials, tools). Chosen over client-side federation (N round-trips per keystroke,
// duplicated auth/demo handling) and over ingesting registry rows into the eval-gated
// pgvector corpus (couples registry edits to reindexing; kept as a documented follow-up so
// Answer mode can eventually cite registry entities).

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

export type UniversalSearchDomain = "documents" | "medications" | "services" | "forms" | "differentials" | "tools";

export const universalSearchDomains: UniversalSearchDomain[] = [
  "documents",
  "medications",
  "services",
  "forms",
  "differentials",
  "tools",
];

export type UniversalSearchItem = {
  id: string;
  kind: UniversalSearchDomain;
  title: string;
  subtitle?: string;
  href: string;
  // Comparable within a group only: registry scores are integer term-weights while document
  // scores live in [0,1]. Cross-domain ordering is by fixed group order, never by score.
  score: number;
  badge?: string;
  meta?: string;
};

export type UniversalSearchGroup = {
  kind: UniversalSearchDomain;
  total: number;
  items: UniversalSearchItem[];
  latencyMs: number;
  error?: boolean;
};

export type UniversalSearchResponse = {
  query: string;
  groups: UniversalSearchGroup[];
  tookMs: number;
  demoMode?: boolean;
  publicAccess?: boolean;
};

export type RunUniversalSearchArgs = {
  query: string;
  limitPerDomain: number;
  domains?: UniversalSearchDomain[];
  // Live mode: both present. Demo/public mode: demo=true and the registry adapters serve
  // fixtures without touching Supabase.
  supabase?: AdminClient;
  ownerId?: string;
  demo: boolean;
};

const registryDomainTimeoutMs = 2500;
const documentsDomainTimeoutMs = 6000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} search timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function medicationItem(record: MedicationRecord, score: number): UniversalSearchItem {
  return {
    id: record.slug,
    kind: "medications",
    title: record.name,
    subtitle: medicationIndication(record),
    href: `/medications/${record.slug}`,
    score,
    badge: record.schedule || undefined,
    meta: [record.class, record.subclass].filter(Boolean).join(" · ") || undefined,
  };
}

function serviceItem(record: ServiceRecord, score: number): UniversalSearchItem {
  return {
    id: record.slug,
    kind: "services",
    title: record.title,
    subtitle: record.subtitle ?? undefined,
    href: `/services/${record.slug}`,
    score,
    badge: record.statusChips?.[0]?.label ?? undefined,
    meta: record.primaryContact?.value ?? undefined,
  };
}

function formItem(record: FormRecord, score: number): UniversalSearchItem {
  return {
    id: record.slug,
    kind: "forms",
    title: record.title,
    subtitle: record.subtitle ?? undefined,
    href: `/forms/${record.slug}`,
    score,
    badge: record.catalogueLabel ?? undefined,
  };
}

async function searchMedicationsDomain(args: RunUniversalSearchArgs): Promise<UniversalSearchItem[]> {
  const records =
    !args.demo && args.supabase && args.ownerId
      ? (await fetchOwnerMedicationRowsWithSeed(args.supabase, args.ownerId)).map(rowToMedicationRecord)
      : defaultMedicationRecords();
  return rankMedicationRecords(records, args.query, args.limitPerDomain).map((match) =>
    medicationItem(match.medication, match.score),
  );
}

async function searchServicesDomain(args: RunUniversalSearchArgs): Promise<UniversalSearchItem[]> {
  const records =
    !args.demo && args.supabase && args.ownerId
      ? (await fetchOwnerRegistryRowsWithSeed(args.supabase, args.ownerId, "service")).map(rowToServiceRecord)
      : serviceRecords;
  return rankServiceRecords(records, args.query, args.limitPerDomain).map((match) =>
    serviceItem(match.service, match.score),
  );
}

async function searchFormsDomain(args: RunUniversalSearchArgs): Promise<UniversalSearchItem[]> {
  const records =
    !args.demo && args.supabase && args.ownerId
      ? (await fetchOwnerRegistryRowsWithSeed(args.supabase, args.ownerId, "form")).map(rowToServiceRecord)
      : formRecords;
  return rankFormRecords(records, args.query, args.limitPerDomain).map((match) => formItem(match.service, match.score));
}

async function searchDifferentialsDomain(args: RunUniversalSearchArgs): Promise<UniversalSearchItem[]> {
  // Differentials are a static snapshot for list/search purposes (owner edits surface only on
  // detail pages today), so demo and live share the in-bundle catalogue.
  return rankDifferentialRecords(args.query, args.limitPerDomain).map((match) => ({
    id: match.record.slug,
    kind: "differentials",
    title: match.record.title,
    subtitle: match.record.clinicalHinge || match.record.subtitle || undefined,
    href: `/differentials/diagnoses/${match.record.slug}`,
    score: match.score,
  }));
}

async function searchToolsDomain(args: RunUniversalSearchArgs): Promise<UniversalSearchItem[]> {
  return rankToolRecords(args.query, args.limitPerDomain).map((match) => ({
    id: match.tool.id,
    kind: "tools",
    title: match.tool.title,
    subtitle: match.tool.bestFor,
    href: match.tool.href,
    score: match.score,
    badge: match.tool.sourceBacked ? "Source-backed" : undefined,
  }));
}

function documentItemsFromChunks(results: SearchResult[], limit: number): UniversalSearchItem[] {
  const byDocument = new Map<string, UniversalSearchItem>();
  for (const result of results) {
    const score = result.hybrid_score ?? result.similarity ?? 0;
    const existing = byDocument.get(result.document_id);
    if (existing) {
      existing.score = Math.max(existing.score, score);
      continue;
    }
    byDocument.set(result.document_id, {
      id: result.document_id,
      kind: "documents",
      title: result.title,
      subtitle: result.section_heading ?? undefined,
      href: `/documents/${result.document_id}`,
      score,
      meta: result.file_name,
    });
  }
  return Array.from(byDocument.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function searchDocumentsDomain(args: RunUniversalSearchArgs): Promise<UniversalSearchItem[]> {
  if (args.demo || !args.supabase) {
    return documentItemsFromChunks(
      demoSearch(args.query, args.limitPerDomain * 3) as SearchResult[],
      args.limitPerDomain,
    );
  }
  const { results } = await searchChunksWithTelemetry({
    query: args.query,
    ownerId: args.ownerId,
    topK: Math.max(6, args.limitPerDomain),
    allowGlobalSearch: !args.ownerId,
  });
  const related = await fetchRelatedDocuments({
    supabase: args.supabase,
    ownerId: args.ownerId,
    query: args.query,
    results,
    limit: args.limitPerDomain,
  });
  if (related.length > 0) {
    return related.map((document) => ({
      id: document.document_id,
      kind: "documents" as const,
      title: document.title,
      subtitle: document.summary ?? undefined,
      href: `/documents/${document.document_id}`,
      score: document.score,
      meta: document.match_reason,
    }));
  }
  return documentItemsFromChunks(results, args.limitPerDomain);
}

const domainAdapters: Record<
  UniversalSearchDomain,
  { run: (args: RunUniversalSearchArgs) => Promise<UniversalSearchItem[]>; timeoutMs: number }
> = {
  documents: { run: searchDocumentsDomain, timeoutMs: documentsDomainTimeoutMs },
  medications: { run: searchMedicationsDomain, timeoutMs: registryDomainTimeoutMs },
  services: { run: searchServicesDomain, timeoutMs: registryDomainTimeoutMs },
  forms: { run: searchFormsDomain, timeoutMs: registryDomainTimeoutMs },
  differentials: { run: searchDifferentialsDomain, timeoutMs: registryDomainTimeoutMs },
  tools: { run: searchToolsDomain, timeoutMs: registryDomainTimeoutMs },
};

export async function runUniversalSearch(args: RunUniversalSearchArgs): Promise<UniversalSearchResponse> {
  const startedAt = Date.now();
  const requested = args.domains?.length
    ? universalSearchDomains.filter((domain) => args.domains!.includes(domain))
    : universalSearchDomains;

  const settled = await Promise.allSettled(
    requested.map(async (domain): Promise<UniversalSearchGroup> => {
      const domainStartedAt = Date.now();
      const adapter = domainAdapters[domain];
      const items = await withTimeout(adapter.run(args), adapter.timeoutMs, domain);
      return {
        kind: domain,
        total: items.length,
        items: items.slice(0, args.limitPerDomain),
        latencyMs: Date.now() - domainStartedAt,
      };
    }),
  );

  // A failed domain yields an empty errored group — one slow or broken adapter must never
  // blank the whole response.
  const groups = settled.map((result, index): UniversalSearchGroup => {
    if (result.status === "fulfilled") return result.value;
    return { kind: requested[index], total: 0, items: [], latencyMs: Date.now() - startedAt, error: true };
  });

  return { query: args.query, groups, tookMs: Date.now() - startedAt };
}

export function universalSearchViewAllHref(domain: UniversalSearchDomain, query: string) {
  switch (domain) {
    case "documents":
      return documentsSearchHref({ query, run: true });
    case "medications":
      return `/?mode=prescribing&q=${encodeURIComponent(query)}&run=1`;
    case "services":
      return `/services?q=${encodeURIComponent(query)}&run=1`;
    case "forms":
      return `/forms?q=${encodeURIComponent(query)}&run=1`;
    case "differentials":
      return `/differentials?q=${encodeURIComponent(query)}&run=1`;
    case "tools":
      return `/?mode=tools&q=${encodeURIComponent(query)}&run=1`;
  }
}
