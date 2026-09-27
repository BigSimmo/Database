import type { HealthServiceCode, WhatsOnRow } from "@/lib/teaching/model";

/*
 * Pure shaping for What's on (spec §5a, master plan R4). Read-only: the server
 * chooses which sessions the reader sees (their own service, plus anything
 * another service has opened to the shared health service); this file only
 * names, filters and segments the rows it is given.
 */

/** F1: whether a session is for the reader's level. Absent until parts 1 and 2 send it. */
export type WhatsOnRowRead = WhatsOnRow & { forMyLevel?: boolean };
export type WhatsOnFilter = "all" | "level" | "online";

export const HEALTH_SERVICE_NAMES: Record<HealthServiceCode, string> = {
  nmhs: "North Metropolitan Health Service",
  smhs: "South Metropolitan Health Service",
  emhs: "East Metropolitan Health Service",
  wachs: "WA Country Health Service",
  cahs: "Child and Adolescent Health Service",
  demo: "Demo health service",
};

export function whatsOnHeading(codes: readonly HealthServiceCode[]): string {
  return codes.length === 0 ? "Your services" : codes.map((code) => HEALTH_SERVICE_NAMES[code]).join(" and ");
}

/** "My level" only shows once the server sends `forMyLevel` on at least one row (F1). */
export function whatsOnFilters(rows: readonly WhatsOnRowRead[]): { value: WhatsOnFilter; label: string }[] {
  const level = rows.some((row) => row.forMyLevel !== undefined);
  return [
    { value: "all", label: "All" },
    ...(level ? [{ value: "level" as const, label: "My level" }] : []),
    { value: "online", label: "Online" },
  ];
}

export function filterWhatsOn(rows: readonly WhatsOnRowRead[], filter: WhatsOnFilter): WhatsOnRowRead[] {
  if (filter === "online") return rows.filter((row) => row.joinUrl !== null);
  if (filter === "level") return rows.filter((row) => row.forMyLevel === true);
  return [...rows];
}

export function onNow(rows: readonly WhatsOnRowRead[], now: Date): WhatsOnRowRead[] {
  const at = now.getTime();
  return rows.filter(
    (row) => row.status !== "cancelled" && Date.parse(row.startsAt) <= at && at < Date.parse(row.endsAt),
  );
}
