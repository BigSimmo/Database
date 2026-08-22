// The phone dock's addon slot holds exactly ONE page-owned action at a time.
//
// `data-footer-addon` is a single attribute value, and three separate things key
// off it: the backdrop scrim height, the hide-transform overshoot, and the
// content reserve. Adding a second claimant (Patient details, alongside the
// original Differentials Compare bar) is only safe because the two are mutually
// exclusive by surface. Nothing in the type system enforces that, so it is
// pinned here — together with the requirement that every registered addon kind
// actually has the CSS and reserve wiring it needs.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  phoneDockAddonSlotId,
  differentialsMobileCompareAddonSlotId,
  patientDetailsAddonSlotId,
  type PhoneDockAddonKind,
} from "@/lib/mode-home-composer";
import {
  mobileComposerVisibleReserve,
  resolveDashboardVisibleMobileComposerReserve,
  resolveShellVisibleMobileComposerReserve,
} from "@/components/clinical-dashboard/mobile-composer-reserve";

function read(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const globalsCss = read("src/app/globals.css");
const dashboard = read("src/components/ClinicalDashboard.tsx");
const shell = read("src/components/clinical-dashboard/global-search-shell.tsx");
const header = read("src/components/clinical-dashboard/master-search-header.tsx");

const ADDON_KINDS: PhoneDockAddonKind[] = ["differentials-compare", "patient-details"];

describe("phone dock addon registry", () => {
  it("maps every addon kind to a distinct slot id", () => {
    const ids = ADDON_KINDS.map((kind) => phoneDockAddonSlotId[kind]);
    expect(ids).toEqual([differentialsMobileCompareAddonSlotId, patientDetailsAddonSlotId]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("derives data-footer-addon from the addon kind rather than hardcoding one claimant", () => {
    // The original code hardcoded "differentials-compare" whenever any slot id
    // was present, which silently mislabels a second claimant's dock.
    expect(header).toMatch(/data-footer-addon=\{[\s\S]{0,200}mobileBottomSearchAddonKind/);
  });
});

describe("addon kinds are mutually exclusive", () => {
  it("keys the dashboard's two claimants on different search modes", () => {
    expect(dashboard).toMatch(/differentialsCompareAddonActive\s*=\s*\n?\s*searchMode === "differentials"/);
    expect(dashboard).toMatch(/patientDetailsAddonActive\s*=\s*\n?\s*searchMode === "prescribing"/);
  });

  it("leaves the shell with a single claimant", () => {
    expect(shell).toMatch(/differentialsCompareAddonActive\s*=\s*\n?\s*searchMode === "differentials"/);
    // No shell route claims the patient-details addon: `/medications` is a
    // standalone mode home with no dock, and `/medications/[slug]` already opens
    // the same sheet from its nav header. Claiming it here would inflate the
    // dock reserve for a pill that never mounts — a blank band at the bottom.
    expect(shell).not.toMatch(/mobileBottomSearchAddonKind=\{[\s\S]{0,200}"patient-details"/);
  });

  it("does not give the medication detail route a second entry point to one sheet", () => {
    const recordPage = read("src/components/clinical-dashboard/medication-record-page.tsx");
    expect(recordPage).toContain("onOpenPatientDetails");
    expect(recordPage).not.toContain("PatientDetailsDockAction");
  });
});

describe("every addon kind carries its dock wiring", () => {
  it.each(ADDON_KINDS)("%s has a backdrop scrim height", (kind) => {
    expect(globalsCss).toContain(
      `.answer-footer-search-dock[data-footer-addon="${kind}"] .answer-footer-search-backdrop`,
    );
  });

  it.each(ADDON_KINDS)("%s has a hide-transform overshoot so no strip peeps at the edge", (kind) => {
    expect(globalsCss).toMatch(
      new RegExp(`data-footer-addon="${kind}"\\]\\[data-scroll-hidden="true"\\][\\s\\S]{0,120}translateY`),
    );
  });

  it.each(ADDON_KINDS)("%s has clearance tokens", (kind) => {
    expect(globalsCss).toContain(`--phone-dock-${kind}-clearance:`);
    expect(globalsCss).toContain(`--phone-dock-${kind}-compact-clearance:`);
  });
});

describe("reserve resolvers honour the patient-details addon", () => {
  it("returns the patient-details reserve on the dashboard", () => {
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "prescribing",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
        patientDetailsAddonActive: true,
      }),
    ).toBe(mobileComposerVisibleReserve.patientDetails);
  });

  it("returns the patient-details reserve in the shell", () => {
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        heroOwnsPhoneComposer: false,
        searchMode: "prescribing",
        differentialsCompareAddonActive: false,
        patientDetailsAddonActive: true,
      }),
    ).toBe(mobileComposerVisibleReserve.patientDetails);
  });

  it("still lets compare win when both flags are somehow set", () => {
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        heroOwnsPhoneComposer: false,
        searchMode: "differentials",
        differentialsCompareAddonActive: true,
        patientDetailsAddonActive: true,
      }),
    ).toBe(mobileComposerVisibleReserve.differentialsCompare);
  });

  it("keeps the standalone mode home on the idle pad — no dock, no addon reserve", () => {
    // `/medications` is a standalone mode home: the composer lives in the hero,
    // so reserving dock-sized space there would open a blank bottom band.
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        heroOwnsPhoneComposer: true,
        searchMode: "prescribing",
        differentialsCompareAddonActive: false,
        patientDetailsAddonActive: true,
      }),
    ).toBe("2rem");
  });
});

describe("CSS and TS reserve values stay in step", () => {
  it.each([
    ["differentials-compare", mobileComposerVisibleReserve.differentialsCompare],
    ["patient-details", mobileComposerVisibleReserve.patientDetails],
  ] as const)("%s clearance token matches the TS constant", (kind, reserve) => {
    const token = new RegExp(`--phone-dock-${kind}-clearance:\\s*([\\d.]+)rem`).exec(globalsCss);
    expect(token, `missing --phone-dock-${kind}-clearance`).not.toBeNull();
    expect(reserve).toContain(`${token?.[1]}rem`);
  });
});
