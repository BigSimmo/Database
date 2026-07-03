import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Public (browser/user-context) Supabase config, or null when the public env
 *  is not configured (demo / local-no-auth). Distinct from the service-role
 *  admin client in `admin.ts` — this one carries the user's session and is
 *  subject to RLS. */
export function publicSupabaseConfig(): { url: string; key: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Cookie-aware Supabase client for Server Components and Route Handlers. Reads
 * (and, where the context allows, refreshes) the user's `@supabase/ssr` session
 * cookies via `next/headers`. Returns null when the public Supabase env is
 * absent so callers can fall back to demo behaviour. RLS applies to this client
 * (unlike the service-role admin client).
 */
export async function createSupabaseServerClient() {
  const config = publicSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called during a Server Component render where cookies are
          // read-only. The proxy refresh writes the cookies instead, so this
          // is safe to ignore.
        }
      },
    },
  });
}
