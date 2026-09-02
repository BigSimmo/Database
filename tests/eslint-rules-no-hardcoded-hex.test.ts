import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/no-hardcoded-hex.mjs";

// L67: this rule (like the other three custom rules beside require-button-wiring) had no
// RuleTester/unit coverage — `npm run lint` going green proves the repo is clean, not that the
// rule can still fail. These cases pin both directions.
const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { local: { rules: { "no-hardcoded-hex": rule } } },
    rules: { "local/no-hardcoded-hex": "error" },
  });
}

describe("no-hardcoded-hex", () => {
  it("flags a hardcoded hex background utility", () => {
    expect(lint('const x = "bg-[#ffffff]";')).toHaveLength(1);
  });

  it("flags a hardcoded hex text and border utility", () => {
    expect(lint('const x = "text-[#fff]";')).toHaveLength(1);
    expect(lint('const x = "border-[#123abc]";')).toHaveLength(1);
  });

  it("flags a hex utility inside a template literal", () => {
    expect(lint("const x = `bg-[#ffffff] p-2`;")).toHaveLength(1);
  });

  it("does not flag a semantic CSS variable utility", () => {
    expect(lint('const x = "bg-[color:var(--surface)]";')).toHaveLength(0);
  });

  it("does not flag an unrelated string containing a hex-looking fragment without the utility prefix", () => {
    expect(lint('const x = "#ffffff";')).toHaveLength(0);
  });

  it("does not flag a plain Tailwind class with no hex value", () => {
    expect(lint('const x = "bg-surface text-sm";')).toHaveLength(0);
  });
});
