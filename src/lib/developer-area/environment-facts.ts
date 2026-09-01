import "server-only";

import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HubEnvironmentFacts = {
  demoMode: boolean;
  documentCount: number | null;
  email: string | null;
};

/**
 * The three facts the developer hub's environment strip cannot read for itself.
 *
 * One Supabase client, one auth call and at most one count query per hub load —
 * the gate above this page (`DeveloperAreaGate`) already resolves the same user
 * on the same request, so this is deliberately the *second* auth call and not a
 * third: email and the document count are gathered together rather than through
 * two independent helpers.
 *
 * **The user-session client, never the service-role admin client.**
 * `public.documents` has row-level security enabled with a single select policy,
 * `documents owner read` (`owner_id = auth.uid()`), so the database itself scopes
 * this count to the caller's own documents. `createAdminClient` bypasses RLS and
 * would report every owner's document total to whoever happened to be signed in.
 *
 * **Every failure returns `null`, never `0`.** Zero is a true and meaningful
 * answer here — an account that has uploaded nothing — so a failed read must not
 * be able to impersonate it. The strip renders `null` as "document count
 * unavailable", which is the conservative degradation this repo requires: name
 * the gap rather than state a number nothing read. The same reasoning is why an
 * unauthenticated request skips the query outright instead of reporting the `0`
 * rows RLS would correctly return to it.
 */
export async function resolveHubEnvironmentFacts(): Promise<HubEnvironmentFacts> {
  const demoMode = isDemoMode();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { demoMode, documentCount: null, email: null };

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { demoMode, documentCount: null, email: null };

  const { count, error } = await supabase.from("documents").select("id", { count: "exact", head: true });

  return {
    demoMode,
    documentCount: error ? null : (count ?? null),
    email: user.email ?? null,
  };
}
