import { deriveGovernanceColumns } from "@/lib/registry-records";
import { getServiceRecord, serviceRecords, type ServiceRecord } from "@/lib/services";
import { isRetainedBootstrapReleaseId } from "@/lib/site-content/site-content-health";

/**
 * Keep Services mode reachable while the served release is still the epoch-zero freeze.
 *
 * WHY THIS EXISTS, measured against production on 2026-09-17.
 * -----------------------------------------------------------
 * `20260916190000` made `read_site_content_public_records` fast again (8,656 ms mean ->
 * 133 ms for a services search). Until it landed, that read was blowing its budget on every
 * call, `readCatalogueWithSeedFallback` was returning the in-bundle catalogue, and the group
 * was flagged `degraded`. The moment the read started completing, search began answering from
 * the frozen 2026-08-24 release — 843 records — and the 17 service records added by #2814
 * stopped appearing at all:
 *
 *     "sexual assault"  ->  Sexual Assault Resource Centre (SARC) was result #1, now absent
 *     "suicide"         ->  StandBy Support After Suicide was result #1, now absent
 *     "1800respect"     ->  no results at all
 *
 * Those are crisis and suicide-postvention services: SARC, 1800RESPECT, Thirrili, Culture Care
 * Connect, ARBOR, CYPRESS, StandBy and the Aftercare Services Program among them. Their detail
 * pages still render (the page is server-rendered from this same in-repo catalogue), so the
 * content was never lost — only its findability was, and Services mode is search-first, so
 * search is the only route to it. Fixing a latency defect should not remove crisis services
 * from a clinician's search results.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a publication, and it does not pretend to be one. Catalogue growth reaches live
 * through the publication pipeline in `docs/site-content-sync-runbook.md` and nowhere else;
 * that pipeline has never been run (zero publications, zero sync events,
 * `site_content_sync_state.initialized = false` as of 2026-09-17), and running it for the first
 * time is a seven-step, administrator-driven job. This is the stopgap that holds until it does.
 *
 * THE GATE IS THE WHOLE DESIGN
 * ----------------------------
 * Everything here is inert unless the served release is a retained epoch-zero bootstrap
 * identity (`isRetainedBootstrapReleaseId`). The moment an operator publishes and activates a
 * real release, that release wins and every function below becomes a no-op — the same gate
 * `preferBundledFormRecord` uses, and for the same reason: otherwise every future
 * clinician-reviewed publish would keep losing to the bundle. A stopgap that removes itself is
 * the only kind worth shipping.
 *
 * TWO DIFFERENT DEFECTS, TWO DIFFERENT FIXES
 * ------------------------------------------
 * `preferBundledServiceRecord` refreshes a record the release already has, and is the exact
 * analogue of `preferBundledFormRecord`. It covers the ~9 services whose contact details were
 * re-verified after the freeze: same slug, stale payload.
 *
 * `bundledServicesMissingFrom` is the genuinely new half, and it is new because the Forms
 * mechanism cannot do it: `preferBundledFormRecord` looks the bundled record up BY the slug of
 * a record the database already returned, so it can only ever swap a payload, never introduce a
 * record the release does not contain. The 17 additions need this instead.
 *
 * GOVERNANCE MUST FOLLOW THE CONTENT
 * ----------------------------------
 * A topped-up record has no canonical governance row, because it has no canonical row at all.
 * `bundledServiceGovernance` derives `sourceStatus` from the record's own source the way the
 * seed path already does — that describes the publisher's page, which is true whether or not
 * this catalogue has been published — and pins `validationStatus` to `unverified` regardless of
 * what the record claims locally. These records have not been through the governed pipeline, so
 * they must never carry a sign-off label, and `unverified` is the conservative value the enum
 * already has. Same reasoning, and the same narrowing, as the Forms path.
 */

/** The governance a record served from the bundle alone may claim. Never a sign-off. */
export function bundledServiceGovernance(record: ServiceRecord): {
  sourceStatus: string;
  validationStatus: string;
} {
  const derived = deriveGovernanceColumns(record);
  // sourceStatus stays derived: it describes the publisher's page, which publication does not change.
  // validationStatus is pinned rather than derived: nothing here has been published or signed off.
  return { sourceStatus: derived.source_status, validationStatus: "unverified" };
}

/**
 * Swap a canonical service payload for the in-repo one while the release is a retained
 * bootstrap. Mirrors `preferBundledFormRecord`. Returns `mapped` untouched otherwise.
 */
export function preferBundledServiceRecord<
  T extends { record: ServiceRecord; governance?: { validationStatus?: string } },
>(mapped: T, options?: { activeReleaseId?: string | null }): T {
  const activeReleaseId = options?.activeReleaseId;
  if (!activeReleaseId || !isRetainedBootstrapReleaseId(activeReleaseId)) return mapped;
  const bundled = getServiceRecord(mapped.record.slug);
  if (!bundled) return mapped;
  const swapped = { ...mapped, record: bundled } as T;
  if (!mapped.governance) return swapped;
  // The swapped-in text has not been published, so it cannot keep the release's sign-off label.
  return { ...swapped, governance: { ...mapped.governance, validationStatus: "unverified" } } as T;
}

/**
 * In-repo service records the served release does not contain, while that release is a retained
 * bootstrap. Empty in every other state, including once a real release is active.
 *
 * Slug comparison is on `record.slug` as both sides already store it; callers pass the records
 * they are about to serve, so a record swapped by `preferBundledServiceRecord` is matched by the
 * same slug and is not duplicated.
 */
export function bundledServicesMissingFrom(
  records: readonly ServiceRecord[],
  options?: { activeReleaseId?: string | null },
): ServiceRecord[] {
  const activeReleaseId = options?.activeReleaseId;
  if (!activeReleaseId || !isRetainedBootstrapReleaseId(activeReleaseId)) return [];
  const present = new Set(records.map((record) => record.slug));
  return serviceRecords.filter((record) => !present.has(record.slug));
}
