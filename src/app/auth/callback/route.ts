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

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return failure("auth_unconfigured");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return failure(error.message);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
