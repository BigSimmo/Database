import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sourceSegment } from "./helpers/source-contract";

/**
 * The cross-mode chips are the one place in the dropdown where the rendered
 * content of an option is not the whole meaning of it.
 *
 * Sighted readers see a row: `Search "sertraline" in` followed by `Forms`,
 * `Factsheets`, `Dictionary`. That lead sits outside every `role="option"`, so
 * a screen reader announced the destination on its own — "Forms" — with no
 * indication that activating it would leave the current mode and re-run the
 * query somewhere else. The chip that reads as an obvious search-elsewhere
 * control visually read as a bare mode name to everyone else.
 *
 * The fix is an explicit `aria-label` per chip carrying the whole sentence, and
 * the visible lead marked presentational so it is not left as a loose text node
 * for assistive technology to try to associate. This file pins both halves: an
 * `aria-label` that is never wired up, or a lead that becomes readable again
 * while the labels are dropped, both put the announcement back where it was.
 */
const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/universal-search-command-surface.tsx"),
  "utf8",
);

describe("cross-mode chip accessible names", () => {
  it("gives the chips option an accessible name of its own", () => {
    const chipsOption = sourceSegment(SOURCE, '{section.layout === "chips" ? (', "{section.items.map((item) => (", {
      label: "chips branch",
    });
    const optionElement = sourceSegment(SOURCE, "{section.items.map((item) => (", "{item.render(activeItemId", {
      label: "chips option element",
    });

    expect(optionElement).toContain('role="option"');
    expect(optionElement, "the chips option must carry an explicit accessible name").toContain(
      "aria-label={item.ariaLabel}",
    );
    // The lead is decoration once each chip says the whole sentence; left
    // readable it is an orphan text node inside the listbox.
    expect(chipsOption, "the visible lead must be presentational").toContain('aria-hidden="true"');
  });

  it("names the destination and the query together, not the destination alone", () => {
    const crossMode = sourceSegment(SOURCE, 'key: "cross-mode",', 'if (modeId === "answer") {', {
      label: "cross-mode section",
    });

    expect(crossMode).toContain("ariaLabel:");
    // The sentence, not just the mode: a label of `${targetMode.label}` alone
    // would satisfy the wiring test above and change nothing for a listener.
    expect(crossMode, "the accessible name must include the query").toContain("${trimmedQuery}");
    expect(crossMode, "the accessible name must include the destination mode").toContain("${targetMode.label}");
    // The visible count renders as a bare "(2)". Spelled out here so it is read
    // as a number of matches rather than as punctuation.
    expect(crossMode).toContain('"match"');
    expect(crossMode).toContain('"matches"');
  });

  it("keeps ariaLabel optional, so no other option is forced to invent one", () => {
    const dropdownItem = sourceSegment(SOURCE, "type DropdownItem = {", "};", { label: "DropdownItem" });
    expect(dropdownItem).toContain("ariaLabel?: string;");
  });
});
