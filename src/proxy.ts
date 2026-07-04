import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

// Next 16 renamed the `middleware` file convention to `proxy` (see
// node_modules/next/dist/docs/.../file-conventions/proxy.md). Proxy defaults to
// the Node.js runtime, which the Supabase client requires.
//
// Purpose: keep the user's @supabase/ssr session cookie fresh on navigation and
// API calls so persistent logins survive refreshes. It is a no-op unless the
// public Supabase env is configured AND an `sb-` auth cookie is present, so
// demo / local-no-auth traffic is untouched and adds no auth round-trip.

const documentFlowRedirects: Record<string, string> = {
  "/mockups/document-search-command": "/documents/search",
  "/mockups/document-search/source": "/documents/source",
  "/mockups/document-search/source/evidence": "/documents/source/evidence",
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const redirectTarget = documentFlowRedirects[pathname];

  if (redirectTarget) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTarget;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/mockups") && process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
  if (!url || !key || !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Refresh the session. Per @supabase/ssr guidance, do not run other logic
  // between createServerClient and getUser — a stale token here would sign the
  // user out on the next request.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Run on everything except static assets and image files. API routes are
  // intentionally included so cookie-based sessions refresh for them too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
