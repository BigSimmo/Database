import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { consolidatedModeHomeTarget, unsubmittedModeSearchTarget } from "@/lib/consolidated-mode-home-redirect";
import { documentSourceRedirectTarget, isDocumentSourcePath } from "@/lib/document-source-redirect";
import { env } from "@/lib/env";
import { legacyHomeRedirectUrl } from "@/lib/legacy-home-redirect";
import {
  DEVELOPER_AREA_HEADER,
  DEVELOPER_AREA_PATH_HEADER,
  DEVELOPER_GATED_PATH_PREFIXES,
} from "@/lib/developer-area/headers";
import { buildContentSecurityPolicy, resolveRuntimeFlags } from "@/lib/security-headers";
import { signProxyAuthPayload } from "@/lib/supabase/proxy-auth-crypto";

function isDeveloperGatedPath(pathname: string) {
  return DEVELOPER_GATED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const PROXY_AUTH_USER_HEADER = "x-proxy-auth-user";

// Next 16 renamed the `middleware` file convention to `proxy` (see
// node_modules/next/dist/docs/.../file-conventions/proxy.md). Proxy defaults to
// the Node.js runtime, which the Supabase client requires.
//
// Two jobs:
//   1. Content-Security-Policy nonce. A fresh per-request nonce is generated and
//      threaded into the SSR request (`x-nonce` + the CSP header, which Next.js
//      parses to stamp its framework/bundle scripts) and onto the response so the
//      browser enforces it. This is why the CSP header lives here and not in
//      next.config.ts: a nonce cannot be a build-time constant. Using a nonce
//      opts pages into dynamic rendering (app/layout.tsx reads the nonce), which
//      is inherent to nonce-based CSP.
//   2. Session refresh. Keep the user's @supabase/ssr session cookie fresh on
//      page navigations so persistent logins survive refreshes. It is a no-op
//      unless the public Supabase env is configured AND an `sb-` auth cookie is
//      present, so demo / local-no-auth traffic is untouched. Cookie-authenticated
//      API requests still pass through this refresh path because route handlers
//      cannot write rotated SSR cookies back to the browser themselves.

/**
 * Retired paths that forward, query string intact, to the surface that replaced
 * them. Resolved here as one 307 rather than left to the page's own
 * `redirect()`, which under the streaming `(search-app)` layout emits a
 * client-side meta refresh — a second of empty shell. Each page keeps its
 * redirect as a backstop for anything the matcher misses.
 */
const staticRouteRedirects: Record<string, string> = {
  "/mockups/document-search-command": "/documents/search",
  // Dictionary's Search and Browse were one catalogue behind two destinations
  // and are now one route; `view`, `letter`, `topic` and `kind` mean the same
  // thing there, so the query string travels unchanged.
  "/dictionary/browse": "/dictionary/search",
  // Ward Flow Constellation was retired in Phase 2; keep
  // /ward-management/constellation as an intentional unlinked compatibility
  // redirect to /ward-management/network so historical deep-links match the
  // page backstop (PR #2303).
  "/ward-management/constellation": "/ward-management/network",
};

const publicPwaPaths = new Set(["/sw.js", "/offline.html", "/manifest.webmanifest", "/apple-icon", "/icon.svg"]);

export function isPublicPwaPath(pathname: string) {
  return publicPwaPaths.has(pathname) || pathname.startsWith("/icons/");
}

// Same runtime flags next.config.ts uses for the static headers, so the nonce'd
// CSP matches the rest of the policy (unsafe-eval in dev, HTTPS upgrade off local
// http). Evaluated once at module load.
const { isDevelopment, isLocalHttpRuntime } = resolveRuntimeFlags();

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PWA bootstrap assets are public and deliberately independent from a user's
  // auth session. Let next.config.ts apply their stable resource-specific headers
  // without generating a page nonce or refreshing Supabase cookies.
  if (isPublicPwaPath(pathname)) return NextResponse.next();

  // A fresh, unguessable nonce per request (see Next.js CSP guide). Buffer+base64
  // matches the documented pattern and keeps the value header-safe.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy({ isDevelopment, isLocalHttpRuntime, nonce });

  if (request.nextUrl.pathname === "/api/upload") {
    const declaredLength = Number(request.headers.get("content-length"));
    const uploadEnvelopeBytes = env.MAX_UPLOAD_MB * 1024 * 1024 + 1024 * 1024;
    if (Number.isFinite(declaredLength) && declaredLength > uploadEnvelopeBytes) {
      const response = NextResponse.json(
        { error: "Upload request is too large.", code: "payload_too_large" },
        { status: 413 },
      );
      response.headers.set("content-security-policy", csp);
      response.headers.set("cache-control", "private, no-store");
      return response;
    }
  }

  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks/")
  ) {
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite === "cross-site") {
      const response = NextResponse.json(
        { error: "Cross-site request blocked.", code: "cross_site_forbidden" },
        { status: 403 },
      );
      response.headers.set("content-security-policy", csp);
      return response;
    }
  }

  // Request headers Next.js reads during SSR: `x-nonce` for our own inline
  // <script>, and the CSP header from which Next extracts the nonce for its
  // scripts. Rebuilt from the *current* request each call so session-cookie
  // mutations below still propagate to the render.
  const requestHeadersWithNonce = (authenticatedUserHeader?: string | null) => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    // Untrusted: strip unconditionally so a client cannot set this header itself
    // and spoof past the parent `/mockups` layout's production gate on a route
    // that is not actually one of the developer-gated subtrees listed in
    // DEVELOPER_GATED_PATH_PREFIXES (`/mockups/development`, the Caring Contact
    // prototype, and the Care Plan prototype).
    headers.delete(DEVELOPER_AREA_HEADER);
    headers.delete(DEVELOPER_AREA_PATH_HEADER);
    headers.delete(PROXY_AUTH_USER_HEADER);
    if (isDeveloperGatedPath(pathname)) {
      headers.set(DEVELOPER_AREA_HEADER, "1");
      headers.set(DEVELOPER_AREA_PATH_HEADER, `${pathname}${request.nextUrl.search}`);
    }
    if (authenticatedUserHeader) {
      headers.set(PROXY_AUTH_USER_HEADER, authenticatedUserHeader);
    }
    return headers;
  };
  // Every response the browser sees must carry the enforced CSP header.
  const withCsp = (response: NextResponse) => {
    response.headers.set("content-security-policy", csp);
    return response;
  };

  const legacyHomeTarget = legacyHomeRedirectUrl(request.nextUrl, request.method);
  if (legacyHomeTarget) return withCsp(NextResponse.redirect(legacyHomeTarget));

  const redirectTarget = staticRouteRedirects[pathname];

  if (redirectTarget) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTarget;
    return withCsp(NextResponse.redirect(url));
  }

  // Issue #024: resolve the document-source fallbacks here as a single HTTP 307
  // instead of letting the page's server redirect() stream a 200 whose redirect
  // completes client-side through an `_rsc` navigation — WebKit raises
  // access-control pageerrors on that chain. The target is rebuilt from
  // sanitised components of this request's own query, so it cannot become an
  // open redirect. The page remains as a backstop for any request the matcher
  // misses.
  // Consolidated mode homes: every mode but Favourites, Tools and Medication now
  // shares one home, so its bare path forwards — to `/?mode=<id>` unsubmitted, or
  // to `<mode>/search` when the link carries a submitted query. Resolved here for
  // the same reason as the document-source fallbacks below — a page `redirect()`
  // under the streaming `(search-app)` layout emits a client-side meta refresh (a
  // full second of empty shell) rather than a 307. The page keeps its own redirect
  // as a backstop for anything this misses.
  const consolidatedHomeTarget = consolidatedModeHomeTarget(pathname, request.nextUrl.searchParams);

  if (consolidatedHomeTarget) {
    const url = request.nextUrl.clone();
    const [targetPathname, targetSearch = ""] = consolidatedHomeTarget.split("?");
    url.pathname = targetPathname;
    url.search = targetSearch;
    return withCsp(NextResponse.redirect(url));
  }

  // The same forward for an unsubmitted `<mode>/search`: those four routes have no
  // browse view, so an empty query would render the retired mode home a second time.
  const unsubmittedSearchTarget = unsubmittedModeSearchTarget(pathname, request.nextUrl.searchParams);

  if (unsubmittedSearchTarget) {
    const url = request.nextUrl.clone();
    const [targetPathname, targetSearch = ""] = unsubmittedSearchTarget.split("?");
    url.pathname = targetPathname;
    url.search = targetSearch;
    return withCsp(NextResponse.redirect(url));
  }

  if (isDocumentSourcePath(pathname)) {
    const url = request.nextUrl.clone();
    const target = documentSourceRedirectTarget(url.searchParams);
    const [targetPathname, targetSearch = ""] = target.split("?");
    url.pathname = targetPathname;
    url.search = targetSearch;
    return withCsp(NextResponse.redirect(url));
  }

  if (shouldBlockProductionMockups(pathname)) {
    return withCsp(new NextResponse(null, { status: 404 }));
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
  if (!url || !key || !hasAuthCookie) {
    return withCsp(NextResponse.next({ request: { headers: requestHeadersWithNonce() } }));
  }

  let userHeaderValue: string | null = null;
  let response = NextResponse.next({ request: { headers: requestHeadersWithNonce() } });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeadersWithNonce(userHeaderValue) } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(responseHeaders)) response.headers.set(name, value);
      },
    },
  });

  // Refresh the session. Per @supabase/ssr guidance, do not run other logic
  // between createServerClient and getClaims — a stale token here would sign the
  // user out on the next request.
  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult?.data?.claims;
  if (claims && typeof claims === "object" && typeof claims.sub === "string" && claims.sub) {
    const userPayload = {
      id: claims.sub,
      appMetadata:
        claims.app_metadata && typeof claims.app_metadata === "object"
          ? (claims.app_metadata as Record<string, unknown>)
          : {},
    };
    const rawPayload = Buffer.from(JSON.stringify(userPayload), "utf8").toString("base64");
    userHeaderValue = signProxyAuthPayload(rawPayload);
    const previousCookies = response.cookies.getAll();
    const previousHeaders = new Headers(response.headers);
    response = NextResponse.next({ request: { headers: requestHeadersWithNonce(userHeaderValue) } });
    for (const [k, v] of previousHeaders.entries()) {
      // `Headers.entries()` does not reliably preserve Set-Cookie attributes.
      // Re-apply cookies through the cookie store after this copy instead.
      if (k.toLowerCase() === "set-cookie") continue;
      response.headers.set(k, v);
    }
    for (const cookie of previousCookies) {
      response.cookies.set(cookie);
    }
  }
  return withCsp(response);
}

export function shouldBlockProductionMockups(
  pathname: string,
  environment: Record<string, string | undefined> = process.env,
) {
  if (!pathname.startsWith("/mockups") || environment.NODE_ENV !== "production") return false;

  // `/mockups/development` and the two prototypes it links to — Caring Contact
  // and Care Plan — carry their own signed-in-administrator gate
  // (`DeveloperAreaGate`, applied in each subtree's layout via the
  // x-developer-area header set above), so let them through this blanket block
  // and let that gate run instead of a bare 404. The match is exact-or-slash, so
  // a look-alike path such as `/mockups/care-plan-archive` is NOT let through.
  // Every other /mockups/** path is unaffected.
  if (isDeveloperGatedPath(pathname)) return false;

  // Mockups remain unavailable in every normal production process. The one
  // exception is the repository-owned, isolated Playwright server when its
  // advisory project explicitly opts into mockup coverage. Instrumentation
  // separately refuses PLAYWRIGHT_OFFLINE_MODE outside the inert loopback and
  // isolated .next-playwright profile.
  return !(environment.PLAYWRIGHT_OFFLINE_MODE === "true" && environment.NEXT_PUBLIC_MOCKUPS_ENABLED === "true");
}

export const config = {
  // Run on everything except static assets and image files. API routes stay in
  // the matcher so cookie-authenticated requests can return rotated cookies and
  // every response carries the CSP header.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
