import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../src/components/factsheets/factsheets-topics-phone-mockups.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(new URL("../src/app/mockups/mockups-layout-client.tsx", import.meta.url), "utf8");

describe("factsheets topics phone mockups", () => {
  it("studies chips, accordion, and a hundred-item stress case on a 390 px frame", () => {
    expect(source).toContain('id: "chips"');
    expect(source).toContain('id: "accordion"');
    expect(source).toContain('id: "dense"');
    expect(source).toContain("recommended: true");
    expect(source).toContain("390 × 844");
    expect(source).toContain('label: "Search"');
    expect(source).toContain('label: "Topics"');
    expect(source).toContain("Show all");
    expect(source).toContain("topicChipOverflow");
    expect(source).toContain('data-testid="factsheets-topics-phone-mockups"');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("suppresses shared mockup chrome so the framed ModeNav is the only bar", () => {
    expect(layout).toContain('pathname === "/mockups/factsheets-topics-phone"');
    expect(layout).toContain("isFactsheetsTopicsPhoneMockup");
  });
});
