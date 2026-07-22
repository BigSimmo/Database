import { describe, expect, it, vi } from "vitest";

import {
  findInteractiveTapLiteralsInSource,
  hasLegacyTapClass,
  rawColorContractSource,
} from "../scripts/design-system-contract-utils.mjs";

describe("design-system contract helpers", () => {
  it("detects variant-prefixed tap literals inside composed interactive classes", () => {
    expect(hasLegacyTapClass("sm:h-11")).toBe(true);
    expect(hasLegacyTapClass("dark:md:min-w-11")).toBe(true);
    expect(
      findInteractiveTapLiteralsInSource(
        "src/example.tsx",
        '<button className={cn("h-11", active && "md:w-11", `focus:min-h-11`)}>Save</button>',
      ),
    ).toEqual(["src/example.tsx:1"]);
    expect(
      findInteractiveTapLiteralsInSource(
        "src/example.tsx",
        '<div className={cn("h-11", active && "md:w-11")}>Decoration</div>',
      ),
    ).toEqual([]);
  });

  it("masks raw colours only inside the two fixed-paper rendering scopes", () => {
    const reportFailure = vi.fn();
    const therapySource = [
      ".tc-app { color: #123456; }",
      ".tc-paper { /* a closing brace here must be inert: } */ color: #ffffff; }",
      ".tc-app-after-paper { color: #654321; }",
      "@media print { /* an opening brace here must be inert: { */ body { background: #ffffff; } }",
    ].join("\n");
    const scopedTherapy = rawColorContractSource(
      "src/components/therapy-compass/therapy-compass.css",
      therapySource,
      reportFailure,
    );
    expect(scopedTherapy).toContain("#123456");
    expect(scopedTherapy).toContain("#654321");
    expect(scopedTherapy).not.toContain("#ffffff");

    const factsheetSource = [
      'const appChrome = "#123456";',
      'function FactsheetPrintSheet() { return <div style={{ color: "#ffffff" }} />; }',
    ].join("\n");
    const scopedFactsheet = rawColorContractSource(
      "src/components/factsheets/factsheet-detail-page.tsx",
      factsheetSource,
      reportFailure,
    );
    expect(scopedFactsheet).toContain("#123456");
    expect(scopedFactsheet).not.toContain("#ffffff");
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("masks only the pre-paint theme-color constant, not the rest of theme.ts", () => {
    const reportFailure = vi.fn();
    const source = [
      "export const APP_THEME_COLORS = {",
      '  light: "#ffffff",',
      '  dark: "#060708",',
      "} as const satisfies Record<ResolvedTheme, string>;",
      "",
      "// A later, unrelated raw colour in this file must stay countable — the",
      "// whole-file exemption this replaced would have hidden it.",
      'export const UNRELATED_ACCENT = "#0f766e";',
      'export const SCRIPT = `var c=d?"${APP_THEME_COLORS.dark}":"${APP_THEME_COLORS.light}";`;',
    ].join("\n");

    const scoped = rawColorContractSource("src/lib/theme.ts", source, reportFailure);

    expect(scoped).not.toContain("#ffffff");
    expect(scoped).not.toContain("#060708");
    expect(scoped).toContain("#0f766e");
    // The interpolating bootstrap script holds no literals of its own and must
    // survive masking intact.
    expect(scoped).toContain("APP_THEME_COLORS.dark");
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("fails closed when the pre-paint theme-color boundary disappears", () => {
    const reportFailure = vi.fn();
    // The constant was renamed/removed but the exemption still matches the path.
    const source = 'export const THEME_COLORS = { light: "#ffffff" };';

    // Unmasked, so both literals are counted and the ratcheted baseline goes red
    // rather than silently exempting the file.
    expect(rawColorContractSource("src/lib/theme.ts", source, reportFailure)).toBe(source);
    expect(reportFailure).toHaveBeenCalledWith("pre-paint theme-color boundary is missing");
  });

  it("fails closed when a fixed-paper boundary disappears", () => {
    const reportFailure = vi.fn();
    const source = ".tc-app { color: #123456; }";

    expect(rawColorContractSource("src/components/therapy-compass/therapy-compass.css", source, reportFailure)).toBe(
      source,
    );
    expect(reportFailure).toHaveBeenCalledWith("printable Therapy paper raw-color boundaries are missing");
  });
});
