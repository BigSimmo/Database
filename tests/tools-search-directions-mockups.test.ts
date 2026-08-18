import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { submittedToolIdsForMockup } from "../src/components/tools-search-directions-mockups";
import { normalizeSearchText } from "../src/lib/catalog-search";
import { toolCatalogRecords, toolSearchText } from "../src/lib/tools-catalog";
import { sourceSegment } from "./helpers/source-contract";

const source = readFileSync(new URL("../src/components/tools-search-directions-mockups.tsx", import.meta.url), "utf8");

function productionSubmittedToolIds(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return toolCatalogRecords
    .filter((tool) => (!normalized || toolSearchText(tool).includes(normalized)) && tool.id !== "favourites")
    .map((tool) => tool.id);
}

describe("tools search direction mockup evidence", () => {
  it("renders frames at the widths named by their captions", () => {
    expect(source).toContain('device === "phone" ? "w-[390px]" : "w-[1280px]"');
    expect(source).toContain('device === "phone" ? "Phone 390" : "Desktop 1280"');
    expect(source).not.toContain('device === "phone" ? "w-[340px]" : "w-full max-w-[900px]"');
  });

  it("shows both representative queries at both widths for every direction", () => {
    const showcase = sourceSegment(source, "function DirectionShowcase", "const currentDefects", {
      label: "direction showcase frames",
    });
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="monitoring" device="phone" />');
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="compare" device="phone" />');
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="monitoring" device="desktop" />');
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="compare" device="desktop" />');
  });

  it.each(["monitoring", "compare"])("uses the production submitted matcher for %s", (query) => {
    expect(submittedToolIdsForMockup(query)).toEqual(productionSubmittedToolIds(query));
  });

  it("keeps the ranked filter only for multi-match frames at both widths", () => {
    const brief = sourceSegment(source, "function BriefDirection", "function SegmentedCountBand", {
      label: "brief direction ranked filter",
    });
    expect(brief).toContain('device === "desktop" && matches.length > 1');
    expect(brief).toContain('device === "phone" && matches.length > 1');
    expect(brief).not.toContain('device === "desktop" ? <AreaFilterRow');
  });
});
