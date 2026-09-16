import { describe, expect, it, vi } from "vitest";

import { FORMS_AWAITING_REVIEW_NOTE, loadFormCatalogDetails } from "@/lib/form-catalog";
import { formRecords } from "@/lib/forms";
import { preferBundledFormRecord } from "@/lib/site-content/prefer-bundled-form-record";
import type { ServiceRecord } from "@/lib/services";

describe("preferBundledFormRecord", () => {
  it("replaces a stale canonical form projection with the bundled catalogue record", () => {
    const bundled = formRecords[0];
    expect(bundled).toBeTruthy();
    const stale = {
      ...bundled,
      subtitle: "STALE PURPOSE THAT MUST NOT SURFACE",
      verification: {
        ...bundled.verification,
        notes: ["stale note without the awaiting-review caveat"],
      },
      catalogPayload: {
        ...(bundled.catalogPayload as Record<string, unknown>),
        contentReviewStatus: "reviewed",
        purpose: "STALE PURPOSE THAT MUST NOT SURFACE",
      },
    } as ServiceRecord;

    const synced = preferBundledFormRecord("form", {
      record: stale,
      governance: { sourceStatus: "current", validationStatus: "locally_reviewed" },
    });

    expect(synced.record).toEqual(bundled);
    expect(synced.record.subtitle).not.toBe("STALE PURPOSE THAT MUST NOT SURFACE");
    expect((synced.record.catalogPayload as { contentReviewStatus?: string }).contentReviewStatus).toBe(
      (bundled.catalogPayload as { contentReviewStatus?: string }).contentReviewStatus,
    );
    // `sourceStatus` describes the approved form on the OCP register, which the handover
    // re-verified rather than changed, so it stays canonical.
    expect(synced.governance?.sourceStatus).toBe("current");
  });

  /**
   * The canonical governance describes the release payload this helper has just thrown
   * away. Carrying its sign-off across onto drafted guidance would put an `approved` or
   * `locally_reviewed` badge on text nobody has signed off, which is the one thing the
   * awaiting-review caveat exists to prevent.
   */
  it("narrows a release sign-off to unverified when the bundled form still awaits review", () => {
    const bundled = formRecords.find((row) => (row.verification?.notes ?? []).includes(FORMS_AWAITING_REVIEW_NOTE));
    expect(bundled, "expected at least one drafted form in the bundled catalogue").toBeTruthy();

    for (const claimed of ["approved", "locally_reviewed", "unverified"]) {
      const synced = preferBundledFormRecord("form", {
        record: { ...bundled!, subtitle: "stale" },
        governance: { sourceStatus: "current", validationStatus: claimed },
      });
      expect(synced.governance?.validationStatus, claimed).toBe("unverified");
      expect(synced.governance?.sourceStatus, claimed).toBe("current");
    }
  });

  it("leaves a signed-off release claim alone once the bundled form is reviewed", async () => {
    // The helper always re-reads the real bundled record, so the reviewed branch cannot be
    // reached by editing the record passed in. Every shipped form is currently drafted, so
    // the only way to exercise it is to stand in a reviewed bundle.
    const bundled = formRecords.find((row) => (row.verification?.notes ?? []).includes(FORMS_AWAITING_REVIEW_NOTE))!;
    const reviewed = {
      ...bundled,
      verification: {
        ...bundled.verification,
        notes: (bundled.verification?.notes ?? []).filter((note) => note !== FORMS_AWAITING_REVIEW_NOTE),
      },
    } as ServiceRecord;

    vi.resetModules();
    vi.doMock("@/lib/forms", () => ({ getFormRecord: () => reviewed, formRecords: [reviewed] }));
    const { preferBundledFormRecord: scoped } = await import("@/lib/site-content/prefer-bundled-form-record");

    const synced = scoped("form", {
      record: reviewed,
      governance: { sourceStatus: "current", validationStatus: "locally_reviewed" },
    });

    // The swap itself never downgrades; only an unreviewed payload does.
    expect(synced.governance?.validationStatus).toBe("locally_reviewed");

    vi.doUnmock("@/lib/forms");
    vi.resetModules();
  });

  it("does not invent governance for a caller that passes none", () => {
    const bundled = formRecords[0]!;
    const synced = preferBundledFormRecord("form", { record: { ...bundled, subtitle: "stale" } });
    expect(synced).not.toHaveProperty("governance");
  });

  it("leaves non-form kinds untouched", () => {
    const record = { slug: "svc", title: "Service" } as ServiceRecord;
    const mapped = { record, extra: 1 };
    expect(preferBundledFormRecord("service", mapped)).toBe(mapped);
  });

  it("keeps every drafted form's awaiting-review caveat in the bundled population the API prefers", () => {
    const drafted = loadFormCatalogDetails().filter((row) => row.contentReviewStatus === "drafted");
    expect(drafted.length).toBeGreaterThan(0);
    for (const details of drafted) {
      const resolved =
        formRecords.find((row) => (row.catalogPayload as { form?: string } | undefined)?.form === details.form) ?? null;
      expect(resolved, details.form).toBeTruthy();
      expect(resolved!.verification?.notes ?? []).toContain(FORMS_AWAITING_REVIEW_NOTE);
      const synced = preferBundledFormRecord("form", { record: { ...resolved!, subtitle: "stale" } });
      expect(synced.record.verification?.notes ?? []).toContain(FORMS_AWAITING_REVIEW_NOTE);
    }
  });
});
