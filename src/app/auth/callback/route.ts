import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Handles the PKCE code return for OAuth (Google/Microsoft), email-confirmation,
// and magic-link sign-in. Exchanges `?code=` for a session, writing the session
// cookies via the cookie-aware server client, then redirects into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("error");
  // Only honour same-origin relative redirects to avoid an open-redirect.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const failure = (reason: string) => NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(reason)}`);

  if (errorDescription) {
    return failure(errorDescription);
  }
  if (!code) {
    return failure("missing_auth_code");
  }

  const authCookies: Parameters<SetAllCookies>[0] = [];
  const authHeaders = new Headers();
  const setAllCookies: SetAllCookies = (cookiesToSet, responseHeaders) => {
    authCookies.push(...cookiesToSet);
    for (const [name, value] of Object.entries(responseHeaders)) authHeaders.set(name, value);
  };
  const withAuthMutations = (response: NextResponse) => {
    for (const { name, value, options } of authCookies) response.cookies.set(name, value, options);
    authHeaders.forEach((value, name) => response.headers.set(name, value));
    return response;
  };

  const supabase = await createSupabaseServerClient({ setAllCookies });
  if (!supabase) {
    return failure("auth_unconfigured");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return withAuthMutations(failure(error.message));
  }
  return withAuthMutations(NextResponse.redirect(`${origin}${next}`));
}
