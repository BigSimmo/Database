import "server-only";

import { isAdministratorUser } from "@/lib/authorization";
import { isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HubEnvironmentFacts = {
  demoMode: boolean;
  documentCount: number | null;
  email: string | null;
};

/**
 * The three facts the developer hub's environment strip cannot read for itself.
 *
 * One auth call and at most one count query per hub load — the gate above this
 * page (`DeveloperAreaGate`) already resolves the same user on the same request,
 * so this is deliberately the *second* auth call and not a third: email and the
 * document count are gathered together rather than through two independent
 * helpers.
 *
 * **Why the count is read with the service-role client, and what scopes it.**
 * This module first counted `public.documents` through the cookie-bound user
 * client, on the reasoning that the `documents owner read` policy
 * (`owner_id = auth.uid()`) would scope the count in the database. It cannot.
 * `supabase/schema.sql:5299` revokes all table privileges in `public` from
 * `anon` and `authenticated`, and the grant block below it names
 * `public.documents` for `service_role` only;
 * `supabase/migrations/20260725000000_audit_security_remediation.sql:81`
 * re-applies that revoke after every earlier grant, and no later migration
 * restores it. The schema says as much in a comment of its own: browser clients
 * receive no direct table privileges, signed-in access is mediated by the server
 * routes, and the owner policies remain as defence in depth. A policy cannot
 * hand back an SQL `SELECT` privilege the role does not hold, so the count
 * returned permission denied on every hub load and the strip could only ever
 * render "document count unavailable" — silently, because a failed read here
 * degrades to `null` by design. Found while building the corpus-health panel,
 * which had copied this module as its model (PR #2504).
 *
 * So the scoping moves up one layer, matching `corpus-health.ts` and
 * `src/app/api/ingestion/jobs/route.ts`: the cookie-bound client identifies the
 * caller and reads no table, the caller must carry the same administrator claim
 * `DeveloperAreaGate` checks, and the count filters on `owner_id` explicitly.
 * That filter is the whole of the owner-scoping guarantee now, not an addition
 * to row-level security, and `tests/developer-hub-environment-facts.test.ts`
 * asserts it on the issued query. Do not "restore" the user client here on the
 * strength of the policy: it reads nothing, and it fails by looking healthy.
 *
 * **Every failure returns `null`, never `0`.** Zero is a true and meaningful
 * answer here — an account that has uploaded nothing — so a failed read must not
 * be able to impersonate it. The strip renders `null` as "document count
 * unavailable", which is the conservative degradation this repo requires: name
 * the gap rather than state a number nothing read. The same reasoning is why an
 * unauthenticated request skips the query outright instead of reporting a `0`.
 */
export async function resolveHubEnvironmentFacts(): Promise<HubEnvironmentFacts> {
  const demoMode = isDemoMode();
  const unread: HubEnvironmentFacts = { demoMode, documentCount: null, email: null };

  const session = await createSupabaseServerClient();
  if (!session) return unread;

  // Both awaits are wrapped, and a returned `{ error }` is only half of what can
  // go wrong. An aborted request or one that exhausts its network retries makes
  // the client *reject* rather than resolve with an error, and an unhandled
  // rejection here would fail the whole page rather than degrade one line of it
  // — the opposite of this module's contract, and worst during exactly the
  // Supabase outage that makes the hub worth opening. `demoMode` survives either
  // way, because it never depended on the network. `createAdminClient()` is
  // inside the same guard: it calls `requireServerEnv()` and throws when the
  // server env is absent.
  try {
    const { data } = await session.auth.getUser();
    const user = data.user;
    if (!user) return unread;

    // The email is known at this point and does not depend on the count, so a
    // non-administrator still gets a named account rather than a blank strip.
    // The `owner_id` filter below would already confine the count to this
    // caller's own documents; this check is the same defence in depth the
    // corpus-health panel applies.
    const email = user.email ?? null;
    if (!isAdministratorUser(user)) return { demoMode, documentCount: null, email };

    const admin = createAdminClient();
    const { count, error } = await admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    return {
      demoMode,
      documentCount: error ? null : (count ?? null),
      email,
    };
  } catch {
    return unread;
  }
}
