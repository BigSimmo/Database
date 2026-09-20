import { describe, expect, it, vi } from "vitest";
import { PublicApiError } from "@/lib/http";
import { ON_CALL_SECTIONS, onCallDetailsSchemaFor } from "@/lib/on-call/entry-model";
import {
  COMPLIANCE_MARKER_KEYS,
  PUBLIC_ON_CALL_SECTIONS,
  assertValidLinkedDocumentIds,
  fetchOwnerOnCallEntries,
  fetchSharedOnCallEntries,
  fetchVisibleOnCallEntries,
  onCallEntryToRow,
  rowToOnCallEntry,
} from "@/lib/on-call/repository";

function fakeClient(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return { from: vi.fn(() => chain), chain };
}

const SHARED_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  section: "contacts",
  slug: "s1",
  title: "Switchboard",
  subtitle: null,
  body: null,
  details: {},
  linked_document_ids: [],
  tags: [],
  is_personal: false,
  include_on_card: false,
  sort_order: 0,
  last_verified_at: null,
};

const PERSONAL_ROW = {
  id: "22222222-2222-4222-8222-222222222222",
  section: "contacts",
  slug: "s2",
  title: "Consultant mobile",
  subtitle: null,
  body: null,
  details: {},
  linked_document_ids: [],
  tags: [],
  is_personal: true,
  include_on_card: false,
  sort_order: 0,
  last_verified_at: null,
};

describe("fetchOwnerOnCallEntries", () => {
  it("filters by owner_id on the same chain as from()", async () => {
    const client = fakeClient([]);
    await fetchOwnerOnCallEntries(client as never, "owner-1");
    expect(client.from).toHaveBeenCalledWith("on_call_entries");
    expect(client.chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
  });

  it("refuses to run without an owner rather than returning another tenant's rows", async () => {
    const client = fakeClient([]);
    await expect(fetchOwnerOnCallEntries(client as never, "")).rejects.toThrow(/owner/i);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("fetchSharedOnCallEntries", () => {
  // The safety-critical assertion of the public-visibility change. On Call entries are
  // world-readable, so this read must never be able to return an entry the editor marked
  // "Private — only you". A world-readable fetch is an export, which is what that
  // control promises to keep the row out of.
  it("filters out personal entries on the same chain as from()", async () => {
    const client = fakeClient([]);
    await fetchSharedOnCallEntries(client as never);
    expect(client.from).toHaveBeenCalledWith("on_call_entries");
    expect(client.chain.eq).toHaveBeenCalledWith("is_personal", false);
  });

  it("never narrows by owner, because there is no viewer to narrow to", async () => {
    const client = fakeClient([]);
    await fetchSharedOnCallEntries(client as never);
    expect(client.chain.eq).not.toHaveBeenCalledWith("owner_id", expect.anything());
  });

  it("still applies a section filter alongside the personal-entry exclusion", async () => {
    const client = fakeClient([]);
    await fetchSharedOnCallEntries(client as never, { section: "playbook" });
    expect(client.chain.eq).toHaveBeenCalledWith("is_personal", false);
    expect(client.chain.eq).toHaveBeenCalledWith("section", "playbook");
  });
});

/**
 * The control that keeps a doctor's own regulatory record off a public page.
 *
 * On Call has no login wall: `GET /api/on-call/entries` answers anonymous
 * callers, and the 2026-09-04 decision that made it do so was about ward
 * numbers and escalation ladders. The Compliance page stores registration,
 * indemnity, credentialing, Working with Children Check and police-clearance
 * records for one named person, and often a link to the certificate. The
 * editor stores those rows private, but the flag is a setting and settings can
 * be changed, imported around, or edited directly in the database — so the
 * read itself refuses, on the raw row, before anything is parsed.
 *
 * Every case below is a way that refusal could be got around. If one of these
 * ever goes green by being deleted rather than by being fixed, the thing that
 * leaks is somebody's Ahpra registration.
 */
/**
 * The control that was missing when the compliance leak happened.
 *
 * A security review put it plainly: the leak was not a coding mistake. Every
 * line of the shared read was correct. A page holding a doctor's registration
 * and police clearance was added to a section that had been made public a
 * fortnight earlier for ward phone numbers, and nothing anywhere required
 * anyone to re-decide. No test went red, because no test asserted what the
 * public read is ALLOWED to return — only what it happened to return.
 *
 * These cases are that assertion. They are deliberately about the shape of the
 * answer rather than today's data, so the next section and the next column are
 * withheld until somebody names them on purpose.
 */
describe("fetchSharedOnCallEntries is deny-by-default", () => {
  it("asks the database for an explicit list of publishable sections", async () => {
    const client = fakeClient([]);
    await fetchSharedOnCallEntries(client as never);
    expect(client.chain.in).toHaveBeenCalledWith("section", [...PUBLIC_ON_CALL_SECTIONS]);
  });

  it("publishes fewer sections than the schema allows, or exactly as many — never more", () => {
    // The allow-list may lag the union deliberately; it may never lead it. A
    // value here that is not a real section is a typo that silently withholds
    // a whole page, which is the failure this direction catches.
    for (const section of PUBLIC_ON_CALL_SECTIONS) {
      expect(ON_CALL_SECTIONS as readonly string[]).toContain(section);
    }
  });

  it("withholds a seventh section until it is named, rather than publishing it on arrival", () => {
    // The forcing function. Adding a value to `ON_CALL_SECTIONS` must not
    // publish it: this goes red, and whoever adds the section has to decide,
    // in writing, whether a stranger may read it.
    const undeclared = (ON_CALL_SECTIONS as readonly string[]).filter(
      (section) => !(PUBLIC_ON_CALL_SECTIONS as readonly string[]).includes(section),
    );
    expect(
      undeclared,
      `${undeclared.join(", ")} can be stored but is not in PUBLIC_ON_CALL_SECTIONS. ` +
        "Decide whether an anonymous reader may see it, then add it there with a reason — or leave it out on purpose " +
        "and update this expectation.",
    ).toEqual([]);
  });

  it("returns an explicit set of fields, so a new column is not published by being added", async () => {
    const client = fakeClient([SHARED_ROW]);
    const [entry] = await fetchSharedOnCallEntries(client as never);
    // `details` is the one field whose CONTENTS are free-form, which is exactly
    // how the compliance data arrived; the row-level predicate above is what
    // guards it. This list guards the rest.
    expect(Object.keys(entry).sort()).toEqual(
      [
        "body",
        "details",
        "id",
        "includeOnCard",
        "isPersonal",
        "lastVerifiedAt",
        "linkedDocumentIds",
        "section",
        "slug",
        "sortOrder",
        "subtitle",
        "tags",
        "title",
      ].sort(),
    );
  });
});

describe("fetchSharedOnCallEntries and compliance requirements", () => {
  function logisticsRow(id: string, details: unknown, overrides: Record<string, unknown> = {}) {
    return {
      id,
      section: "logistics",
      slug: `row-${id.slice(0, 4)}`,
      title: `Row ${id.slice(0, 4)}`,
      subtitle: null,
      body: null,
      details,
      linked_document_ids: [],
      tags: [],
      is_personal: false,
      include_on_card: false,
      sort_order: 0,
      last_verified_at: null,
      ...overrides,
    };
  }

  const ADMIN_ROW = logisticsRow("33333333-3333-4333-8333-333333333333", { category: "Leave" });

  it("withholds a compliance requirement even when it is not flagged personal", async () => {
    const row = logisticsRow("44444444-4444-4444-8444-444444444444", {
      category: "Registration",
      kind: "compliance",
      consequence: "stops-work",
      expiresOn: "2027-03-12",
    });
    const client = fakeClient([ADMIN_ROW, row]);
    const entries = await fetchSharedOnCallEntries(client as never);
    expect(entries.map((entry) => entry.id)).toEqual([ADMIN_ROW.id]);
  });

  it("still returns ordinary admin rows, so the filter is not simply excluding the section", async () => {
    const client = fakeClient([ADMIN_ROW]);
    const entries = await fetchSharedOnCallEntries(client as never);
    expect(entries).toHaveLength(1);
  });

  it("withholds a row whose kind is misspelt, because the parsed entry would call it ordinary admin", async () => {
    // `rowToOnCallEntry` nulls details that fail their schema, so a capital C
    // here makes `isComplianceEntry` answer false. Asking the parsed entry
    // would publish exactly the rows most likely to be malformed.
    const row = logisticsRow("55555555-5555-4555-8555-555555555555", {
      category: "Registration",
      kind: "Compliance",
      expiresOn: "2027-03-12",
    });
    const client = fakeClient([row]);
    expect(await fetchSharedOnCallEntries(client as never)).toEqual([]);
  });

  it("withholds a logistics row whose details cannot be read at all", async () => {
    const client = fakeClient([logisticsRow("66666666-6666-4666-8666-666666666666", null)]);
    expect(await fetchSharedOnCallEntries(client as never)).toEqual([]);
  });

  it("withholds a logistics row whose details are an array", async () => {
    // `typeof [] === "object"` and an array has no `kind`, so the first version
    // of this predicate called an array an ordinary Admin row and published it.
    const client = fakeClient([logisticsRow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [])]);
    expect(await fetchSharedOnCallEntries(client as never)).toEqual([]);
  });

  it("withholds a requirement that carries compliance fields but has lost its kind", async () => {
    // The case that made `kind` alone insufficient, and the reason this file
    // has a guard below. `kind` is optional in `logisticsDetails`, so this row
    // is SCHEMA-VALID: it parses, its details survive `rowToOnCallEntry`
    // intact, and the old predicate published the expiry, the issuing body and
    // the link to the certificate to anyone who called the endpoint.
    const row = logisticsRow("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
      category: "Registration",
      consequence: "stops-work",
      expiresOn: "2027-03-12",
      issuingBody: "Ahpra",
      evidenceUrl: "https://example.org/certificate.pdf",
    });
    expect(onCallDetailsSchemaFor("logistics").safeParse(row.details).success).toBe(true);
    const client = fakeClient([row]);
    expect(await fetchSharedOnCallEntries(client as never)).toEqual([]);
  });

  it.each(COMPLIANCE_MARKER_KEYS)("withholds a logistics row carrying %s on its own", async (key) => {
    const row = logisticsRow("cccccccc-cccc-4ccc-8ccc-cccccccccccc", { category: "Leave", [key]: "anything" });
    const client = fakeClient([row]);
    expect(await fetchSharedOnCallEntries(client as never)).toEqual([]);
  });

  it("still publishes an admin row that uses only the ordinary admin fields", async () => {
    // The other half of the guard: widening the predicate must not quietly
    // withhold the section it was made public for.
    const row = logisticsRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      category: "Facilities",
      location: "Level 3",
      hours: "0800-1630",
      phone: "1234",
      url: "https://example.org/parking",
    });
    const client = fakeClient([row]);
    expect((await fetchSharedOnCallEntries(client as never)).map((entry) => entry.id)).toEqual([row.id]);
  });

  /**
   * Deny by default for FIELDS, the same discipline `PUBLIC_ON_CALL_SECTIONS`
   * applies to sections.
   *
   * Adding a field to `logisticsDetails` is how the leak above happened: the
   * compliance fields were added to a section that had been made public a
   * fortnight earlier, and nothing required anyone to re-decide. This fails
   * until the new key is sorted into one list or the other on purpose.
   */
  it("classifies every logistics detail field as either a compliance marker or admin-safe", () => {
    const ADMIN_SAFE_KEYS = ["category", "location", "hours", "phone", "url"];
    const schema = onCallDetailsSchemaFor("logistics") as unknown as { shape: Record<string, unknown> };
    const declared = Object.keys(schema.shape).sort();
    const classified = [...COMPLIANCE_MARKER_KEYS, ...ADMIN_SAFE_KEYS].sort();
    expect(declared).toEqual(classified);
  });

  it("leaves rows in other sections alone, whatever their details carry", async () => {
    // Who's who rides `details.kind` on contacts and is deliberately public.
    const roleExplainer = {
      ...logisticsRow("77777777-7777-4777-8777-777777777777", { kind: "role-explainer" }),
      section: "contacts",
    };
    const client = fakeClient([roleExplainer]);
    expect(await fetchSharedOnCallEntries(client as never)).toHaveLength(1);
  });

  it("does not hide the requirement from its owner", async () => {
    const row = logisticsRow("88888888-8888-4888-8888-888888888888", {
      category: "Registration",
      kind: "compliance",
    });
    const client = fakeClient([row]);
    const entries = await fetchOwnerOnCallEntries(client as never, "owner-1");
    expect(entries.map((entry) => entry.id)).toEqual([row.id]);
  });
});

describe("fetchVisibleOnCallEntries", () => {
  it("returns only the shared set for an anonymous viewer", async () => {
    const client = fakeClient([SHARED_ROW]);
    const entries = await fetchVisibleOnCallEntries(client as never, undefined);
    expect(entries.map((entry) => entry.title)).toEqual(["Switchboard"]);
    expect(client.chain.eq).not.toHaveBeenCalledWith("owner_id", expect.anything());
  });

  it("adds the viewer's own entries, including the personal ones the shared read withholds", async () => {
    // One fake client answers both queries; the rows returned stand in for the union the
    // two reads produce against a real database.
    const client = fakeClient([SHARED_ROW, PERSONAL_ROW]);
    const entries = await fetchVisibleOnCallEntries(client as never, "owner-1");
    expect(client.chain.eq).toHaveBeenCalledWith("is_personal", false);
    expect(client.chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(entries.map((entry) => entry.title).sort()).toEqual(["Consultant mobile", "Switchboard"]);
  });

  it("returns one object per entry when both reads see the same row", async () => {
    const client = fakeClient([SHARED_ROW]);
    const entries = await fetchVisibleOnCallEntries(client as never, "owner-1");
    expect(entries).toHaveLength(1);
  });
});

/**
 * The write-side half of the same control. The client editor stores compliance
 * rows private; this does not trust it, because an authenticated caller can
 * send whatever body they like straight to the API.
 */
describe("onCallEntryToRow and compliance requirements", () => {
  function entryFor(details: unknown, isPersonal: boolean) {
    return {
      id: "99999999-9999-4999-8999-999999999999",
      section: "logistics",
      slug: "medical-registration",
      title: "Medical registration",
      subtitle: null,
      body: null,
      details,
      linkedDocumentIds: [],
      tags: [],
      isPersonal,
      includeOnCard: false,
      sortOrder: 0,
      lastVerifiedAt: null,
    } as unknown as Parameters<typeof onCallEntryToRow>[0];
  }

  it("stores a compliance requirement private even when the caller asked for it to be shared", () => {
    const row = onCallEntryToRow(entryFor({ category: "Registration", kind: "compliance" }, false), "owner-1");
    expect(row.is_personal).toBe(true);
  });

  it("leaves an ordinary admin row's own choice alone", () => {
    expect(onCallEntryToRow(entryFor({ category: "Facilities" }, false), "owner-1").is_personal).toBe(false);
    expect(onCallEntryToRow(entryFor({ category: "Access" }, true), "owner-1").is_personal).toBe(true);
  });

  it("agrees with the read filter about a misspelt kind", () => {
    // Same rule on both sides — any `kind` at all on a logistics row — so a
    // typo cannot be shared by one half and withheld by the other.
    expect(
      onCallEntryToRow(entryFor({ category: "Registration", kind: "Compliance" }, false), "owner-1").is_personal,
    ).toBe(true);
  });
});

describe("rowToOnCallEntry", () => {
  it("drops details that do not match the section's schema instead of trusting them", () => {
    const entry = rowToOnCallEntry({
      id: "11111111-1111-4111-8111-111111111111",
      section: "contacts",
      slug: "ward-4b",
      title: "Ward 4B",
      subtitle: null,
      body: null,
      details: { phne: "9999 9999" },
      linked_document_ids: [],
      tags: [],
      is_personal: false,
      include_on_card: false,
      sort_order: 0,
      last_verified_at: null,
    });
    expect(entry.details).toBeNull();
  });

  it("normalizes empty or whitespace-only subtitle to null instead of throwing", () => {
    const entry = rowToOnCallEntry({
      id: "11111111-1111-4111-8111-111111111111",
      section: "contacts",
      slug: "ward-4b",
      title: "Ward 4B",
      subtitle: "",
      body: null,
      details: {},
      linked_document_ids: [],
      tags: [],
      is_personal: false,
      include_on_card: false,
      sort_order: 0,
      last_verified_at: null,
    });
    expect(entry.subtitle).toBeNull();
  });
});

function fakeDocumentClient(rows: Array<{ id: string }>, error: { message: string } | null = null) {
  let capturedOr: string | undefined;
  let capturedIn: { column: string; values: string[] } | undefined;
  let capturedTable: string | undefined;

  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    in: vi.fn((column: string, values: string[]) => {
      capturedIn = { column, values };
      return chain;
    }),
    or: vi.fn((filter: string) => {
      capturedOr = filter;
      return chain;
    }),
    is: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then(resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) {
      return Promise.resolve({ data: error ? null : rows, error }).then(resolve, reject);
    },
  };

  const client = {
    from: vi.fn((table: string) => {
      capturedTable = table;
      return chain;
    }),
    chain,
    get capturedOr() {
      return capturedOr;
    },
    get capturedIn() {
      return capturedIn;
    },
    get capturedTable() {
      return capturedTable;
    },
  };

  return client;
}

describe("assertValidLinkedDocumentIds", () => {
  const callerOwnerId = "00000000-0000-4000-8000-000000000001";
  const doc1 = "11111111-1111-4111-8111-111111111111";
  const doc2 = "22222222-2222-4222-8222-222222222222";
  const otherOwnerDoc = "33333333-3333-4333-8333-333333333333";

  it("passes when documentIds is empty without querying documents", async () => {
    const client = fakeDocumentClient([]);
    await expect(assertValidLinkedDocumentIds(client as never, [], callerOwnerId)).resolves.toBeUndefined();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("passes when all linked document IDs exist and are accessible under the owner scope", async () => {
    const client = fakeDocumentClient([{ id: doc1 }, { id: doc2 }]);
    await expect(assertValidLinkedDocumentIds(client as never, [doc1, doc2], callerOwnerId)).resolves.toBeUndefined();
    expect(client.from).toHaveBeenCalledWith("documents");
    expect(client.capturedIn).toEqual({ column: "id", values: [doc1, doc2] });
    expect(client.capturedOr).toContain(`owner_id.eq.${callerOwnerId}`);
  });

  it("throws PublicApiError 400 when one or more documents do not exist", async () => {
    const client = fakeDocumentClient([{ id: doc1 }]);
    const promise = assertValidLinkedDocumentIds(client as never, [doc1, doc2], callerOwnerId);
    await expect(promise).rejects.toThrow(PublicApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: "Invalid linked document IDs: one or more documents do not exist.",
    });
  });

  it("throws PublicApiError 400 when a document belongs to another owner and is excluded by owner scope", async () => {
    // Other owner's document is filtered out by withOwnerReadScope, so documents query returns empty
    const client = fakeDocumentClient([]);
    const promise = assertValidLinkedDocumentIds(client as never, [otherOwnerDoc], callerOwnerId);
    await expect(promise).rejects.toThrow(PublicApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: "Invalid linked document IDs: one or more documents do not exist.",
    });
    expect(client.capturedOr).toContain(`owner_id.eq.${callerOwnerId}`);
  });

  it("throws an error when the database query fails", async () => {
    const client = fakeDocumentClient([], { message: "Database connection failed" });
    await expect(assertValidLinkedDocumentIds(client as never, [doc1], callerOwnerId)).rejects.toThrow(
      "Database connection failed",
    );
  });
});
