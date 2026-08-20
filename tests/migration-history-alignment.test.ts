import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIGRATION_HISTORY_VERSIONS_MIGRATION,
  fetchRemoteVersions,
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

    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(MIGRATION_HISTORY_VERSIONS_MIGRATION);
    await expect(fetchRemoteVersions(URL_, KEY)).rejects.toThrow(/PGRST106/);
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
