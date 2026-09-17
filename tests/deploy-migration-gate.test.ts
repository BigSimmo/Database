import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { listLocalMigrationVersions, missingVersions } from "../scripts/deploy/migration-versions.mjs";
import { buildManifest, DEFAULT_MIGRATIONS_DIR, writeManifest } from "../scripts/deploy/write-migration-manifest.mjs";
import {
  DEFAULT_MAX_WAIT_S,
  DEFAULT_POLL_S,
  MAX_WAIT_S,
  MIN_POLL_S,
  fetchLiveVersions,
  normalizeSupabaseUrl,
  pollForMigrations,
  positiveNumberOr,
  readManifestVersions,
  runGate,
  scrubUrl,
} from "../scripts/deploy/await-migrations.mjs";

const root = join(__dirname, "..");

/**
 * A minimal fake clock: `now()` reads the counter, `sleep(ms)` advances it —
 * mirroring how the real gate's `now` and `sleep` compose in
 * `pollForMigrations`, without a real timer in any of these tests.
 */
function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    sleep: async (ms: number) => {
      current += ms;
    },
  };
}

const okResponse = (versions: string[]) =>
  new Response(JSON.stringify({ probe: "ok", versions: versions.map((version) => ({ version })) }), { status: 200 });

describe("missingVersions", () => {
  it("returns expected versions absent from live", () => {
    expect(missingVersions(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });

  it("ignores live-only extras (older-commit redeploys, rollbacks)", () => {
    expect(missingVersions(["a"], ["a", "b", "z"])).toEqual([]);
  });

  it("returns nothing when every expected version is live", () => {
    expect(missingVersions(["a", "b"], ["b", "a"])).toEqual([]);
  });

  it("sorts the result", () => {
    expect(missingVersions(["c", "a", "b"], [])).toEqual(["a", "b", "c"]);
  });
});

describe("write-migration-manifest matches the checker's local version list", () => {
  it("produces the same version list as scripts/check-migration-history-alignment.ts reads locally", () => {
    const fromSharedModule = listLocalMigrationVersions(DEFAULT_MIGRATIONS_DIR);
    const fromRealDirectory = readdirSync(join(root, "supabase/migrations"))
      .map((name) => /^(\d{14})_.*\.sql$/.exec(name)?.[1] ?? null)
      .filter((version): version is string => Boolean(version))
      .sort();

    expect(fromSharedModule).toEqual(fromRealDirectory);
    expect(fromSharedModule.length).toBeGreaterThan(0);

    const manifest = buildManifest();
    expect(manifest.versions).toEqual(fromRealDirectory);
    expect(manifest.count).toBe(fromRealDirectory.length);
  });
});

describe("positiveNumberOr", () => {
  it("returns the parsed number when it is finite and positive", () => {
    expect(positiveNumberOr("45", 20)).toBe(45);
    expect(positiveNumberOr(45, 20)).toBe(45);
  });

  it("falls back on NaN-producing input (non-numeric strings)", () => {
    expect(positiveNumberOr("abc", 20)).toBe(20);
    expect(positiveNumberOr("reprot", 600)).toBe(600);
  });

  it("falls back on a blank string (Number('') is 0, not NaN)", () => {
    expect(positiveNumberOr("", 20)).toBe(20);
    expect(positiveNumberOr("   ", 20)).toBe(20);
  });

  it("falls back on zero and negative values", () => {
    expect(positiveNumberOr("0", 20)).toBe(20);
    expect(positiveNumberOr(-5, 20)).toBe(20);
  });

  it("falls back on undefined", () => {
    expect(positiveNumberOr(undefined, 20)).toBe(20);
  });
});

describe("normalizeSupabaseUrl", () => {
  it("strips one or more trailing slashes", () => {
    expect(normalizeSupabaseUrl("https://project.supabase.co/")).toBe("https://project.supabase.co");
    expect(normalizeSupabaseUrl("https://project.supabase.co///")).toBe("https://project.supabase.co");
  });

  it("leaves a URL with no trailing slash unchanged", () => {
    expect(normalizeSupabaseUrl("https://project.supabase.co")).toBe("https://project.supabase.co");
  });
});

describe("scrubUrl", () => {
  it("removes the exact URL from a message", () => {
    expect(
      scrubUrl("fetch failed: https://project.supabase.co/rest/v1/rpc/x", "https://project.supabase.co"),
    ).not.toContain("project.supabase.co");
  });

  it("removes the URL's origin even when only the origin appears", () => {
    expect(
      scrubUrl("connect ECONNREFUSED https://project.supabase.co:443", "https://project.supabase.co"),
    ).not.toContain("project.supabase.co");
  });

  it("returns the text unchanged when no url is given", () => {
    expect(scrubUrl("some message", "")).toBe("some message");
  });
});

describe("fetchLiveVersions", () => {
  it("reads versions via the migration_history_versions RPC", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return okResponse(["20260101000000", "20260102000000"]);
    });

    const versions = await fetchLiveVersions("https://project.supabase.co", "service-role-key", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(versions).toEqual(["20260101000000", "20260102000000"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://project.supabase.co/rest/v1/rpc/migration_history_versions");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));

    await expect(
      fetchLiveVersions("https://project.supabase.co", "key", { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/status 500/);
  });

  it("throws when the RPC payload is not the expected shape", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ probe: "no_history_table" }), { status: 200 }));

    await expect(
      fetchLiveVersions("https://project.supabase.co", "key", { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/no_history_table/);
  });
});

describe("pollForMigrations", () => {
  it("never sleeps past the deadline when the poll interval exceeds the wait budget", async () => {
    const clock = fakeClock();
    const sleeps: number[] = [];
    const fetchVersions = vi.fn(async () => ["a"]);

    const result = await pollForMigrations({
      expectedVersions: ["a", "b"],
      fetchVersions,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        await clock.sleep(ms);
      },
      now: clock.now,
      pollS: 999_999,
      maxWaitS: 600,
    });

    expect(result.ok).toBe(false);
    expect(clock.now()).toBe(600_000);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(600_000);
    expect(fetchVersions).toHaveBeenCalledTimes(2);
  });

  it("passes on the first read when every expected version is already present", async () => {
    const { now, sleep } = fakeClock();
    const fetchVersions = vi.fn(async () => ["a", "b"]);

    const result = await pollForMigrations({
      expectedVersions: ["a", "b"],
      fetchVersions,
      sleep,
      now,
      pollS: 20,
      maxWaitS: 600,
    });

    expect(result).toEqual({ ok: true, missing: [], error: null });
    expect(fetchVersions).toHaveBeenCalledTimes(1);
  });

  it("passes once a pending version shows up on a later read", async () => {
    const { now, sleep } = fakeClock();
    const reads = [["a"], ["a", "b"]];
    const fetchVersions = vi.fn(async () => reads.shift() ?? []);

    const result = await pollForMigrations({
      expectedVersions: ["a", "b"],
      fetchVersions,
      sleep,
      now,
      pollS: 20,
      maxWaitS: 600,
    });

    expect(result).toEqual({ ok: true, missing: [], error: null });
    expect(fetchVersions).toHaveBeenCalledTimes(2);
  });

  it("fails with the missing versions listed, and reads a bounded number of times, when they never appear", async () => {
    const { now, sleep } = fakeClock();
    const fetchVersions = vi.fn(async () => ["a"]);

    const result = await pollForMigrations({
      expectedVersions: ["a", "b"],
      fetchVersions,
      sleep,
      now,
      pollS: 20,
      maxWaitS: 60,
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["b"]);
    expect(result.error).toBeNull();
    // maxWaitS=60 / pollS=20 bounds this to at most 4 reads (initial + 3 retries).
    expect(fetchVersions.mock.calls.length).toBeLessThanOrEqual(4);
    expect(fetchVersions.mock.calls.length).toBeGreaterThan(1);
  });

  it("passes when live holds extra versions beyond what is expected", async () => {
    const { now, sleep } = fakeClock();
    const fetchVersions = vi.fn(async () => ["a", "b", "z-not-expected"]);

    const result = await pollForMigrations({
      expectedVersions: ["a", "b"],
      fetchVersions,
      sleep,
      now,
      pollS: 20,
      maxWaitS: 600,
    });

    expect(result).toEqual({ ok: true, missing: [], error: null });
  });

  it("recovers from a transient read error on a later attempt", async () => {
    const { now, sleep } = fakeClock();
    let attempt = 0;
    const fetchVersions = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("ECONNRESET");
      return ["a"];
    });

    const result = await pollForMigrations({
      expectedVersions: ["a"],
      fetchVersions,
      sleep,
      now,
      pollS: 20,
      maxWaitS: 600,
    });

    expect(result).toEqual({ ok: true, missing: [], error: null });
    expect(fetchVersions).toHaveBeenCalledTimes(2);
  });

  it("fails with the last error when reads keep failing until the deadline", async () => {
    const { now, sleep } = fakeClock();
    const fetchVersions = vi.fn(async () => {
      throw new Error("persistent network failure");
    });

    const result = await pollForMigrations({
      expectedVersions: ["a"],
      fetchVersions,
      sleep,
      now,
      pollS: 20,
      maxWaitS: 60,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("persistent network failure");
    expect(fetchVersions.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("maxWaitS: 0 forces exactly one read and no sleep — the primitive report mode relies on", async () => {
    const sleep = vi.fn(async () => {});
    const fetchVersions = vi.fn(async () => ["a"]); // "b" stays missing forever

    const result = await pollForMigrations({
      expectedVersions: ["a", "b"],
      fetchVersions,
      sleep,
      now: () => 0,
      pollS: 20,
      maxWaitS: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["b"]);
    expect(fetchVersions).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("runGate (the CLI, with env/fetch/clock injected)", () => {
  it("off mode exits 0 and never calls the RPC", async () => {
    const fetchImpl = vi.fn();
    const logs: string[] = [];

    const result = await runGate({
      env: { DEPLOY_MIGRATION_GATE: "off" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logs.join("\n")).toMatch(/mode=off/);
  });

  it("report mode makes exactly one read, exits 0, and never blocks — even with migrations missing", async () => {
    const fetchImpl = vi.fn(async () => okResponse(["20260101000000"]));
    const logs: string[] = [];

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "report",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: vi.fn(async () => {}),
      readManifest: () => ["20260101000000", "20260102000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toMatch(/missing: 20260102000000/);
    expect(logs.join("\n")).toMatch(/mode=report — not blocking deploy/);
    expect(logs.join("\n")).toMatch(/single read, no polling/);
  });

  it("report mode makes exactly one read and exits 0 even when every migration is present", async () => {
    const fetchImpl = vi.fn(async () => okResponse(["20260101000000"]));
    const logs: string[] = [];

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "report",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readManifest: () => ["20260101000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toMatch(/PASS/);
  });

  it("enforce mode exits 1 once the wait budget is exhausted with migrations still missing", async () => {
    const { now, sleep } = fakeClock();
    const fetchImpl = vi.fn(async () => okResponse(["20260101000000"]));
    const logs: string[] = [];

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "enforce",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        DEPLOY_MIGRATION_GATE_POLL_S: "20",
        DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "60",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      now,
      readManifest: () => ["20260101000000", "20260102000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(1);
    expect(logs.join("\n")).toMatch(/missing: 20260102000000/);
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("enforce mode passes once the missing migration shows up on a later poll", async () => {
    const { now, sleep } = fakeClock();
    const reads = [["20260101000000"], ["20260101000000", "20260102000000"]];
    const fetchImpl = vi.fn(async () => okResponse(reads.shift() ?? []));
    const logs: string[] = [];

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "enforce",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        DEPLOY_MIGRATION_GATE_POLL_S: "20",
        DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "600",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      now,
      readManifest: () => ["20260101000000", "20260102000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  describe("NaN/blank numeric settings never produce an unbounded poll or a flood of reads", () => {
    it("report mode: a NaN poll and a blank max-wait still make exactly one read and exit 0", async () => {
      const fetchImpl = vi.fn(async () => okResponse([]));
      const logs: string[] = [];

      const result = await runGate({
        env: {
          DEPLOY_MIGRATION_GATE: "report",
          NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          DEPLOY_MIGRATION_GATE_POLL_S: "abc",
          DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: vi.fn(async () => {
          throw new Error("report mode must never sleep");
        }),
        readManifest: () => ["20260101000000"],
        log: (message) => logs.push(message),
      });

      expect(result.exitCode).toBe(0);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("enforce mode: a NaN poll and a blank max-wait fall back to the documented defaults, bounded", async () => {
      const { now, sleep } = fakeClock();
      const fetchImpl = vi.fn(async () => okResponse([])); // never satisfies "a", so it runs to the deadline
      const logs: string[] = [];

      const result = await runGate({
        env: {
          DEPLOY_MIGRATION_GATE: "enforce",
          NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          DEPLOY_MIGRATION_GATE_POLL_S: "abc",
          DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep,
        now,
        readManifest: () => ["20260101000000"],
        log: (message) => logs.push(message),
      });

      expect(result.exitCode).toBe(1);
      expect(logs.join("\n")).toContain(`poll=${DEFAULT_POLL_S}s max-wait=${DEFAULT_MAX_WAIT_S}s`);
      // DEFAULT_MAX_WAIT_S / DEFAULT_POLL_S + 1 bounds the read count.
      expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(DEFAULT_MAX_WAIT_S / DEFAULT_POLL_S + 1);
    });

    it("enforce mode: zero/negative settings also fall back rather than flooding reads", async () => {
      const { now, sleep } = fakeClock();
      const fetchImpl = vi.fn(async () => okResponse([]));

      const result = await runGate({
        env: {
          DEPLOY_MIGRATION_GATE: "enforce",
          NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          DEPLOY_MIGRATION_GATE_POLL_S: "0",
          DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "-5",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep,
        now,
        readManifest: () => ["20260101000000"],
        log: () => {},
      });

      expect(result.exitCode).toBe(1);
      expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(DEFAULT_MAX_WAIT_S / DEFAULT_POLL_S + 1);
    });

    it("enforce mode: an oversized max-wait is clamped to MAX_WAIT_S, and a sub-1s poll is floored to MIN_POLL_S", async () => {
      const { now, sleep } = fakeClock();
      const fetchImpl = vi.fn(async () => okResponse([]));
      const logs: string[] = [];

      await runGate({
        env: {
          DEPLOY_MIGRATION_GATE: "enforce",
          NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          DEPLOY_MIGRATION_GATE_POLL_S: "0.2",
          DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "999999",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep,
        now,
        readManifest: () => ["20260101000000"],
        log: (message) => logs.push(message),
      });

      expect(logs.join("\n")).toContain(`poll=${MIN_POLL_S}s max-wait=${MAX_WAIT_S}s`);
    });
  });

  it("treats an unrecognised mode as report — exits 0, warns, and still checks", async () => {
    const fetchImpl = vi.fn(async () => okResponse([]));
    const logs: string[] = [];

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "reprot",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readManifest: () => ["20260101000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(logs.join("\n")).toMatch(/unrecognised DEPLOY_MIGRATION_GATE="reprot"/);
    expect(logs.join("\n")).toMatch(/treating as "report"/);
  });

  it("an unrecognised mode with no env configured at all still exits 0 (no RPC reachable, no crash)", async () => {
    const result = await runGate({ env: { DEPLOY_MIGRATION_GATE: "sideways" }, log: () => {} });
    expect(result.exitCode).toBe(0);
  });

  it("a manifest read that throws exits 0 in report mode and 1 in enforce mode", async () => {
    const throwingReadManifest = () => {
      throw new Error("ENOENT: expected-migrations.json not found");
    };

    const reportLogs: string[] = [];
    const reportResult = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "report",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      readManifest: throwingReadManifest,
      log: (message) => reportLogs.push(message),
    });
    expect(reportResult.exitCode).toBe(0);
    expect(reportLogs.join("\n")).toMatch(/unexpected error/);

    const enforceResult = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "enforce",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      readManifest: throwingReadManifest,
      log: () => {},
    });
    expect(enforceResult.exitCode).toBe(1);
  });

  it("builds the correct endpoint from a URL with a trailing slash (no doubled slash)", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return okResponse(["20260101000000"]);
    });

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "report",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readManifest: () => ["20260101000000"],
      log: () => {},
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual(["https://project.supabase.co/rest/v1/rpc/migration_history_versions"]);
  });

  it("names only the actually-missing environment variable, and never leaks the value of the one that is set", async () => {
    const fakeKeyValue = "fake-service-role-key-for-tests-not-a-secret";
    const fetchImpl = vi.fn();
    const logs: string[] = [];

    const result = await runGate({
      env: { DEPLOY_MIGRATION_GATE: "enforce", SUPABASE_SERVICE_ROLE_KEY: fakeKeyValue },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    const combined = logs.join("\n");
    expect(combined).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(combined).not.toContain("SUPABASE_SERVICE_ROLE_KEY,");
    expect(combined).not.toContain(fakeKeyValue);
  });

  it("report mode with missing env exits 0 and still names the variable", async () => {
    const logs: string[] = [];

    const result = await runGate({
      env: { DEPLOY_MIGRATION_GATE: "report", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" },
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(logs.join("\n")).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("never lets the service-role key reach a log line on a real auth failure, and never logs a bare URL", async () => {
    const { now, sleep } = fakeClock();
    const secretKey = "fake-service-role-key-for-tests-not-a-secret";
    // A real PostgREST/Supabase auth failure never echoes the credential it
    // was sent — this is the realistic shape of that response body.
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ code: "401", message: "Invalid API key" }), { status: 401 }),
    );
    const logs: string[] = [];

    const result = await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "enforce",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: secretKey,
        DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "60",
        DEPLOY_MIGRATION_GATE_POLL_S: "20",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      now,
      readManifest: () => ["20260101000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(1);
    const combined = logs.join("\n");
    expect(combined).not.toContain(secretKey);
    // Only the host is logged, never the scheme+host as a bare fetchable URL.
    expect(combined).toContain("project.supabase.co");
    expect(combined).not.toContain("https://project.supabase.co");
  });

  it("scrubs the project URL out of a network error's own message (e.g. a connection-refused text)", async () => {
    const { now, sleep } = fakeClock();
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed: connect ECONNREFUSED https://project.supabase.co:443");
    });
    const logs: string[] = [];

    await runGate({
      env: {
        DEPLOY_MIGRATION_GATE: "enforce",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        DEPLOY_MIGRATION_GATE_MAX_WAIT_S: "20",
        DEPLOY_MIGRATION_GATE_POLL_S: "20",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      now,
      readManifest: () => ["20260101000000"],
      log: (message) => logs.push(message),
    });

    expect(logs.join("\n")).not.toContain("https://project.supabase.co");
  });

  it("--self-test passes with a non-empty manifest and touches no network", async () => {
    const fetchImpl = vi.fn();
    const logs: string[] = [];

    const result = await runGate({
      argv: ["--self-test"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readManifest: () => ["20260101000000"],
      log: (message) => logs.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logs.join("\n")).toMatch(/self-test passed/);
  });

  it("--self-test fails when the manifest has no versions", async () => {
    const result = await runGate({
      argv: ["--self-test"],
      readManifest: () => [],
      log: () => {},
    });

    expect(result.exitCode).toBe(1);
  });

  it("--self-test fails (rather than crashing) when the manifest cannot be read at all", async () => {
    const result = await runGate({
      argv: ["--self-test"],
      readManifest: () => {
        throw new Error("ENOENT: no such file");
      },
      log: () => {},
    });

    expect(result.exitCode).toBe(1);
  });
});

describe("the manifest writer's real output round-trips through --self-test", () => {
  it("a manifest written by write-migration-manifest.mjs to a real file is read back and passes --self-test", async () => {
    const scratchDir = mkdtempSync(join(tmpdir(), "deploy-migration-gate-"));
    const manifestPath = join(scratchDir, "expected-migrations.json");
    try {
      const written = writeManifest({ manifestPath });
      expect(written.versions.length).toBeGreaterThan(0);

      const result = await runGate({
        argv: ["--self-test"],
        readManifest: () => readManifestVersions(manifestPath),
        log: () => {},
      });

      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
