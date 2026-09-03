import { describe, expect, it } from "vitest";

import { allEmergencyDepartments, allUnits, wardSites } from "@/components/ward-management/ward-sites";
import { escapeForRegExp, namesRealPlace } from "./helpers/ward-place-names";

/**
 * The detector's own proof, held here so the DISCRIMINATION is established at the helper rather than
 * only at the three guards that use it.
 *
 * ⚠️ **The three call sites keep their own positive controls and this does not replace them.**
 * Centralising the proofs as well as the detector would swap three independently-decaying copies for
 * one silently-shared blind spot. This file proves the RULE; each guard still proves it can fire on
 * its own surface, against its own register.
 */
describe("the place-name detector's matching rule", () => {
  it("boundary-matches a bare token, so a code inside an ordinary word is not a place", () => {
    // Both directions, or this proves only that the detector is quiet rather than that it discriminates.
    expect(namesRealPlace("the ward was warmly lit", "ARM")).toBe(false);
    expect(namesRealPlace("the patient is dangerous", "GER")).toBe(false);
    expect(namesRealPlace("transferred to ARM today", "ARM")).toBe(true);
    expect(namesRealPlace("bed confirmed at GER", "GER")).toBe(true);
  });

  /**
   * ⚠️ THE CASE THE OLD RULE COULD NOT SEE, AND THE REASON THIS HELPER EXISTS.
   *
   * A DOM `textContent` concatenates sibling elements with no separator, so a real card reads
   * `…Emergency DepartmentWF-013…`. Under a bare `\b…\b` the detector returned FALSE while the
   * place was rendered on the screen — an absence check that could not fire. The master line ran
   * that version for part of 2026-09-02.
   */
  it("contain-matches a multi-word name butted against the next element's text", () => {
    const name = "Armadale Hospital Emergency Department";
    const concatenated = `${name}WF-013Older adult · Open`;

    // The case is only meaningful while no boundary exists at the seam — assert that, don't assume it.
    expect(
      /\w/.test(concatenated.charAt(name.length)),
      "the character after the place name is not a word character, so this no longer tests the seam",
    ).toBe(true);
    expect(new RegExp(`\\b${escapeForRegExp(name)}\\b`).test(concatenated), "the OLD rule should miss this").toBe(
      false,
    );

    expect(namesRealPlace(concatenated, name), "the current rule must catch it").toBe(true);
  });

  it("still catches a multi-word name in ordinary prose", () => {
    const name = "Armadale Hospital Emergency Department";
    expect(namesRealPlace(`Withdrawn — redirected to ${name}.`, name)).toBe(true);
    expect(namesRealPlace("Withdrawn — the referrer no longer needs this bed.", name)).toBe(false);
  });

  it("refuses a name below the 3-character floor rather than matching half the alphabet", () => {
    expect(() => namesRealPlace("anything at all", "AB")).toThrow(/3-character floor/);
  });

  it("escapes regex metacharacters, so a name is never read as a pattern", () => {
    // No register entry contains these today; the point is that one arriving later cannot silently
    // become a wildcard that matches everything.
    expect(namesRealPlace("ward A.B unit", "A.B")).toBe(true);
    expect(namesRealPlace("ward AXB unit", "A.B")).toBe(false);
  });

  it("runs against the live registers without throwing — every real name clears the floor", () => {
    const everyName = [
      ...allUnits().map((unit) => unit.name),
      ...wardSites.map((site) => site.name),
      ...wardSites.map((site) => site.code),
      ...allEmergencyDepartments().map((ed) => ed.name),
    ];
    expect(everyName.length, "the registers are empty, so this proves nothing").toBeGreaterThan(0);

    for (const name of everyName) {
      // The floor throws rather than returning false, so a too-short entry surfaces here as a
      // failure of this test rather than as a guard that quietly stops discriminating.
      expect(() => namesRealPlace("a sentence with no place in it", name)).not.toThrow();
    }
  });
});
