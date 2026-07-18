import { defaultServiceRecords } from "@/lib/registry-fixtures";
import { rankServiceRecords, type ServiceRecord, type ServiceSearchMatch } from "@/lib/service-ranker";

export * from "@/lib/service-ranker";

export const serviceRecords: ServiceRecord[] = defaultServiceRecords();

export function loadServiceRecords(): ServiceRecord[] {
  return defaultServiceRecords();
}

export function getServiceRecord(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  return serviceRecords.find((service) => service.slug === normalizedSlug) ?? null;
}

export function serviceStaticParams() {
  return serviceRecords.map((service) => ({ slug: service.slug }));
}

export function defaultServiceSlug() {
  return serviceRecords[0]?.slug ?? null;
}

export function searchServiceRecords(query: string, limit = serviceRecords.length): ServiceSearchMatch[] {
  return rankServiceRecords(serviceRecords, query, limit);
}
