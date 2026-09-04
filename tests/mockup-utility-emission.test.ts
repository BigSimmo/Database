import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { describe, expect, it } from "vitest";

/**
 * Guards the Caring Contacts prototype against silently unstyled utilities.
 *
 * `globals.css` keeps the mockup component tree out of Tailwind's scan so its
 * large, fast-moving utility vocabulary never reaches a production page. The
 * mockup routes get their own sheet, `src/app/mockups/mockups.css`, whose stated
 * job is to re-emit that vocabulary — but its `@reference "../globals.css"` also
 * inherits globals' `@source not` rules, so its broad `@source "../../components"`
 * did not actually reach the excluded files.
 *
 * The failure mode is the dangerous kind: nothing errors. The class is written on
 * the element, no rule is generated for it, and the element simply renders without
 * it. Thirty-two utilities in this prototype were inert that way — block and panel
 * spacing, every custom `grid-cols`, the hero type scale, the eyebrow tracking, the
 * phone dock height and both wide-table minimum widths. Others survived only by
 * coincidence, because production happened to use the identical class string.
 *
 * That coincidence is why this test compiles rather than greps: it asserts the
 * rules exist in the real compiled sheet, so it fails both if the `@source`
 * re-include is removed AND if a utility's only other user disappears from
 * production. A grep over the CSS source could not tell those apart.
 */

const root = join(__dirname, "..");
const mockupComponentsDir = join(root, "src", "components", "caring-contacts", "mockups");
const stylesheetPath = join(root, "src", "app", "mockups", "mockups.css");

/**
 * Tailwind arbitrary-value utilities, captured WITH their variant chain, because
 * the variant is part of the emitted class name: `lg:max-w-[32rem]` becomes the
 * selector `.lg\:max-w-\[32rem\]`, and there is no bare `.max-w-\[32rem\]` to find.
 * Values containing a quote are skipped rather than guessed at — a class would
 * have to be built dynamically to hold one, and a dynamic class is not statically
 * detectable by Tailwind in the first place.
 */
const ARBITRARY_UTILITY = /(?<![\w:/-])((?:[a-z][a-z0-9-]*:)*[a-z][a-z0-9-]*-\[[^\]"'`]+\])/g;

function utilitiesIn(source: string): Set<string> {
  return new Set(Array.from(source.matchAll(ARBITRARY_UTILITY), (match) => match[1]));
}

function prototypeUtilities(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const entry of readdirSync(mockupComponentsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const source = readFileSync(join(mockupComponentsDir, entry.name), "utf8");
    for (const utility of utilitiesIn(source)) {
      found.set(utility, [...(found.get(utility) ?? []), entry.name]);
    }
  }
  return found;
}

/**
 * Compare against the compiled sheet with its selector escaping removed, rather
 * than trying to reproduce that escaping. Tailwind escapes brackets, colons, dots
 * and commas in a selector, and getting any one of them wrong would make this test
 * report a utility as missing when it is emitted — which is exactly the false
 * alarm that would get the whole test deleted. Stripping the backslashes turns
 * `.lg\:max-w-\[32rem\]` back into `.lg:max-w-[32rem]`, which is the class as written.
 */
async function compileMockupStylesheetUnescaped(): Promise<string> {
  const result = await postcss([tailwind()]).process(readFileSync(stylesheetPath, "utf8"), {
    from: stylesheetPath,
  });
  return result.css.replace(/\\/g, "");
}

describe("Caring Contacts prototype utility emission", () => {
  it("emits a rule for every arbitrary utility the prototype's components use", async () => {
    const used = prototypeUtilities();
    expect(used.size).toBeGreaterThan(50); // the scan found the components at all

    const css = await compileMockupStylesheetUnescaped();
    const missing = [...used.entries()]
      .filter(([utility]) => !css.includes(`.${utility}`))
      .map(([utility, files]) => `${utility}  (${files.join(", ")})`)
      .sort();

    expect(
      missing,
      "These utilities are written on prototype elements but no rule is generated for them, so " +
        "they do nothing and nothing else will report it. Either add the missing path to an " +
        "`@source` in src/app/mockups/mockups.css, or replace the utility with one the sheet emits.",
    ).toEqual([]);
  }, 60_000);

  it("keeps the re-include that makes the excluded component tree reachable", () => {
    // Named explicitly so removing the line fails here with the reason, rather than
    // only as a long list of missing utilities in the test above.
    expect(readFileSync(stylesheetPath, "utf8")).toContain('@source "../../components/caring-contacts/mockups";');
  });
});
