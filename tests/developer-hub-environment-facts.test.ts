import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

// resolveHubEnvironmentFacts() supplies three of the four facts on the developer
// hub's environment strip. Two of its rules are the reason it exists rather than
// being inlined into the page: the document count must be scoped to the caller's
// own documents by the database, and a count it could not read must report as
// absent rather than as zero. An empty corpus and a failed query look identical
// on screen if that second rule ever slips.

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

type LoadOptions = {
  user?: { id: string; email?: string } | null;
  count?: number | null;
  error?: { message: string } | null;
  demoMode?: boolean;
  /** The client rejects instead of resolving, as it does on an aborted request. */
  rejectCount?: boolean;
  rejectAuth?: boolean;
};

const selectCalls: { columns: string; options: unknown }[] = [];

async function load({
  user = null,
  count = null,
  error = null,
  demoMode = false,
  rejectCount = false,
  rejectAuth = false,
}: LoadOptions = {}) {
  selectCalls.length = 0;
  vi.doMock("server-only", () => ({}));
  vi.doMock("@/lib/env", () => ({ isDemoMode: () => demoMode }));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      auth: {
        getUser: vi.fn(async () => {
          if (rejectAuth) throw new Error("fetch failed");
          return { data: { user } };
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn((columns: string, options: unknown) => {
          selectCalls.push({ columns, options });
          return rejectCount ? Promise.reject(new Error("fetch failed")) : Promise.resolve({ count, error });
        }),
      })),
    })),
  }));
  return import("../src/lib/developer-area/environment-facts");
}

describe("resolveHubEnvironmentFacts", () => {
  it("reports the demo/live environment even when Supabase is not configured", async () => {
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true }));
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => null) }));
    const { resolveHubEnvironmentFacts } = await import("../src/lib/developer-area/environment-facts");

    // The env read never depends on the database, which is why it was able to
    // ship before the other two facts.
    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: true,
      documentCount: null,
      email: null,
    });
  });

  it("does not count anything for a request with no signed-in user", async () => {
    const { resolveHubEnvironmentFacts } = await load({ user: null, count: 4 });

    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: false,
      documentCount: null,
      email: null,
    });
    // Not merely "returns null": the query must not run at all. Row-level
    // security would correctly return 0 rows to an anonymous caller, and
    // rendering that as "0 documents" would state something false about the
    // corpus rather than about the session.
    expect(selectCalls).toHaveLength(0);
  });

  it("reports the owner's document count and email for a signed-in user", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-1", email: "clinician@example.com" },
      count: 2851,
    });

    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: false,
      documentCount: 2851,
      email: "clinician@example.com",
    });
    expect(selectCalls).toEqual([{ columns: "id", options: { count: "exact", head: true } }]);
  });

  it("keeps an empty corpus distinct from a count it could not read", async () => {
    const empty = await load({ user: { id: "user-1" }, count: 0 });
    await expect(empty.resolveHubEnvironmentFacts()).resolves.toMatchObject({ documentCount: 0 });

    vi.resetModules();
    const failed = await load({ user: { id: "user-1" }, count: 0, error: { message: "permission denied" } });
    await expect(failed.resolveHubEnvironmentFacts()).resolves.toMatchObject({ documentCount: null });
  });

  it("reports a missing count as unavailable rather than as zero", async () => {
    const { resolveHubEnvironmentFacts } = await load({ user: { id: "user-1" }, count: null });

    await expect(resolveHubEnvironmentFacts()).resolves.toMatchObject({ documentCount: null });
  });

  it("has no email to report for a user record that carries none", async () => {
    const { resolveHubEnvironmentFacts } = await load({ user: { id: "user-1" }, count: 3 });

    await expect(resolveHubEnvironmentFacts()).resolves.toMatchObject({ email: null, documentCount: 3 });
  });

  /**
   * A returned `{ error }` is only half of what can go wrong. The client rejects
   * rather than resolves when a request is aborted or exhausts its network
   * retries, and an unhandled rejection would fail the entire developer hub page
   * instead of degrading one line of it — during exactly the Supabase outage
   * that makes the page worth opening. Raised in review of PR #2495.
   */
  it("degrades to unavailable when the count read rejects instead of returning an error", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-1", email: "clinician@example.com" },
      rejectCount: true,
      demoMode: false,
    });

    // Not merely "does not throw": the facts that were already read must survive.
    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: false,
      documentCount: null,
      email: null,
    });
  });

  it("degrades to unavailable when the auth read itself rejects", async () => {
    const { resolveHubEnvironmentFacts } = await load({ rejectAuth: true, demoMode: true });

    // `demoMode` never touched the network, so it must still be reported: an
    // outage should not make the page claim it cannot tell demo from live.
    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: true,
      documentCount: null,
      email: null,
    });
  });

  /**
   * The owner-scoping guarantee is structural, not behavioural: it holds because
   * this module uses the cookie-bound user client, which row-level security
   * scopes to `owner_id = auth.uid()`. The service-role admin client bypasses RLS
   * entirely, so importing it here would silently turn one account's count into
   * every account's — with no failing assertion anywhere, because the mock in the
   * tests above would still answer. A source assertion is the only thing that can
   * catch that substitution.
   */
  it("reads through the user-session client and never the service-role client", () => {
    const source = readFileSync(new URL("../src/lib/developer-area/environment-facts.ts", import.meta.url), "utf8");
    // Import statements only. The module's own comment names `createAdminClient`
    // to explain why it is wrong here, so a whole-file substring search for that
    // identifier would fail on the documentation rather than on the code.
    const imports = source.split("\n").filter((line) => line.startsWith("import "));

    expect(imports.some((line) => line.includes('"@/lib/supabase/server"'))).toBe(true);
    expect(imports.some((line) => line.includes("supabase/admin"))).toBe(false);
    // Catches a dynamic import or a re-export that no import line would show.
    expect(source).not.toContain("supabase/admin");
  });
});
