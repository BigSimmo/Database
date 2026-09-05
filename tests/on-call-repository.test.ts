import { describe, expect, it, vi } from "vitest";
import {
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
    const columns = client.chain.eq.mock.calls.map((call) => call[0]);
    expect(columns).not.toContain("owner_id");
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
    const columns = client.chain.eq.mock.calls.map((call) => call[0]);
    expect(columns).not.toContain("owner_id");
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
