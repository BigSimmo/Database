import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import {
  PatientsDirectory,
  parsePatientsDirectoryFilter,
} from "@/components/caring-contacts/workspace/patients-directory";
import { auditedRead } from "@/lib/caring-contacts-server/handler";
import { isCaringContactsDemoEnabled, resolveDemoActor } from "@/lib/caring-contacts-server/session";
import { caringContactsStore } from "@/lib/caring-contacts-server/store";
import { canPerformCaringContactAction } from "@/lib/caring-contacts/permissions";
import { READ_ACTIONS, type PlanRecord } from "@/lib/caring-contacts/repository";
import type { ServiceState } from "@/lib/caring-contacts/service-state";

/**
 * The workspace's lazy route boundary (Ruling 13). Same spelling and same reason as
 * `src/app/caring-contacts/page.tsx`: nothing outside this route segment imports the workspace,
 * and dynamically importing the shell keeps the Client Components beneath it out of the Clinical
 * KB dashboard's chunks. See that file's module note for the argument in full; it is not repeated
 * here, because one copy of it is the source of truth and two copies would drift.
 */
const CaringContactsShell = dynamic(() =>
  import("@/components/caring-contacts/workspace/shell").then((module) => module.CaringContactsShell),
);

/**
 * The team's caseload -- the first real screen of Phase 2B, and the shape every later list screen
 * copies.
 *
 * TWO AUDITED READS, no HTTP
 * --------------------------
 * `GET /api/caring-contacts/plans` already lists the team's plans, but this page is a Server
 * Component and reads the store directly, exactly as the Today page does. Going over HTTP from a
 * render would add a network hop, a second copy of the failure handling, and an access trail that
 * recorded the server calling itself.
 *
 * Both reads go through `auditedRead`, the same wrapper `readHandler` is built on, with the SAME
 * access identity each read already has on the API side, so the trail does not grow a second
 * vocabulary for the same read:
 *
 *   * the service state -- `{ administrative, serviceState, "service" }`, because the safety
 *     banner is required on every screen (Ruling 56) and must be a state that was actually read;
 *   * the plans -- `{ search, plan, "all" }`, matching `plans/route.ts`'s `GET` exactly.
 *
 * Every bad outcome fails closed and reaches `error.tsx`, which says nothing was sent and nothing
 * was changed. There is no honest fallback for either read: a caseload rendered beside a
 * service-state read that failed would claim sending is running during an incident, and a caseload
 * rendered from a failed plans read would claim a caseload that was never read.
 *
 * AN EMPTY LIST IS NOT A MISSING RESOURCE
 * --------------------------------------
 * `auditedRead` maps a `null`/`undefined` release to `denied`, which `readHandler` turns into
 * `not-found`. An empty ARRAY is neither, and is recorded as `allowed` -- an empty list IS what was
 * released. So a team with no plans renders the empty STATE on the success path and `notFound()` is
 * never reached; the only `notFound()` on this page is the production demo lock, which is a
 * different fact entirely. `tests/caring-contacts-patients-page.dom.test.tsx` pins that, because
 * `listPlans` returning `[]` and `getPlan` returning `null` look alike at a glance and the access
 * trail itself cannot tell "you may not see these" from "there are none" for a list.
 *
 * WHICH IS WHY THE CAPABILITY IS DECIDED HERE
 * ------------------------------------------
 * `listPlans` answers an actor without `viewReferral` with `[]`, exactly as it answers a team with
 * no plans -- deliberately, so nobody can probe for the existence of records they may not see. A
 * screen that only counted rows would therefore tell an auditor their team has no patients, which
 * is a false statement about a caseload. The page asks `canPerformCaringContactAction` the same
 * question the store asked, and hands the answer to the directory as `mayViewPlans` so the empty
 * list can say which of the two facts it is.
 *
 * FILTERING IS A URL
 * -----------------
 * `searchParams` is a promise in Next 16 and is awaited before use. Reading it makes the route
 * dynamic, which is already true here -- the role cookie does the same -- and is correct: a cached
 * copy of a caseload would outlive the caseload.
 */
export default async function CaringContactsPatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isCaringContactsDemoEnabled()) notFound();
  const actor = await resolveDemoActor();
  const store = await caringContactsStore();
  const filter = parsePatientsDirectoryFilter(await searchParams);

  // "service" names the one service-wide record, matching the object id the API route records
  // against -- the access trail needs one stable identifier for it, not a per-caller one.
  const serviceStateRead = await auditedRead<ServiceState>(
    store,
    actor,
    { kind: "administrative", objectType: "serviceState", objectId: "service" },
    () => store.getServiceState({ actor }),
  );
  if (serviceStateRead.outcome === "failed") {
    throw serviceStateRead.error instanceof Error
      ? serviceStateRead.error
      : new Error("Failed to read the service state.");
  }
  if (!serviceStateRead.recorded) {
    throw new Error("Caring Contacts access trail is unavailable; nothing was rendered.");
  }
  if (serviceStateRead.released === null) {
    throw new Error("caring-contacts service state read returned no record.");
  }
  const serviceState = serviceStateRead.released;

  // `"all"` is the object id a collection read names -- the actor's own team scopes what comes
  // back, so there is no single object to name. Identical to `plans/route.ts`'s `COLLECTION`.
  const plansRead = await auditedRead<PlanRecord[]>(
    store,
    actor,
    { kind: "search", objectType: "plan", objectId: "all" },
    () => store.listPlans({ actor }),
  );
  if (plansRead.outcome === "failed") {
    throw plansRead.error instanceof Error ? plansRead.error : new Error("Failed to read this team's plans.");
  }
  if (!plansRead.recorded) {
    throw new Error("Caring Contacts access trail is unavailable; nothing was rendered.");
  }
  // `listPlans` returns an array for every actor, empty where nothing is visible, so "denied" is
  // not a reachable outcome for this read. A null release here would mean the store broke that
  // contract -- fail closed rather than render a caseload from a missing answer.
  const records = plansRead.released ?? [];

  const mayViewPlans = canPerformCaringContactAction(actor, READ_ACTIONS.plan, { teamId: actor.teamId }).allowed;

  return (
    <CaringContactsShell
      title="Patients"
      description="Every patient this team holds a caring-contact plan for, and where each plan has got to. Every patient, number and message in this workspace is invented; nothing here is ever sent to a real number."
      serviceState={serviceState}
    >
      <PatientsDirectory records={records} filter={filter} mayViewPlans={mayViewPlans} />
    </CaringContactsShell>
  );
}
