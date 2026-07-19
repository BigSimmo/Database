import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("differentials ModeHomeMain alignment", () => {
  it("top-aligns tall search results and keeps empty home centred", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/components/differentials/differentials-home-page.tsx"),
      "utf8",
    );
    const modeHomeSource = readFileSync(resolve(process.cwd(), "src/components/mode-home-template.tsx"), "utf8");

    // Results path must opt into start alignment via the ModeHomeMain prop —
    // className overrides are unreliable because cn() does not merge Tailwind.
    expect(pageSource).toMatch(/contentAlign=\{autoRunSearch \? "start" : "center"\}/);
    expect(modeHomeSource).toMatch(/contentAlign\s*=\s*"center"/);
    expect(modeHomeSource).toMatch(/contentAlign === "start"/);
    expect(modeHomeSource).toMatch(/justify-start/);
    expect(modeHomeSource).toMatch(/justify-center/);
  });
});
