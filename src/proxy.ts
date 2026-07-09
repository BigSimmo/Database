import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { buildContentSecurityPolicy, resolveRuntimeFlags } from "@/lib/security-headers";

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
//      navigation and API calls so persistent logins survive refreshes. It is a
//      no-op unless the public Supabase env is configured AND an `sb-` auth
//      cookie is present, so demo / local-no-auth traffic is untouched.

const documentFlowRedirects: Record<string, string> = {
  "/mockups/document-search-command": "/documents/search",
  "/mockups/document-search/source": "/documents/source",
  "/mockups/document-search/source/evidence": "/documents/source/evidence",
};

// Same runtime flags next.config.ts uses for the static headers, so the nonce'd
// CSP matches the rest of the policy (unsafe-eval in dev, HTTPS upgrade off local
// http). Evaluated once at module load.
const { isDevelopment, isLocalHttpRuntime } = resolveRuntimeFlags();

const documentFlowRedirects: Record<string, string> = {
  "/mockups/document-search-command": "/documents/search",
  "/mockups/document-search/source": "/documents/source",
  "/mockups/document-search/source/evidence": "/documents/source/evidence",
};

export async function proxy(request: NextRequest) {
<<<<<<< HEAD
=======
  // A fresh, unguessable nonce per request (see Next.js CSP guide). Buffer+base64
  // matches the documented pattern and keeps the value header-safe.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy({ isDevelopment, isLocalHttpRuntime, nonce });

  // Request headers Next.js reads during SSR: `x-nonce` for our own inline
  // <script>, and the CSP header from which Next extracts the nonce for its
  // scripts. Rebuilt from the *current* request each call so session-cookie
  // mutations below still propagate to the render.
  const requestHeadersWithNonce = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return headers;
  };
  // Every response the browser sees must carry the enforced CSP header.
  const withCsp = (response: NextResponse) => {
    response.headers.set("content-security-policy", csp);
    return response;
  };

>>>>>>> origin/main
  const { pathname } = request.nextUrl;
  const redirectTarget = documentFlowRedirects[pathname];

  if (redirectTarget) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTarget;
<<<<<<< HEAD
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/mockups") && process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
=======
    return withCsp(NextResponse.redirect(url));
  }

  if (pathname.startsWith("/mockups") && process.env.NODE_ENV === "production") {
    return withCsp(new NextResponse(null, { status: 404 }));
>>>>>>> origin/main
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
  if (!url || !key || !hasAuthCookie) {
    return withCsp(NextResponse.next({ request: { headers: requestHeadersWithNonce() } }));
  }

  let response = NextResponse.next({ request: { headers: requestHeadersWithNonce() } });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeadersWithNonce() } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Refresh the session. Per @supabase/ssr guidance, do not run other logic
  // between createServerClient and getUser — a stale token here would sign the
  // user out on the next request.
  await supabase.auth.getUser();
  return withCsp(response);
}

export const config = {
  // Run on everything except static assets and image files. API routes are
  // intentionally included so cookie-based sessions refresh for them too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
