import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/require-z-index-ladder.mjs";

// L67: no RuleTester coverage existed for this rule (see no-hardcoded-hex.test.ts for why that
// matters). Pins the allowed rungs (0, 5, 10, 20, 30, 40, 60, 80-85, 95, 100, 110) and a
// disallowed rung in between.
const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { local: { rules: { "require-z-index-ladder": rule } } },
    rules: { "local/require-z-index-ladder": "error" },
  });
}

describe("require-z-index-ladder", () => {
  it("accepts every allowed rung, including the 80-85 band", () => {
    for (const rung of [0, 5, 10, 20, 30, 40, 60, 80, 81, 82, 83, 84, 85, 95, 100, 110]) {
      expect(lint(`const x = "z-[${rung}]";`)).toHaveLength(0);
    }
  });

  it("flags a rung not on the ladder", () => {
    const result = lint('const x = "z-[50]";');
    expect(result).toHaveLength(1);
    expect(result[0]?.messageId).toBe("invalid");
  });

  it("flags a rung above 110", () => {
    expect(lint('const x = "z-[120]";')).toHaveLength(1);
  });

  it("flags an invalid rung inside a template literal", () => {
    expect(lint("const x = `z-[7] absolute`;")).toHaveLength(1);
  });

  it("flags every invalid occurrence when more than one appears in the same string", () => {
    expect(lint('const x = "z-[50] z-[7]";')).toHaveLength(2);
  });

  it("does not flag an unrelated string with no z-[] utility", () => {
    expect(lint('const x = "flex items-center";')).toHaveLength(0);
  });
});
