import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Gate 1 / PR 3 — design-system recipes must not put the decoration tier on
 * text nodes (eyebrows, placeholders). Decorative glyphs may still use
 * `--text-soft` / `--decoration-soft`.
 */

const primitives = readFileSync(new URL("../src/components/ui-primitives.tsx", import.meta.url), "utf8");

describe("decoration-on-text contracts", () => {
  it("keeps eyebrowText on a text-tier token, not --text-soft", () => {
    const match = primitives.match(/export const eyebrowText\s*=\s*"([^"]+)"/);
    expect(match, "eyebrowText recipe missing").toBeTruthy();
    expect(match![1]).not.toContain("--text-soft");
    expect(match![1]).not.toContain("--decoration-soft");
    expect(match![1]).toContain("--text-muted");
  });

  it("keeps fieldControl placeholders on --text-placeholder", () => {
    const match = primitives.match(/export const fieldControl\s*=\s*"([^"]+)"/);
    expect(match, "fieldControl recipe missing").toBeTruthy();
    expect(match![1]).toContain("placeholder:text-[color:var(--text-placeholder)]");
    expect(match![1]).not.toContain("placeholder:text-[color:var(--text-soft)]");
  });
});
