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
      ".tc-paper { color: #ffffff; }",
      ".tc-app-after-paper { color: #654321; }",
      "@media print { body { background: #ffffff; } }",
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

  it("fails closed when a fixed-paper boundary disappears", () => {
    const reportFailure = vi.fn();
    const source = ".tc-app { color: #123456; }";

    expect(rawColorContractSource("src/components/therapy-compass/therapy-compass.css", source, reportFailure)).toBe(
      source,
    );
    expect(reportFailure).toHaveBeenCalledWith("printable Therapy paper raw-color boundaries are missing");
  });
});
