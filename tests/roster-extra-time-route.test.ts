import { beforeEach, describe, expect, it, vi } from "vitest";

/* POST /api/roster/extra-time: "Stayed late" logged by the doctor themselves. Invented data only. */

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  auth: vi.fn(),
  demo: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));

import { POST } from "@/app/api/roster/extra-time/route";
import { AuthenticationError } from "@/lib/supabase/auth";

const ownerId = "owner-1";

function jsonRequest(body: unknown) {
  return new Request("https://psychiatry.tools/api/roster/extra-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.auth.mockResolvedValue({ id: ownerId });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
});

describe("POST /api/roster/extra-time", () => {
  it("logs a late finish once, even if Admin logged it too", async () => {
    const response = await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("extra_time_records");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        owner_id: ownerId,
        kind: "stayed_late",
        started_at: "2026-10-05T08:30:00.000Z",
        ended_at: "2026-10-05T09:45:00.000Z",
      },
      { onConflict: "owner_id,kind,started_at", ignoreDuplicates: true },
    );
  });

  it("writes only kind, started_at and ended_at, never a claim field", async () => {
    await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }),
    );
    const [row] = mocks.upsert.mock.calls[0]!;
    expect(Object.keys(row).sort()).toEqual(["ended_at", "kind", "owner_id", "started_at"]);
  });

  it("refuses a shift that ends before it starts, or lasts more than 24 hours", async () => {
    const backwards = await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T09:45:00.000Z", endedAt: "2026-10-05T08:30:00.000Z" }),
    );
    expect(backwards.status).toBe(400);
    const tooLong = await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T00:00:00.000Z", endedAt: "2026-10-06T01:00:00.000Z" }),
    );
    expect(tooLong.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("refuses an unknown field or an unknown kind", async () => {
    const extraField = await POST(
      jsonRequest({
        kind: "stayed_late",
        startedAt: "2026-10-05T08:30:00.000Z",
        endedAt: "2026-10-05T09:45:00.000Z",
        claimReference: "R1",
      }),
    );
    expect(extraField.status).toBe(400);
    const badKind = await POST(
      jsonRequest({ kind: "recalled", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }),
    );
    expect(badKind.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("refuses a signed-out request", async () => {
    mocks.auth.mockRejectedValue(new AuthenticationError("no session"));
    const response = await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }),
    );
    expect(response.status).toBe(401);
  });

  it("will not log extra time in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    const response = await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("is rate-limited like the rest of Roster's own API", async () => {
    mocks.rate.mockResolvedValue({ limited: true, retryAfterSeconds: 10 });
    const response = await POST(
      jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }),
    );
    expect(response.status).toBe(429);
    expect(mocks.rate.mock.calls[0]![0]).toMatchObject({ bucket: "roster" });
  });
});
