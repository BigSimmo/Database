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
  therapyCompareAddonSlotId,
  type PhoneDockAddonKind,
} from "@/lib/mode-home-composer";
import {
  mobileComposerVisibleReserve,
  resolveDashboardVisibleMobileComposerReserve,
  resolveShellVisibleMobileComposerReserve,
} from "@/components/clinical-dashboard/mobile-composer-reserve";
import {
  isTherapyPhoneDockRoute,
  readTherapyCompareSlugCount,
  THERAPY_MAX_COMPARE,
} from "@/lib/therapy-compass-navigation";

function read(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const globalsCss = read("src/app/globals.css");
const dashboard = read("src/components/ClinicalDashboard.tsx");
const shell = read("src/components/clinical-dashboard/global-search-shell.tsx");
const header = read("src/components/clinical-dashboard/master-search-header.tsx");

const ADDON_KINDS: PhoneDockAddonKind[] = ["differentials-compare", "patient-details", "therapy-compare"];

describe("phone dock addon registry", () => {
  it("maps every addon kind to a distinct slot id", () => {
    const ids = ADDON_KINDS.map((kind) => phoneDockAddonSlotId[kind]);
    expect(ids).toEqual([differentialsMobileCompareAddonSlotId, patientDetailsAddonSlotId, therapyCompareAddonSlotId]);
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

  it("keys the shell's two claimants on different modes", () => {
    expect(shell).toMatch(/differentialsCompareAddonActive\s*=\s*\n?\s*searchMode === "differentials"/);
    expect(shell).toMatch(/therapyCompareAddonActive\s*=\s*\n?\s*searchMode === "therapy-compass"/);
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

describe("the therapy tray only claims a dock that exists and has something in it", () => {
  it("restricts the claim to therapy routes that render the phone dock", () => {
    // `/therapy-compass/recommend` hides the shell composer and every record
    // route is an information page, so neither has a slot to portal into.
    // Claiming one would inflate the reserve for a row that never mounts.
    expect(isTherapyPhoneDockRoute("/therapy-compass")).toBe(true);
    expect(isTherapyPhoneDockRoute("/therapy-compass/search")).toBe(true);
    expect(isTherapyPhoneDockRoute("/therapy-compass/compare")).toBe(true);
    expect(isTherapyPhoneDockRoute("/therapy-compass/pathways")).toBe(true);
    expect(isTherapyPhoneDockRoute("/therapy-compass/review")).toBe(true);
    expect(isTherapyPhoneDockRoute("/therapy-compass/recommend")).toBe(false);
    expect(isTherapyPhoneDockRoute("/therapy-compass/cognitive-behavioural-therapy-cbt")).toBe(false);
    expect(isTherapyPhoneDockRoute("/therapy-compass/cognitive-behavioural-therapy-cbt/brief")).toBe(false);
  });

  it("requires the URL to carry a compare set before claiming the slot", () => {
    // The reserve inflates on claim, not on render. An empty tray renders
    // nothing, so a claim without `ids` is a blank band by construction.
    expect(shell).toMatch(/readTherapyCompareSlugCount\(searchParams\) > 0/);
    expect(readTherapyCompareSlugCount(new URLSearchParams("q=trauma&run=1"))).toBe(0);
    expect(readTherapyCompareSlugCount(new URLSearchParams("ids=cbt,act"))).toBe(2);
    expect(readTherapyCompareSlugCount(new URLSearchParams("ids=,,"))).toBe(0);
  });

  it("caps the counted set at the comparison ceiling", () => {
    expect(readTherapyCompareSlugCount(new URLSearchParams("ids=a,b,c,d,e,f"))).toBe(THERAPY_MAX_COMPARE);
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

  it("returns the therapy-compare reserve in the shell", () => {
    expect(
      resolveShellVisibleMobileComposerReserve({
        shouldShowSearchComposer: true,
        heroOwnsPhoneComposer: false,
        searchMode: "therapy-compass",
        differentialsCompareAddonActive: false,
        therapyCompareAddonActive: true,
      }),
    ).toBe(mobileComposerVisibleReserve.therapyCompare);
  });

  it("returns the therapy-compare reserve on the dashboard", () => {
    expect(
      resolveDashboardVisibleMobileComposerReserve({
        searchMode: "therapy-compass",
        hasAnswerFollowUps: false,
        differentialsCompareAddonActive: false,
        therapyCompareAddonActive: true,
      }),
    ).toBe(mobileComposerVisibleReserve.therapyCompare);
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
    ["therapy-compare", mobileComposerVisibleReserve.therapyCompare],
  ] as const)("%s clearance token matches the TS constant", (kind, reserve) => {
    const token = new RegExp(`--phone-dock-${kind}-clearance:\\s*([\\d.]+)rem`).exec(globalsCss);
    expect(token, `missing --phone-dock-${kind}-clearance`).not.toBeNull();
    expect(reserve).toContain(`${token?.[1]}rem`);
  });
});
