import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  movementStages,
  operationalPriorityScore,
  wardHospitals,
  wardPatientById,
  wardPatients,
} from "../src/components/ward-management/synthetic-fixtures";
import { toolCatalogRecordById } from "../src/lib/tools-catalog";

/**
 * The mode strip renders one literal `<Link href="...">` per view so
 * `tests/route-reachability.test.ts` can find the hrefs by static AST scan. Reading the
 * source back is therefore the only way to assert the strip and the routes agree.
 */
function wardModeHrefs() {
  const source = readFileSync("src/components/ward-management/ward-management-navigation.tsx", "utf8");
  const modeStrip = source.slice(source.indexOf("export function WardModeNavigation"));
  return [...modeStrip.matchAll(/href="(\/ward-management[^"]*)"/g)].map((match) => match[1]);
}

function routeFileFor(href: string) {
  return `src/app${href}/page.tsx`;
}

describe("Ward Flow synthetic prototype", () => {
  it("keeps the production route reachable from the Tools catalogue", () => {
    expect(toolCatalogRecordById("ward-management").href).toBe("/ward-management");
  });

  it("maps every Ward Flow view to a distinct reachable route", () => {
    const hrefs = wardModeHrefs();
    expect(hrefs).toEqual([
      "/ward-management",
      "/ward-management/constellation",
      "/ward-management/network",
      "/ward-management/queue",
      "/ward-management/capacity",
      "/ward-management/movements",
      "/ward-management/exceptions",
      "/ward-management/transport",
      "/ward-management/governance",
    ]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(existsSync(routeFileFor(href)), `${href} has no page.tsx`).toBe(true);
    }
  });

  it("uses only synthetic operational patient identifiers and minimised fields", () => {
    expect(wardPatients).toHaveLength(14);
    for (const patient of wardPatients) {
      expect(patient.id).toMatch(/^WF-\d{3}$/);
      expect(patient).not.toHaveProperty("name");
      expect(patient).not.toHaveProperty("dateOfBirth");
      expect(patient).not.toHaveProperty("mrn");
      expect(patient).not.toHaveProperty("address");
      expect(patient).not.toHaveProperty("diagnosis");
      expect(patient).not.toHaveProperty("clinicalHistory");
    }
  });

  it("keeps human urgency separate from the explainable operational score", () => {
    for (const patient of wardPatients) {
      expect([1, 2, 3]).toContain(patient.urgency);
      expect(patient.score).toBeGreaterThanOrEqual(0);
      expect(patient.score).toBeLessThanOrEqual(100);
      expect(operationalPriorityScore(patient)).toBeLessThanOrEqual(patient.score);
      expect(patient.recommendationReasons.length).toBeGreaterThan(0);
      expect(patient.alternatives.length).toBeGreaterThan(0);
    }
  });

  it("models the approved six movement stages and five bed states", () => {
    expect(movementStages.map((stage) => stage.id)).toEqual([
      "placement_requested",
      "destination_review",
      "bed_held",
      "handover_ready",
      "moving",
      "arrived",
    ]);
    for (const hospital of wardHospitals) {
      expect(hospital).toEqual(
        expect.objectContaining({
          available: expect.any(Number),
          held: expect.any(Number),
          potential: expect.any(Number),
          blocked: expect.any(Number),
          occupied: expect.any(Number),
          lastConfirmed: expect.stringMatching(/^\d{2}:\d{2}$/),
        }),
      );
    }
  });

  it("preserves plain-language legal status and form readiness", () => {
    const referredPatient = wardPatientById("WF-198");
    expect(referredPatient.voluntaryStatus).toBe("Referred for psychiatric examination");
    expect(referredPatient.legalDetail).toContain("Form 1A");
  });
});
