import { describe, expect, it } from "vitest";

import { getServiceRecord, serviceRecords, type ServiceRecord } from "@/lib/services";
import {
  bundledServiceGovernance,
  bundledServicesMissingFrom,
  preferBundledServiceRecord,
} from "@/lib/site-content/bundled-service-catalogue";
import { serviceRecordSignOff } from "@/lib/service-record-sign-off";

/**
 * Guards the 2026-09-17 findability gap.
 *
 * Fixing the catalogue read latency (20260916190000) made the canonical read complete again, and
 * the served release is still the 2026-08-24 epoch-zero freeze — 843 records, which predates the
 * 17 services added by #2814. Live search went straight from answering out of the in-bundle
 * catalogue (because the read was failing) to answering out of the freeze, and crisis services
 * disappeared from results: "sexual assault" stopped returning SARC, "suicide" stopped returning
 * StandBy, "1800respect" returned nothing at all.
 *
 * IF THIS FAILS, do not relax the assertion. Either the gate has been widened past the retained
 * bootstrap (it must not be — a published release has to win), or the top-up has stopped covering
 * records the freeze does not contain, which is the whole defect.
 */

const RETAINED_BOOTSTRAP = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
const PUBLISHED_RELEASE = "c96d32f6-e42a-53b0-8cfe-cd07d4b7f963";

/** Crisis and postvention records added by #2814 that the freeze does not carry. */
const POST_FREEZE_SLUGS = [
  "sexual-assault-resource-centre-sarc",
  "1800respect",
  "standby-support-after-suicide",
  "aftercare-services-program",
] as const;

/** The bundle minus the post-freeze additions: what the served release actually carries. */
function asServedByTheFreeze(): ServiceRecord[] {
  const excluded = new Set<string>(POST_FREEZE_SLUGS);
  return serviceRecords.filter((record) => !excluded.has(record.slug));
}

function entry(record: ServiceRecord, validationStatus = "approved") {
  return { record, governance: { sourceStatus: "current", validationStatus } };
}

describe("the in-repo service catalogue tops up the frozen release", () => {
  it("the records this exists for are really in the bundle", () => {
    // Non-vacuous: every assertion below is meaningless if these slugs do not exist, and a
    // renamed slug would otherwise turn this whole file green while the defect returned.
    for (const slug of POST_FREEZE_SLUGS) {
      expect(getServiceRecord(slug), `${slug} must exist in the in-repo catalogue`).toBeTruthy();
    }
    // Deliberately relative, not an absolute count: the frozen release carries 227 services (843
    // is every kind combined) and both numbers move whenever the catalogue is curated.
    expect(serviceRecords.length).toBeGreaterThan(POST_FREEZE_SLUGS.length);
  });

  it("adds bundled services the served release does not contain", () => {
    const frozen = asServedByTheFreeze();
    const added = bundledServicesMissingFrom(frozen, { activeReleaseId: RETAINED_BOOTSTRAP });
    expect(added.map((record) => record.slug).sort()).toEqual([...POST_FREEZE_SLUGS].sort());
  });

  it("adds nothing when every bundled record is already served", () => {
    expect(bundledServicesMissingFrom(serviceRecords, { activeReleaseId: RETAINED_BOOTSTRAP })).toEqual([]);
  });

  it("is inert once a real release is active", () => {
    // The gate is the whole design: a published release must win, or every future
    // clinician-reviewed publish keeps losing to the bundle.
    const frozen = asServedByTheFreeze();
    expect(bundledServicesMissingFrom(frozen, { activeReleaseId: PUBLISHED_RELEASE })).toEqual([]);
    expect(bundledServicesMissingFrom(frozen, { activeReleaseId: null })).toEqual([]);
    expect(bundledServicesMissingFrom(frozen, {})).toEqual([]);
  });
});

describe("a stale service payload is refreshed from the bundle", () => {
  const bundled = getServiceRecord("13yarn");

  it("swaps a record the release already has", () => {
    expect(bundled).toBeTruthy();
    const stale = { ...(bundled as ServiceRecord), title: "STALE TITLE FROM THE FREEZE" };
    const result = preferBundledServiceRecord(entry(stale), { activeReleaseId: RETAINED_BOOTSTRAP });
    expect(result.record.title).toBe((bundled as ServiceRecord).title);
    expect(result.record.title).not.toBe("STALE TITLE FROM THE FREEZE");
  });

  it("leaves the canonical payload alone once a real release is active", () => {
    const stale = { ...(bundled as ServiceRecord), title: "STALE TITLE FROM THE FREEZE" };
    for (const activeReleaseId of [PUBLISHED_RELEASE, null, undefined]) {
      const result = preferBundledServiceRecord(entry(stale), { activeReleaseId });
      expect(result.record.title).toBe("STALE TITLE FROM THE FREEZE");
    }
  });

  it("leaves a record the bundle does not have alone", () => {
    const orphan = { ...(bundled as ServiceRecord), slug: "a-slug-the-bundle-does-not-have" };
    const result = preferBundledServiceRecord(entry(orphan), { activeReleaseId: RETAINED_BOOTSTRAP });
    expect(result.record.slug).toBe("a-slug-the-bundle-does-not-have");
  });
});

describe("content served from the bundle never carries a sign-off", () => {
  it("narrows a swapped record's validation status", () => {
    // The release's `approved` badge describes the payload that was just replaced.
    const stale = { ...(getServiceRecord("13yarn") as ServiceRecord), title: "STALE" };
    const result = preferBundledServiceRecord(entry(stale, "approved"), {
      activeReleaseId: RETAINED_BOOTSTRAP,
    });
    expect(result.governance?.validationStatus).toBe("unverified");
  });

  it("gives a topped-up record unverified governance unless the owner signed it off", () => {
    for (const slug of POST_FREEZE_SLUGS) {
      const record = getServiceRecord(slug) as ServiceRecord;
      const governance = bundledServiceGovernance(record);
      // Only a sign-off written by npm run clinical:review -- --kind service lifts it; whatever
      // the record claims locally never does.
      expect(governance.validationStatus, `${slug} must not claim a sign-off it does not have`).toBe(
        serviceRecordSignOff(record) ? "locally_reviewed" : "unverified",
      );
      // sourceStatus stays derived: it describes the publisher's page, which publication does not change.
      expect(typeof governance.sourceStatus).toBe("string");
    }
  });
});
