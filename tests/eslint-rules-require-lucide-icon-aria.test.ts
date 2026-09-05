import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/require-lucide-icon-aria.mjs";

// L67: no RuleTester coverage existed for this rule. Covers the three in-scope tag shapes (a
// direct lucide-react value import, a local `*Icon`-suffixed value, and `<x.icon />` /
// `<x.Icon />` member tags), the accessibility-intent escape hatches, the spread escape, and the
// two deliberate exclusions the rule's own comment documents: a component declared in the same
// module and a name imported from elsewhere.
const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
      sourceType: "module",
    },
    plugins: { local: { rules: { "require-lucide-icon-aria": rule } } },
    rules: { "local/require-lucide-icon-aria": "error" },
  });
}

function messageIds(code: string) {
  return lint(code).map((message) => message.messageId);
}

describe("require-lucide-icon-aria", () => {
  it("flags a lucide-react value import rendered with no accessibility intent", () => {
    expect(messageIds('import { ChevronRight } from "lucide-react";\nconst x = <ChevronRight />;')).toEqual([
      "missing",
    ]);
  });

  it("does not flag a lucide-react icon marked aria-hidden", () => {
    expect(
      messageIds('import { ChevronRight } from "lucide-react";\nconst x = <ChevronRight aria-hidden="true" />;'),
    ).toEqual([]);
  });

  it("does not flag a lucide-react icon that carries an accessible name", () => {
    expect(
      messageIds('import { ChevronRight } from "lucide-react";\nconst x = <ChevronRight aria-label="Next" />;'),
    ).toEqual([]);
  });

  it("flags an unresolved *Icon-suffixed tag (an icon held in a value)", () => {
    expect(messageIds("const x = <TitleIcon />;")).toEqual(["missing"]);
  });

  it("does not flag a *Icon-suffixed tag that resolves to a function component declared in the module", () => {
    expect(messageIds("function ToolIcon() { return <svg />; }\nconst x = <ToolIcon />;")).toEqual([]);
  });

  it("does not flag a *Icon-suffixed tag that resolves to a const arrow-function component", () => {
    expect(messageIds("const ProviderBrandIcon = () => <svg />;\nconst x = <ProviderBrandIcon />;")).toEqual([]);
  });

  it("does not flag a *Icon-suffixed tag imported from another module", () => {
    expect(messageIds('import { ToolIcon } from "./icons";\nconst x = <ToolIcon />;')).toEqual([]);
  });

  it("flags a member-expression icon tag (<item.icon />) with no accessibility intent", () => {
    expect(messageIds("const item = {};\nconst x = <item.icon />;")).toEqual(["missing"]);
  });

  it("does not flag a member-expression tag whose property is not icon-shaped", () => {
    expect(messageIds("const Foo = {};\nconst x = <Foo.Provider />;")).toEqual([]);
  });

  it("does not flag an icon tag that spreads props (aria-* may arrive dynamically)", () => {
    expect(messageIds('import { ChevronRight } from "lucide-react";\nconst x = <ChevronRight {...rest} />;')).toEqual(
      [],
    );
  });
});
