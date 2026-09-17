import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import {
  differentialRecords,
  getDifferentialRecord,
  getPresentationWorkflow,
  scopeDifferentialRecord,
  scopePresentationWorkflow,
} from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { readCanonicalSiteContentRecords } from "@/lib/site-content/site-content-publication";

/**
 * Canonical published payloads were seeded from the deliberately unlabelled
 * snapshot, so a live read returns records with no `clinicalHingeScope` and no
 * section `scope`. The UI defaults an absent scope to diagnosis-specific, which
 * would put the akathisia discriminator back under acute dystonia on exactly the
 * path real requests take. Every canonical record is relabelled on the way out.
 * See `scopeDifferentialRecord` in `@/lib/differentials`.
 */
export const readPresentationCandidateRecords = cache(async (slugs: readonly string[]) => {
  const requested = new Set(slugs);
  if (isDemoMode() || isLocalNoAuthMode()) return differentialRecords.filter((record) => requested.has(record.slug));
  await connection();
  const { records } = await readCanonicalSiteContentRecords({
    supabase: createAdminClient(),
    kind: "differential",
    slug: null,
    seeds: differentialRecords,
    // A LIST read: it pulls the whole differential catalogue and filters in memory, so it is the
    // same shared, public, non-owner-scoped read search caches. The per-slug reads below stay
    // uncached on purpose, so an operator publishing a record sees it on its detail page at once.
    cache: true,
  });
  return records.filter((record) => requested.has(record.slug)).map(scopeDifferentialRecord);
});

/** A page and its metadata read the same public publication within one request. */
export const readDifferentialPageRecord = cache(async (slug: string) => {
  const seed = getDifferentialRecord(slug);
  if (isDemoMode() || isLocalNoAuthMode()) return seed;
  await connection();
  const { records } = await readCanonicalSiteContentRecords({
    supabase: createAdminClient(),
    kind: "differential",
    slug,
    seeds: seed ? [seed] : [],
  });
  const record = records[0];
  return record ? scopeDifferentialRecord(record) : null;
});

export const readPresentationPageRecord = cache(async (slug: string) => {
  const seed = getPresentationWorkflow(slug);
  if (isDemoMode() || isLocalNoAuthMode()) return seed;
  await connection();
  const { records } = await readCanonicalSiteContentRecords({
    supabase: createAdminClient(),
    kind: "presentation",
    slug,
    seeds: seed ? [{ workflow: seed }] : [],
    mapRecord: ({ finalRenderPayload }) => ({
      workflow: finalRenderPayload as unknown as NonNullable<typeof seed>,
    }),
  });
  const workflow = records[0]?.workflow;
  return workflow ? scopePresentationWorkflow(workflow) : null;
});
