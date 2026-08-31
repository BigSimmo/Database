import { describe, expect, it } from "vitest";

import { appliedInboxFallbackPath, markdownAnchorSlugs } from "../scripts/check-docs-links.mjs";

describe("appliedInboxFallbackPath", () => {
  it("maps a pending inbox UUID citation to the applied sibling", () => {
    expect(appliedInboxFallbackPath("docs/outstanding-issues-inbox/edebb730-91d9-42f5-bd93-ca2abb9678bc.json")).toBe(
      "docs/outstanding-issues-inbox/applied/edebb730-91d9-42f5-bd93-ca2abb9678bc.json",
    );
  });

  it("does not wrap an already-applied path or a nested inbox file", () => {
    expect(
      appliedInboxFallbackPath("docs/outstanding-issues-inbox/applied/edebb730-91d9-42f5-bd93-ca2abb9678bc.json"),
    ).toBeNull();
    expect(appliedInboxFallbackPath("docs/outstanding-issues-inbox/README.md")).toBeNull();
    expect(appliedInboxFallbackPath("docs/outstanding-issues.md")).toBeNull();
    expect(appliedInboxFallbackPath("docs/outstanding-issues-inbox/not-a-uuid.json")).toBeNull();
  });
});

describe("markdownAnchorSlugs", () => {
  it("extracts and slugifies standard and formatted headings", () => {
    const md = `
# Title

## 1. Quick Start

### Some \`code\` & [Link text](http://example.com)

## L0 — Structural (1)

### PR 1 — clinical status semantics

## Duplicate Heading

## Duplicate Heading
`;
    const slugs = markdownAnchorSlugs(md);
    expect(slugs.has("title")).toBe(true);
    expect(slugs.has("1-quick-start")).toBe(true);
    expect(slugs.has("some-code--link-text")).toBe(true);
    expect(slugs.has("l0--structural-1")).toBe(true);
    expect(slugs.has("pr-1--clinical-status-semantics")).toBe(true);
    expect(slugs.has("duplicate-heading")).toBe(true);
    expect(slugs.has("duplicate-heading-1")).toBe(true);
  });

  it("recognizes explicit HTML anchor ids and names", () => {
    const md = `
<a id="custom-target"></a>
<a name="legacy-name"></a>
<span id="span-anchor"></span>
`;
    const slugs = markdownAnchorSlugs(md);
    expect(slugs.has("custom-target")).toBe(true);
    expect(slugs.has("legacy-name")).toBe(true);
    expect(slugs.has("span-anchor")).toBe(true);
  });
});
