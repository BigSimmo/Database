import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sourceSegment } from "./helpers/source-contract";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("cold-load CSS and font delivery", () => {
  it("keeps mockup-only Tailwind utilities out of the production global sheet", () => {
    const globals = read("src/app/globals.css");
    const mockups = read("src/app/mockups/mockups.css");
    const layout = read("src/app/mockups/layout.tsx");

    expect(globals).toContain('@source not "./mockups";');
    expect(globals).toContain('@source not "../components/**/*mockup*";');
    expect(mockups).toContain('@import "tailwindcss/utilities.css" layer(utilities) source(none);');
    expect(mockups).not.toMatch(/source\(none\)\s+important/);
    expect(mockups).toContain('@reference "../globals.css";');
    expect(mockups).toContain('@source "../";');
    expect(mockups).toContain('@source "../../components";');
    expect(layout).toContain('import "./mockups.css";');
  });

  it("keeps the display-swap body font preloaded for LCP text", () => {
    const rootLayout = read("src/app/layout.tsx");
    const geistSans = sourceSegment(rootLayout, "const geistSans", "const geistMono", {
      label: "geistSans font configuration",
    });

    expect(geistSans).toContain('display: "swap"');
    expect(geistSans).not.toContain("preload: false");
  });
});
