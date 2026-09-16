import { describe, expect, it } from "vitest";

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
    expect(synced.governance).toEqual({ sourceStatus: "current", validationStatus: "locally_reviewed" });
    expect((synced.record.catalogPayload as { contentReviewStatus?: string }).contentReviewStatus).toBe(
      (bundled.catalogPayload as { contentReviewStatus?: string }).contentReviewStatus,
    );
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
