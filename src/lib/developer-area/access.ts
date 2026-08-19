import "server-only";

import { isAdministratorUser } from "@/lib/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeveloperAccessState = "authorized" | "unauthenticated" | "unauthorized";

export type DeveloperAccessResult = { state: DeveloperAccessState; email: string | null };

/**
 * Gate for the in-progress surfaces linked from Settings ("Development"): the
 * same administrator claim (`app_metadata.site_role === "administrator"`)
 * that already gates document/corpus management, per `src/lib/authorization.ts`.
 * Reused deliberately rather than a new role — a second, parallel authorization
 * concept for a single-admin deployment would be pure duplication.
 */
export async function resolveDeveloperAccessState(): Promise<DeveloperAccessResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { state: "unauthenticated", email: null };

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { state: "unauthenticated", email: null };

  return {
    state: isAdministratorUser(user) ? "authorized" : "unauthorized",
    email: user.email ?? null,
  };
}
