import { describe, expect, it } from "vitest";
import {
  rankToolRecords,
  toolCatalogRecordById,
  toolCatalogRecords,
  toolCatalogRecordsForSession,
} from "../src/lib/tools-catalog";
import { tools as mockupToolFixtures } from "../src/components/tools-page-mockups/tool-fixtures";

describe("tools catalog", () => {
  it("has unique ids and the launcher staples", () => {
    const ids = toolCatalogRecords.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const staple of ["clinical-kb-search", "documents", "medication-prescribing", "services", "forms"]) {
      expect(ids).toContain(staple);
    }
  });

  it("ranks title matches above keyword-only matches", () => {
    const matches = rankToolRecords("forms");
    expect(matches[0].tool.id).toBe("forms");
    expect(matches[0].reasons).toContain("title");
  });

  it("finds tools through keywords", () => {
    const matches = rankToolRecords("contraindications");
    expect(matches.some((match) => match.tool.id === "risk-safety")).toBe(true);
  });

  it("returns nothing for an empty query", () => {
    expect(rankToolRecords("")).toEqual([]);
  });

  it("hides Saved workflows from guest sessions in ranking and catalog helpers", () => {
    const guestCatalog = toolCatalogRecordsForSession({ authenticated: false, demoMode: false });
    expect(guestCatalog.some((tool) => tool.id === "favourites")).toBe(false);
    // Omitting session must fail closed (same as explicit guest).
    expect(rankToolRecords("saved workflows", 10, []).map((m) => m.tool.id)).not.toContain("favourites");
    expect(
      rankToolRecords("saved workflows", 10, [], { authenticated: false, demoMode: false }).map((m) => m.tool.id),
    ).not.toContain("favourites");
    expect(
      rankToolRecords("saved workflows", 10, [], { authenticated: true, demoMode: false }).some(
        (match) => match.tool.id === "favourites",
      ),
    ).toBe(true);
    expect(
      toolCatalogRecordsForSession({ authenticated: true, demoMode: false }).some((tool) => tool.id === "favourites"),
    ).toBe(true);
  });

  it("keeps the mockup fixtures derived from catalog identity fields", () => {
    for (const fixture of mockupToolFixtures) {
      const record = toolCatalogRecordById(fixture.id);
      expect(record.id).toBe(fixture.id);
      expect(fixture.href).toBe(record.href);
      expect(fixture.sourceBacked).toBe(record.sourceBacked);
    }
  });
});
