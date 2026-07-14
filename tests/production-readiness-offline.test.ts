import { describe, expect, it } from "vitest";

import { openAIReadinessPolicy } from "../scripts/production-readiness";

describe("production readiness provider policy", () => {
  it("requires an OpenAI key for auto and openai modes", () => {
    expect(openAIReadinessPolicy("auto")).toEqual({ required: true, ready: false });
    expect(openAIReadinessPolicy("openai")).toEqual({ required: true, ready: false });
    expect(openAIReadinessPolicy("auto", "configured")).toEqual({ required: true, ready: true });
  });

  it("allows a missing OpenAI key only for explicit offline mode", () => {
    expect(openAIReadinessPolicy("offline")).toEqual({ required: false, ready: true });
  });
});
