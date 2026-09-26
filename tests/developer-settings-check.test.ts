import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { EXPECTED_RAILWAY_SECRETS, parseEnvSchemaNames } from "../scripts/check-env-parity.mjs";
import {
  buildSettingsCheckRows,
  PROGRAMME_MODES,
  PROVIDER_MODES,
  settingsCheckFor,
  summariseSettings,
  type SettingRow,
} from "@/lib/developer-area/settings-check";
import { expectedSupabaseProject, staleSupabaseProjects } from "@/lib/supabase/project";

/**
 * The Settings check page shows the owner which production switches are on and
 * which secrets are in place. Its one hard rule is that no value ever leaves the
 * server: every row is built from a fixed name list and every state is one of a
 * closed set of words. These tests pin that rule, the attention logic, and that
 * nothing at all comes back without the administrator claim.
 */

const ADMIN = { app_metadata: { site_role: "administrator" } };
const MEMBER = { app_metadata: { site_role: "member" } };

function byKey(rows: SettingRow[], key: string): SettingRow {
  const row = rows.find((entry) => entry.key === key);
  if (!row) throw new Error(`no row for ${key}`);
  return row;
}

/** A healthy production-shaped environment, as raw strings. */
const HEALTHY: Record<string, string> = {
  RAG_QUERY_HASH_SECRET: "q".repeat(32),
  OPENAI_SAFETY_IDENTIFIER_SECRET: "s".repeat(40),
  RAG_PERSIST_RAW_QUERY_TEXT: "false",
  RAG_PERSIST_ANSWER_TEXT: "false",
  OPENAI_STORE_RESPONSES: "false",
  RAG_PROGRAMME_MODE: "legacy",
  RAG_PROVIDER_MODE: "auto",
  NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
  SUPABASE_PROJECT_REF: expectedSupabaseProject.ref,
  SUPABASE_PROJECT_NAME: expectedSupabaseProject.name,
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  OPENAI_API_KEY: "sk-test",
  SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
  DEVELOPER_AREA_ACCESS_KEY: "d".repeat(40),
  RAILWAY_WEBHOOK_SECRET: "r".repeat(20),
  SUPABASE_INGESTION_WEBHOOK_SECRET: "i".repeat(20),
  HEALTH_DEEP_PROBE_SECRET: "h".repeat(20),
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/x",
  SPEND_ALERT_DAILY_USD: "25",
};

describe("settings check rows", () => {
  it("covers the four groups and reports a healthy environment with nothing needing attention", () => {
    const rows = buildSettingsCheckRows(HEALTHY);
    expect(new Set(rows.map((row) => row.group))).toEqual(
      new Set(["privacy", "answer-engine", "connections", "alerts-and-access"]),
    );
    expect(rows.filter((row) => row.attention)).toEqual([]);
    expect(byKey(rows, "RAG_QUERY_HASH_SECRET").state).toBe("set");
    expect(byKey(rows, "RAG_PERSIST_RAW_QUERY_TEXT").state).toBe("off");
    expect(byKey(rows, "SUPABASE_PROJECT_REF").state).toBe("matches");
    expect(byKey(rows, "SPEND_ALERT_DAILY_USD").state).toBe("set");
  });

  it("flags a missing expected secret and a privacy switch that is on", () => {
    const rows = buildSettingsCheckRows({
      ...HEALTHY,
      RAG_QUERY_HASH_SECRET: "",
      OPENAI_API_KEY: undefined as unknown as string,
      RAG_PERSIST_ANSWER_TEXT: "true",
      OPENAI_STORE_RESPONSES: "true",
    });
    expect(byKey(rows, "RAG_QUERY_HASH_SECRET")).toMatchObject({ state: "missing", expected: "set", attention: true });
    expect(byKey(rows, "OPENAI_API_KEY")).toMatchObject({ state: "missing", attention: true });
    expect(byKey(rows, "RAG_PERSIST_ANSWER_TEXT")).toMatchObject({ state: "on", expected: "off", attention: true });
    expect(byKey(rows, "OPENAI_STORE_RESPONSES")).toMatchObject({ state: "on", attention: true });
  });

  it("parses switches the way env.ts does: only the exact string true, or a parsed true, is on", () => {
    for (const [value, state] of [
      ["true", "on"],
      [true, "on"],
      ["false", "off"],
      [false, "off"],
      ["TRUE", "off"],
      ["1", "off"],
      [undefined, "off"],
    ] as const) {
      expect(
        byKey(buildSettingsCheckRows({ RAG_PERSIST_RAW_QUERY_TEXT: value }), "RAG_PERSIST_RAW_QUERY_TEXT").state,
      ).toBe(state);
    }
  });

  it("reports answer-engine switches without judging them", () => {
    const rows = buildSettingsCheckRows({
      ...HEALTHY,
      RAG_SEMANTIC_RERANK_ENABLED: "true",
      CLINICAL_ASK_ENABLED: "true",
    });
    const engine = rows.filter((row) => row.group === "answer-engine");
    expect(engine.length).toBe(10);
    for (const row of engine) {
      expect(row.expected, row.key).toBeNull();
      expect(row.attention, row.key).toBe(false);
    }
    expect(byKey(rows, "RAG_SEMANTIC_RERANK_ENABLED").state).toBe("on");
    expect(byKey(rows, "RAG_ADAPTIVE_ANSWER_ENABLED").state).toBe("off");
  });

  it("reports modes only from the allow-list, and an unknown value as the env.ts default", () => {
    const canary = buildSettingsCheckRows({ RAG_PROGRAMME_MODE: "canary", RAG_PROVIDER_MODE: "offline" });
    expect(byKey(canary, "RAG_PROGRAMME_MODE").state).toBe("canary");
    expect(byKey(canary, "RAG_PROVIDER_MODE").state).toBe("offline");

    const odd = buildSettingsCheckRows({ RAG_PROGRAMME_MODE: "DROP TABLE", RAG_PROVIDER_MODE: "sk-live-9" });
    expect(byKey(odd, "RAG_PROGRAMME_MODE").state).toBe("legacy");
    expect(byKey(odd, "RAG_PROVIDER_MODE").state).toBe("auto");
    expect(PROGRAMME_MODES).toEqual(["legacy", "shadow", "canary"]);
    expect(PROVIDER_MODES).toEqual(["auto", "openai", "offline"]);
  });

  it("reports the database project as matches, does not match, or not set, never the ref", () => {
    const stale = staleSupabaseProjects[0];
    expect(byKey(buildSettingsCheckRows(HEALTHY), "SUPABASE_PROJECT_REF")).toMatchObject({
      state: "matches",
      attention: false,
    });
    const wrong = buildSettingsCheckRows({
      ...HEALTHY,
      NEXT_PUBLIC_SUPABASE_URL: stale.url,
      SUPABASE_PROJECT_REF: stale.ref,
    });
    expect(byKey(wrong, "SUPABASE_PROJECT_REF")).toMatchObject({ state: "does not match", attention: true });
    expect(JSON.stringify(wrong)).not.toContain(stale.ref);
    const none = buildSettingsCheckRows({ ...HEALTHY, NEXT_PUBLIC_SUPABASE_URL: "" });
    expect(byKey(none, "SUPABASE_PROJECT_REF")).toMatchObject({ state: "not set", attention: true });
  });

  it("needs one alert channel, Slack or Discord, and flags both rows when neither is set", () => {
    const discordOnly = buildSettingsCheckRows({
      ...HEALTHY,
      SLACK_WEBHOOK_URL: "",
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/x",
    });
    expect(byKey(discordOnly, "SLACK_WEBHOOK_URL")).toMatchObject({ state: "missing", attention: false });
    expect(byKey(discordOnly, "DISCORD_WEBHOOK_URL")).toMatchObject({ state: "set", attention: false });

    const neither = buildSettingsCheckRows({ ...HEALTHY, SLACK_WEBHOOK_URL: "" });
    expect(byKey(neither, "SLACK_WEBHOOK_URL").attention).toBe(true);
    expect(byKey(neither, "DISCORD_WEBHOOK_URL").attention).toBe(true);
  });

  it("treats a spend alert of zero or absent as not set", () => {
    for (const value of ["0", 0, undefined, ""]) {
      expect(byKey(buildSettingsCheckRows({ SPEND_ALERT_DAILY_USD: value }), "SPEND_ALERT_DAILY_USD")).toMatchObject({
        state: "not set",
        attention: true,
      });
    }
    expect(byKey(buildSettingsCheckRows({ SPEND_ALERT_DAILY_USD: 12.5 }), "SPEND_ALERT_DAILY_USD").state).toBe("set");
  });

  it("labels only NEXT_PUBLIC_* rows as built in", () => {
    for (const row of buildSettingsCheckRows(HEALTHY)) {
      expect(row.builtIn, row.key).toBe(row.key.startsWith("NEXT_PUBLIC_"));
    }
    expect(byKey(buildSettingsCheckRows(HEALTHY), "NEXT_PUBLIC_SUPABASE_URL").builtIn).toBe(true);
  });

  it("never copies a value into the output", () => {
    // Every name the page reads, given a value no row could produce by itself.
    const distinctive: Record<string, string> = {};
    for (const row of buildSettingsCheckRows({})) {
      distinctive[row.key] = `zz-${row.key.toLowerCase()}-4f9c2e7b-value-zz`;
    }
    Object.assign(distinctive, {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      SUPABASE_PROJECT_NAME: "zz-project-name-value-zz",
      SUPABASE_STAGING_PROJECT_REF: "zyxwvutsrqponmlkjihg",
      SUPABASE_STAGING_PROJECT_NAME: "zz-staging-name-value-zz",
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/zz-slack-secret-zz",
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/zz-discord-secret-zz",
      SPEND_ALERT_DAILY_USD: "987654.321",
      RAG_PERSIST_RAW_QUERY_TEXT: "zz-switch-value-zz",
    });

    const serialised = JSON.stringify(settingsCheckFor(ADMIN, distinctive));
    for (const value of Object.values(distinctive)) {
      expect(serialised, value).not.toContain(value);
    }
    expect(serialised).not.toContain("zz-");
    expect(serialised).not.toContain("987654");
    expect(serialised).not.toContain("abcdefghijklmnopqrst");
  });

  it("uses only names env.ts declares, and expects every Railway secret the env-parity check expects", () => {
    const envNames = new Set(parseEnvSchemaNames(readFileSync(join(process.cwd(), "src/lib/env.ts"), "utf8")));
    const rows = buildSettingsCheckRows({});
    for (const row of rows) expect(envNames.has(row.key), row.key).toBe(true);
    for (const name of EXPECTED_RAILWAY_SECRETS) {
      expect(byKey(rows, name).expected, name).toBe("set");
    }
  });
});

describe("settings check summary", () => {
  it("counts attention, as-expected and reported-only rows without overlap", () => {
    const rows = buildSettingsCheckRows({ ...HEALTHY, OPENAI_API_KEY: "" });
    const summary = summariseSettings(rows);
    expect(summary.attention.map((row) => row.key)).toEqual(["OPENAI_API_KEY"]);
    expect(summary.attention.length + summary.asExpected + summary.reportedOnly).toBe(rows.length);
  });
});

describe("settings check access", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.resetModules();
  });

  it("returns no rows for a signed-out caller or a non-administrator", () => {
    expect(settingsCheckFor(null, HEALTHY)).toEqual({ kind: "unauthorized" });
    expect(settingsCheckFor(undefined, HEALTHY)).toEqual({ kind: "unauthorized" });
    expect(settingsCheckFor(MEMBER, HEALTHY)).toEqual({ kind: "unauthorized" });
    expect(settingsCheckFor(ADMIN, HEALTHY).kind).toBe("checked");
  });

  it("gives the developer-key cookie alone nothing: no session means no rows", async () => {
    // The link cookie is checked by the gate, never by this module. With no
    // Supabase session the resolver must not fall back to showing anything.
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => null }));
    const { resolveSettingsCheck } = await import("@/lib/developer-area/settings-check");
    expect(await resolveSettingsCheck(HEALTHY)).toEqual({ kind: "unauthorized" });
  });

  it("returns no rows when the signed-in user lacks the administrator claim, or the auth call rejects", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: MEMBER } }) } }),
    }));
    let loaded = await import("@/lib/developer-area/settings-check");
    expect(await loaded.resolveSettingsCheck(HEALTHY)).toEqual({ kind: "unauthorized" });

    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({
        auth: {
          getUser: async () => {
            throw new Error("network");
          },
        },
      }),
    }));
    loaded = await import("@/lib/developer-area/settings-check");
    expect(await loaded.resolveSettingsCheck(HEALTHY)).toEqual({ kind: "unauthorized" });
  });

  it("returns rows for a signed-in administrator", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: ADMIN } }) } }),
    }));
    const { resolveSettingsCheck } = await import("@/lib/developer-area/settings-check");
    const result = await resolveSettingsCheck(HEALTHY);
    expect(result.kind).toBe("checked");
  });
});
