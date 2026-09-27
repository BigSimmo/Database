import { describe, expect, it } from "vitest";

import {
  CANONICAL_ACUTE_INPATIENT_SERVICES,
  CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES,
  WA_POISONS_CENTRE_SERVICE,
  bundledServiceGovernance,
  getBundledCanonicalServiceRecord,
  preferBundledServiceRecord,
} from "@/lib/site-content/bundled-service-catalogue";
import { serviceNavigatorQuery, type ServiceRecord } from "@/lib/service-ranker";

const REQUIRED_SLUGS = [
  "graylands-hospital-and-frankland-centre",
  "scgh-mental-health-observation-area-and-inpatient",
  "fiona-stanley-hospital-wards-4b-and-4c",
  "alma-street-centre-fremantle-hospital",
  "royal-perth-hospital-ward-2k",
  "bentley-hospital-ward-4",
  "st-john-of-god-midland-public-hospital-mental-health-inpatient-unit",
  "rockingham-general-hospital-mimidi-park",
  "perth-childrens-hospital-ward-5a",
  "wa-poisons-information-centre",
] as const;

describe("bundled services fixtures health", () => {
  it("carries all 10 canonical inpatient and toxicology services with unique valid slugs", () => {
    expect(CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES).toHaveLength(10);
    expect(CANONICAL_ACUTE_INPATIENT_SERVICES).toHaveLength(9);
    expect(WA_POISONS_CENTRE_SERVICE.slug).toBe("wa-poisons-information-centre");

    const slugs = CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(10);

    for (const slug of REQUIRED_SLUGS) {
      expect(slugs, `Must contain canonical slug ${slug}`).toContain(slug);
    }
  });

  it("satisfies clinical rendering and structural integrity standards on all fixtures", () => {
    for (const service of CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES) {
      // Slug & naming
      expect(service.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(service.title.trim()).toBeTruthy();
      expect(service.subtitle?.trim()).toBeTruthy();
      expect(service.location?.trim()).toBeTruthy();
      expect(serviceNavigatorQuery(service)).toBeTruthy();

      // Contacts
      expect(service.primaryContact).toBeDefined();
      expect(service.primaryContact?.value?.trim()).toBeTruthy();
      expect(service.primaryContact?.kind).toBe("phone");
      expect(service.contacts && service.contacts.length > 0).toBe(true);
      expect(
        service.contacts?.some((c) => c.value === service.primaryContact?.value),
        `${service.slug} primaryContact must be present in contacts list`,
      ).toBe(true);

      // Route, eligibility, and cost (no pipe delimiter corruptions)
      expect(service.route).toBeTruthy();
      expect(service.route).not.toContain("|");
      expect(service.eligibility).toBeTruthy();
      expect(service.eligibility).not.toContain("|");
      expect(service.cost).toBeTruthy();
      expect(service.cost).not.toContain("|");

      // Best use & summary cards
      expect(service.bestUse?.trim()).toBeTruthy();
      expect(service.summaryCards && service.summaryCards.length >= 3).toBe(true);
      for (const card of service.summaryCards ?? []) {
        expect(card.id).toBeTruthy();
        expect(card.title?.trim()).toBeTruthy();
        expect(card.title).not.toContain("|");
      }

      // Referral info rows
      expect(service.referralInfo && service.referralInfo.length >= 4).toBe(true);
      for (const row of service.referralInfo ?? []) {
        expect(row.label.trim()).toBeTruthy();
        expect(row.value?.trim()).toBeTruthy();
      }

      // Clinical criteria
      expect(service.criteria && service.criteria.length >= 2).toBe(true);
      for (const criterion of service.criteria ?? []) {
        expect(criterion.label.trim()).toBeTruthy();
        expect(criterion.label).not.toContain("|");
        expect(["meet", "caution", "reject"]).toContain(criterion.tone);
      }

      // Verification metadata
      expect(service.verification).toBeDefined();
      expect(service.verification?.confidence).toBe("High");
      expect(service.verification?.availabilityStatus).toBe("active");
      // No clinical-owner sign-off exists for these fixtures (serviceRecordSignOff returns null),
      // so they must not claim local verification on the detail page.
      expect(service.verification?.locallyVerified).toBe(false);
      expect(service.verification?.reviewer?.trim()).toBeTruthy();
      expect(service.verification?.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Facets: tags & catchments
      expect(service.tags && service.tags.length > 0).toBe(true);
      expect(service.catchments && service.catchments.length > 0).toBe(true);

      // Provenance / source
      expect(service.source).toBeDefined();
      expect(service.source?.label?.trim()).toBeTruthy();
      expect(service.source?.status).toBe("Source checked");
      expect(service.source?.url).toMatch(/^https:\/\//);
    }
  });

  describe("WA Poisons Information Centre (13 11 26)", () => {
    const poisons = WA_POISONS_CENTRE_SERVICE;

    it("carries national/statewide 13 11 26 primary contact and 24/7 coverage", () => {
      expect(poisons.primaryContact?.value).toBe("13 11 26");
      expect(poisons.contacts?.some((c) => c.value === "13 11 26")).toBe(true);
      expect(poisons.contacts?.some((c) => c.value === "000")).toBe(true);
      expect(poisons.referralInfo?.find((r) => r.label === "Hours")?.value).toContain("24 hours");
    });

    it("covers urgent toxicology, poisoning, and overdose intents with statewide catchment", () => {
      expect(poisons.tags).toEqual(
        expect.arrayContaining(["toxicology", "poisons", "overdose", "emergency", "urgent_crisis", "statewide"]),
      );
      expect(poisons.catchments).toEqual(expect.arrayContaining(["Statewide", "Western Australia"]));
      expect(poisons.bestUse?.toLowerCase()).toContain("poisoning");
      expect(poisons.bestUse?.toLowerCase()).toContain("overdose");
    });
  });

  describe("Perth Children's Hospital Ward 5A", () => {
    const pch = CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES.find((s) => s.slug === "perth-childrens-hospital-ward-5a")!;

    it("identifies CAMHS acute child and adolescent inpatient scope", () => {
      expect(pch).toBeDefined();
      expect(pch.title).toBe("Perth Children's Hospital Ward 5A");
      expect(pch.tags).toEqual(expect.arrayContaining(["inpatient", "camhs", "ward_5a", "pch", "child_youth"]));
      expect(pch.catchments).toEqual(expect.arrayContaining(["Statewide", "Western Australia"]));
    });

    it("routes acute access via CAMHS Crisis Connect 1800 048 636 and PCH ED", () => {
      expect(pch.primaryContact?.value).toBe("1800 048 636");
      expect(pch.contacts?.some((c) => c.value === "(08) 6456 4300")).toBe(true); // Ward 5A direct
      expect(pch.contacts?.some((c) => c.value === "(08) 6456 2222")).toBe(true); // PCH switchboard
      expect(pch.route).toContain("CAMHS Crisis Connect");
    });
  });

  describe("Graylands Hospital & Frankland Centre", () => {
    const graylands = CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES.find(
      (s) => s.slug === "graylands-hospital-and-frankland-centre",
    )!;

    it("identifies statewide acute inpatient and forensic mental health scope", () => {
      expect(graylands).toBeDefined();
      expect(graylands.title).toBe("Graylands Hospital & Frankland Centre");
      expect(graylands.tags).toEqual(
        expect.arrayContaining(["inpatient", "psychiatric_inpatient", "forensic_mental_health", "statewide"]),
      );
      expect(graylands.catchments).toEqual(expect.arrayContaining(["Statewide", "Western Australia"]));
    });

    it("provides both Graylands and Frankland Centre forensic contact numbers", () => {
      expect(graylands.contacts?.some((c) => c.value === "(08) 9347 6600")).toBe(true); // Graylands Switchboard
      expect(graylands.contacts?.some((c) => c.value === "(08) 9347 6400")).toBe(true); // Frankland Centre
      expect(graylands.route).toContain("State Forensic Mental Health Service");
    });
  });

  describe("metropolitan health services acute adult inpatient coverage", () => {
    const bySlug = new Map(CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES.map((s) => [s.slug, s]));

    it("covers North Metropolitan Health Service (NMHS): SCGH MHOA & Inpatient", () => {
      const scgh = bySlug.get("scgh-mental-health-observation-area-and-inpatient")!;
      expect(scgh).toBeDefined();
      expect(scgh.tags).toEqual(expect.arrayContaining(["nmhs", "scgh", "mhoa", "inpatient"]));
      expect(scgh.catchments).toContain("North Metropolitan Health Service");
    });

    it("covers South Metropolitan Health Service (SMHS): FSH Wards 4B & 4C, Alma Street, Mimidi Park", () => {
      const fsh = bySlug.get("fiona-stanley-hospital-wards-4b-and-4c")!;
      expect(fsh).toBeDefined();
      expect(fsh.tags).toEqual(expect.arrayContaining(["smhs", "fsh", "inpatient", "psychiatric_ward"]));
      expect(fsh.catchments).toContain("South Metropolitan Health Service");

      const alma = bySlug.get("alma-street-centre-fremantle-hospital")!;
      expect(alma).toBeDefined();
      expect(alma.tags).toEqual(expect.arrayContaining(["smhs", "fremantle_hospital", "alma_street", "inpatient"]));

      const mimidi = bySlug.get("rockingham-general-hospital-mimidi-park")!;
      expect(mimidi).toBeDefined();
      expect(mimidi.tags).toEqual(expect.arrayContaining(["smhs", "mimidi_park", "rockingham_hospital", "inpatient"]));
    });

    it("covers East Metropolitan Health Service (EMHS): RPH Ward 2K, Bentley Ward 4, SJG Midland", () => {
      const rph = bySlug.get("royal-perth-hospital-ward-2k")!;
      expect(rph).toBeDefined();
      expect(rph.tags).toEqual(expect.arrayContaining(["emhs", "rph", "ward_2k", "inpatient"]));

      const bentley = bySlug.get("bentley-hospital-ward-4")!;
      expect(bentley).toBeDefined();
      expect(bentley.tags).toEqual(expect.arrayContaining(["emhs", "bentley_hospital", "ward_4", "inpatient"]));

      const midland = bySlug.get("st-john-of-god-midland-public-hospital-mental-health-inpatient-unit")!;
      expect(midland).toBeDefined();
      expect(midland.tags).toEqual(expect.arrayContaining(["emhs", "midland_hospital", "sjog_midland", "inpatient"]));
    });
  });

  describe("lookup and governance resolution", () => {
    it("retrieves each canonical inpatient and poisons service by exact or normalized slug", () => {
      for (const slug of REQUIRED_SLUGS) {
        expect(getBundledCanonicalServiceRecord(slug)?.slug).toBe(slug);
        expect(getBundledCanonicalServiceRecord(` ${slug.toUpperCase()} `)?.slug).toBe(slug);
      }
      expect(getBundledCanonicalServiceRecord("unknown-inpatient-slug")).toBeNull();
    });

    it("derives conservative unverified governance for bundled records without clinical sign-off", () => {
      for (const service of CANONICAL_INPATIENT_AND_TOXICOLOGY_SERVICES) {
        const gov = bundledServiceGovernance(service);
        expect(gov.sourceStatus).toBe("current");
        expect(gov.validationStatus).toBe("unverified");
      }
    });

    it("allows preferBundledServiceRecord to resolve canonical bundled records under retained bootstrap", () => {
      const retainedBootstrap = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
      const dummyRecord: ServiceRecord = {
        slug: "wa-poisons-information-centre",
        title: "DUMMY OLD TITLE",
      };
      const entry = {
        record: dummyRecord,
        governance: { validationStatus: "approved" },
      };
      const swapped = preferBundledServiceRecord(entry, { activeReleaseId: retainedBootstrap });
      expect(swapped.record.title).toBe("WA Poisons Information Centre");
      expect(swapped.governance.validationStatus).toBe("unverified");
    });
  });
});
