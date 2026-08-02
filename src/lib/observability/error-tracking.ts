import type { ErrorEvent } from "@sentry/nextjs";
import type { Instrumentation } from "next";

const SAFE_ERROR_MESSAGE = "Unhandled server request error";
// `service` / `worker_stage` are set only from fixed code literals by the
// ingestion worker (worker/observability.ts) — never from job, document, or
// owner data. Everything else stays stripped.
const SAFE_TAGS = ["router_kind", "route_type", "route_path", "service", "worker_stage"] as const;
const SAFE_EXCEPTION_TYPES = new Set([
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
]);

/** Span attributes safe to export for DB performance dashboards. */
const SAFE_SPAN_DATA_KEYS = [
  "db.table",
  "db.schema",
  "db.system",
  "db.operation",
  "db.sdk",
  "http.status_code",
  "sentry.op",
  "sentry.origin",
  "sentry.source",
  "sentry.sample_rate",
] as const;

/**
 * gen_ai span attributes safe to export for AI agent monitoring: operation and
 * model metadata, token usage, and the synthetic per-request conversation id.
 * Prompt, message, tool, embedding-input, and response-text attributes are
 * deliberately absent — clinical queries, source evidence, and generated
 * answers never leave the server (docs/error-tracking.md).
 */
const SAFE_GEN_AI_SPAN_DATA_KEYS = [
  "gen_ai.system",
  "gen_ai.operation.name",
  "gen_ai.agent.name",
  "gen_ai.pipeline.name",
  "gen_ai.conversation.id",
  "gen_ai.request.model",
  "gen_ai.request.stream",
  "gen_ai.request.temperature",
  "gen_ai.request.max_tokens",
  "gen_ai.request.top_p",
  "gen_ai.request.frequency_penalty",
  "gen_ai.request.presence_penalty",
  "gen_ai.request.encoding_format",
  "gen_ai.request.dimensions",
  "gen_ai.response.model",
  "gen_ai.response.id",
  "gen_ai.response.finish_reasons",
  "gen_ai.response.stop_reason",
  "gen_ai.response.streaming",
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.output_tokens",
  "gen_ai.usage.total_tokens",
  "gen_ai.usage.input_tokens.cached",
  "gen_ai.usage.input_tokens.cache_write",
] as const;

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

/**
 * Structural transaction/span shapes for privacy scrubbing.
 * Kept local so knip does not require a direct `@sentry/core` dependency —
 * `@sentry/nextjs` does not re-export `TransactionEvent` / `SpanJSON`.
 */
type ScrubbedSpan = {
  span_id: string;
  trace_id: string;
  parent_span_id?: string;
  op?: string;
  origin?: string;
  status?: string;
  start_timestamp: number;
  timestamp?: number;
  exclusive_time?: number;
  description?: string;
  data?: Record<string, unknown>;
};

type ScrubbedTransactionEvent = {
  type: "transaction";
  event_id?: string;
  timestamp?: number;
  start_timestamp?: number;
  platform?: string;
  level?: ErrorEvent["level"];
  release?: string;
  environment?: string;
  transaction?: string;
  transaction_info?: { source: string };
  measurements?: ErrorEvent["measurements"];
  contexts?: {
    trace?: {
      trace_id?: string;
      span_id?: string;
      parent_span_id?: string;
      op?: string;
      status?: string;
      origin?: string;
      data?: Record<string, unknown>;
    };
  };
  spans?: ScrubbedSpan[];
  tags?: ErrorEvent["tags"];
  request?: ErrorEvent["request"];
  user?: ErrorEvent["user"];
  breadcrumbs?: ErrorEvent["breadcrumbs"];
};

function privacySafeExceptionType(value: string | undefined) {
  return value && SAFE_EXCEPTION_TYPES.has(value) ? value : "Error";
}

function privacySafeTags(event: { tags?: ErrorEvent["tags"] | ScrubbedTransactionEvent["tags"] }) {
  return Object.fromEntries(
    SAFE_TAGS.flatMap((key) => (typeof event.tags?.[key] === "string" ? [[key, event.tags[key]]] : [])),
  );
}

/**
 * Resolve performance sampling. Defaults to 10% when unset. Operators can set
 * `SENTRY_TRACES_SAMPLE_RATE=0` to disable tracing without removing the DSN.
 */
export function resolveTracesSampleRate(rawValue: string | undefined = process.env.SENTRY_TRACES_SAMPLE_RATE): number {
  if (rawValue === undefined || rawValue.trim() === "") {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  return parsed;
}

/** True when a DSN is configured and the resolved traces sample rate is > 0. */
export function isSentryDbTracingEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim()) && resolveTracesSampleRate() > 0;
}

function privacySafeSpanDescription(data: Record<string, unknown>, fallback: string | undefined): string | undefined {
  const operation = typeof data["db.operation"] === "string" ? data["db.operation"] : undefined;
  const table = typeof data["db.table"] === "string" ? data["db.table"] : undefined;

  if (operation?.startsWith("auth.")) {
    return typeof fallback === "string" && /^auth\b/i.test(fallback) ? fallback : `auth ${operation.slice(5)}`;
  }
  if (operation && table) {
    return `${operation} from(${table})`;
  }
  if (table) {
    return `from(${table})`;
  }

  // gen_ai (agent monitoring) spans: rebuild "<operation> <model>" from the
  // allowlisted attributes; the SDK's own span name is treated as free-form text.
  const genAiOperation = typeof data["gen_ai.operation.name"] === "string" ? data["gen_ai.operation.name"] : undefined;
  if (genAiOperation) {
    const genAiModel =
      typeof data["gen_ai.request.model"] === "string"
        ? data["gen_ai.request.model"]
        : typeof data["gen_ai.response.model"] === "string"
          ? data["gen_ai.response.model"]
          : undefined;
    return genAiModel ? `${genAiOperation} ${genAiModel}` : genAiOperation;
  }

  // Keep parameterized framework/route span names; drop free-form or query-bearing text.
  if (
    typeof fallback === "string" &&
    !fallback.includes("?") &&
    !fallback.includes("=") &&
    (/^\//.test(fallback) ||
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//i.test(fallback) ||
      /^(middleware|start|resolve page component|Executing api route)/i.test(fallback))
  ) {
    return fallback;
  }

  return undefined;
}

function privacySafeSpan(span: ScrubbedSpan): ScrubbedSpan {
  const rawData = (span.data ?? {}) as Record<string, unknown>;
  const data = Object.fromEntries(
    [...SAFE_SPAN_DATA_KEYS, ...SAFE_GEN_AI_SPAN_DATA_KEYS].flatMap((key) =>
      rawData[key] === undefined ? [] : [[key, rawData[key]]],
    ),
  );

  return {
    span_id: span.span_id,
    trace_id: span.trace_id,
    parent_span_id: span.parent_span_id,
    op: span.op,
    origin: span.origin,
    status: span.status,
    start_timestamp: span.start_timestamp,
    timestamp: span.timestamp,
    exclusive_time: span.exclusive_time,
    description: privacySafeSpanDescription(rawData, span.description),
    data: Object.keys(data).length ? data : {},
  };
}

/** Keep timing + safe DB metadata; strip query filters, bodies, request/PII payloads. */
export function privacySafeTransactionEvent(event: ScrubbedTransactionEvent): ScrubbedTransactionEvent {
  const tags = privacySafeTags(event);
  const transaction =
    typeof event.transaction === "string" && !event.transaction.includes("?") && !event.transaction.includes("=")
      ? event.transaction
      : undefined;

  return {
    type: "transaction",
    event_id: event.event_id,
    timestamp: event.timestamp,
    start_timestamp: event.start_timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    transaction,
    transaction_info: event.transaction_info,
    measurements: event.measurements,
    contexts: event.contexts?.trace
      ? {
          trace: {
            trace_id: event.contexts.trace.trace_id,
            span_id: event.contexts.trace.span_id,
            parent_span_id: event.contexts.trace.parent_span_id,
            op: event.contexts.trace.op,
            status: event.contexts.trace.status,
            origin: event.contexts.trace.origin,
          },
        }
      : undefined,
    spans: event.spans?.map(privacySafeSpan),
    tags: Object.keys(tags).length ? tags : undefined,
  };
}

/** Keep code locations while removing all free-form/request data before export. */
export function privacySafeErrorEvent(event: ErrorEvent): ErrorEvent {
  const exceptions = event.exception?.values?.map((exception) => ({
    // Error.name is mutable and can contain request or clinical text. Retain
    // only fixed JavaScript runtime types; custom/provider names collapse to a
    // generic type while their scrubbed stack location still supports grouping.
    type: privacySafeExceptionType(exception.type),
    value: SAFE_ERROR_MESSAGE,
    stacktrace: exception.stacktrace
      ? {
          frames: exception.stacktrace.frames?.map((frame) => ({
            filename: frame.filename,
            function: frame.function,
            module: frame.module,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        }
      : undefined,
  }));

  const tags = privacySafeTags(event);
  const exceptionType = exceptions?.[0]?.type || "Error";
  const routePath = tags.route_path;
  const topFrame = exceptions?.[0]?.stacktrace?.frames?.at(-1);
  // The ingestion worker has no route pattern, so group its events by the
  // fixed service/stage labels instead of dropping the fingerprint entirely.
  const workerStage = tags.service === "worker" ? (tags.worker_stage ?? "unknown") : undefined;

  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    message: exceptions?.length ? undefined : SAFE_ERROR_MESSAGE,
    exception: exceptions?.length ? { values: exceptions } : undefined,
    fingerprint: workerStage
      ? ["worker", workerStage, exceptionType, topFrame?.filename ?? "unknown"]
      : routePath
        ? [routePath, exceptionType, topFrame?.filename ?? "unknown", topFrame?.function ?? "unknown"]
        : undefined,
    tags: Object.keys(tags).length ? tags : undefined,
  };
}

/**
 * Status probe only. Runtime init is owned by `src/sentry.server.config.ts`
 * (loaded once from `instrumentation.register`) so privacy scrubbing cannot race
 * a second `Sentry.init()`.
 */
export async function initializeErrorTracking(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  return process.env.NODE_ENV === "production" && process.env.NEXT_RUNTIME === "nodejs" && Boolean(dsn);
}

export const captureRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !process.env.SENTRY_DSN?.trim()
  ) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.withScope((scope) => {
    scope.setTag("router_kind", context.routerKind);
    scope.setTag("route_type", context.routeType);
    // This is Next's static route pattern, never the requested URL/query string.
    scope.setTag("route_path", context.routePath);
    // Error.name is mutable free-form text; never put it on the scope fingerprint.
    // beforeSend rebuilds a privacy-safe fingerprint from route + runtime type + frame.
    const errorType = error instanceof Error ? privacySafeExceptionType(error.name) : typeof error;
    scope.setFingerprint([context.routePath, String(errorType)]);
    Sentry.captureException(error);
  });
  await Sentry.flush(2_000);
};
