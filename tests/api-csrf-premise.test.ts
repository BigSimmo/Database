// tests/api-csrf-premise.test.ts
//
// `apiMutationCsrfVerdict` deliberately ALLOWS a request carrying no Fetch Metadata, no Origin
// and no Referer, on the reasoning that such a request did not come from a browser (curl,
// server-to-server, the ingestion worker), and that `SameSite=Lax` session cookies are what
// actually stop cross-site request forgery. `tests/api-csrf.test.ts:121` pins that behaviour.
//
// The 2026-09-17 external audit flagged it (finding C13), and also that `X-Forwarded-Host` is
// trusted with no allowlist, so a caller setting both that header and a matching `Origin` vouches
// for itself. Checked, and neither is worth a code change today:
//
//   - A browser cannot set `X-Forwarded-Host` on a cross-site fetch; it is not a header script can
//     add without a preflight this app does not grant. Exploiting it needs a non-browser client,
//     which already passes under the rule above.
//   - Railway terminates TLS in front of the app, so the forwarded host IS the host the browser
//     used. Pinning the trusted set to a configured canonical host is possible, but it changes
//     how every production request is judged and cannot be verified from outside that topology.
//
// BUT THE REASONING HAS A PREMISE, and it is the whole thing: the session cookie must be the ONLY
// credential a mutating route accepts. The moment one authenticates by a bearer token or an API
// key -- something a browser can be made to attach, or that travels without Fetch Metadata -- the
// "no headers means not a browser" rule stops being safe and starts being a bypass.
//
// Nothing stated that premise and nothing checked it. This does. It is a scan rather than a note,
// because a note does not go red.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const API_ROOT = resolve(process.cwd(), "src/app/api");

/** Handlers CSRF applies to. A GET is not a state change and is out of scope by construction. */
const MUTATION_HANDLER = /export\s+(?:async\s+)?(?:function\s+)?(POST|PUT|PATCH|DELETE)\b/;
const READS_AUTHORIZATION = /headers\s*(?:\.get\(|\[)\s*["'`]authorization["'`]/i;

function routeFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      found.push(...routeFiles(path));
      continue;
    }
    if (entry === "route.ts" || entry === "route.tsx") found.push(path);
  }
  return found;
}

/**
 * Webhooks are exempt in `api-csrf.ts` itself and authenticate by shared secret on purpose: they
 * are called by Railway, never by a browser, and carry no session cookie to forge.
 */
function isWebhook(rel: string): boolean {
  return rel.includes("/webhooks/");
}

describe("the premise the CSRF fallback rests on", () => {
  const routes = routeFiles(API_ROOT).map((path) => ({
    rel: relative(process.cwd(), path).replaceAll("\\", "/"),
    source: readFileSync(path, "utf8"),
  }));

  it("finds the API routes at all", () => {
    // A scan over an empty set passes for ever. If the route tree moves, this fails and someone
    // re-points it, rather than the suite quietly asserting nothing.
    expect(routes.length).toBeGreaterThan(20);
    expect(routes.some(({ source }) => MUTATION_HANDLER.test(source))).toBe(true);
  });

  it("has no mutating route that authenticates by an Authorization header", () => {
    const offenders = routes
      .filter(({ rel }) => !isWebhook(rel))
      .filter(({ source }) => MUTATION_HANDLER.test(source) && READS_AUTHORIZATION.test(source))
      .map(({ rel }) => rel);

    expect(
      offenders,
      "A mutating route now reads an Authorization header. The CSRF check allows a request with " +
        "no Fetch Metadata, no Origin and no Referer, on the grounds that only a browser can be " +
        "made to forge a request and only the SameSite session cookie travels automatically. A " +
        "bearer-authenticated mutation breaks that reasoning: either exempt the route explicitly " +
        "and say why, or tighten apiMutationCsrfVerdict. Do not simply add it to this list.",
    ).toEqual([]);
  });

  it("still allows the bare non-browser request it is written to allow", async () => {
    // Pinned here as well as in api-csrf.test.ts so the two halves of the argument sit together:
    // this is only safe WHILE the case above holds.
    const { apiMutationCsrfVerdict } = await import("@/lib/api-csrf");
    expect(apiMutationCsrfVerdict(new Headers(), "psychiatry.tools")).toEqual({ allowed: true });
    expect(apiMutationCsrfVerdict(new Headers({ "sec-fetch-site": "cross-site" }), "psychiatry.tools")).toEqual({
      allowed: false,
      reason: "cross_site",
    });
  });
});
