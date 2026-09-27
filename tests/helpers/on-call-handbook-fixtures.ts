import { vi } from "vitest";

import type { HospitalHandbookState } from "@/components/on-call/use-hospital-handbook";
import { publishedHandbookItems, type HandbookItem } from "@/lib/on-call/handbook-items";
import type { ServiceEntry } from "@/lib/on-call/service-model";

/**
 * Synthetic hospital handbooks for the Now and Who's on DOM tests. Every number
 * is a 9000 00xx placeholder or the synthetic short code 55; nothing here is a
 * real hospital's.
 */

export const SITE = "30000000-0000-4000-8000-00000000000a";
export const OTHER_SITE = "30000000-0000-4000-8000-00000000000b";
const SOURCE = [{ label: "Synthetic hospital policy", url: "https://example.org/synthetic-policy" }];

export type HandbookRow = {
  readonly id: string;
  readonly title: string;
  readonly phone?: string;
  readonly body?: string;
  readonly section?: ServiceEntry["content"]["section"];
  readonly kind?: ServiceEntry["content"]["kind"];
  readonly siteId?: string | null;
  readonly phase?: ServiceEntry["content"]["orientationPhase"];
};

export function handbookItems(rows: readonly HandbookRow[]): HandbookItem[] {
  return publishedHandbookItems({
    entries: rows.map((row) => {
      const content = {
        siteId: row.siteId === undefined ? SITE : row.siteId,
        section: row.section ?? "contacts",
        kind: row.kind ?? "operational",
        title: row.title,
        body: row.body ?? "Synthetic example only",
        phone: row.phone ?? "",
        sources: row.kind === "clinical" ? SOURCE : [],
        orientationPhase: row.phase ?? "first_shift",
      } as ServiceEntry["content"];
      return {
        id: row.id,
        revision: 1,
        publishedRevision: 1,
        content,
        publishedContent: content,
        status: "published",
        authorId: null,
        reviewedBy: null,
        reviewedAt: row.kind === "clinical" ? "2026-09-20T04:00:00.000Z" : null,
        reviewComment: "",
        updatedAt: "2026-09-20T04:00:00.000Z",
      } as unknown as ServiceEntry;
    }),
  });
}

export function readyHandbook(
  items: readonly HandbookItem[],
  over: Partial<HospitalHandbookState> = {},
): HospitalHandbookState {
  return {
    status: "ready",
    demo: false,
    services: [],
    serviceId: "svc",
    siteId: SITE,
    serviceName: "Synthetic Hospital Service",
    siteName: "Synthetic Hospital",
    hospitals: [],
    hospitalKey: `svc:${SITE}`,
    items,
    removed: [],
    emergencyPinExpected: null,
    source: "network",
    savedAt: null,
    error: null,
    choose: vi.fn(),
    changeHospital: vi.fn(),
    retry: vi.fn(),
    report: vi.fn(async () => "sent" as const),
    hasReported: () => false,
    onRosteredSiteMismatch: vi.fn(),
    ...over,
  };
}
