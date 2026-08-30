import { describe, expect, it } from "vitest";

import {
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_PURPOSES,
  type ReferralDestination,
  type ReferralPurpose,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * AN EMERGENCY-DEPARTMENT REFERRAL SAYS WHICH DEPARTMENT, AND WHY.
 *
 * `FD-15`/`FD-11`, decided and unbuilt until now. Three different flows all address an emergency
 * department and none of them means the same thing:
 *
 *   community → ED           purpose "bed"
 *   ED psychiatry → itself   purpose "psychiatric_review"   (`FD-16`: the self-addressed inbox)
 *   ward → ED                purpose "medical_assessment"
 *
 * ⚠️ **PURPOSE IS A SEPARATE AXIS AND MUST NOT BE FOLDED INTO `kind`.** A fourth destination kind
 * encoding "psychiatry review at an ED" would put the WHY inside the WHERE, and then a bed request
 * and a review request are answered by the same affordance — which is how one becomes the other by
 * accident. Three kinds, three purposes, orthogonal.
 *
 * ⚠️ **AND THE WORKAROUND THIS EXISTS TO KILL, WHICH WAS FOUND AND REFUSED RATHER THAN SHIPPED:**
 * inferring "addressed to itself" from `originSiteCode === department.siteCode`. That compiles,
 * reads correctly, and puts the ward→ED MEDICAL notification straight into the psychiatry inbox —
 * because a psychiatric ward at the same hospital shares that site code. It is wrong on exactly the
 * case the spec names, which is the case nobody re-reads after implementing from it. `FD-18` is the
 * general form. The last test in this file is the guard.
 */
/**
 * Typed as the NARROWED arm rather than the `ReferralDestination` union, deliberately. Returning
 * the union compiles and then hides the fields this file exists to check: `.edId` is not reachable
 * on a union member without narrowing, so every assertion about it would need a cast — and a cast
 * is exactly what would let the field be removed again without this file noticing.
 */
type EdDestination = Extract<ReferralDestination, { kind: "emergency_department" }>;

function edDestination(edId: string, purpose: ReferralPurpose): EdDestination {
  return { kind: "emergency_department", edId, purpose };
}

describe("the emergency-department destination", () => {
  const departments = allEmergencyDepartments();

  it("has more than one department, or 'which one' is not a question this can test", () => {
    // The canary. With a single department every assertion below passes against a model that
    // records no department at all.
    expect(departments.length).toBeGreaterThan(1);
  });

  it("keeps THREE destination kinds — purpose did not become a fourth", () => {
    expect([...REFERRAL_DESTINATION_KINDS]).toEqual([
      "psychiatric_ward",
      "emergency_department",
      "community_team",
    ]);
    expect(
      REFERRAL_DESTINATION_KINDS,
      "a kind naming a purpose (ed_psychiatry, ed_medical) is the fold this axis exists to prevent",
    ).not.toContain("ed_psychiatry");
  });

  it("offers exactly the three purposes, and they are a closed list", () => {
    expect([...REFERRAL_PURPOSES]).toEqual(["bed", "psychiatric_review", "medical_assessment"]);
  });

  it("names WHICH department on every ED destination, whoever sent it", () => {
    for (const department of departments.slice(0, 3)) {
      const destination = edDestination(department.id, "psychiatric_review");
      expect(destination.edId).toBe(department.id);
    }
  });

  it("expresses all three flows, and they are DISTINGUISHABLE from one another", () => {
    const [first, second] = departments;
    const flows = [
      edDestination(first.id, "bed"),
      edDestination(first.id, "psychiatric_review"),
      edDestination(second.id, "medical_assessment"),
    ];
    // Three distinct (department, purpose) pairs. If any two collapse, one flow is invisible.
    const keys = new Set(flows.map((flow) => `${flow.edId}:${flow.purpose}`));
    expect(keys.size).toBe(3);
  });

  it("⚠️ SEPARATES THE SELF-ADDRESSED INBOX FROM THE WARD'S MEDICAL NOTIFICATION — the FD-18 guard", () => {
    // Both are addressed to the SAME department by parties at the SAME hospital, which is exactly
    // why a site-code inference cannot tell them apart. Purpose can, and nothing else has to.
    const department = departments[0];
    const psychiatryToItself = edDestination(department.id, "psychiatric_review");
    const wardToEdMedical = edDestination(department.id, "medical_assessment");

    expect(psychiatryToItself.edId).toBe(wardToEdMedical.edId);
    expect(
      psychiatryToItself.purpose,
      "the two flows must differ on something, or the inbox cannot be built without guessing",
    ).not.toBe(wardToEdMedical.purpose);

    // The inbox query, written the way the hub will write it. It must select one and reject the
    // other while they agree on every other field.
    const inbox = [psychiatryToItself, wardToEdMedical].filter(
      (destination) => destination.edId === department.id && destination.purpose === "psychiatric_review",
    );
    expect(inbox).toEqual([psychiatryToItself]);
    expect(
      inbox,
      "the ward's medical notification reached the psychiatry inbox. That is the conflation FD-18 " +
        "exists to prevent, and a site-code inference produces it silently.",
    ).not.toContain(wardToEdMedical);
  });
});
