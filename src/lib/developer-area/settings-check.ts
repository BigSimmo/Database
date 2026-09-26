import "server-only";

import type { User } from "@supabase/supabase-js";

import { isAdministratorUser } from "@/lib/authorization";
import { env } from "@/lib/env";
import { checkSupabaseProjectConfig } from "@/lib/supabase/project";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The Owner panel's "Settings check": whether each production switch is on and
 * each secret is in place — never the values.
 *
 * **Nothing read from the environment is ever copied into the output.** Every
 * row is built from the fixed name list below, and every `state` is one of a
 * closed set of words chosen by this module: `set`/`missing`/`not set` for a
 * secret or an amount, `on`/`off` for a switch, `matches`/`does not match`/
 * `not set` for the database project, and — the one case where the setting's
 * own value decides the word — a mode name taken from this module's own
 * allow-list constant, never from the input string. An unrecognised mode value
 * reports the default env.ts falls back to, not the value.
 * `tests/developer-settings-check.test.ts` serialises a result built from an
 * environment full of distinctive values and fails if any of them appears.
 *
 * **Read from the parsed `env`, not raw `process.env`.** `resolveSettingsCheck`
 * passes env.ts's parsed object, so the page reports what the running server
 * actually uses: blank values already coerced to unset, an under-strength
 * developer key already dropped, and an invalid rollout setting already reset to
 * legacy/off by env.ts's fail-closed rule. The row builder also accepts raw
 * strings (`"true"`/`"false"`), parsed the same way env.ts parses them — only
 * the exact string `"true"` is on — so it can be tested with a plain record.
 *
 * **The administrator claim is checked here, not trusted from the gate.** The
 * developer-key cookie lets a link holder reach these pages, and nothing more
 * (see `developerLinkAccessGranted` in `access.ts`): like `corpus-health.ts` and
 * `environment-facts.ts`, this module requires the signed-in administrator
 * claim itself and returns no rows at all without it.
 */

export const PROGRAMME_MODES = ["legacy", "shadow", "canary"] as const;
export type ProgrammeMode = (typeof PROGRAMME_MODES)[number];

export const PROVIDER_MODES = ["auto", "openai", "offline"] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

export type SettingGroupId = "privacy" | "answer-engine" | "connections" | "alerts-and-access";

export const SETTING_GROUPS: readonly { id: SettingGroupId; name: string; blurb: string }[] = [
  { id: "privacy", name: "Privacy", blurb: "Settings the privacy assessment depends on." },
  {
    id: "answer-engine",
    name: "Answer engine",
    blurb:
      "Which answer features are switched on. There is no single right setting here, so these are reported, not judged.",
  },
  {
    id: "connections",
    name: "Connections",
    blurb: "What the site needs to reach its database, its AI provider and its error tracker.",
  },
  {
    id: "alerts-and-access",
    name: "Alerts and access",
    blurb: "How problems reach you, and how you get into these pages.",
  },
];

/** `amount` is the spend threshold; `project` is the database-project match. */
export type SettingKind = "secret" | "switch" | "mode" | "amount" | "project";

export type SettingState =
  "set" | "missing" | "not set" | "on" | "off" | "matches" | "does not match" | ProgrammeMode | ProviderMode;

/**
 * What the row should read. `either-alert-channel` is met when Slack or Discord
 * (or both) is set. `null` means there is no fixed expectation and the row is
 * reported only — it never needs attention.
 */
export type SettingExpectation = "set" | "off" | "matches" | "either-alert-channel" | null;

export type SettingRow = {
  group: SettingGroupId;
  label: string;
  key: string;
  description: string;
  kind: SettingKind;
  state: SettingState;
  expected: SettingExpectation;
  attention: boolean;
  /** `NEXT_PUBLIC_*`: the browser's copy is fixed when the site is built. */
  builtIn: boolean;
};

export type SettingsCheck = { kind: "unauthorized" } | { kind: "checked"; rows: SettingRow[] };

/** Anything env-shaped: env.ts's parsed object, or a raw string record. */
export type SettingsSource = Readonly<Record<string, unknown>>;

type Spec = {
  group: SettingGroupId;
  key: string;
  label: string;
  description: string;
} & (
  | { check: "secret"; expected: "set" | null }
  | { check: "switch"; expected: "off" | null }
  | { check: "mode"; modes: readonly string[]; fallback: string }
  | { check: "amount" }
  | { check: "project" }
  | { check: "alert-channel" }
);

const ALERT_CHANNEL_KEYS = ["SLACK_WEBHOOK_URL", "DISCORD_WEBHOOK_URL"] as const;

/**
 * The name list. Labels and descriptions are plain English for the owner; each
 * description was written from the comment and usage of that name in the code,
 * and says only what the code shows the setting does.
 */
const SPECS: readonly Spec[] = [
  // Privacy
  {
    group: "privacy",
    key: "RAG_QUERY_HASH_SECRET",
    label: "Question scrambling secret",
    description:
      "Turns each logged question into a keyed code that cannot be read back, and signs answer feedback. Production is meant to refuse to start without it.",
    check: "secret",
    expected: "set",
  },
  {
    group: "privacy",
    key: "OPENAI_SAFETY_IDENTIFIER_SECRET",
    label: "Safety identifier secret",
    description:
      "Lets OpenAI tell accounts apart for abuse checks using a scrambled code rather than the real account. Without it, requests carry no identifier.",
    check: "secret",
    expected: "set",
  },
  {
    group: "privacy",
    key: "RAG_PERSIST_RAW_QUERY_TEXT",
    label: "Save exact question wording",
    description:
      "Keeps the plain text of each question in the database instead of a scrambled placeholder. Questions can contain patient details, so this should stay off.",
    check: "switch",
    expected: "off",
  },
  {
    group: "privacy",
    key: "RAG_PERSIST_ANSWER_TEXT",
    label: "Save answer text",
    description:
      "Keeps the full text of each generated answer in the database. Answers can repeat patient details from the question, so this should stay off.",
    check: "switch",
    expected: "off",
  },
  {
    group: "privacy",
    key: "OPENAI_STORE_RESPONSES",
    label: "Let OpenAI keep responses",
    description: "Asks OpenAI to store a copy of each response on its side. Should stay off.",
    check: "switch",
    expected: "off",
  },

  // Answer engine
  {
    group: "answer-engine",
    key: "RAG_PROGRAMME_MODE",
    label: "Rollout stage",
    description:
      "Which answer pipeline serves: legacy is the current one, shadow runs the new one silently alongside it, and canary lets the new one serve a share of people. An invalid rollout setting falls back to legacy.",
    check: "mode",
    modes: PROGRAMME_MODES,
    fallback: "legacy",
  },
  {
    group: "answer-engine",
    key: "RAG_PROVIDER_MODE",
    label: "AI provider mode",
    description:
      "Auto uses OpenAI when it works and falls back to source-only answers when it does not. OpenAI always tries OpenAI. Offline never calls OpenAI.",
    check: "mode",
    modes: PROVIDER_MODES,
    fallback: "auto",
  },
  {
    group: "answer-engine",
    key: "RAG_GOVERNED_RETRIEVAL_ENABLED",
    label: "Governed search",
    description:
      "Lets the new pipeline search the governed library. The shadow and canary stages only change search while this is on.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "RAG_SITE_CONTENT_ENABLED",
    label: "The app's own pages as sources",
    description:
      "Lets answers draw on the app's own published pages. Only takes effect while governed search is on in shadow or canary.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "RAG_AUSTRALIAN_AUGMENTATION_ENABLED",
    label: "Australian source augmentation",
    description:
      "Adds Australian sources to governed search. Only takes effect while governed search is on in shadow or canary.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "RAG_ADAPTIVE_ANSWER_ENABLED",
    label: "Adaptive answers: writing",
    description: "Lets the new pipeline write answers in the newer adaptive format, for people it is serving.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "RAG_ADAPTIVE_ANSWER_RENDER_ENABLED",
    label: "Adaptive answers: showing",
    description: "Shows the adaptive answer sections on screen. When off, they stay hidden even if they were written.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "RAG_SEMANTIC_RERANK_ENABLED",
    label: "Second-pass ranking",
    description:
      "An extra AI pass that re-orders search results, used only when the top results are hard to tell apart.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "CLINICAL_ASK_ENABLED",
    label: "Clinical Ask",
    description:
      "Master switch for Clinical Ask and its voice transcription. When off, both are switched off entirely.",
    check: "switch",
    expected: null,
  },
  {
    group: "answer-engine",
    key: "CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED",
    label: "Clinical Ask outside search",
    description: "Lets Clinical Ask look beyond your own library. Has no effect while Clinical Ask is off.",
    check: "switch",
    expected: null,
  },

  // Connections
  {
    group: "connections",
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Database address",
    description: "Where the site finds its database.",
    check: "secret",
    expected: "set",
  },
  {
    group: "connections",
    key: "SUPABASE_PROJECT_REF",
    label: "Database project",
    description:
      "Whether the database address and project settings point at the live clinical database (or a declared staging one) rather than an old project. The project itself is never shown.",
    check: "project",
  },
  {
    group: "connections",
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Database server key",
    description: "The server-only key the site uses for its own database work, such as indexing.",
    check: "secret",
    expected: "set",
  },
  {
    group: "connections",
    key: "OPENAI_API_KEY",
    label: "OpenAI key",
    description: "Needed for AI answers, search embeddings and image captions.",
    check: "secret",
    expected: "set",
  },
  {
    group: "connections",
    key: "SENTRY_DSN",
    label: "Error tracking",
    description: "Sends server errors to Sentry. Without it, errors reach only the server logs.",
    check: "secret",
    expected: "set",
  },

  // Alerts and access
  {
    group: "alerts-and-access",
    key: "DEVELOPER_AREA_ACCESS_KEY",
    label: "Owner panel link key",
    description:
      "The secret behind your bookmarked link to these pages. Optional: when missing, the link is off and administrator sign-in is the only way in.",
    check: "secret",
    expected: null,
  },
  {
    group: "alerts-and-access",
    key: "RAILWAY_WEBHOOK_SECRET",
    label: "Deploy notice secret",
    description: "Lets Railway tell the site about new deploys. When missing, those notices are refused.",
    check: "secret",
    expected: "set",
  },
  {
    group: "alerts-and-access",
    key: "SUPABASE_INGESTION_WEBHOOK_SECRET",
    label: "Upload notice secret",
    description:
      "Lets the database tell the site that a new upload is waiting to be indexed. When missing, those notices are refused.",
    check: "secret",
    expected: "set",
  },
  {
    group: "alerts-and-access",
    key: "HEALTH_DEEP_PROBE_SECRET",
    label: "Deep health check secret",
    description:
      "Protects the detailed health check used by monitoring. When missing, only the short health check works.",
    check: "secret",
    expected: "set",
  },
  {
    group: "alerts-and-access",
    key: "SLACK_WEBHOOK_URL",
    label: "Slack alerts",
    description: "Where deploy and failure alerts are sent in Slack. Either Slack or Discord is enough.",
    check: "alert-channel",
  },
  {
    group: "alerts-and-access",
    key: "DISCORD_WEBHOOK_URL",
    label: "Discord alerts",
    description: "Where deploy and failure alerts are sent in Discord. Either Slack or Discord is enough.",
    check: "alert-channel",
  },
  {
    group: "alerts-and-access",
    key: "WORKER_FAILURE_WEBHOOK_URL",
    label: "Indexing failure alerts",
    description:
      "Where the indexing worker reports a document that failed. The worker is a separate service with its own settings, so this page, which reads the website's settings, cannot see the worker's copy.",
    check: "secret",
    expected: null,
  },
  {
    group: "alerts-and-access",
    key: "SPEND_ALERT_DAILY_USD",
    label: "Daily spend alert",
    description:
      "Raises a flag in the health check when projected daily OpenAI spend passes this amount. Zero or missing means no flag.",
    check: "amount",
  },
];

function isPresent(value: unknown): boolean {
  return typeof value === "string" ? value.trim() !== "" : value !== undefined && value !== null && value !== false;
}

/** env.ts parses every switch as `z.enum(["true","false"]).transform(v => v === "true")`. */
function isOn(value: unknown): boolean {
  return value === true || value === "true";
}

/** A string for `checkSupabaseProjectConfig`, which only compares; nothing it returns is copied out. */
function asConfigString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function row(spec: Spec, state: SettingState, expected: SettingExpectation, attention: boolean): SettingRow {
  return {
    group: spec.group,
    label: spec.label,
    key: spec.key,
    description: spec.description,
    kind: spec.check === "alert-channel" ? "secret" : spec.check,
    state,
    expected,
    attention,
    builtIn: spec.key.startsWith("NEXT_PUBLIC_"),
  };
}

function evaluate(spec: Spec, source: SettingsSource): SettingRow {
  const value = source[spec.key];
  switch (spec.check) {
    case "secret": {
      const set = isPresent(value);
      return row(spec, set ? "set" : "missing", spec.expected, spec.expected === "set" && !set);
    }
    case "switch": {
      const on = isOn(value);
      return row(spec, on ? "on" : "off", spec.expected, spec.expected === "off" && on);
    }
    case "mode": {
      // The output word comes from the allow-list constant, never from `value`.
      const known = spec.modes.find((mode) => mode === value) ?? spec.fallback;
      return row(spec, known as SettingState, null, false);
    }
    case "amount": {
      const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
      const set = Number.isFinite(amount) && amount > 0;
      return row(spec, set ? "set" : "not set", "set", !set);
    }
    case "project": {
      // The same shared check `/api/setup-status` reports as its "Clinical KB
      // Database target" line, grouped the same way: `ready` and `warning` both
      // count as on target there, `mismatch` does not, and `missing` means no
      // database address at all.
      const check = checkSupabaseProjectConfig(
        {
          NEXT_PUBLIC_SUPABASE_URL: asConfigString(source.NEXT_PUBLIC_SUPABASE_URL),
          SUPABASE_PROJECT_REF: asConfigString(source.SUPABASE_PROJECT_REF),
          SUPABASE_PROJECT_NAME: asConfigString(source.SUPABASE_PROJECT_NAME),
          SUPABASE_STAGING_PROJECT_REF: asConfigString(source.SUPABASE_STAGING_PROJECT_REF),
          SUPABASE_STAGING_PROJECT_NAME: asConfigString(source.SUPABASE_STAGING_PROJECT_NAME),
        },
        { requireMetadata: true },
      );
      const state: SettingState =
        check.status === "missing" ? "not set" : check.status === "mismatch" ? "does not match" : "matches";
      return row(spec, state, "matches", state !== "matches");
    }
    case "alert-channel": {
      const anyChannel = ALERT_CHANNEL_KEYS.some((key) => isPresent(source[key]));
      return row(spec, isPresent(value) ? "set" : "missing", "either-alert-channel", !anyChannel);
    }
  }
}

/** Pure: one row per name in the list, in list order. Never copies a value out. */
export function buildSettingsCheckRows(source: SettingsSource): SettingRow[] {
  return SPECS.map((spec) => evaluate(spec, source));
}

/** Pure: no rows at all unless the user carries the administrator claim. */
export function settingsCheckFor(
  user: Pick<User, "app_metadata"> | null | undefined,
  source: SettingsSource,
): SettingsCheck {
  if (!isAdministratorUser(user)) return { kind: "unauthorized" };
  return { kind: "checked", rows: buildSettingsCheckRows(source) };
}

export type SettingsSummary = {
  attention: SettingRow[];
  asExpected: number;
  reportedOnly: number;
};

export function summariseSettings(rows: readonly SettingRow[]): SettingsSummary {
  return {
    attention: rows.filter((entry) => entry.attention),
    asExpected: rows.filter((entry) => entry.expected !== null && !entry.attention).length,
    reportedOnly: rows.filter((entry) => entry.expected === null).length,
  };
}

/**
 * The page's entry point. Identifies the caller with the cookie-bound session
 * client (which reads no table) and requires the administrator claim; any
 * failure — no Supabase configuration, no session, a rejected auth call —
 * degrades to `unauthorized`, which shows no rows.
 */
export async function resolveSettingsCheck(source: SettingsSource = env): Promise<SettingsCheck> {
  try {
    const session = await createSupabaseServerClient();
    if (!session) return { kind: "unauthorized" };
    const { data } = await session.auth.getUser();
    return settingsCheckFor(data.user, source);
  } catch {
    return { kind: "unauthorized" };
  }
}
