import { afterEach, describe, expect, it, vi } from "vitest";

// resolveHubEnvironmentFacts() supplies three of the four facts on the developer
// hub's environment strip. Two of its rules are the reason it exists rather than
// being inlined into the page: the document count must be confined to the
// caller's own documents, and a count it could not read must report as absent
// rather than as zero. An empty corpus and a failed query look identical on
// screen if that second rule ever slips.
//
// The first rule used to be delegated to row-level security. It cannot be: the
// `authenticated` role holds no table privilege on `public.documents`
// (`schema.sql:5299`, re-applied by migration `20260725000000`), so the
// owner-read policy sits behind a privilege the role does not have and the read
// returned permission denied on every hub load. The count now goes through the
// service-role client with an explicit `owner_id` filter, which makes that
// filter the whole guarantee — so it is asserted on the issued query below.

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

type LoadOptions = {
  user?: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null;
  count?: number | null;
  error?: { message: string } | null;
  demoMode?: boolean;
  /** The client rejects instead of resolving, as it does on an aborted request. */
  rejectCount?: boolean;
  rejectAuth?: boolean;
};

const selectCalls: { columns: string; options: unknown; filters: [string, unknown][] }[] = [];

const ADMINISTRATOR = { site_role: "administrator" };

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
  // The user client identifies the caller and reads no table; the service-role
  // client performs the count. Mocked apart, so a read issued through the wrong
  // one shows up as a missing call rather than passing silently.
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      auth: {
        getUser: vi.fn(async () => {
          if (rejectAuth) throw new Error("fetch failed");
          return { data: { user } };
        }),
      },
    })),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn((columns: string, options: unknown) => {
          const call = { columns, options, filters: [] as [string, unknown][] };
          const chain = {
            eq(column: string, value: unknown) {
              call.filters.push([column, value]);
              return chain;
            },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              selectCalls.push(call);
              return (rejectCount ? Promise.reject(new Error("fetch failed")) : Promise.resolve({ count, error })).then(
                resolve,
                reject,
              );
            },
          };
          return chain;
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
    // Not merely "returns null": the query must not run at all. There is no
    // owner id to filter on, so the count would be a whole-table count across
    // every account — and reporting it as "N documents" would state something
    // false about this account's corpus.
    expect(selectCalls).toHaveLength(0);
  });

  it("reports the owner's document count and email for a signed-in user", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-1", email: "clinician@example.com", app_metadata: ADMINISTRATOR },
      count: 2851,
    });

    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: false,
      documentCount: 2851,
      email: "clinician@example.com",
    });
    expect(selectCalls).toEqual([
      { columns: "id", options: { count: "exact", head: true }, filters: [["owner_id", "user-1"]] },
    ]);
  });

  it("keeps an empty corpus distinct from a count it could not read", async () => {
    const empty = await load({ user: { id: "user-1", app_metadata: ADMINISTRATOR }, count: 0 });
    await expect(empty.resolveHubEnvironmentFacts()).resolves.toMatchObject({ documentCount: 0 });

    vi.resetModules();
    const failed = await load({
      user: { id: "user-1", app_metadata: ADMINISTRATOR },
      count: 0,
      error: { message: "permission denied" },
    });
    await expect(failed.resolveHubEnvironmentFacts()).resolves.toMatchObject({ documentCount: null });
  });

  it("reports a missing count as unavailable rather than as zero", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-1", app_metadata: ADMINISTRATOR },
      count: null,
    });

    await expect(resolveHubEnvironmentFacts()).resolves.toMatchObject({ documentCount: null });
  });

  it("has no email to report for a user record that carries none", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-1", app_metadata: ADMINISTRATOR },
      count: 3,
    });

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
      user: { id: "user-1", email: "clinician@example.com", app_metadata: ADMINISTRATOR },
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
   * The owner-scoping guarantee, and the reason this replaced a source assertion
   * that the module used the cookie-bound user client and never the admin one.
   *
   * That assertion was backwards. The user client reads nothing here:
   * `schema.sql:5299` revokes all `public` table privileges from
   * `authenticated`, migration `20260725000000` re-applies the revoke after
   * every earlier grant, and no later migration restores it — so the
   * `documents owner read` policy sits behind a privilege the role does not
   * hold and the count returned permission denied on every hub load. The read
   * goes through the service-role client, which is not subject to that policy,
   * which makes the explicit filter the entire guarantee rather than a second
   * layer over it. Asserting it on the issued query is what stops the count
   * from silently becoming a total across every account.
   */
  it("filters the count by the caller's own owner id", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-1", email: "clinician@example.com", app_metadata: ADMINISTRATOR },
      count: 2851,
    });
    await resolveHubEnvironmentFacts();

    expect(selectCalls).toHaveLength(1);
    expect(selectCalls[0]!.filters).toContainEqual(["owner_id", "user-1"]);
  });

  it("counts nothing for a signed-in user without the administrator claim", async () => {
    const { resolveHubEnvironmentFacts } = await load({
      user: { id: "user-2", email: "someone@example.com", app_metadata: {} },
      count: 2851,
    });

    // The same claim `DeveloperAreaGate` checks. The owner filter would already
    // confine the count to this caller's own documents, so this is defence in
    // depth — but the email is still reported, because it was already read and
    // a named account is more useful than a blank strip.
    await expect(resolveHubEnvironmentFacts()).resolves.toEqual({
      demoMode: false,
      documentCount: null,
      email: "someone@example.com",
    });
    expect(selectCalls).toHaveLength(0);
  });
});
