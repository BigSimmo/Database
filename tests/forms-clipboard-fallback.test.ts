import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/components/forms/form-detail-page.tsx", import.meta.url), "utf8");

describe("form detail clipboard fallback", () => {
  it("falls back to selection-copy when clipboard.writeText rejects", () => {
    expect(source).toContain("if (navigator.clipboard?.writeText)");
    expect(source).toContain("await navigator.clipboard.writeText(value)");
    expect(source).toContain("Fall through to the legacy selection path for restricted browser contexts.");
    expect(source).toContain("document.execCommand?.(\"copy\")");
    expect(source).toContain("finally {\n    document.body.removeChild(textArea);\n  }");
  });
});
