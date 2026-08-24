import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const rpc = vi.fn();
const requireAuthenticatedUser = vi.fn();

function mockRuntime() {
  vi.resetModules();
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
  vi.doMock("@/lib/supabase/auth", async (original) => {
    const actual = await original<typeof import("@/lib/supabase/auth")>();
    return { ...actual, requireAuthenticatedUser };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  rpc.mockReset();
  requireAuthenticatedUser.mockReset();
});

describe("site-content publication POST", () => {
  it("normalizes only the selected locked legacy row through static SQL branches", () => {
    const migration = readFileSync(
      "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql",
      "utf8",
    );
    expect(migration).toContain("from public.clinical_registry_records r");
    expect(migration).toContain("from public.medication_records r");
    expect(migration).toContain("from public.differential_records r");
    expect(migration).toContain("for update;");
    expect(migration).not.toMatch(/execute\s+format/i);
  });

  it("denies a non-administrator before any command RPC can change state", async () => {
    mockRuntime();
    const { AuthenticationError } = await import("@/lib/supabase/auth");
    requireAuthenticatedUser.mockRejectedValue(new AuthenticationError("Administrator access required."));
    const { POST } = await import("../src/app/api/site-content/publications/route");

    const response = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
          reconciliationPlanDigest: "a".repeat(64),
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("derives the actor from administrator authentication and never accepts public JSON", async () => {
    mockRuntime();
    requireAuthenticatedUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    rpc.mockResolvedValue({ data: [{ logical_id: "medications:sertraline", change_epoch: 1 }], error: null });
    const { POST } = await import("../src/app/api/site-content/publications/route");

    const response = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
          reconciliationPlanDigest: "a".repeat(64),
          actorId: "attacker",
          record: { body: "crafted public JSON" },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    const validResponse = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
          reconciliationPlanDigest: "a".repeat(64),
        }),
      }),
    );
    expect(validResponse.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "publish_site_content_record",
      expect.objectContaining({ p_published_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    );
  });
});
