/**
 * Ward-round soak test for the Clinical KB app tier.
 *
 * STAGING ONLY. This script drives sustained answer/search load and must never
 * point at production. See docs/capacity-review.md §4 for the load model,
 * usage examples, and success criteria.
 *
 * Safety rails:
 * - requires an explicit --target and --confirm-staging;
 * - refuses targets that look like production (the live Supabase project ref
 *   in the host, or any host passed via --forbid-host);
 * - issues read-only traffic only (POST /api/search and POST /api/answer).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_MARKERS = ["sjrfecxgysukkwxsowpy"];

type SoakArgs = {
  target: string;
  confirmStaging: boolean;
  users: number;
  durationS: number;
  rampS: number;
  thinkMs: number;
  answerShare: number;
  timeoutMs: number;
  bearer?: string;
  forbidHosts: string[];
};

type RequestSample = {
  endpoint: "search" | "answer";
  status: number;
  latencyMs: number;
  timedOut: boolean;
};

function usage(): never {
  console.log(
    [
      "Usage: npx tsx scripts/soak-test.ts --target <staging-url> --confirm-staging [options]",
      "",
      "Options:",
      "  --target <url>          Base URL of the STAGING app (required)",
      "  --confirm-staging       Acknowledge the target is staging (required)",
      "  --users <n>             Virtual users (default 30)",
      "  --duration-s <n>        Steady-state duration in seconds (default 300)",
      "  --ramp-s <n>            Ramp-up window in seconds (default 60)",
      "  --think-ms <n>          Mean think time between requests (default 15000)",
      "  --answer-share <0..1>   Fraction of requests that are answers (default 0.25)",
      "  --timeout-ms <n>        Per-request timeout (default 60000)",
      "  --bearer <token>        Authorization bearer token (bypasses anonymous limits)",
      "  --forbid-host <host>    Extra host substring to refuse (repeatable)",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): SoakArgs {
  const args: SoakArgs = {
    target: "",
    confirmStaging: false,
    users: 30,
    durationS: 300,
    rampS: 60,
    thinkMs: 15_000,
    answerShare: 0.25,
    timeoutMs: 60_000,
    forbidHosts: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === "--help" || token === "-h") usage();
    if (token === "--confirm-staging") {
      args.confirmStaging = true;
      continue;
    }
    if (!value) continue;
    if (token === "--target") args.target = value;
    if (token === "--users") args.users = Number.parseInt(value, 10);
    if (token === "--duration-s") args.durationS = Number.parseInt(value, 10);
    if (token === "--ramp-s") args.rampS = Number.parseInt(value, 10);
    if (token === "--think-ms") args.thinkMs = Number.parseInt(value, 10);
    if (token === "--answer-share") args.answerShare = Number.parseFloat(value);
    if (token === "--timeout-ms") args.timeoutMs = Number.parseInt(value, 10);
    if (token === "--bearer") args.bearer = value;
    if (token === "--forbid-host") args.forbidHosts.push(value.toLowerCase());
  }

  if (!args.target) {
    console.error("Missing --target. This script never assumes a default target.");
    usage();
  }
  if (!args.confirmStaging) {
    console.error(
      "Refusing to run without --confirm-staging. This script is for STAGING only; do not point it at production.",
    );
    process.exit(1);
  }
  if (!Number.isInteger(args.users) || args.users < 1 || args.users > 500) {
    throw new Error("--users must be an integer between 1 and 500.");
  }
  if (!Number.isFinite(args.answerShare) || args.answerShare < 0 || args.answerShare > 1) {
    throw new Error("--answer-share must be between 0 and 1.");
  }
  return args;
}

function assertTargetIsNotProduction(args: SoakArgs) {
  const url = new URL(args.target);
  const host = url.host.toLowerCase();
  const markers = [...PRODUCTION_MARKERS.map((marker) => marker.toLowerCase()), ...args.forbidHosts];
  for (const marker of markers) {
    if (host.includes(marker)) {
      console.error(`Refusing target ${host}: matches forbidden production marker "${marker}".`);
      process.exit(1);
    }
  }
}

const fallbackQueries = [
  "clozapine monitoring requirements",
  "lithium toxicity management",
  "acute dystonia treatment",
  "venlafaxine discontinuation symptoms",
  "sodium valproate in pregnancy",
  "serotonin syndrome recognition",
  "rapid tranquillisation protocol",
  "metformin renal dosing",
  "warfarin reversal steps",
  "delirium screening tools",
];

function loadQueries(): string[] {
  const fixturePath = join(process.cwd(), "scripts", "fixtures", "rag-retrieval-golden.json");
  if (!existsSync(fixturePath)) return fallbackQueries;
  try {
    const parsed: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
    if (!Array.isArray(parsed)) return fallbackQueries;
    const queries = parsed
      .map((entry) => (entry && typeof entry === "object" ? (entry as { query?: unknown }).query : null))
      .filter((query): query is string => typeof query === "string" && query.length > 0);
    return queries.length > 0 ? queries : fallbackQueries;
  } catch {
    return fallbackQueries;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredThink(meanMs: number) {
  // 0.5x..1.5x uniform jitter around the mean keeps users out of lockstep.
  return meanMs * (0.5 + Math.random());
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

async function issueRequest(args: SoakArgs, endpoint: "search" | "answer", query: string): Promise<RequestSample> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(new URL(`/api/${endpoint}`, args.target), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.bearer ? { authorization: `Bearer ${args.bearer}` } : {}),
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    // Drain the body so keep-alive sockets are reusable.
    await response.arrayBuffer().catch(() => undefined);
    return { endpoint, status: response.status, latencyMs: Date.now() - startedAt, timedOut: false };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { endpoint, status: 0, latencyMs: Date.now() - startedAt, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

async function runVirtualUser(
  args: SoakArgs,
  userIndex: number,
  queries: string[],
  endAtMs: number,
  samples: RequestSample[],
) {
  // Stagger starts across the ramp window.
  await sleep((args.rampS * 1000 * userIndex) / Math.max(args.users, 1));
  while (Date.now() < endAtMs) {
    const query = queries[Math.floor(Math.random() * queries.length)];
    const endpoint = Math.random() < args.answerShare ? "answer" : "search";
    samples.push(await issueRequest(args, endpoint, query));
    const remaining = endAtMs - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(jitteredThink(args.thinkMs), remaining));
  }
}

function summarizeEndpoint(samples: RequestSample[], endpoint: "search" | "answer") {
  const scoped = samples.filter((sample) => sample.endpoint === endpoint);
  const ok = scoped.filter((sample) => sample.status >= 200 && sample.status < 400);
  const rateLimited = scoped.filter((sample) => sample.status === 429);
  const failed = scoped.filter((sample) => sample.status === 0 || (sample.status >= 400 && sample.status !== 429));
  const latencies = ok.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  return {
    endpoint,
    total: scoped.length,
    ok: ok.length,
    rateLimited: rateLimited.length,
    failed: failed.length,
    timedOut: scoped.filter((sample) => sample.timedOut).length,
    p50: percentile(latencies, 0.5),
    p90: percentile(latencies, 0.9),
    p95: percentile(latencies, 0.95),
    max: latencies.at(-1) ?? 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertTargetIsNotProduction(args);
  const queries = loadQueries();

  console.log(`Soak target: ${args.target}`);
  console.log(
    `Profile: ${args.users} users, ramp ${args.rampS}s, steady ${args.durationS}s, ` +
      `answer share ${Math.round(args.answerShare * 100)}%, think ~${args.thinkMs}ms, ${queries.length} queries.`,
  );
  console.log(args.bearer ? "Auth: bearer token supplied." : "Auth: anonymous (expect tight 429 limits).");

  const endAtMs = Date.now() + (args.rampS + args.durationS) * 1000;
  const samples: RequestSample[] = [];
  await Promise.all(
    Array.from({ length: args.users }, (_, userIndex) => runVirtualUser(args, userIndex, queries, endAtMs, samples)),
  );

  const summaries = [summarizeEndpoint(samples, "search"), summarizeEndpoint(samples, "answer")];
  console.log("\nResults:");
  for (const summary of summaries) {
    console.log(
      `  /api/${summary.endpoint}: n=${summary.total} ok=${summary.ok} 429=${summary.rateLimited} ` +
        `failed=${summary.failed} timeouts=${summary.timedOut}`,
    );
    console.log(
      `    latency ms (ok only): p50=${summary.p50} p90=${summary.p90} p95=${summary.p95} max=${summary.max}`,
    );
  }

  const total = samples.length;
  const hardFailures = summaries.reduce((sum, summary) => sum + summary.failed, 0);
  const failureRate = total > 0 ? hardFailures / total : 0;
  console.log(`\nTotal requests: ${total}; non-429 failure rate: ${(failureRate * 100).toFixed(2)}% (gate: 5%).`);
  if (failureRate > 0.05) {
    console.error("FAIL: non-429 failure rate exceeded 5%.");
    process.exit(1);
  }
  console.log("PASS: failure rate within budget. Compare percentiles against docs/capacity-review.md §4.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
