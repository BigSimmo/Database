import { describe, expect, it } from "vitest";
import {
  rankToolRecords,
  toolCatalogRecordById,
  toolCatalogRecords,
  toolCatalogRecordsForSession,
} from "../src/lib/tools-catalog";
import { appModeHomeHref, type AppModeId } from "../src/lib/app-modes";
import { smartSearchExpansions } from "../src/lib/smart-search-intent";
import { tools as mockupToolFixtures } from "../src/components/tools-page-mockups/tool-fixtures";

describe("tools catalog", () => {
  it("has unique ids and the launcher staples", () => {
    const ids = toolCatalogRecords.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const staple of [
      "clinical-kb-search",
      "documents",
      "medication-prescribing",
      "services",
      "forms",
      "calculators",
    ]) {
      expect(ids).toContain(staple);
    }
  });

  it("links shared-home tools directly to their canonical mode homes", () => {
    const sharedHomeTools = [
      ["differentials", "differentials"],
      ["clinical-dictionary", "dictionary"],
      ["services", "services"],
      ["forms", "forms"],
      ["calculators", "calculators"],
    ] as const satisfies readonly (readonly [Parameters<typeof toolCatalogRecordById>[0], AppModeId])[];

    for (const [toolId, modeId] of sharedHomeTools) {
      expect(toolCatalogRecordById(toolId).href).toBe(appModeHomeHref(modeId));
      expect(toolCatalogRecordById(toolId).href).toBe(`/?mode=${modeId}`);
    }
  });

  // Ward Flow is deliberately absent from this catalogue — see
  // tests/ward-flow-sandbox.test.ts, which asserts no entry's href starts with
  // "/ward-management" or "/mockups/ward-flow" (the old and new sandbox paths).
  // A test here asserting it WAS reachable would fight that guard directly.

  it("ranks title matches above keyword-only matches", () => {
    const matches = rankToolRecords("forms");
    expect(matches[0].tool.id).toBe("forms");
    expect(matches[0].reasons).toContain("title");
  });

  it("finds tools through keywords", () => {
    const matches = rankToolRecords("contraindications");
    expect(matches.some((match) => match.tool.id === "risk-safety")).toBe(true);
  });

  it("ranks Smart medication-interaction intent and exact Forms queries ahead of other tools", () => {
    const expansions = smartSearchExpansions("tools", "where can I check medication interactions?");
    expect(rankToolRecords("where can I check medication interactions?", 5, expansions)[0]?.tool.id).toBe(
      "medication-prescribing",
    );
    expect(rankToolRecords("Forms")[0]?.tool.id).toBe("forms");
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

  it("excludes Favourites from guest Smart ranking", () => {
    const query = "where are my saved workflows?";
    expect(
      rankToolRecords(query, 10, smartSearchExpansions("tools", query), {
        authenticated: false,
        demoMode: false,
      }).map((match) => match.tool.id),
    ).not.toContain("favourites");
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
