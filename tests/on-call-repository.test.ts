import { describe, expect, it, vi } from "vitest";
import { fetchOwnerOnCallEntries, rowToOnCallEntry } from "@/lib/on-call/repository";

function fakeClient(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return { from: vi.fn(() => chain), chain };
}

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
});
