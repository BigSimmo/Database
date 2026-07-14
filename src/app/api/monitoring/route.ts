// Same-origin Sentry tunnel. The browser SDK is configured with
// `tunnel: "/api/monitoring"` (src/instrumentation-client.ts) so event envelopes
// are POSTed here instead of directly to Sentry's ingest host. This keeps the
// strict clinical CSP intact — `connect-src 'self'` already allows this route, so
// no Sentry ingest host has to be added to the policy — and lets ad-blockers that
// block *.sentry.io not silently drop client error reports.
//
// The route forwards the raw envelope to Sentry server-side (server fetches are not
// bound by CSP). Hardening: it (1) validates the envelope's embedded DSN against the
// project's own configured DSN so the endpoint cannot relay to arbitrary projects,
// (2) caps the buffered body at 1 MB (Content-Length preflight + streamed byte
// count) since this is an unauthenticated public POST under a large proxy body
// allowance, and (3) bounds the upstream relay with a timeout. Inert (404) until
// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is set.

export const runtime = "nodejs";

const MAX_ENVELOPE_BYTES = 1_000_000; // 1 MB — Sentry event envelopes are far smaller.
const UPSTREAM_TIMEOUT_MS = 5_000;

// Lightweight per-IP throttle. This is an unauthenticated public POST, so a
// spammer with a valid envelope could otherwise burn the project's Sentry ingest
// quota. A per-instance in-memory window is intentionally simple (unlike the
// durable answer/upload limiters this is best-effort telemetry relay, not a paid
// or state-changing path); Sentry's own ingest rate limits are the backstop.
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
type RateWindow = { count: number; resetAt: number };
const rateLimitByIp = new Map<string, RateWindow>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimitByIp.size > 5_000) {
    for (const [key, window] of rateLimitByIp) if (now >= window.resetAt) rateLimitByIp.delete(key);
  }
  const existing = rateLimitByIp.get(ip);
  if (!existing || now >= existing.resetAt) {
    rateLimitByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  existing.count += 1;
  return existing.count > RATE_LIMIT_MAX;
}

type ParsedDsn = { host: string; projectId: string };

function parseDsn(dsn: string): ParsedDsn {
  const url = new URL(dsn);
  const projectId = url.pathname.replace(/^\//, "");
  if (!url.host || !projectId) throw new Error("incomplete dsn");
  return { host: url.host, projectId };
}

// Reads the request body as text but aborts once it exceeds `maxBytes`, returning
// null. Streams so an oversized body is never fully buffered.
async function readCappedText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    return text.length > maxBytes ? null : text;
  }
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

export async function POST(request: Request): Promise<Response> {
  const configuredDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!configuredDsn) return new Response(null, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return new Response("too many requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  let expected: ParsedDsn;
  try {
    expected = parseDsn(configuredDsn);
  } catch {
    // Misconfigured server DSN — do not leak detail, just refuse.
    return new Response(null, { status: 404 });
  }

  // Reject oversized payloads before buffering when the length is declared.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ENVELOPE_BYTES) {
    return new Response("payload too large", { status: 413 });
  }

  const envelope = await readCappedText(request, MAX_ENVELOPE_BYTES);
  if (envelope === null) return new Response("payload too large", { status: 413 });

  const firstNewline = envelope.indexOf("\n");
  if (firstNewline === -1) return new Response("invalid envelope", { status: 400 });

  let header: { dsn?: unknown };
  try {
    header = JSON.parse(envelope.slice(0, firstNewline));
  } catch {
    return new Response("invalid envelope header", { status: 400 });
  }

  if (typeof header.dsn !== "string") return new Response("missing dsn", { status: 400 });

  let incoming: ParsedDsn;
  try {
    incoming = parseDsn(header.dsn);
  } catch {
    return new Response("invalid dsn", { status: 400 });
  }

  // Reject anything not addressed to this project's own DSN (no open relay).
  if (incoming.host !== expected.host || incoming.projectId !== expected.projectId) {
    return new Response("forbidden", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://${expected.host}/api/${expected.projectId}/envelope/`, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Upstream slow/unreachable — fail fast without tying up the request thread.
    return new Response("bad gateway", { status: 502 });
  }

  const body = await upstream.text();
  return new Response(body, { status: upstream.status });
}
