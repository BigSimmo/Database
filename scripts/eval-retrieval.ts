import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { loadCapturedRagEvalCases, type RagEvalCase, type SupabaseEvalCaseClient } from "@/lib/rag-eval-cases";
import type { SearchResult } from "@/lib/types";
import { findOwnerIdByEmail, loadAdminClient, percentile } from "./eval-utils";

loadEnvConfig(process.cwd());

const contentExpectationSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);

const goldenCaseSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  expectedQueryClass: z.string().min(1),
  expectedDocumentSubstrings: z.array(z.string().min(1)).default([]),
  expectedContentTerms: z.array(contentExpectationSchema).default([]),
  topK: z.number().int().positive().default(8),
  expectTableEvidence: z.boolean().default(false),
});

const goldenCasesSchema = z.array(goldenCaseSchema);

export type GoldenRetrievalCase = z.infer<typeof goldenCaseSchema>;

type EvalArgs = {
  fixture: string;
  ownerEmail?: string;
  ownerId?: string;
  limit?: number;
  query?: string;
  json: boolean;
  failOnThreshold: boolean;
};

export type GoldenRetrievalResult = {
  id: string;
  query: string;
  expectedQueryClass: string;
  actualQueryClass: string | null;
  documentRecallAt5: number;
  contentRecallAt5: number;
  hitAtK: boolean;
  topK: number;
  reciprocalRankAt10: number;
  latencyMs: number;
  retrievalStrategy: string | null;
  resultCount: number;
  tableEvidenceFound: boolean;
  failures: string[];
  topResults: Array<{
    rank: number;
    title: string;
    file_name: string;
    chunk_id: string;
    page_number: number | null;
    hybrid_score: number | null;
    similarity: number;
    text_rank: number | null;
    rrf_score: number | null;
    score_explanation?: SearchResult["score_explanation"];
    content_preview: string;
  }>;
};

function parseArgs(argv: string[]): EvalArgs {
  const args: EvalArgs = {
    fixture: join(process.cwd(), "scripts", "fixtures", "rag-retrieval-golden.json"),
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    json: false,
    failOnThreshold: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--fail-on-threshold") {
      args.failOnThreshold = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--fixture") args.fixture = value;
    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--owner-id") args.ownerId = value;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--query") args.query = value;
  }

  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }

  return args;
}

export function loadGoldenRetrievalCases(path: string) {
  const parsed = goldenCasesSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return parsed;
}

export function capturedRagCaseToGoldenCase(testCase: RagEvalCase): GoldenRetrievalCase {
  return {
    id: testCase.id,
    query: testCase.question,
    expectedQueryClass: testCase.expectedQueryClass ?? "document_lookup",
    expectedDocumentSubstrings: testCase.expectedFiles,
    expectedContentTerms: [],
    topK: 8,
    expectTableEvidence: Boolean(testCase.requireVisualEvidence),
  };
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const clinicalContentAliases: Record<string, string[]> = {
  anc: ["anc", "absolute neutrophil count", "neutrophil", "neutrophils"],
  fbc: ["fbc", "full blood count", "full blood", "wbc", "white blood cell", "white cell"],
  im: ["im", "intramuscular", "intramuscularly"],
  po: ["po", "oral", "orally"],
  prn: ["prn", "as required"],
  withhold: ["withhold", "withheld", "withholding", "cease", "ceased", "stop", "stopped", "red"],
};

function contentExpectationAlternatives(expectation: GoldenRetrievalCase["expectedContentTerms"][number]) {
  const terms = Array.isArray(expectation) ? expectation : [expectation];
  return Array.from(
    new Set(
      terms.flatMap((term) => {
        const normalizedTerm = normalized(term);
        return [normalizedTerm, ...(clinicalContentAliases[normalizedTerm] ?? [])].filter(Boolean);
      }),
    ),
  );
}

function contentExpectationLabel(expectation: GoldenRetrievalCase["expectedContentTerms"][number]) {
  return Array.isArray(expectation) ? expectation.join(" OR ") : expectation;
}

function textContainsClinicalTerm(text: string, term: string) {
  const normalizedTerm = normalized(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(text);
}

function resultDocumentText(result: SearchResult) {
  return normalized(`${result.title} ${result.file_name}`);
}

function resultContentText(result: SearchResult) {
  const tableFactText = (result.table_facts ?? [])
    .map((fact) =>
      [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const imageText = (result.images ?? [])
    .map((image) =>
      [image.caption, image.tableTitle, image.tableLabel, image.tableTextSnippet].filter(Boolean).join(" "),
    )
    .join(" ");
  return normalized(
    [
      result.title,
      result.file_name,
      result.section_heading,
      result.section_path?.join(" "),
      result.retrieval_synopsis,
      result.content,
      tableFactText,
      imageText,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function expectedDocumentHits(expectedSubstrings: string[], results: SearchResult[], limit: number) {
  const topDocumentText = results.slice(0, limit).map(resultDocumentText);
  const hits = expectedSubstrings.filter((expected) =>
    topDocumentText.some((documentText) => documentText.includes(normalized(expected))),
  );
  return { hits, missing: expectedSubstrings.filter((expected) => !hits.includes(expected)) };
}

function expectedContentHits(
  expectedTerms: GoldenRetrievalCase["expectedContentTerms"],
  results: SearchResult[],
  limit: number,
) {
  const topContentText = results.slice(0, limit).map(resultContentText).join(" ");
  const hits = expectedTerms.filter((expectation) =>
    contentExpectationAlternatives(expectation).some((term) => textContainsClinicalTerm(topContentText, term)),
  );
  return {
    hits: hits.map(contentExpectationLabel),
    missing: expectedTerms.filter((expectation) => !hits.includes(expectation)).map(contentExpectationLabel),
  };
}

function reciprocalRankAt10(expectedSubstrings: string[], results: SearchResult[]) {
  if (expectedSubstrings.length === 0) return 0;
  const expected = expectedSubstrings.map(normalized);
  const index = results
    .slice(0, 10)
    .findIndex((result) => expected.some((substring) => resultDocumentText(result).includes(substring)));
  return index >= 0 ? 1 / (index + 1) : 0;
}

function hasTableEvidence(results: SearchResult[], limit = 5) {
  return results.slice(0, limit).some((result) => {
    if ((result.table_facts?.length ?? 0) > 0) return true;
    return (result.images ?? []).some(
      (image) =>
        image.image_type === "clinical_table" ||
        image.source_kind === "table_crop" ||
        Boolean(image.tableTitle || image.tableLabel || image.tableTextSnippet),
    );
  });
}

function topResultSummary(results: SearchResult[]) {
  return results.slice(0, 5).map((result, index) => ({
    rank: index + 1,
    title: result.title,
    file_name: result.file_name,
    chunk_id: result.id,
    page_number: result.page_number,
    hybrid_score: result.hybrid_score ?? null,
    similarity: result.similarity,
    text_rank: result.text_rank ?? null,
    rrf_score: result.rrf_score ?? null,
    score_explanation: result.score_explanation,
    content_preview: (result.retrieval_synopsis || result.content).replace(/\s+/g, " ").trim().slice(0, 220),
  }));
}

export function evaluateGoldenRetrievalCase(args: {
  testCase: GoldenRetrievalCase;
  results: SearchResult[];
  telemetry: { query_class?: string | null; retrieval_strategy?: string | null };
  latencyMs: number;
}): GoldenRetrievalResult {
  const documentHits = expectedDocumentHits(args.testCase.expectedDocumentSubstrings, args.results, 5);
  const contentHits = expectedContentHits(args.testCase.expectedContentTerms, args.results, 5);
  const topK = args.testCase.topK;
  const documentHitsAtK = expectedDocumentHits(args.testCase.expectedDocumentSubstrings, args.results, topK);
  const contentHitsAtK = expectedContentHits(args.testCase.expectedContentTerms, args.results, topK);
  const documentRecallAt5 =
    args.testCase.expectedDocumentSubstrings.length === 0
      ? 1
      : documentHits.hits.length / args.testCase.expectedDocumentSubstrings.length;
  const contentRecallAt5 =
    args.testCase.expectedContentTerms.length === 0
      ? 1
      : contentHits.hits.length / args.testCase.expectedContentTerms.length;
  const tableEvidenceFound = hasTableEvidence(args.results, 5);
  const tableEvidenceFoundAtK = hasTableEvidence(args.results, topK);
  const actualQueryClass = args.telemetry.query_class ?? null;
  const failures: string[] = [];
  const hitAtK =
    documentHitsAtK.missing.length === 0 &&
    contentHitsAtK.missing.length === 0 &&
    (!args.testCase.expectTableEvidence || tableEvidenceFoundAtK);

  if (actualQueryClass !== args.testCase.expectedQueryClass) {
    failures.push(`expected query class ${args.testCase.expectedQueryClass}, got ${actualQueryClass ?? "none"}`);
  }
  if (documentHits.missing.length > 0) {
    failures.push(`missing expected document(s) in top 5: ${documentHits.missing.join(", ")}`);
  }
  if (contentHits.missing.length > 0) {
    failures.push(`missing expected content term(s) in top 5: ${contentHits.missing.join(", ")}`);
  }
  if (args.testCase.expectTableEvidence && !tableEvidenceFound) {
    failures.push("expected table evidence in top 5");
  }

  return {
    id: args.testCase.id,
    query: args.testCase.query,
    expectedQueryClass: args.testCase.expectedQueryClass,
    actualQueryClass,
    documentRecallAt5,
    contentRecallAt5,
    hitAtK,
    topK,
    reciprocalRankAt10: reciprocalRankAt10(args.testCase.expectedDocumentSubstrings, args.results),
    latencyMs: args.latencyMs,
    retrievalStrategy: args.telemetry.retrieval_strategy ?? null,
    resultCount: args.results.length,
    tableEvidenceFound,
    failures,
    topResults: topResultSummary(args.results),
  };
}

export function summarizeGoldenRetrievalResults(results: GoldenRetrievalResult[]) {
  const documentRecallDenominator = Math.max(results.length, 1);
  const contentRecallDenominator = Math.max(results.length, 1);
  const strategyCounts = results.reduce<Record<string, number>>((counts, result) => {
    const strategy = result.retrievalStrategy ?? "none";
    counts[strategy] = (counts[strategy] ?? 0) + 1;
    return counts;
  }, {});
  return {
    case_count: results.length,
    document_recall_at_5: Number(
      (results.reduce((sum, result) => sum + result.documentRecallAt5, 0) / documentRecallDenominator).toFixed(4),
    ),
    content_recall_at_5: Number(
      (results.reduce((sum, result) => sum + result.contentRecallAt5, 0) / contentRecallDenominator).toFixed(4),
    ),
    top_k_hit_rate: Number(
      (results.filter((result) => result.hitAtK).length / Math.max(results.length, 1)).toFixed(4),
    ),
    mrr_at_10: Number(
      (results.reduce((sum, result) => sum + result.reciprocalRankAt10, 0) / Math.max(results.length, 1)).toFixed(4),
    ),
    median_latency_ms: percentile(
      results.map((result) => result.latencyMs),
      50,
    ),
    retrieval_strategy_counts: strategyCounts,
    failed_cases: results.filter((result) => result.failures.length > 0),
  };
}

function latencyFromTelemetry(telemetry: {
  supabase_rpc_latency_ms?: number;
  embedding_latency_ms?: number;
  rerank_latency_ms?: number;
}) {
  return (
    (telemetry.supabase_rpc_latency_ms ?? 0) +
    (telemetry.embedding_latency_ms ?? 0) +
    (telemetry.rerank_latency_ms ?? 0)
  );
}

function printHumanSummary(summary: ReturnType<typeof summarizeGoldenRetrievalResults>) {
  console.log("");
  console.log("Golden retrieval eval summary:");
  console.log(`  cases=${summary.case_count}`);
  console.log(`  document_recall@5=${summary.document_recall_at_5}`);
  console.log(`  content_recall@5=${summary.content_recall_at_5}`);
  console.log(`  top_k_hit_rate=${summary.top_k_hit_rate}`);
  console.log(`  mrr@10=${summary.mrr_at_10}`);
  console.log(`  median_latency_ms=${summary.median_latency_ms}`);
  console.log(`  retrieval_strategy_counts=${JSON.stringify(summary.retrieval_strategy_counts)}`);
  console.log(`  failed_cases=${summary.failed_cases.length}`);
  for (const failed of summary.failed_cases) {
    console.log(`\nFAIL ${failed.id}: ${failed.failures.join("; ")}`);
    console.log(`  Q: ${failed.query}`);
    for (const result of failed.topResults.slice(0, 3)) {
      console.log(
        `  #${result.rank} ${result.file_name} p${result.page_number ?? "?"} hybrid=${result.hybrid_score ?? "n/a"} sim=${result.similarity.toFixed(3)} text=${result.text_rank ?? "n/a"} rrf=${result.rrf_score ?? "n/a"}`,
      );
      if (result.score_explanation) console.log(`     score=${JSON.stringify(result.score_explanation)}`);
      console.log(`     ${result.content_preview}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [{ requireOpenAIEnv, requireServerEnv }, { searchChunksWithTelemetry }, supabase] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/rag"),
    loadAdminClient(),
  ]);

  requireServerEnv();
  requireOpenAIEnv();

  const ownerId = args.ownerId ?? (args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined);
  const capturedCaseClient = supabase as unknown as SupabaseEvalCaseClient;
  const capturedCases = await loadCapturedRagEvalCases({ supabase: capturedCaseClient, ownerId, limit: args.limit });
  const allCases = [...capturedCases.map(capturedRagCaseToGoldenCase), ...loadGoldenRetrievalCases(args.fixture)];
  const filteredCases = args.query
    ? allCases.filter((item) => item.query.toLowerCase().includes(args.query!.toLowerCase()) || item.id === args.query)
    : allCases;
  const cases = filteredCases.slice(0, args.limit ?? filteredCases.length);
  const results: GoldenRetrievalResult[] = [];

  if (!args.json) console.log(`Running ${cases.length} golden retrieval case(s).`);

  for (const testCase of cases) {
    const startedAt = Date.now();
    const search = await searchChunksWithTelemetry({
      query: testCase.query,
      ownerId,
      topK: testCase.topK,
      minSimilarity: 0.12,
      skipCache: true,
    });
    const latencyMs = latencyFromTelemetry(search.telemetry) || Date.now() - startedAt;
    const result = evaluateGoldenRetrievalCase({
      testCase,
      results: search.results,
      telemetry: search.telemetry,
      latencyMs,
    });
    results.push(result);

    if (!args.json) {
      const status = result.failures.length ? "FAIL" : "PASS";
      console.log(
        `${status} ${result.id} hit@${result.topK}=${result.hitAtK ? "1" : "0"} docRecall@5=${result.documentRecallAt5.toFixed(2)} contentRecall@5=${result.contentRecallAt5.toFixed(2)} rr@10=${result.reciprocalRankAt10.toFixed(2)} latency=${result.latencyMs}ms strategy=${result.retrievalStrategy ?? "none"}`,
      );
    }
  }

  const summary = summarizeGoldenRetrievalResults(results);
  if (args.json) {
    console.log(JSON.stringify({ fixture: args.fixture, results, summary }, null, 2));
  } else {
    printHumanSummary(summary);
  }

  if (args.failOnThreshold && summary.failed_cases.length > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
