import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/components/dictionary-no-title-top-search-mockups.tsx"),
  "utf8",
);

describe("dictionary no-title top-search mockup", () => {
  it("retires the in-page Clinical terms heading from every device frame", () => {
    expect(source).not.toMatch(/Clinical terms/);
    expect(source).not.toMatch(/Clinical dictionary/);
    expect(source).toContain('<h2 className="sr-only">Dictionary catalogue</h2>');
  });

  it("puts the original composer at the top of the catalogue, not in a bottom dock", () => {
    expect(source).toContain('data-testid="mock-top-composer"');
    expect(source).not.toMatch(/absolute inset-x-0 bottom-0/);
    const composerIndex = source.indexOf("function TopComposer");
    const phoneFrameIndex = source.indexOf("function PhoneFrame");
    const phoneComposerUse = source.indexOf('<TopComposer state={state} size="phone" />');
    const filterBandUse = source.indexOf('<FilterBand state={state} slot="phone" />');
    expect(composerIndex).toBeGreaterThan(0);
    expect(phoneFrameIndex).toBeGreaterThan(composerIndex);
    expect(phoneComposerUse).toBeGreaterThan(phoneFrameIndex);
    expect(filterBandUse).toBeGreaterThan(phoneComposerUse);
  });

  it("steps phone Terms / Abbreviations and A–Z up to 36px", () => {
    expect(source).toContain('size === "phone" ? "h-9" : "h-7"');
    expect(source).toContain('size === "phone" ? "text-xs" : "text-2xs"');
    expect(source).toContain("inline-flex h-9 max-h-9 shrink-0 items-center");
  });

  it("shows browse and search on both phone and desktop frames", () => {
    expect(source).toContain('<PhoneFrame label="Browse" initialQuery={false} />');
    expect(source).toContain('<PhoneFrame label="Search" initialQuery />');
    expect(source).toContain('<DesktopFrame label="Browse" initialQuery={false} />');
    expect(source).toContain('<DesktopFrame label="Search" initialQuery />');
  });

  it("suppresses shared mockup chrome for the dictionary namespace", () => {
    const layout = readFileSync(path.join(process.cwd(), "src/app/mockups/mockups-layout-client.tsx"), "utf8");
    expect(layout).toContain('pathname.startsWith("/mockups/dictionary")');
    expect(layout).toContain("!isDictionaryMockup");
  });
});
