import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import dsmClinicalContent from "../src/data/dsm-clinical-content.json";
import { dsmCategories } from "../src/lib/dsm";

/**
 * The DSM export ships a per-category colour the app must not adopt.
 *
 * `src/data/dsm-clinical-content.json` is a vendored snapshot of the upstream
 * `dsm-5-diagnosis` repository (no generator lives here), and every category in
 * it carries `css_class` plus a raw hex `color`. Three of those hexes sit
 * squarely on the semantic palette — red for Psychotic Disorders, green for OCD
 * & Related, amber for Mood Disorders — so wiring them into the UI would assert
 * danger, success and caution about diagnostic categories that nothing has
 * reviewed. That is the same defect removed from factsheets in this branch, and
 * `docs/clinical-badge-system-guide.md` states the rule it breaks: meaning
 * drives the colour, never the other way round.
 *
 * The snapshot keeps the fields (editing it would diverge it from its source).
 * These tests hold the boundary instead.
 */
describe("DSM category colour boundary", () => {
  it("still finds the colours in the vendored export, so this guard stays meaningful", () => {
    // If upstream ever drops them, this fails loudly rather than the guard
    // quietly passing against nothing.
    const raw = dsmClinicalContent as { categories: Array<Record<string, unknown>> };
    const withColour = raw.categories.filter((category) => "color" in category || "css_class" in category);
    expect(withColour.length, "the export no longer ships category colours — retire this guard").toBeGreaterThan(0);
  });

  it("does not surface colour or css_class on the categories the app consumes", () => {
    for (const category of dsmCategories) {
      expect(Object.keys(category), `category "${category.key}" leaks a presentation field`).toEqual(
        expect.not.arrayContaining(["color", "css_class"]),
      );
    }
  });

  it("keeps DsmCategory free of the presentation fields, so reading one cannot compile", () => {
    const source = readFileSync(new URL("../src/lib/dsm.ts", import.meta.url), "utf8");
    const start = source.indexOf("export type DsmCategory = {");
    expect(start, "DsmCategory declaration not found").toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("};", start));
    expect(body, "DsmCategory must not declare css_class").not.toContain("css_class");
    expect(body, "DsmCategory must not declare color").not.toContain("color:");
  });

  it("has no source file reading a DSM category colour", () => {
    // A regex over the type is not enough on its own: someone could reach the
    // raw JSON directly and bypass the type entirely.
    const offenders: string[] = [];
    for (const file of ["src/lib/dsm.ts"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      // Comments explain the omission on purpose, so only look at code lines.
      const code = source
        .split("\n")
        .filter(
          (line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"),
        )
        .join("\n");
      if (/\.css_class\b/.test(code) || /category\.color\b/.test(code)) offenders.push(file);
    }
    expect(offenders, `these files read a DSM category colour: ${offenders.join(", ")}`).toEqual([]);
  });
});
