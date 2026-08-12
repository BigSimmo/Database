import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/components/tools-search-directions-mockups.tsx", import.meta.url), "utf8");

describe("tools search direction mockup evidence", () => {
  it("renders frames at the widths named by their captions", () => {
    expect(source).toContain('device === "phone" ? "w-[390px]" : "w-[1280px]"');
    expect(source).toContain('device === "phone" ? "Phone 390" : "Desktop 1280"');
    expect(source).not.toContain('device === "phone" ? "w-[340px]" : "w-full max-w-[900px]"');
  });

  it("shows both representative queries at both widths for every direction", () => {
    const showcase = source.slice(source.indexOf("function DirectionShowcase"), source.indexOf("const currentDefects"));
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="monitoring" device="phone" />');
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="compare" device="phone" />');
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="monitoring" device="desktop" />');
    expect(showcase).toContain('<DeviceFrame direction={direction.id} query="compare" device="desktop" />');
  });
});
