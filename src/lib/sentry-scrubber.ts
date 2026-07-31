/**
 * Runtime-neutral Sentry privacy hooks for client / Node / Edge inits.
 *
 * Clinical query text, secrets, emails, and request URLs must not leave this
 * process once a DSN is configured. Hooks fail closed: any scrubbing error, or
 * an event that cannot be made safe, drops the payload (return null).
 *
 * Event shapes are local (not imported from `@sentry/core`) so knip does not
 * treat the transitive SDK package as an unlisted direct dependency. Hook
 * exports are cast to `@sentry/nextjs` init option types at the boundary.
 */
import type * as Sentry from "@sentry/nextjs";
import { redactLogValue } from "@/lib/privacy";

type SentryInitOptions = NonNullable<Parameters<(typeof Sentry)["init"]>[0]>;

type Primitive = string | number | boolean | null | undefined;

type SentryBreadcrumb = {
  message?: string;
  category?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

type SentryException = {
  type?: string;
  value?: string;
  stacktrace?: {
    frames?: Array<{
      filename?: string;
      abs_path?: string;
      context_line?: string;
      vars?: unknown;
      [key: string]: unknown;
    }>;
  };
};

type SentryEvent = {
  type?: "transaction" | "profile" | "replay_event" | "feedback" | undefined;
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  transaction?: string;
  exception?: { values?: SentryException[] };
  breadcrumbs?: SentryBreadcrumb[];
  request?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, Primitive>;
  extra?: Record<string, unknown>;
  user?: { id?: string | number; email?: string; ip_address?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type SentryErrorEvent = SentryEvent & { type: undefined };
type SentryTransactionEvent = SentryEvent & { type: "transaction" };

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|api[-_]?key|password|service[-_]?role|email|\bquery\b|prompt|\bcontent\b|\banswer\b|patient|\bmrn\b|headers|data|body|request/i;

const MAX_DEPTH = 6;

function scrubString(value: string): string {
  // Strip query/hash before general redaction so route transactions like
  // `GET /answer?q=clinical+text` cannot leak clinical query text when they
  // are not full https:// URLs (redactLogValue's URL matcher requires a scheme).
  const withoutQuery = value.replace(/[?#][^\s"]*/g, "[query]");
  return String(redactLogValue(withoutQuery));
}

function scrubUnknown(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[depth-limited]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubUnknown(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : scrubUnknown(val, depth + 1);
    }
    return out;
  }
  return scrubString(String(value));
}

function scrubBreadcrumb(breadcrumb: SentryBreadcrumb): SentryBreadcrumb | null {
  try {
    const next: SentryBreadcrumb = { ...breadcrumb };
    if (typeof next.message === "string") next.message = scrubString(next.message);
    if (typeof next.category === "string") next.category = scrubString(next.category);
    if (next.data && typeof next.data === "object") {
      next.data = scrubUnknown(next.data) as Record<string, unknown>;
    }
    return next;
  } catch {
    return null;
  }
}

function scrubRequest(event: SentryEvent): void {
  if (!event.request || typeof event.request !== "object") return;
  const request = { ...event.request };
  for (const key of ["url", "query_string", "fragment"] as const) {
    if (typeof request[key] === "string") request[key] = scrubString(request[key] as string);
  }
  if (request.headers) request.headers = "[redacted]";
  if (request.cookies) request.cookies = "[redacted]";
  if (request.data !== undefined) request.data = "[redacted]";
  if (request.env) request.env = "[redacted]";
  event.request = request;
}

function scrubExceptions(event: SentryEvent): void {
  const values = event.exception?.values;
  if (!Array.isArray(values)) return;
  for (const exception of values) {
    if (!exception || typeof exception !== "object") continue;
    if (typeof exception.value === "string") exception.value = scrubString(exception.value);
    if (typeof exception.type === "string") exception.type = scrubString(exception.type);
    const frames = exception.stacktrace?.frames;
    if (!Array.isArray(frames)) continue;
    for (const frame of frames) {
      if (!frame || typeof frame !== "object") continue;
      if (typeof frame.filename === "string") frame.filename = scrubString(frame.filename);
      if (typeof frame.abs_path === "string") frame.abs_path = scrubString(frame.abs_path);
      if ("vars" in frame) delete frame.vars;
      if (typeof frame.context_line === "string") frame.context_line = scrubString(frame.context_line);
    }
  }
}

function scrubEventFields(event: SentryEvent): SentryEvent {
  if (typeof event.message === "string") event.message = scrubString(event.message);
  if (event.logentry && typeof event.logentry === "object") {
    if (typeof event.logentry.message === "string") {
      event.logentry.message = scrubString(event.logentry.message);
    }
    if (Array.isArray(event.logentry.params)) {
      event.logentry.params = event.logentry.params.map((param) => scrubUnknown(param));
    }
  }
  if (typeof event.transaction === "string") event.transaction = scrubString(event.transaction);

  scrubExceptions(event);
  scrubRequest(event);

  if (event.user && typeof event.user === "object") {
    event.user = {
      id: typeof event.user.id === "string" || typeof event.user.id === "number" ? event.user.id : undefined,
    };
  }

  if (event.tags && typeof event.tags === "object") {
    const tags: Record<string, Primitive> = {};
    for (const [key, val] of Object.entries(event.tags)) {
      if (SENSITIVE_KEY.test(key)) {
        tags[key] = "[redacted]";
      } else if (typeof val === "string") {
        tags[key] = scrubString(val);
      } else if (typeof val === "number" || typeof val === "boolean" || val === null || val === undefined) {
        tags[key] = val;
      } else {
        tags[key] = scrubString(String(val));
      }
    }
    event.tags = tags;
  }

  if (event.extra && typeof event.extra === "object") {
    event.extra = scrubUnknown(event.extra) as Record<string, unknown>;
  }
  if (event.contexts && typeof event.contexts === "object") {
    event.contexts = scrubUnknown(event.contexts) as Record<string, unknown>;
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs
      .map((crumb) => scrubBreadcrumb(crumb))
      .filter((crumb): crumb is SentryBreadcrumb => crumb !== null);
  }

  return event;
}

/** Drop or scrub error/message events before transmission. */
export function sentryBeforeSend(event: SentryErrorEvent, hint?: unknown): SentryErrorEvent | null {
  void hint;
  try {
    return scrubEventFields(event) as SentryErrorEvent;
  } catch {
    return null;
  }
}

/** Drop or scrub performance transactions before transmission. */
export function sentryBeforeSendTransaction(
  event: SentryTransactionEvent,
  hint?: unknown,
): SentryTransactionEvent | null {
  void hint;
  try {
    return scrubEventFields(event) as SentryTransactionEvent;
  } catch {
    return null;
  }
}

/** Drop or scrub breadcrumbs before they attach to an event. */
export function sentryBeforeBreadcrumb(breadcrumb: SentryBreadcrumb): SentryBreadcrumb | null {
  return scrubBreadcrumb(breadcrumb);
}

/** Shared init fragment for all three Next.js runtimes. */
export const sentryPrivacyHooks = {
  beforeSend: sentryBeforeSend as SentryInitOptions["beforeSend"],
  beforeSendTransaction: sentryBeforeSendTransaction as SentryInitOptions["beforeSendTransaction"],
  beforeBreadcrumb: sentryBeforeBreadcrumb as SentryInitOptions["beforeBreadcrumb"],
  sendDefaultPii: false as const,
};
