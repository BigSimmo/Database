// OpenAI answer-generation spend snapshot for the deep /api/health probe.
//
// Token counts are already the durable primitive: src/lib/answer-telemetry.ts
// writes one rag_retrieval_logs row per answered request with
// metadata.answer.tokens { input, output, total, cached_input, reasoning_output }
// plus metadata.answer.route and .model. Nothing turns those into a cost signal,
// so a budget regression (e.g. the reasoning-token starvation incident, or a
// pricing/traffic change) is invisible until the bill arrives. This aggregates
// the persisted counts over a trailing window and derives USD from a configurable
// per-token price, split by route and model, plus a 24h projection for alerting.
//
// USD is derived, never stored (per the answer-telemetry design note). Reasoning
// output tokens are a SUBSET of output_tokens in the OpenAI Responses API, so they
// are surfaced for visibility but billed as part of output — never double-counted.
// Cached input tokens are a subset of input, billed at the cheaper cached rate.
//
// Like `slo`/`cache`, this runs behind the secret-gated deep probe, reads only
// aggregate token metadata (never raw query text), and never flips liveness.

export type SpendPricing = {
  // USD per 1,000,000 tokens.
  inputPerMTok: number;
  cachedInputPerMTok: number;
  outputPerMTok: number;
};

export type ModelSpend = {
  model: string;
  answers: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  usd: number;
};

export type SpendSnapshot = {
  windowMinutes: number;
  answers: number;
  tokens: {
    input: number;
    cachedInput: number;
    output: number;
    reasoningOutput: number;
    total: number;
  };
  usd: number;
  usdByRoute: Record<string, number>;
  usdByModel: ModelSpend[];
  // usd normalized to a 24h rate, so a short probe window still yields a
  // comparable daily figure for the alert threshold.
  projectedDailyUsd: number;
  alertDailyUsdThreshold: number | null;
  alerting: boolean;
  // True when the row sample hit the cap, so the totals are a lower bound.
  sampleTruncated: boolean;
  pricing: SpendPricing;
};

type AnswerTokens = {
  input?: number | null;
  output?: number | null;
  total?: number | null;
  cached_input?: number | null;
  reasoning_output?: number | null;
};

type SpendRow = {
  query_class?: string | null;
  metadata?: {
    answer?: {
      route?: string | null;
      model?: string | null;
      tokens?: AnswerTokens | null;
    } | null;
  } | null;
};

type SelectResult = { data: SpendRow[] | null; error: unknown };

// Minimal structural view of the PostgREST select we use — the Supabase admin
// client is assignable to this, and tests pass a small fake (same approach as
// answer-slo.ts / supabase/health.ts).
type SpendQueryBuilder = PromiseLike<SelectResult> & {
  gt(column: string, value: string): SpendQueryBuilder;
  eq(column: string, value: string): SpendQueryBuilder;
  limit(count: number): SpendQueryBuilder;
};

export type SpendProbeClient = {
  from(table: string): {
    select(columns: string): SpendQueryBuilder;
  };
};

const DEFAULT_ROW_CAP = 5000;

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round(value: number, dp = 6): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

/**
 * Cost of one answer's token usage. Uncached input and cached input are billed at
 * their respective rates (cached is a subset of input); output already includes
 * reasoning tokens, so output is billed once. Pure — unit-tested directly.
 */
export function computeAnswerCostUsd(tokens: AnswerTokens, pricing: SpendPricing): number {
  const input = num(tokens.input);
  const cached = Math.min(num(tokens.cached_input), input);
  const uncachedInput = input - cached;
  const output = num(tokens.output);
  const usd =
    (uncachedInput * pricing.inputPerMTok + cached * pricing.cachedInputPerMTok + output * pricing.outputPerMTok) /
    1_000_000;
  return usd;
}

export type SpendSnapshotOptions = {
  windowMinutes?: number;
  pricing: SpendPricing;
  alertDailyUsd?: number | null;
  rowCap?: number;
};

/**
 * Aggregate answer-path token spend over the trailing window. Throws on a query
 * error so the caller can null the block rather than report a falsely-zero spend.
 */
export async function spendSnapshot(client: SpendProbeClient, options: SpendSnapshotOptions): Promise<SpendSnapshot> {
  const windowMinutes = options.windowMinutes ?? 60;
  const rowCap = options.rowCap ?? DEFAULT_ROW_CAP;
  const pricing = options.pricing;
  const alertDailyUsdThreshold =
    typeof options.alertDailyUsd === "number" && options.alertDailyUsd > 0 ? options.alertDailyUsd : null;
  const sinceIso = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const result = await client
    .from("rag_retrieval_logs")
    .select("query_class, metadata")
    .gt("created_at", sinceIso)
    .eq("metadata->answer->>log_source", "answer")
    .limit(rowCap);

  if (result.error) {
    if (result.error instanceof Error) throw result.error;
    const message =
      result.error && typeof result.error === "object" && "message" in result.error
        ? String((result.error as { message?: unknown }).message ?? "")
        : String(result.error);
    throw new Error(message || "spend snapshot query failed");
  }

  const rows = result.data ?? [];
  const totals = { input: 0, cachedInput: 0, output: 0, reasoningOutput: 0, total: 0 };
  const usdByRoute: Record<string, number> = {};
  const byModel = new Map<string, ModelSpend>();
  let usd = 0;

  for (const row of rows) {
    const answer = row.metadata?.answer;
    const tokens = answer?.tokens ?? {};
    const input = num(tokens.input);
    const cached = Math.min(num(tokens.cached_input), input);
    const output = num(tokens.output);
    const reasoning = num(tokens.reasoning_output);
    const rowUsd = computeAnswerCostUsd(tokens, pricing);

    totals.input += input;
    totals.cachedInput += cached;
    totals.output += output;
    totals.reasoningOutput += reasoning;
    totals.total += num(tokens.total) || input + output;
    usd += rowUsd;

    const route = answer?.route ?? "unknown";
    usdByRoute[route] = (usdByRoute[route] ?? 0) + rowUsd;

    const model = answer?.model ?? "unknown";
    const entry = byModel.get(model) ?? {
      model,
      answers: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      usd: 0,
    };
    entry.answers += 1;
    entry.inputTokens += input;
    entry.cachedInputTokens += cached;
    entry.outputTokens += output;
    entry.reasoningOutputTokens += reasoning;
    entry.usd += rowUsd;
    byModel.set(model, entry);
  }

  const projectedDailyUsd = windowMinutes > 0 ? usd * (1440 / windowMinutes) : 0;

  return {
    windowMinutes,
    answers: rows.length,
    tokens: totals,
    usd: round(usd),
    usdByRoute: Object.fromEntries(Object.entries(usdByRoute).map(([route, value]) => [route, round(value)])),
    usdByModel: [...byModel.values()]
      .map((entry) => ({ ...entry, usd: round(entry.usd) }))
      .sort((a, b) => b.usd - a.usd),
    projectedDailyUsd: round(projectedDailyUsd, 2),
    alertDailyUsdThreshold,
    alerting: alertDailyUsdThreshold !== null && projectedDailyUsd > alertDailyUsdThreshold,
    sampleTruncated: rows.length >= rowCap,
    pricing,
  };
}
