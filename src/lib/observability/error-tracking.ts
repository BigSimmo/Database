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

/**
 * Webpack assigns chunk ids per build, so `chunks/41261.js` names a different file
 * after every deploy even when the fault is unchanged.
 */
const BUILD_VOLATILE_FILENAME = /(^|[\\/])chunks[\\/][^\\/]*\d{3,}[^\\/]*\.m?js$/i;

/**
 * Minifier output: `Z`, `rV`, `gX`, `d0`. Regenerated on every build.
 *
 * Capped at two characters on purpose. Three would also swallow `GET`, `POST` and
 * `PUT`, which are the most useful names a route frame can carry, and keeping a name
 * that turns out to be volatile only costs the grouping this already had.
 */
const MINIFIED_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]?$/;

/**
 * Build-stable part of a frame filename, or `"unknown"`.
 *
 * Without uploaded source maps every production frame is minified, and the pieces
 * that change per build were previously fed straight into the fingerprint. One
 * recurring `/api/medications` fault split across 25 Sentry issues that way
 * (2026-09-16 review). Route module paths and `node_modules` paths survive a rebuild;
 * numbered chunk files do not.
 */
export function stableFrameFilename(filename: string | undefined): string {
  if (!filename) return "unknown";
  return BUILD_VOLATILE_FILENAME.test(filename) ? "unknown" : filename;
}

/**
 * Build-stable part of a frame function name, or `"unknown"`.
 *
 * Minified member expressions keep a readable tail (`rV.handleResponse`), so the
 * mangled segments are dropped rather than the whole name: `rV.handleResponse` and
 * `d0.makeRequest` stay distinguishable across deploys as `handleResponse` and
 * `makeRequest`, while a wholly mangled `Z` collapses to `"unknown"`.
 */
export function stableFrameFunction(name: string | undefined): string {
  if (!name) return "unknown";
  const retained = name.split(".").filter((segment) => segment.length > 0 && !MINIFIED_IDENTIFIER.test(segment));
  return retained.length ? retained.join(".") : "unknown";
}

/**
 * SDK mechanism `type` values are code literals (`generic`, `onunhandledrejection`,
 * `auto.function.nextjs.on_request_error`). Anchored so nothing free-form can pass.
 */
const SAFE_MECHANISM_TYPE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;

/**
 * Structural capture metadata, allowlisted to `type` and `handled`.
 *
 * `mechanism.data` is deliberately absent: it carries free-form SDK context (URLs, handler
 * arguments) and is the one part of a mechanism that can hold request or clinical text.
 *
 * WHY THIS IS CARRIED AT ALL, measured 2026-09-17. Rebuilding the exception without its
 * mechanism made Sentry default every event to `handled: true` — including the ones
 * `captureRequestError` explicitly marks `handled: false`. All 857 error events in the
 * preceding 30 days reported `error.handled: 1`, so an unhandled promise rejection was
 * indistinguishable from a caught-and-reported error and triage had nowhere to start.
 */
function privacySafeMechanism(mechanism: { type?: string; handled?: boolean } | undefined) {
  if (!mechanism) return undefined;
  const type =
    typeof mechanism.type === "string" && SAFE_MECHANISM_TYPE.test(mechanism.type) ? mechanism.type : undefined;
  const handled = typeof mechanism.handled === "boolean" ? mechanism.handled : undefined;
  if (type === undefined && handled === undefined) return undefined;
  // `generic` is Sentry's own default type, and the field is required by the SDK shape.
  return { type: type ?? "generic", ...(handled === undefined ? {} : { handled }) };
}

/**
 * Next writes one server bundle per route at a path that names the route pattern, so a frame
 * such as `/app/.next/server/app/api/medications/route.js` still carries the route identity
 * after minification, and survives a rebuild unchanged.
 *
 * Dynamic segments appear as their literal pattern (`[slug]`), never a request value, so this
 * recovers the same string `captureRequestError` would have tagged and nothing more.
 */
const APP_ROUTE_BUNDLE = /\/\.next\/server\/app\/(.+?)\/(?:route|page)\.js$/;

/** Newest-first scan for the route pattern a stack passed through, or `undefined`. */
function routePathFromFrames(frames: { filename?: string }[] | undefined): string | undefined {
  if (!frames?.length) return undefined;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const matched = APP_ROUTE_BUNDLE.exec(frames[index]?.filename ?? "");
    if (matched) return `/${matched[1]}`;
  }
  return undefined;
}

/** Keep code locations while removing all free-form/request data before export. */
export function privacySafeErrorEvent(event: ErrorEvent): ErrorEvent {
  const exceptions = event.exception?.values?.map((exception) => ({
    // Error.name is mutable and can contain request or clinical text. Retain
    // only fixed JavaScript runtime types; custom/provider names collapse to a
    // generic type while their scrubbed stack location still supports grouping.
    type: privacySafeExceptionType(exception.type),
    value: SAFE_ERROR_MESSAGE,
    mechanism: privacySafeMechanism(exception.mechanism),
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
  const frames = exceptions?.[0]?.stacktrace?.frames;
  // Only `captureRequestError` sets `route_path`, and over the 30 days to 2026-09-17 it
  // accounted for 4 of 857 error events: everything arriving through the SDK's own global
  // handlers is untagged. Recovering the pattern from the stack keeps those events grouped by
  // route rather than collapsed into a single undifferentiated bucket.
  const routePath = tags.route_path ?? routePathFromFrames(frames);
  const topFrame = frames?.at(-1);
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
    // NEVER `undefined` outside the worker branch. An undefined fingerprint hands grouping back
    // to Sentry's default algorithm, which reads exactly the minified frames this function exists
    // to normalise, so one recurring fault opens a fresh issue on every deploy. That was diagnosed
    // on 2026-09-16 and fixed for the routed path only — and 853 of 857 events had no route, so
    // they kept splintering: 20 open groups under one title by 2026-09-17. `unrouted` is a
    // deliberately coarse last resort for a stack that names no route bundle at all.
    fingerprint: workerStage
      ? ["worker", workerStage, exceptionType, stableFrameFilename(topFrame?.filename)]
      : [
          routePath ?? "unrouted",
          exceptionType,
          stableFrameFilename(topFrame?.filename),
          stableFrameFunction(topFrame?.function),
        ],
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

export const captureRequestError: Instrumentation.onRequestError = async (error, request, context) => {
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
    // Use the SDK's Next-aware capture path so the event carries the standard
    // request-error mechanism and framework context. `privacySafeErrorEvent`
    // still strips request headers, raw paths, and all non-allowlisted context.
    Sentry.captureRequestError(error, request, context);
  });
  await Sentry.flush(2_000);
};
