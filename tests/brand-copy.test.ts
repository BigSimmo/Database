import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BRAND_CATCHPHRASE,
  BRAND_CATCHPHRASE_BARE,
  BRAND_DESCRIPTION,
  BRAND_INSTALL_TAGLINE,
  BRAND_MENU_DESCRIPTION,
  BRAND_NAME,
  BRAND_OG_ALT,
} from "@/lib/brand";

/**
 * The product's written identity has one home (`src/lib/brand.ts`).
 *
 * Before it did, four surfaces described PsychSift four different ways — the
 * page metadata, the web manifest, the OG card and the install prompt each
 * carried a hand-typed sentence, and two of them disagreed about whether the
 * product is a "RAG knowledge base" or a "knowledge base". Nobody had made a
 * decision to say two different things; the second sentence was written months
 * after the first by someone who could not see it.
 *
 * So this file guards the property that made that possible: a brand line
 * re-typed as a literal at the point of use. The check is deliberately narrow —
 * it does not police every mention of the product, only the specific lines the
 * module owns, and only outside the module itself.
 */

const SOURCE_FILES = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
  .split("\n")
  .filter((file) => /\.(ts|tsx)$/.test(file))
  // The module that defines the strings is the one place they may appear as
  // literals, and design-scratch mockups are excluded for the same reason they
  // are excluded from the wiring and reachability gates: they are not product.
  .filter((file) => file !== "src/lib/brand.ts" && !file.includes("mockups"));

/** Lines a surface must import rather than retype. */
const OWNED_LINES: ReadonlyArray<readonly [name: string, value: string]> = [
  ["BRAND_CATCHPHRASE", BRAND_CATCHPHRASE],
  ["BRAND_DESCRIPTION", BRAND_DESCRIPTION],
  ["BRAND_INSTALL_TAGLINE", BRAND_INSTALL_TAGLINE],
  ["BRAND_MENU_DESCRIPTION", BRAND_MENU_DESCRIPTION],
];

describe("brand copy has a single source", () => {
  it.each(OWNED_LINES)("%s appears as a literal only in src/lib/brand.ts", (name, value) => {
    const offenders = SOURCE_FILES.filter((file) => readFileSync(file, "utf8").includes(value));
    expect(
      offenders,
      `${name} is retyped as a literal in ${offenders.join(", ")}. Import it from "@/lib/brand" instead — ` +
        "a second copy is how the product ended up describing itself two different ways.",
    ).toEqual([]);
  });

  it("the surfaces that carry brand copy read it from the module", () => {
    for (const file of [
      "src/app/layout.tsx",
      "src/app/manifest.ts",
      "src/app/opengraph-image.tsx",
      "src/components/pwa-lifecycle.tsx",
      "src/components/clinical-dashboard/ClinicalSidebar.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), `${file} no longer imports the brand module`).toMatch(/from "@\/lib\/brand"/);
    }
  });
});

describe("the catchphrase stays usable where it is shown", () => {
  /**
   * The phone drawer renders the catchphrase on a single truncating line beside
   * a 28px mark and a 48px close control. There is not much room, and the
   * failure is silent: a longer line does not break the layout, it just gets
   * cut off mid-word with an ellipsis and reads as a bug. 32 characters is the
   * measured fit at the narrowest supported width (320px) — not a style
   * preference, so raise it only against a re-measure.
   */
  it("fits the phone drawer strapline", () => {
    expect(BRAND_CATCHPHRASE.length).toBeLessThanOrEqual(32);
  });

  it("is one line, not a sentence pair", () => {
    expect(BRAND_CATCHPHRASE).not.toMatch(/[\n\r]/);
    expect(BRAND_CATCHPHRASE.split(".").filter(Boolean)).toHaveLength(1);
  });

  it("keeps the bare variant in step with the punctuated one", () => {
    // Two exports so no caller has to slice the string and quietly disagree
    // about where it ends; that only helps while they still say the same thing.
    expect(`${BRAND_CATCHPHRASE_BARE}.`).toBe(BRAND_CATCHPHRASE);
  });

  it("does not promise clinical correctness", () => {
    // This is a clinical reference prototype, not validated decision support.
    // The catchphrase may describe what the product does; it may not make a
    // claim about the guidance it surfaces being right, safe or sufficient,
    // because the entire citation architecture exists so a clinician can check
    // that themselves. Guarding the words is cruder than guarding the meaning,
    // but a review that has to argue with a failing test is the point.
    expect(BRAND_CATCHPHRASE.toLowerCase()).not.toMatch(
      /\b(trust(ed|worthy)?|accurate|correct|safe|reliable|proven|verified|evidence-based)\b/,
    );
  });
});

describe("derived brand lines", () => {
  it("builds the description from the catchphrase", () => {
    expect(BRAND_DESCRIPTION).toContain(BRAND_CATCHPHRASE_BARE.toLowerCase());
  });

  it("names the product in the share-card alt text", () => {
    expect(BRAND_OG_ALT.startsWith(BRAND_NAME)).toBe(true);
    // One dash per sentence: BRAND_DESCRIPTION already carries one, so the alt
    // text joins with a colon. Two em dashes in one line read as a stutter.
    expect(BRAND_OG_ALT.match(/—/g) ?? []).toHaveLength(1);
  });
});
