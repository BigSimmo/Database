/**
 * Boot-time pre-warm for the catalogue search path.
 *
 * WHY. The live domain monitor (#2919) fails against an idle process because the first catalogue
 * read after idle pays ~1.3–1.8 s of connection setup and blows the 1200 ms search budget; the
 * per-kind cold retry in `catalogue-seed-fallback.ts` helps one domain, but `universal-search`
 * Promise.all's forms/services/medications and still triple-cold-starts. Populating the process
 * cache (and marking the connection warm) before the first request means no user-facing read is
 * ever the first. Failures are swallowed the same way as `warmEnabledRagAliasCache`: the first
 * real search still has the serialisation gate and the one-shot retry.
 *
 * KINDS ARE READ SERIALLY ON PURPOSE. Parallel warm would recreate the bug this exists to prevent.
 * A narrowed search projection (keeping ranker render fields) remains the right efficiency follow-up
 * but needs a migration; this helper is deliberately app-side only and does not raise `budget_ms`.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { markCatalogueProcessConnectionWarmed } from "@/lib/site-content/catalogue-seed-fallback";
import { readCanonicalSiteContentRecords } from "@/lib/site-content/site-content-publication";

/** The three registry domains universal-search Promise.all's on a federated catalogue query. */
export const catalogueSearchWarmKinds = ["form", "service", "medication"] as const;

export async function warmCanonicalCatalogueSearchCaches(
  supabase: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<void> {
  for (const kind of catalogueSearchWarmKinds) {
    try {
      await readCanonicalSiteContentRecords({
        supabase,
        kind,
        slug: null,
        cache: true,
        // Seeds are unused on a successful RPC; an empty list is enough for warm-only.
        seeds: [],
      });
      // First success opens the process-level cold gate for any concurrent first search.
      markCatalogueProcessConnectionWarmed();
    } catch (error) {
      console.warn("Canonical catalogue cache warmup failed; first search will retry.", {
        catalogue_kind: kind,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
