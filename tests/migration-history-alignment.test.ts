import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIGRATION_HISTORY_VERSIONS_MIGRATION,
  alignmentFailureMessage,
  diffMigrationHistory,
  fetchRemoteVersions,
  parseAlignmentOptions,
  resolveAlignment,
} from "../scripts/check-migration-history-alignment";

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const URL_ = "https://project.supabase.co";
const KEY = "service-role-key";

type FetchCall = { url: string; init?: RequestInit };

/**
 * The live-drift workflow's alignment step could never pass on this project: it
 * read supabase_migrations through PostgREST, which returns 406 PGRST106 because
 * the schema is not exposed to the Data API. The read now prefers a
 * service-role-only RPC. These tests pin the preference order, the fallback, and
 * the failure message — a check that silently degrades to "fine" would be worse
 * than the red job it replaced.
 */
function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(handler({ url: String(url), init }));
  });
  return calls;
}

const rpcOk = (versions: { version: string; name: string | null }[]) =>
  new Response(JSON.stringify({ probe: "ok", versions }), { status: 200 });

const rpcAbsent = () =>
  new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function" }), { status: 404 });

const profileBlocked = () =>
  new Response(JSON.stringify({ code: "PGRST106", message: "Invalid schema: supabase_migrations" }), { status: 406 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("migration history remote read", () => {
  it("prefers the service-role RPC and never touches the unexposed schema", async () => {
    const calls = stubFetch(() => rpcOk([{ version: "20260101000000", name: "init" }]));

    const result = await fetchRemoteVersions(URL_, KEY);

    expect(result.source).toBe("rpc");
    expect(result.rows).toEqual([{ version: "20260101000000", name: "init" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/rest/v1/rpc/migration_history_versions");
    expect(calls[0].init?.headers).not.toHaveProperty("Accept-Profile");
  });

  it("falls back to the direct read only when the RPC does not exist yet", async () => {
    const calls = stubFetch(({ url }) =>
      url.includes("/rpc/")
        ? rpcAbsent()
        : new Response(JSON.stringify([{ version: "20260101000000", name: "init" }]), { status: 200 }),
    );

    const result = await fetchRemoteVersions(URL_, KEY);

    expect(result.source).toBe("accept-profile");
    expect(result.rows).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it("fails with the remedy named when neither path can read history", async () => {
    stubFetch(({ url }) => (url.includes("/rpc/") ? rpcAbsent() : profileBlocked()));

    const failure = fetchRemoteVersions(URL_, KEY);
    await expect(failure).rejects.toThrow(MIGRATION_HISTORY_VERSIONS_MIGRATION);
    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(/merge the reviewed migration to main/);
    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(/GitHub integration deploys it/);
    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(/PGRST106/);
    await expect(fetchRemoteVersions(URL_, KEY)).rejects.not.toThrow(/auto-deploy is off/);
  });

  it("treats a database with no history table as an error, not an empty history", async () => {
    stubFetch(() => new Response(JSON.stringify({ probe: "no_history_table", versions: [] }), { status: 200 }));

    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(/no_history_table/);
  });

  it("surfaces an unexpected RPC failure instead of silently falling back", async () => {
    const calls = stubFetch(() => new Response("boom", { status: 500 }));

    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(/status 500/);
    expect(calls).toHaveLength(1);
  });
});

describe("migration_history_versions definition parity (migration vs schema.sql)", () => {
  const extract = (text: string) => {
    const start = text.indexOf("create or replace function public.migration_history_versions()");
    expect(start, "migration_history_versions definition not found").toBeGreaterThanOrEqual(0);
    const end = text.indexOf("grant execute on function public.migration_history_versions() to service_role;", start);
    expect(end, "migration_history_versions grants not found").toBeGreaterThan(start);
    return text.slice(start, end);
  };

  it(`migration ${MIGRATION_HISTORY_VERSIONS_MIGRATION.slice(0, 14)} and schema.sql carry byte-identical definitions`, () => {
    const fromMigration = extract(read(`supabase/migrations/${MIGRATION_HISTORY_VERSIONS_MIGRATION}`));
    expect(extract(read("supabase/schema.sql"))).toBe(fromMigration);
  });

  it("is read-only, service-role only, and guarded for databases without the history schema", () => {
    const file = read(`supabase/migrations/${MIGRATION_HISTORY_VERSIONS_MIGRATION}`);
    const sql = extract(file);
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path to ''");
    expect(sql).toContain("stable");
    expect(sql).toContain("to_regclass('supabase_migrations.schema_migrations')");
    expect(sql).toContain("'no_history_table'");
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|alter)\b/i);
    expect(file).toContain(
      "revoke execute on function public.migration_history_versions() from public, anon, authenticated;",
    );
    expect(file).toContain("grant execute on function public.migration_history_versions() to service_role;");
  });
});

/**
 * AGENTS.md makes "check:drift AND check:migration-history green" the gate that a
 * merged migration actually reached production. check:drift only compares the
 * object inventory (views, tables, indexes, policies, triggers, functions,
 * extensions, constraints, storage buckets), so a migration whose effect is a
 * pg_cron job row, a COMMENT ON, an ALTER DATABASE SET, a data-only fix or a
 * grant on a non-public schema is invisible to it. If this check also treats a
 * merged-but-unapplied version as informational, "BOTH green" proves nothing for
 * that class — the exact failure shape (#Q5JHBJ) the drift programme exists for.
 */
describe("merged-but-unapplied migrations fail the post-merge gate", () => {
  it("reports the versions live history is missing", () => {
    const diff = diffMigrationHistory(["20260101000000", "20260102000000"], ["20260101000000"]);

    expect(diff.localOnly).toEqual(["20260102000000"]);
    expect(diff.remoteOnly).toEqual([]);
  });

  it("fails when a local version never reached live history", () => {
    const message = alignmentFailureMessage({ remoteOnly: [], localOnly: ["20260102000000"] }, { allowPending: false });

    expect(message).toContain("20260102000000");
    expect(message).toMatch(/1 local migration version/);
    expect(message).toMatch(/--allow-pending/);
  });

  it("keeps remote-only versions fatal, with or without pending versions allowed", () => {
    for (const allowPending of [false, true]) {
      const message = alignmentFailureMessage({ remoteOnly: ["20259912310000"], localOnly: [] }, { allowPending });
      expect(message).toContain("20259912310000");
      expect(message).toMatch(/Preview/);
    }
  });

  it("passes only when both sides agree", () => {
    expect(alignmentFailureMessage({ remoteOnly: [], localOnly: [] }, { allowPending: false })).toBeNull();
    expect(
      alignmentFailureMessage({ remoteOnly: [], localOnly: ["20260102000000"] }, { allowPending: true }),
    ).toBeNull();
  });

  it("accepts --allow-pending on the command line", () => {
    expect(parseAlignmentOptions([]).allowPending).toBe(false);
    expect(parseAlignmentOptions(["--allow-pending"]).allowPending).toBe(true);
  });

  it("waits out the integration's apply window before calling a version unapplied", async () => {
    // The push-triggered live-drift run starts before the Supabase integration
    // has applied the merged migration (measured at 34 s), so a single read
    // would fail spuriously.
    const reads = [["20260101000000"], ["20260101000000", "20260102000000"]];
    const slept: number[] = [];

    const result = await resolveAlignment({
      localVersions: ["20260101000000", "20260102000000"],
      readRemote: async () => ({
        rows: (reads.shift() ?? []).map((version) => ({ version, name: null })),
        source: "rpc",
      }),
      allowPending: false,
      attempts: 3,
      waitMs: 1_000,
      sleep: async (ms: number) => {
        slept.push(ms);
      },
      log: () => {},
    });

    expect(result.diff.localOnly).toEqual([]);
    expect(slept).toEqual([1_000]);
  });

  it("gives up after the configured attempts and reports the pending versions", async () => {
    const slept: number[] = [];

    const result = await resolveAlignment({
      localVersions: ["20260101000000", "20260102000000"],
      readRemote: async () => ({ rows: [{ version: "20260101000000", name: null }], source: "rpc" }),
      allowPending: false,
      attempts: 3,
      waitMs: 1_000,
      sleep: async (ms: number) => {
        slept.push(ms);
      },
      log: () => {},
    });

    expect(result.diff.localOnly).toEqual(["20260102000000"]);
    expect(slept).toEqual([1_000, 1_000]);
  });

  it("does not wait at all when pending versions are explicitly allowed", async () => {
    const slept: number[] = [];

    const result = await resolveAlignment({
      localVersions: ["20260101000000", "20260102000000"],
      readRemote: async () => ({ rows: [{ version: "20260101000000", name: null }], source: "rpc" }),
      allowPending: true,
      attempts: 3,
      waitMs: 1_000,
      sleep: async (ms: number) => {
        slept.push(ms);
      },
      log: () => {},
    });

    expect(result.diff.localOnly).toEqual(["20260102000000"]);
    expect(slept).toEqual([]);
  });
});
