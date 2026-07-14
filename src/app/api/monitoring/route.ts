// Same-origin Sentry tunnel. The browser SDK is configured with
// `tunnel: "/api/monitoring"` (src/instrumentation-client.ts) so event envelopes
// are POSTed here instead of directly to Sentry's ingest host. This keeps the
// strict clinical CSP intact — `connect-src 'self'` already allows this route, so
// no Sentry ingest host has to be added to the policy — and lets ad-blockers that
// block *.sentry.io not silently drop client error reports.
//
// The route forwards the raw envelope to Sentry server-side (server fetches are not
// bound by CSP). It validates the envelope's embedded DSN against the project's own
// configured DSN so the endpoint cannot be used as an open relay to arbitrary
// Sentry projects. Inert (404) until SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is set.

export const runtime = "nodejs";

type ParsedDsn = { host: string; projectId: string };

function parseDsn(dsn: string): ParsedDsn {
  const url = new URL(dsn);
  const projectId = url.pathname.replace(/^\//, "");
  if (!url.host || !projectId) throw new Error("incomplete dsn");
  return { host: url.host, projectId };
}

export async function POST(request: Request): Promise<Response> {
  const configuredDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!configuredDsn) return new Response(null, { status: 404 });

  let expected: ParsedDsn;
  try {
    expected = parseDsn(configuredDsn);
  } catch {
    // Misconfigured server DSN — do not leak detail, just refuse.
    return new Response(null, { status: 404 });
  }

  const envelope = await request.text();
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

  const upstream = await fetch(`https://${expected.host}/api/${expected.projectId}/envelope/`, {
    method: "POST",
    body: envelope,
    headers: { "Content-Type": "application/x-sentry-envelope" },
    signal: AbortSignal.timeout(10000),
  });

  const body = await upstream.text();
  return new Response(body, { status: upstream.status });
}
