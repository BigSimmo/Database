import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// RAG_TEXT_WEAK_OR_RELAXATION is an opt-in P8b experiment that is known to
// regress the golden retrieval eval when left on (see the comment above the
// field in src/lib/env.ts). .env.example previously committed the stale
// `true` value, which disagreed with the schema's actual `false` default;
// this PR corrects the committed default back to `false`. These tests guard
// against the two drifting apart again: the literal value committed in
// .env.example, and its parity with the env.ts zod schema default (which is
// the actual runtime behaviour whenever the var is left unset).

const envExamplePath = path.join(process.cwd(), ".env.example");

function readEnvExampleValue(key: string): string | undefined {
  const content = readFileSync(envExamplePath, "utf8");
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1];
}

async function loadEnvWith(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv("RAG_TEXT_WEAK_OR_RELAXATION", value);
  return import("../src/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe(".env.example RAG_TEXT_WEAK_OR_RELAXATION", () => {
  it("commits the safe default (false), not the regressive true", () => {
    expect(readEnvExampleValue("RAG_TEXT_WEAK_OR_RELAXATION")).toBe("false");
  });

  it("matches src/lib/env.ts's own schema default when the var is unset", async () => {
    const { env } = await loadEnvWith(undefined);
    expect(env.RAG_TEXT_WEAK_OR_RELAXATION).toBe(false);
    expect(String(env.RAG_TEXT_WEAK_OR_RELAXATION)).toBe(readEnvExampleValue("RAG_TEXT_WEAK_OR_RELAXATION"));
  });

  it("resolves to the same boolean whether taken from env.ts's default or the literal .env.example value", async () => {
    const exampleValue = readEnvExampleValue("RAG_TEXT_WEAK_OR_RELAXATION");
    expect(exampleValue).toBeDefined();

    const { env: defaulted } = await loadEnvWith(undefined);
    const { env: fromExample } = await loadEnvWith(exampleValue);

    expect(fromExample.RAG_TEXT_WEAK_OR_RELAXATION).toBe(defaulted.RAG_TEXT_WEAK_OR_RELAXATION);
  });

  it("still transforms an explicit true to true (regression guard: flag is not hard-disabled)", async () => {
    const { env } = await loadEnvWith("true");
    expect(env.RAG_TEXT_WEAK_OR_RELAXATION).toBe(true);
  });

  it("documents the golden-eval regression and kill-switch semantics in the surrounding comment", () => {
    const content = readFileSync(envExamplePath, "utf8");
    const idx = content.indexOf("RAG_TEXT_WEAK_OR_RELAXATION=false");
    expect(idx).toBeGreaterThan(-1);
    const commentBlock = content.slice(Math.max(0, idx - 500), idx);
    expect(commentBlock).toMatch(/OFF by default/i);
    expect(commentBlock).toMatch(/golden retrieval eval/i);
    expect(commentBlock).toMatch(/36\/36/);
  });
});