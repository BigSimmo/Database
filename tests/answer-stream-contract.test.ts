import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isAnswerStreamEventName } from "../src/lib/answer-stream-contract";

describe("answer stream client safety contract", () => {
  it("accepts only final-only clinical stream events", () => {
    expect(isAnswerStreamEventName("progress")).toBe(true);
    expect(isAnswerStreamEventName("final")).toBe(true);
    expect(isAnswerStreamEventName("error")).toBe(true);
    expect(isAnswerStreamEventName("token")).toBe(false);
    expect(isAnswerStreamEventName("revising")).toBe(false);
  });

  it("has no provisional answer rendering path in the dashboard", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");

    expect(dashboard).not.toContain("StreamingAnswerPreview");
    expect(dashboard).not.toContain("setStreamingAnswer");
    expect(dashboard).not.toContain('event === "token"');
    expect(dashboard).not.toContain('event === "revising"');
  });
});
