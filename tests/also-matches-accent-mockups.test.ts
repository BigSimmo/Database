import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/components/also-matches-accent-mockups.tsx", import.meta.url), "utf8");

describe("also-matches accent mockups", () => {
  it("offers three alternatives to the top category rail", () => {
    expect(source).toContain('id: "quiet"');
    expect(source).toContain('id: "spine"');
    expect(source).toContain('id: "chip"');
    expect(source).toContain("cardAccentEdge");
    expect(source).toContain("border-l-[3px] border-l-[color:var(--cat-accent)]");
    expect(source).toContain("eyebrowText");
    expect(source).toContain("bg-[color:var(--cat-soft)]");
    expect(source).toContain('phone ? "grid-cols-1"');
    expect(source).toContain('data-testid="also-matches-chosen-chip"');
    expect(source).not.toContain("Across PsychSift");
  });

  it("keeps identity on category tokens, not clinical-state colour", () => {
    expect(source).not.toMatch(/--(danger|warning|success)\b/);
    expect(source).toContain("data-category-accent={accent}");
    expect(source).toContain("APP_MODE_ACCENT");
  });
});
