import { normalizeSearchText } from "@/lib/catalog-search";
import { analyzeClinicalQuery } from "@/lib/clinical-search";
import { demoSearch } from "@/lib/demo-data";
import { fetchRelatedDocuments } from "@/lib/document-enrichment";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { differentialRecords, rankDifferentialRecords } from "@/lib/differentials";
import { formRecords, rankFormRecords, type FormRecord } from "@/lib/forms";
import { rowToMedicationRecord } from "@/lib/medication-records";
import { defaultMedicationRecords, fetchOwnerMedicationRowsWithSeed } from "@/lib/medication-seed";
import { medicationIndication, rankMedicationRecords, type MedicationRecord } from "@/lib/medications";
import { searchChunksWithTelemetry } from "@/lib/rag";
import { rowToServiceRecord } from "@/lib/registry-records";
import { fetchOwnerRegistryRowsWithSeed } from "@/lib/registry-seed";
import { rankServiceRecords, serviceRecords, type ServiceRecord } from "@/lib/services";
import { rankToolRecords } from "@/lib/tools-catalog";
import type { ClinicalQueryAnalysis, SearchResult } from "@/lib/types";

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
  // Set server-side: the item's title is a whole-phrase match of the (typo-corrected) query,
  // i.e. a near-exact hit. Drives best-bet (topHit) selection; comparable across domains
  // because it is a boolean about the query text, not a cross-domain score.
  confident?: boolean;
};

export type UniversalSearchGroup = {
  kind: UniversalSearchDomain;
  total: number;
  items: UniversalSearchItem[];
  latencyMs: number;
  error?: boolean;
};

// How the raw query was understood, so the UI can show a "Showing results for… / Did you
// mean" affordance. Derived once from analyzeClinicalQuery (the same layer /api/search uses).
export type UniversalSearchInterpretation = {
  // Present only when typo corrections changed the query (e.g. "clozapin" -> "clozapine").
  correctedQuery?: string;
  typoCorrections?: Array<{ from: string; to: string }>;
  // Synonym/acronym/alias terms actually threaded into the registry rankers.
  appliedExpansions?: string[];
  queryClass?: string;
  intent?: string;
};

// A single highlighted best-bet across all domains: the strongest near-exact match, preferring
// the intent-favoured domain. Absent when no confident match exists (no misleading best-bet).
export type UniversalSearchTopHit = UniversalSearchItem & { reason?: string };

// A jump into Answer mode for question-like queries.
export type UniversalSearchAnswerAction = { href: string; label: string };

export type UniversalSearchResponse = {
  query: string;
  groups: UniversalSearchGroup[];
  tookMs: number;
  interpretation?: UniversalSearchInterpretation;
  // Intent-aware order the client should render groups in (a permutation of the requested
  // domains). Only the group order changes — within-group scores are untouched.
  domainOrder?: UniversalSearchDomain[];
  topHit?: UniversalSearchTopHit;
  answerAction?: UniversalSearchAnswerAction;
  // demoMode / publicAccess are attached by the route to its JSON response, not by runUniversalSearch.
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

// Args after query understanding: registry adapters rank against baseQuery (typo-corrected)
// with expansions in the low-weight lane; the documents adapter keeps the ORIGINAL query
// because searchChunksWithTelemetry runs its own analyzeClinicalQuery (double-expanding would
// double-count).
type ResolvedSearchArgs = RunUniversalSearchArgs & {
  baseQuery: string;
  expansions: string[];
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

async function searchMedicationsDomain(args: ResolvedSearchArgs): Promise<UniversalSearchItem[]> {
  const records =
    !args.demo && args.supabase && args.ownerId
      ? (await fetchOwnerMedicationRowsWithSeed(args.supabase, args.ownerId)).map(rowToMedicationRecord)
      : defaultMedicationRecords();
  return rankMedicationRecords(records, args.baseQuery, args.limitPerDomain, args.expansions).map((match) =>
    medicationItem(match.medication, match.score),
  );
}

async function searchServicesDomain(args: ResolvedSearchArgs): Promise<UniversalSearchItem[]> {
  const records =
    !args.demo && args.supabase && args.ownerId
      ? (await fetchOwnerRegistryRowsWithSeed(args.supabase, args.ownerId, "service")).map(rowToServiceRecord)
      : serviceRecords;
  return rankServiceRecords(records, args.baseQuery, args.limitPerDomain, args.expansions).map((match) =>
    serviceItem(match.service, match.score),
  );
}

async function searchFormsDomain(args: ResolvedSearchArgs): Promise<UniversalSearchItem[]> {
  const records =
    !args.demo && args.supabase && args.ownerId
      ? (await fetchOwnerRegistryRowsWithSeed(args.supabase, args.ownerId, "form")).map(rowToServiceRecord)
      : formRecords;
  return rankFormRecords(records, args.baseQuery, args.limitPerDomain, args.expansions).map((match) =>
    formItem(match.service, match.score),
  );
}

async function searchDifferentialsDomain(args: ResolvedSearchArgs): Promise<UniversalSearchItem[]> {
  // Differentials are a static snapshot for list/search purposes (owner edits surface only on
  // detail pages today), so demo and live share the in-bundle catalogue.
  return rankDifferentialRecords(differentialRecords, args.baseQuery, args.limitPerDomain, args.expansions).map(
    (match) => ({
      id: match.record.slug,
      kind: "differentials",
      title: match.record.title,
      subtitle: match.record.clinicalHinge || match.record.subtitle || undefined,
      href: `/differentials/diagnoses/${match.record.slug}`,
      score: match.score,
    }),
  );
}

async function searchToolsDomain(args: ResolvedSearchArgs): Promise<UniversalSearchItem[]> {
  return rankToolRecords(args.baseQuery, args.limitPerDomain, args.expansions).map((match) => ({
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

async function searchDocumentsDomain(args: ResolvedSearchArgs): Promise<UniversalSearchItem[]> {
  // Original query on purpose: the live retrieval path runs its own analyzeClinicalQuery.
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
    // Typeahead preview only: lexical/trigram retrieval is enough for a short document list, so
    // skip the per-keystroke OpenAI embedding round-trip. The Answer/Documents full-search paths
    // still embed. Owner scoping and public-corpus behavior are unchanged (handled downstream).
    lexicalOnly: true,
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
  { run: (args: ResolvedSearchArgs) => Promise<UniversalSearchItem[]>; timeoutMs: number }
> = {
  documents: { run: searchDocumentsDomain, timeoutMs: documentsDomainTimeoutMs },
  medications: { run: searchMedicationsDomain, timeoutMs: registryDomainTimeoutMs },
  services: { run: searchServicesDomain, timeoutMs: registryDomainTimeoutMs },
  forms: { run: searchFormsDomain, timeoutMs: registryDomainTimeoutMs },
  differentials: { run: searchDifferentialsDomain, timeoutMs: registryDomainTimeoutMs },
  tools: { run: searchToolsDomain, timeoutMs: registryDomainTimeoutMs },
};

const maxExpansions = 16;

// Question-like leads that warrant an "Ask this question" bridge into Answer mode.
const questionLeadPattern = /^\s*(what|how|when|why|which|who|where|should|can|could|would|is|are|do|does|did)\b/i;

function applyTypoCorrections(query: string, corrections: Array<{ from: string; to: string }>): string {
  if (!corrections.length) return query;
  const map = new Map(corrections.map((correction) => [correction.from, correction.to] as const));
  return query
    .split(/\s+/)
    .map((token) => map.get(token.toLowerCase()) ?? token)
    .join(" ");
}

// Synonym/acronym/alias terms for the rankers' low-weight expanded lane. Dropped: the base
// query's own tokens (already scored in the high-weight field lane) and anything past the cap
// (analyzeClinicalQuery can emit up to ~48 vocabulary terms; too many would dilute precision).
function deriveExpansions(analysis: ClinicalQueryAnalysis, baseQuery: string): string[] {
  const baseTokens = new Set(normalizeSearchText(baseQuery).split(/\s+/).filter(Boolean));
  const seen = new Set<string>();
  const expansions: string[] = [];
  for (const term of analysis.expandedTerms) {
    const normalized = term.toLowerCase().trim();
    if (normalized.length < 2 || baseTokens.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    expansions.push(normalized);
    if (expansions.length >= maxExpansions) break;
  }
  return expansions;
}

// A whole-phrase (word-boundary) occurrence of the query inside a title — the "near-exact hit"
// signal for best-bet selection. Padding both sides prevents partial-word matches.
function titleMatchesQuery(title: string, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return false;
  return ` ${normalizeSearchText(title)} `.includes(` ${needle} `);
}

// Domains whose group should lead, from query intent. Reorders groups only; scores untouched.
function preferredLeadDomains(analysis: ClinicalQueryAnalysis): UniversalSearchDomain[] {
  switch (analysis.queryClass) {
    case "medication_dose_risk":
      return ["medications"];
    case "document_lookup":
      return ["documents"];
    case "comparison":
      return ["differentials"];
    case "table_threshold":
      return ["documents", "medications"];
    default:
      break;
  }
  if (analysis.medications.length) return ["medications"];
  if (analysis.documentTitleIntent) return ["documents"];
  return [];
}

function buildDomainOrder(analysis: ClinicalQueryAnalysis, groups: UniversalSearchGroup[]): UniversalSearchDomain[] {
  const present = new Set(groups.map((group) => group.kind));
  const confidentDomains = groups
    .filter((group) => group.items.some((item) => item.confident))
    .map((group) => group.kind);
  const order: UniversalSearchDomain[] = [];
  for (const domain of [...preferredLeadDomains(analysis), ...confidentDomains, ...universalSearchDomains]) {
    if (present.has(domain) && !order.includes(domain)) order.push(domain);
  }
  return order;
}

function buildTopHit(
  groups: UniversalSearchGroup[],
  domainOrder: UniversalSearchDomain[],
): UniversalSearchTopHit | undefined {
  const groupByKind = new Map(groups.map((group) => [group.kind, group]));
  for (const domain of domainOrder) {
    const hit = groupByKind.get(domain)?.items.find((item) => item.confident);
    if (hit) return { ...hit, reason: `Best match in ${domain}` };
  }
  return undefined;
}

function buildAnswerAction(analysis: ClinicalQueryAnalysis, query: string): UniversalSearchAnswerAction | undefined {
  const trimmed = query.trim();
  if (trimmed.length < 3) return undefined;
  const looksLikeQuestion = trimmed.endsWith("?") || questionLeadPattern.test(trimmed) || analysis.needsSynthesis;
  // A bare document lookup ("clozapine guideline") wants the document, not a generated answer.
  const bareLookup = analysis.queryClass === "document_lookup" && !analysis.needsSynthesis;
  if (!looksLikeQuestion || bareLookup) return undefined;
  return { href: `/?mode=answer&q=${encodeURIComponent(trimmed)}&run=1`, label: "Ask this question" };
}

function buildInterpretation(
  analysis: ClinicalQueryAnalysis,
  baseQuery: string,
  expansions: string[],
): UniversalSearchInterpretation {
  return {
    correctedQuery: analysis.typoCorrections.length ? baseQuery : undefined,
    typoCorrections: analysis.typoCorrections.length ? analysis.typoCorrections : undefined,
    appliedExpansions: expansions.length ? expansions : undefined,
    queryClass: analysis.queryClass,
    intent: analysis.intent,
  };
}

export async function runUniversalSearch(args: RunUniversalSearchArgs): Promise<UniversalSearchResponse> {
  const startedAt = Date.now();
  const requested = args.domains?.length
    ? universalSearchDomains.filter((domain) => args.domains!.includes(domain))
    : universalSearchDomains;

  // Understand the query once (analyzeClinicalQuery memoizes): typo-correct the base query the
  // registry rankers score against, and collect synonym/acronym/alias terms for their low-weight
  // expanded lane. The documents adapter still receives the ORIGINAL query (it self-analyses).
  const analysis = analyzeClinicalQuery(args.query);
  const baseQuery = applyTypoCorrections(args.query, analysis.typoCorrections);
  const expansions = deriveExpansions(analysis, baseQuery);
  const resolved: ResolvedSearchArgs = { ...args, baseQuery, expansions };

  const settled = await Promise.allSettled(
    requested.map(async (domain): Promise<UniversalSearchGroup> => {
      const domainStartedAt = Date.now();
      const adapter = domainAdapters[domain];
      const items = await withTimeout(adapter.run(resolved), adapter.timeoutMs, domain);
      // Tag near-exact title matches so best-bet + ordering can compare across domains without
      // leaning on the per-domain scores (which are not comparable across domains).
      const tagged = items
        .slice(0, args.limitPerDomain)
        .map((item) => ({ ...item, confident: titleMatchesQuery(item.title, baseQuery) }));
      return {
        kind: domain,
        total: tagged.length,
        items: tagged,
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

  const domainOrder = buildDomainOrder(analysis, groups);
  return {
    query: args.query,
    groups,
    tookMs: Date.now() - startedAt,
    interpretation: buildInterpretation(analysis, baseQuery, expansions),
    domainOrder,
    topHit: buildTopHit(groups, domainOrder),
    answerAction: buildAnswerAction(analysis, args.query),
  };
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
