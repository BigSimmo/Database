import { formRecords } from "@/lib/forms";
import { catalogPayloadBySlug, loadServicesSnapshot } from "@/lib/service-catalog";
import { mapCatalogToServiceRecords } from "@/lib/service-catalog-mapper";
import { recordToRow, type RegistryRecordInsert } from "@/lib/registry-records";
import type { ServiceRecord } from "@/lib/services";

let cachedServiceRecords: ServiceRecord[] | null = null;

/** The curated default service fixtures — the same set the CLI seeds and the
 *  API falls back to when an owner has no records yet. */
export function defaultServiceRecords(): ServiceRecord[] {
  if (cachedServiceRecords) return cachedServiceRecords;
  const snapshot = loadServicesSnapshot();
  cachedServiceRecords = mapCatalogToServiceRecords(snapshot.services);
  return cachedServiceRecords;
}

export function catalogPayloadForSlug(slug: string) {
  return catalogPayloadBySlug().get(slug.trim().toLowerCase()) ?? null;
}

/** Build insertable registry rows for an owner from the default service fixtures. */
export function buildDefaultServiceRows(ownerId: string): RegistryRecordInsert[] {
  const payloads = catalogPayloadBySlug();
  return defaultServiceRecords().map((record) => {
    const row = recordToRow(record, ownerId, "service");
    const payload = payloads.get(record.slug);
    return payload ? { ...row, catalog_payload: payload } : row;
  });
}

/** Build insertable registry rows for forms from the default fixtures. */
export function buildDefaultFormRows(ownerId: string): RegistryRecordInsert[] {
  return formRecords.map((record) => recordToRow(record, ownerId, "form"));
}
