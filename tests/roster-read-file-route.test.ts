import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleRosterPdf, sampleRosterXlsx } from "./helpers/roster-fixtures";

/*
 * The read-file route: reads an uploaded Excel or PDF roster into a grid,
 * entirely in memory. It never stores the file, never logs it, and refuses
 * anything over 2 MB before it is ever read.
 */

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  storage: vi.fn(),
  auth: vi.fn(),
  demo: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, storage: { from: mocks.storage } }),
}));
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

import { POST } from "@/app/api/roster/read-file/route";

const ownerId = "11111111-1111-4111-8111-111111111111";

function requestWithForm(form: FormData) {
  return new Request("https://psychiatry.tools/api/roster/read-file", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.rate.mockResolvedValue({ limited: false });
  mocks.auth.mockResolvedValue({ id: ownerId });
});

describe("POST /api/roster/read-file", () => {
  it("reads an Excel roster and returns only the grid", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(await sampleRosterXlsx())], "oct.xlsx"));
    const response = await POST(requestWithForm(form));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { grid: { rows: Array<{ name: string }> } };
    expect(payload.grid.rows[0]?.name).toBe("Dr Alex Example");
  });

  it("reads a text PDF roster", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(sampleRosterPdf())], "oct.pdf"));
    const response = await POST(requestWithForm(form));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { grid: { rows: Array<{ name: string }> } };
    expect(payload.grid.rows[0]?.name).toBe("Dr Alex Example");
  });

  it("says a scanned PDF can't be read", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(sampleRosterPdf({ scanned: true }))], "scan.pdf"));
    const response = await POST(requestWithForm(form));
    expect(response.status).toBe(422);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("scanned");
  });

  it("refuses a file over 2 MB before reading it", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.xlsx"));
    expect((await POST(requestWithForm(form))).status).toBe(413);
  });

  it("refuses a file that isn't an Excel or PDF by its signature, whatever its name claims", async () => {
    const form = new FormData();
    form.set("file", new File([new TextEncoder().encode("not a roster")], "roster.xlsx"));
    expect((await POST(requestWithForm(form))).status).toBe(415);
  });

  it("never logs the file, and never stores it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const form = new FormData();
    form.set("file", new File([new Uint8Array(sampleRosterPdf({ scanned: true }))], "scan.pdf"));
    await POST(requestWithForm(form));
    expect(log).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("refuses a signed-out request", async () => {
    mocks.auth.mockRejectedValue(new (await import("@/lib/supabase/auth")).AuthenticationError("no session"));
    const form = new FormData();
    form.set("file", new File([new Uint8Array(await sampleRosterXlsx())], "oct.xlsx"));
    expect((await POST(requestWithForm(form))).status).toBe(401);
  });

  it("refuses to read a file in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    const form = new FormData();
    form.set("file", new File([new Uint8Array(await sampleRosterXlsx())], "oct.xlsx"));
    expect((await POST(requestWithForm(form))).status).toBe(400);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});
