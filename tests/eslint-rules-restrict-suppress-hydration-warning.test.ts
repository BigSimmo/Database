import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/restrict-suppress-hydration-warning.mjs";

// L67: no RuleTester coverage existed for this rule. Pins the html/body/script allowlist and
// that every other tag is flagged.
const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { local: { rules: { "restrict-suppress-hydration-warning": rule } } },
    rules: { "local/restrict-suppress-hydration-warning": "error" },
  });
}

describe("restrict-suppress-hydration-warning", () => {
  it("allows suppressHydrationWarning on <html>", () => {
    expect(lint("const x = <html suppressHydrationWarning />;")).toHaveLength(0);
  });

  it("allows suppressHydrationWarning on <body>", () => {
    expect(lint("const x = <body suppressHydrationWarning />;")).toHaveLength(0);
  });

  it("allows suppressHydrationWarning on <script> (nonce mismatch bypass)", () => {
    expect(lint("const x = <script suppressHydrationWarning />;")).toHaveLength(0);
  });

  it("flags suppressHydrationWarning on a <div>", () => {
    expect(lint("const x = <div suppressHydrationWarning />;")).toHaveLength(1);
  });

  it("flags suppressHydrationWarning on a <span>", () => {
    expect(lint("const x = <span suppressHydrationWarning />;")).toHaveLength(1);
  });

  it("does not flag an element with no suppressHydrationWarning attribute", () => {
    expect(lint('const x = <div className="x" />;')).toHaveLength(0);
  });
});
