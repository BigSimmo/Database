import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sourceSegment } from "./helpers/source-contract";

/**
 * Lighthouse Label-in-Name (WCAG 2.5.3) on the phone "Try this" ticker:
 * visible text includes "Try this", the suggestion, and "Tap to search".
 * An aria-label that omits any of those fails the audit even when the
 * suggestion itself is present.
 */
const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/universal-search-command-surface.tsx"),
  "utf8",
);

describe("phone ticker Label-in-Name", () => {
  it("includes Try this, the suggestion, and Tap to search in the accessible name", () => {
    const ticker = sourceSegment(SOURCE, 'data-testid="smart-search-phone-ticker"', "SmartIntentCue", {
      label: "phone ticker button",
    });

    expect(ticker).toContain("aria-label={`Try this ${resolvedTickerExample}. Tap to search`}");
    expect(ticker).toContain("Try this");
    expect(ticker).toContain("Tap to search");
    expect(ticker).not.toContain("Try suggested search:");
  });
});
