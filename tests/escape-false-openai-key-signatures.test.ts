import { describe, expect, it } from "vitest";

import { escapeFalseOpenAiKeySignatures } from "../scripts/lib/escape-false-openai-key-signatures.mjs";

describe("escapeFalseOpenAiKeySignatures", () => {
  it("leaves ordinary words that contain sk- intact (task-centred)", () => {
    const pretty = JSON.stringify([{ slug: "task-centred-practice", name: "Task-centred practice" }], null, 2);
    expect(escapeFalseOpenAiKeySignatures(pretty)).toBe(pretty);
    expect(escapeFalseOpenAiKeySignatures(pretty)).toContain("task-centred-practice");
    expect(escapeFalseOpenAiKeySignatures(pretty)).not.toContain("\\u006b");
  });

  it("breaks OpenAI-key-shaped tokens so scanners do not false-positive", () => {
    const keyShaped = "prefix sk-abcdefghijklmnopqrstuvwxyz12 suffix";
    const escaped = escapeFalseOpenAiKeySignatures(keyShaped);
    expect(escaped).toContain("s\\u006b-abcdefghijklmnopqrstuvwxyz12");
    expect(escaped).not.toContain("sk-abcdefghijklmnopqrstuvwxyz12");
    // Consumers that JSON.parse escaped catalogue text still see the original.
    expect(JSON.parse(`"${escaped.split(" ")[1]}"`)).toBe("sk-abcdefghijklmnopqrstuvwxyz12");
  });
});
