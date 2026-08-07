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

  it("breaks project-scoped sk-proj- keys, whose hyphen an alnum-only tail rejects", () => {
    // `sk-proj-` puts a hyphen four characters in. An `[A-Za-z0-9]{16,}` tail
    // never matches it, so the key shape most likely to be pasted into source
    // was the one shape left unescaped.
    const keyShaped = "prefix sk-proj-abcdefghijklmnop_qrstuvwxyz012345 suffix";
    const escaped = escapeFalseOpenAiKeySignatures(keyShaped);
    expect(escaped).toContain("s\\u006b-proj-abcdefghijklmnop_qrstuvwxyz012345");
    expect(escaped).not.toContain("sk-proj-abcdefghijklmnop");
    expect(JSON.parse(`"${escaped.split(" ")[1]}"`)).toBe("sk-proj-abcdefghijklmnop_qrstuvwxyz012345");
  });

  it("still leaves hyphenated clinical prose alone with the widened tail", () => {
    // The widened tail accepts `-`, so re-pin the words that the original
    // mid-word rewrite mangled. `\b` anchoring is what keeps these safe.
    const prose = JSON.stringify(
      [
        { name: "Task-centred practice with positive risk-taking and skill-building support work" },
        { slug: "risk-taking-and-task-centred-community-casework-support" },
      ],
      null,
      2,
    );
    expect(escapeFalseOpenAiKeySignatures(prose)).toBe(prose);
  });
});
