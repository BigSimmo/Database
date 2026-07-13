import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("document viewer useful-page navigation", () => {
  it("does not carry an unrelated citation chunk into a new page link", () => {
    const source = readFileSync(new URL("../src/components/DocumentViewer.tsx", import.meta.url), "utf8");
    const pageHrefBody = source.match(/const documentPageHref = \(page: number\) => \{([\s\S]*?)\n  \};/)?.[1] ?? "";

    expect(pageHrefBody).not.toContain('params.set("chunk", chunkId)');
  });
});
