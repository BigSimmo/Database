import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { getDifferentialRecord, getPresentationWorkflow } from "@/lib/differentials";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { readCanonicalSiteContentRecords } from "@/lib/site-content/site-content-publication";

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
  return records[0] ?? null;
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
  return records[0]?.workflow ?? null;
});
