import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { openAIReadinessPolicy } from "../scripts/production-readiness";

describe("production readiness provider policy", () => {
  it("passes the explicit staging declaration to the shared project guard", () => {
    const source = readFileSync(new URL("../scripts/production-readiness.ts", import.meta.url), "utf8");
    expect(source).toContain("SUPABASE_STAGING_PROJECT_REF: process.env.SUPABASE_STAGING_PROJECT_REF");
    expect(source).toContain("SUPABASE_STAGING_PROJECT_NAME: process.env.SUPABASE_STAGING_PROJECT_NAME");
  });

  it("requires an OpenAI key for auto and openai modes", () => {
    expect(openAIReadinessPolicy("auto")).toEqual({ required: true, ready: false });
    expect(openAIReadinessPolicy("openai")).toEqual({ required: true, ready: false });
    expect(openAIReadinessPolicy("auto", "configured")).toEqual({ required: true, ready: true });
  });

  it("allows a missing OpenAI key only for explicit offline mode", () => {
    expect(openAIReadinessPolicy("offline")).toEqual({ required: false, ready: true });
  });
});
