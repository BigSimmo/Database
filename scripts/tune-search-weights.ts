import { loadEnvConfig } from "@next/env";
import { selectRagEvalCases } from "@/lib/rag-eval-cases";
import type { SearchResult } from "@/lib/types";

loadEnvConfig(process.cwd());

type CandidateWeights = {
  vector: number;
  text: number;
  rrf: number;
  title: number;
  metadata: number;
};

type SearchForTuning = {
  testCase: ReturnType<typeof selectRagEvalCases>[number];
  results: SearchResult[];
};

const candidates: CandidateWeights[] = [
  { vector: 0.72, text: 0.28, rrf: 0, title: 0, metadata: 0 },
  { vector: 0.62, text: 0.28, rrf: 0.1, title: 0.04, metadata: 0.02 },
  { vector: 0.55, text: 0.3, rrf: 0.15, title: 0.06, metadata: 0.03 },
  { vector: 0.48, text: 0.34, rrf: 0.18, title: 0.08, metadata: 0.04 },
];

function parseLimit(argv: string[]) {
  const index = argv.indexOf("--limit");
  if (index < 0) return undefined;
  const value = argv[index + 1];
  return value ? Number.parseInt(value, 10) : undefined;
}

function expectedHitScore(expectedFiles: string[], result: SearchResult, rank: number) {
  if (expectedFiles.length === 0) return 0;
  const hit = expectedFiles.includes(result.file_name);
  if (!hit) return 0;
  return 1 / Math.log2(rank + 2);
}

function weightedScore(query: string, result: SearchResult, weights: CandidateWeights) {
  const explanation = result.score_explanation;
  const titleText = `${result.title} ${result.file_name}`.toLowerCase();
  const queryTerms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  const titleHit = queryTerms.some((term) => titleText.includes(term)) ? 1 : 0;
  const metadataHit = result.document_labels?.length || result.document_summary ? 1 : 0;
  return (
    (result.similarity ?? explanation?.vectorScore ?? 0) * weights.vector +
    Math.min(result.text_rank ?? explanation?.textRank ?? 0, 1) * weights.text +
    (result.rrf_score ?? explanation?.rrfScore ?? 0) * weights.rrf +
    titleHit * weights.title +
    metadataHit * weights.metadata
  );
}

async function main() {
  const [{ requireOpenAIEnv, requireServerEnv }, { searchChunksWithTelemetry }] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/rag"),
  ]);
  requireServerEnv();
  requireOpenAIEnv();

  const cases = selectRagEvalCases({ limit: parseLimit(process.argv.slice(2)) }).filter((testCase) => testCase.supported);
  const searches: SearchForTuning[] = [];
  for (const testCase of cases) {
    const search = await searchChunksWithTelemetry({
      query: testCase.question,
      topK: 20,
      minSimilarity: 0.1,
      skipCache: true,
    });
    searches.push({ testCase, results: search.results });
  }

  const summary = candidates.map((weights) => {
    let score = 0;
    let top3Hits = 0;
    for (const item of searches) {
      const ranked = [...item.results].sort(
        (a, b) => weightedScore(item.testCase.question, b, weights) - weightedScore(item.testCase.question, a, weights),
      );
      score += ranked.slice(0, 5).reduce((sum, result, rank) => sum + expectedHitScore(item.testCase.expectedFiles, result, rank), 0);
      if (ranked.slice(0, 3).some((result) => item.testCase.expectedFiles.includes(result.file_name))) top3Hits += 1;
    }
    return {
      weights,
      ndcg_like: Number(score.toFixed(4)),
      top3Hits,
      cases: searches.length,
    };
  });

  summary.sort((a, b) => b.ndcg_like - a.ndcg_like || b.top3Hits - a.top3Hits);
  console.log(JSON.stringify({ evaluatedCases: searches.length, recommendations: summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
