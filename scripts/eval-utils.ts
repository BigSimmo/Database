import { expectedFileCoverage } from "@/lib/eval-document-matching";
import type { RagEvalCase } from "@/lib/rag-eval-cases";
import type { RagAnswer, SearchResult, VisualEvidenceCard } from "@/lib/types";

export { expectedFileCoverage, type ExpectedFileCoverage } from "@/lib/eval-document-matching";

export type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;

export async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function evalCaseDelayMs() {
  const parsed = Number.parseInt(process.env.RAG_EVAL_CASE_DELAY_MS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function evalForceEmbeddingDelayMs() {
  const parsed = Number.parseInt(process.env.RAG_EVAL_FORCE_EMBEDDING_DELAY_MS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function pauseBetweenEvalCases(options: { caseIndex: number; forceEmbedding?: boolean }) {
  if (options.caseIndex <= 0) return;
  let delayMs = evalCaseDelayMs();
  if (options.forceEmbedding) delayMs += evalForceEmbeddingDelayMs();
  if (delayMs > 0) await sleep(delayMs);
}

function providerRetryNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isProviderRateLimitError(error: unknown) {
  const maybeRecord = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message = [
    error instanceof Error ? error.name : "",
    error instanceof Error ? error.message : String(error),
    maybeRecord.status,
    maybeRecord.code,
    maybeRecord.type,
  ]
    .filter(Boolean)
    .join(" ");
  return /\b(?:429|rate[_\s-]?limit(?:ed)?|too many requests)\b/i.test(message);
}

export async function withProviderBackoff<T>(
  label: string,
  operation: () => Promise<T>,
  options: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {},
) {
  const maxAttempts = options.maxAttempts ?? providerRetryNumber(process.env.RAG_EVAL_PROVIDER_RETRY_ATTEMPTS, 4);
  const initialDelayMs =
    options.initialDelayMs ?? providerRetryNumber(process.env.RAG_EVAL_PROVIDER_RETRY_INITIAL_MS, 5_000);
  const maxDelayMs = options.maxDelayMs ?? providerRetryNumber(process.env.RAG_EVAL_PROVIDER_RETRY_MAX_MS, 45_000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isProviderRateLimitError(error) || attempt >= maxAttempts) throw error;
      const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      console.warn(
        `[eval] Provider rate limit during ${label}; retrying attempt ${attempt + 1}/${maxAttempts} in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`Provider retry loop exhausted for ${label}.`);
}

export async function withProviderBackoffProgress<TProgress, TResult>(
  label: string,
  operation: (onProgress: (event: TProgress) => void) => Promise<TResult>,
  options: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {},
) {
  let successfulProgress: TProgress[] = [];
  const result = await withProviderBackoff(
    label,
    async () => {
      const attemptProgress: TProgress[] = [];
      const attemptResult = await operation((event) => attemptProgress.push(event));
      successfulProgress = attemptProgress;
      return attemptResult;
    },
    options,
  );
  return { result, progress: successfulProgress };
}

export async function findOwnerIdByEmail(supabase: SupabaseAdmin, email: string) {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user?.id) return user.id;
    if (data.users.length < perPage) break;
  }

  throw new Error(`No Supabase Auth user found for ${email}. Sign in once before running evals.`);
}

/**
 * Committed default eval owner. Since the 2026-07-06 public promotion the live corpus is entirely
 * `owner_id = NULL`, so owner-scoped retrieval must run as the public-owner sentinel
 * (`retrieval_owner_matches` maps it to NULL-owner rows, mirroring anonymous production search). A
 * real owner UUID now scopes retrieval to zero documents. See docs/retrieval-quality-runbook.md.
 */
export const DEFAULT_EVAL_OWNER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Resolve the owner id for a READ/eval run. Precedence: explicit `--owner-id` / `RAG_EVAL_OWNER_ID`
 * / `LOCAL_NO_AUTH_OWNER_ID` (already folded into `args.ownerId`) → `--owner-email` /
 * `RAG_EVAL_OWNER_EMAIL` lookup → the public-owner sentinel. Emits a one-line warning when it falls
 * back to the sentinel so the narrowing to public-only scope is visible, not silent.
 *
 * Do NOT use in write/backfill scripts — defaulting an owner there could write under the wrong owner.
 */
export async function resolveEvalOwnerId(
  supabase: SupabaseAdmin,
  args: { ownerId?: string; ownerEmail?: string },
): Promise<string> {
  const resolved = args.ownerId ?? (args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined);
  if (resolved) return resolved;
  console.warn(
    `[eval] No eval owner set (RAG_EVAL_OWNER_ID / LOCAL_NO_AUTH_OWNER_ID / --owner-id / --owner-email); ` +
      `defaulting to the public-owner sentinel ${DEFAULT_EVAL_OWNER_ID}. The live corpus is all-public ` +
      `(owner_id = NULL); set an explicit owner to scope the eval to a real owner instead.`,
  );
  return DEFAULT_EVAL_OWNER_ID;
}

export function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

export function expectedFileHit(
  expectedFiles: string[],
  sources: Array<Pick<SearchResult, "file_name" | "title">>,
  limit = 3,
) {
  return expectedFileCoverage(expectedFiles, sources, limit).anyHit;
}

export function hasInvalidVisualEvidence(cards: VisualEvidenceCard[] = []) {
  return cards.some((card) => card.image_type === "logo_decorative" || card.clinical_relevance_score === 0);
}

export function validateRagAnswer(testCase: RagEvalCase, answer: RagAnswer) {
  const failures: string[] = [];
  const expectedCoverage = expectedFileCoverage(
    testCase.expectedFiles,
    answer.sources,
    testCase.expectedFiles.length > 1 ? 5 : 3,
  );
  const expectedHit = testCase.expectedFiles.length > 1 ? expectedCoverage.allHit : expectedCoverage.anyHit;
  const route = answer.routingMode ?? "unsupported";
  const visualEvidence = answer.visualEvidence ?? [];

  // acceptSourceOnly cases (diffuse questions with no single authoritative source) may
  // legitimately return a source-only answer (grounded=false); the retrieval regression
  // guard for them is the expected-document coverage check below, not grounding.
  if (testCase.supported && !answer.grounded && !testCase.acceptSourceOnly) {
    failures.push("expected grounded answer");
  }
  if (!testCase.supported && answer.grounded) failures.push("expected unsupported answer");
  if (testCase.falsePositiveControl && answer.grounded)
    failures.push("false-positive control produced grounded answer");
  if (!testCase.allowedRoutes.includes(route)) failures.push(`unexpected route ${route}`);
  if (testCase.expectedQueryClass && answer.queryClass !== testCase.expectedQueryClass) {
    failures.push(`expected query class ${testCase.expectedQueryClass}, got ${answer.queryClass ?? "none"}`);
  }
  if (answer.citations.length < testCase.minCitations)
    failures.push(`expected at least ${testCase.minCitations} citations`);
  if (testCase.expectedFiles.length > 1 && !expectedCoverage.allHit) {
    failures.push(`expected documents missing from top 5: ${expectedCoverage.missingFiles.join(", ")}`);
  } else if (testCase.expectedFiles.length === 1 && !expectedCoverage.anyHit) {
    failures.push("expected document not in retrieved sources");
  }
  if (testCase.requireVisualEvidence && visualEvidence.length === 0) failures.push("expected visual evidence");
  if (hasInvalidVisualEvidence(visualEvidence)) failures.push("decorative or zero-relevance visual evidence returned");
  if (testCase.category === "complex" && (answer.latencyTimings?.total_latency_ms ?? 0) > testCase.latencyTargetMs) {
    failures.push(`latency over ${testCase.latencyTargetMs}ms`);
  }
  if (testCase.supported && ((answer.unverifiedNumericTokens?.length ?? 0) > 0 || answer.faithfulnessWarning)) {
    failures.push(
      `clinical numeric faithfulness warning present (${answer.unverifiedNumericTokens?.length ?? 0} unverified token(s))`,
    );
  }

  return { expectedHit, expectedCoverage, failures };
}

export function configuredCostRates() {
  const input = Number(process.env.RAG_EVAL_INPUT_USD_PER_MILLION);
  const cachedInput = Number(process.env.RAG_EVAL_CACHED_INPUT_USD_PER_MILLION);
  const output = Number(process.env.RAG_EVAL_OUTPUT_USD_PER_MILLION);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;

  return {
    input,
    cachedInput: Number.isFinite(cachedInput) ? cachedInput : input,
    output,
  };
}

export function estimateCostUsd(result: { inputTokens: number; cachedInputTokens: number; outputTokens: number }) {
  const rates = configuredCostRates();
  if (!rates) return null;

  const uncachedInput = Math.max(result.inputTokens - result.cachedInputTokens, 0);
  return (
    (uncachedInput * rates.input + result.cachedInputTokens * rates.cachedInput + result.outputTokens * rates.output) /
    1_000_000
  );
}
