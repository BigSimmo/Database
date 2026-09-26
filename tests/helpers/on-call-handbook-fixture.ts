import { vi } from "vitest";

import type { HospitalHandbookState } from "@/components/on-call/use-hospital-handbook";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { publishedHandbookItems, type HandbookItem } from "@/lib/on-call/handbook-items";
import type { ServiceContent, ServiceEntry } from "@/lib/on-call/service-model";

/**
 * Handbook fixtures for lane B's page tests (Call, Refer, Find). Every row is
 * synthetic (Global Constraint 9): "Site A", hospital lines `9000 00xx`, short
 * codes like `4456`, and a body that always carries "Synthetic example only".
 */
export const FIXTURE_SITE_ID = "00000000-0000-4000-8000-00000000000a";
export const FIXTURE_UPDATED_AT = "2026-09-20T04:00:00.000Z";

export type FixtureRow = {
  readonly id: string;
  readonly title: string;
  readonly phone?: string;
  readonly section?: ServiceContent["section"];
  readonly kind?: ServiceContent["kind"];
  /** Appended to with "Synthetic example only", so every row carries the marker. */
  readonly body?: string;
  readonly siteId?: string | null;
};

const MARKER = "Synthetic example only";

export function entryFor(row: FixtureRow): ServiceEntry {
  const content: ServiceContent = {
    siteId: row.siteId === undefined ? FIXTURE_SITE_ID : row.siteId,
    section: row.section ?? "contacts",
    kind: row.kind ?? "operational",
    title: row.title,
    body: row.body ? `${row.body}\n${MARKER}` : MARKER,
    phone: row.phone ?? "",
    sources: [{ label: "Synthetic hospital procedure", url: "https://example.org/synthetic-procedure" }],
    orientationPhase: "first_shift",
  };
  return {
    id: row.id,
    revision: 1,
    publishedRevision: 1,
    content,
    publishedContent: content,
    status: "published",
    authorId: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: "",
    updatedAt: FIXTURE_UPDATED_AT,
  };
}

export function items(rows: readonly FixtureRow[]): HandbookItem[] {
  return publishedHandbookItems({ entries: rows.map(entryFor) });
}

/** A handbook hook state, ready by default, at "Site A". `report` and `hasReported` are spies. */
export function ready(list: readonly HandbookItem[], overrides: Partial<HospitalHandbookState> = {}) {
  const state = {
    status: "ready",
    demo: false,
    services: [],
    serviceId: "00000000-0000-4000-8000-00000000000b",
    siteId: FIXTURE_SITE_ID,
    serviceName: "Synthetic Health Service",
    siteName: "Site A",
    hospitals: [],
    hospitalKey: `00000000-0000-4000-8000-00000000000b:${FIXTURE_SITE_ID}`,
    items: list,
    removed: [],
    emergencyPinExpected: null,
    source: "network",
    savedAt: null,
    error: null,
    choose: vi.fn(),
    changeHospital: vi.fn(),
    retry: vi.fn(),
    report: vi.fn(async () => "sent" as const),
    hasReported: vi.fn(() => false),
    onRosteredSiteMismatch: vi.fn(),
    ...overrides,
  } satisfies HospitalHandbookState;
  return state as HospitalHandbookState & {
    report: ReturnType<typeof vi.fn>;
    hasReported: ReturnType<typeof vi.fn>;
  };
}

function personalEntry(id: string, section: OnCallEntry["section"], title: string, details: unknown): OnCallEntry {
  return {
    id,
    slug: id,
    section,
    title,
    subtitle: null,
    body: null,
    details,
    linkedDocumentIds: [],
    tags: [],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: FIXTURE_UPDATED_AT,
  } as unknown as OnCallEntry;
}

/** The reader's own contact, as the entries store returns it. */
export function personalContact(id: string, title: string, phone: string): OnCallEntry {
  return personalEntry(id, "contacts", title, { role: title, phone });
}

/** The reader's own referral note. */
export function personalReferral(id: string, title: string): OnCallEntry {
  return personalEntry(id, "referrals", title, { accepts: [], exclusions: [] });
}

/** The entries hook's return value, for a `vi.mock` of `@/lib/on-call/entry-store`. */
export function entriesState(list: readonly OnCallEntry[], overrides: Record<string, unknown> = {}) {
  return {
    entries: [...list],
    loading: false,
    isOffline: false,
    signedOut: false,
    cachedAt: null,
    loadError: null,
    retry: vi.fn(),
    demoMode: false,
    ...overrides,
  };
}
