import { getDifferentialRecord } from "@/lib/differentials";
import type { FavouriteContentType } from "@/lib/favourites-contract";
import { PublicApiError } from "@/lib/http";
import { defaultRegistryRecords } from "@/lib/registry-seed";
import { createAdminClient } from "@/lib/supabase/admin";
import { therapyRecordExists } from "@/lib/therapies";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Verifies that a persisted favourite points to a canonical, accessible content record. */
export async function requireCanonicalFavouriteReference(
  supabase: AdminClient,
  userId: string,
  contentType: FavouriteContentType,
  contentKey: string,
) {
  if (contentType === "therapy") {
    if (therapyRecordExists(contentKey)) return;
  } else if (contentType === "differential") {
    if (getDifferentialRecord(contentKey)) return;
  } else {
    const sharedExists = defaultRegistryRecords(contentType).some((record) => record.slug === contentKey);
    if (sharedExists) return;
    const { data, error } = await supabase
      .from("clinical_registry_records")
      .select("id")
      .eq("owner_id", userId)
      .eq("kind", contentType)
      .eq("slug", contentKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return;
  }
  throw new PublicApiError("Favourite content was not found.", 422, { code: "favourite_content_not_found" });
}
