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
});
