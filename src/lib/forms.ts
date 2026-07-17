import { mapFormCatalogToRecords } from "@/lib/form-catalog";
import { rankFormRecords, type FormRecord, type FormSearchMatch } from "@/lib/form-ranker";

export * from "@/lib/form-ranker";

export const formRecords: FormRecord[] = mapFormCatalogToRecords();

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function getFormRecord(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  return formRecords.find((form) => form.slug === normalizedSlug) ?? null;
}

export function formStaticParams() {
  return formRecords.map((form) => ({ slug: form.slug }));
}

export function defaultFormSlug() {
  return formRecords[0]?.slug ?? null;
}

export function searchFormRecords(query: string, limit = formRecords.length): FormSearchMatch[] {
  return rankFormRecords(formRecords, query, limit);
}
