import { describe, expect, it, vi } from "vitest";
import { PublicApiError } from "@/lib/http";
import {
  assertValidLinkedDocumentIds,
  fetchOwnerOnCallEntries,
  fetchSharedOnCallEntries,
  fetchVisibleOnCallEntries,
  rowToOnCallEntry,
} from "@/lib/on-call/repository";

function fakeClient(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
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
  // "Personal number — excluded from the printable card and any export". A world-readable
  // fetch is an export.
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
