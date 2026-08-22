import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formDetailsClipboardText } from "@/components/forms/form-detail-page";
import { formCatalogDetails } from "@/lib/form-catalog";
import { defaultFormSlug, formRecords, formStaticParams, getFormRecord, searchFormRecords } from "@/lib/forms";
import { buildDefaultFormRows } from "@/lib/registry-fixtures";

describe("psychiatry form records", () => {
  it("copies the visible form details rather than only the primary contact", () => {
    const form = formRecords.find((record) => record.primaryContact?.value && record.bestUse && record.source?.status);
    if (!form?.primaryContact?.value || !form.bestUse || !form.source?.status) {
      throw new Error("Expected a form fixture with copyable details");
    }

    const copied = formDetailsClipboardText(form);
    expect(copied).toContain(form.title);
    expect(copied).toContain(`Form code: ${formCatalogDetails(form)?.form}`);
    expect(copied).toContain(`Legal boundary: ${form.bestUse}`);
    expect(copied).toContain(form.primaryContact.value);
    expect(copied).toContain(`Source status: ${form.source.status}`);
    expect(copied.trim()).not.toBe(form.primaryContact.value.trim());
  });

  it("covers every entry on the current WA MHA 2014 forms register", () => {
    expect(formRecords).toHaveLength(54);
    const details = formRecords.map(formCatalogDetails);
    expect(details.every(Boolean)).toBe(true);
    const codes = details.flatMap((entry) => (entry ? [entry.form] : []));
    expect(new Set(codes).size).toBe(54);
    expect(codes).toEqual(
      expect.arrayContaining(["1A", "1A attachment", "7C", "10H", "12C attachment", "13", "4D", "4E"]),
    );
    expect(details.filter((entry) => entry?.availability === "downloadable")).toHaveLength(51);
    expect(details.filter((entry) => entry?.availability === "unavailable").map((entry) => entry?.form)).toEqual([
      "4D",
      "4E",
    ]);
    expect(details.find((entry) => entry?.form === "13")?.availability).toBe("contact_ocp");
    expect(details.find((entry) => entry?.form === "1A")?.before).toEqual([]);
    expect(details.find((entry) => entry?.form === "1A")?.parallel).toEqual(["1A attachment"]);

    const catalogueText = JSON.stringify(formRecords).toLowerCase();

    expect(catalogueText).toContain("psychiatrist");
    expect(catalogueText).toContain("transport");
    expect(catalogueText).toContain("detention");
    expect(catalogueText).toContain("transfer");
    expect(catalogueText).toContain("mental health act");
    expect(catalogueText).not.toContain("placeholder");
    expect(catalogueText).not.toContain(".example");
    expect(catalogueText).not.toContain("13yarn");
    expect(catalogueText).not.toContain("medicare mental health");
  });

  it("condenses Form 1A priority facts and replaces source status with Act sections", () => {
    const form = getFormRecord("form-1a");
    expect(form).toBeTruthy();
    const details = formCatalogDetails(form!);
    expect(details?.priorityFacts?.clock?.title).toBe("Usually 72 hours from referral");
    expect(details?.priorityFacts?.authority?.detail).toBe("Psychiatrist examination only");
    expect(details?.priorityFacts?.criteria?.detail).toMatch(/illness · risk · capacity · least restrictive/i);
    expect(details?.actSections?.map((entry) => entry.section)).toEqual(["26", "31", "36", "37", "41", "42"]);
    expect(form?.summaryCards?.map((card) => card.id)).toEqual(["clock", "authority", "criteria", "act-sections"]);
    expect(form?.summaryCards?.find((card) => card.id === "act-sections")?.detail).toBe("26 · 31 · 36 · 37 · 41 · 42");
    expect(form?.summaryCards?.some((card) => card.id === "source")).toBe(false);
    // Source status remains on the rail / overview, not in the priority-fact grid.
    expect(form?.source?.status).toBe("Source checked");
    // A form with no archive row has no section cue, so it can never gain an Act-sections
    // card and keeps Source status permanently. Cued forms flip once every section they
    // cite has a reviewed summary - see tests/mha-act-sections.test.ts.
    expect(getFormRecord("form-13")?.summaryCards?.some((card) => card.id === "source")).toBe(true);
    expect(getFormRecord("form-13")?.summaryCards?.some((card) => card.id === "act-sections")).toBe(false);
  });

  it("normalizes form lookup and static params", () => {
    expect(defaultFormSlug()).toBe("form-1a");
    expect(getFormRecord(" FORM-1A ")?.title).toBe("Referral for examination by a psychiatrist");
    expect(getFormRecord(" TRANSPORT-CRISIS-FORM ")?.title).toBe("Transport order");
    expect(getFormRecord("13yarn")).toBeNull();
    expect(formStaticParams()).toEqual(formRecords.map((form) => ({ slug: form.slug })));
  });

  it("ships a stored PDF for every downloadable form", () => {
    const downloadable = formRecords.map(formCatalogDetails).filter((entry) => entry?.availability === "downloadable");
    for (const details of downloadable) {
      expect(details?.localPdfPath, details?.form).toBeTruthy();
      const pdfPath = join(process.cwd(), "public", details!.localPdfPath!.replace(/^\//, ""));
      expect(existsSync(pdfPath), details?.form).toBe(true);
      expect(details?.officialPdfUrl, details?.form).toMatch(/^https:\/\/www\.chiefpsychiatrist\.wa\.gov\.au\//);
      expect(details?.localPdfSha256, details?.form).toMatch(/^[a-f0-9]{64}$/);
      expect(createHash("sha256").update(readFileSync(pdfPath)).digest("hex"), details?.form).toBe(
        details?.localPdfSha256,
      );
      expect(details?.localPdfBytes, details?.form).toBeGreaterThan(10_000);
      expect(details?.officialPdfPasswordProtected, details?.form).toBe(true);
    }
  });

  it("retains the enriched form payload in database seed rows", () => {
    const rows = buildDefaultFormRows("00000000-0000-4000-8000-000000000001");
    expect(rows).toHaveLength(54);
    const form7c = rows.find((row) => row.slug === "form-7c");
    expect(form7c?.catalog_payload).toMatchObject({
      form: "7C",
      name: "Cancellation of grant of leave",
      availability: "downloadable",
    });

    // mergeRegistryRecordWithDefaults spreads a stored owner catalog_payload over the
    // baseline, so a seeded actSections list would win over the catalogue's. Seed rows
    // must therefore carry exactly what the catalogue derives, never a stale copy.
    const form1a = rows.find((row) => row.slug === "form-1a");
    const seededSections = (form1a?.catalog_payload as { actSections?: { section: string }[] })?.actSections;
    expect(seededSections?.map((entry) => entry.section)).toEqual(
      formCatalogDetails(getFormRecord("form-1a")!)?.actSections?.map((entry) => entry.section),
    );
  });

  it("searches forms independently from service records", () => {
    expect(searchFormRecords("transport forms")[0]?.service.slug).toBe("transport-crisis-form");
    expect(searchFormRecords("extension transport")[0]?.service.slug).toBe("extension-transport-order");
    expect(searchFormRecords("detention movement")[0]?.service.slug).toBe("detention-examination-movement");
    expect(searchFormRecords("transfer order")[0]?.service.slug).toBe("transfer-order");
    expect(searchFormRecords("7c cancellation leave")[0]?.service.slug).toBe("form-7c");
    expect(searchFormRecords("10h restraint review")[0]?.service.slug).toBe("form-10h");
    expect(searchFormRecords("ect statistics form 13")[0]?.service.slug).toBe("form-13");
    expect(searchFormRecords("13YARN")).toHaveLength(0);
    expect(searchFormRecords("services")).toHaveLength(0);
    expect(searchFormRecords("forms")[0]?.reasons).toContain("psychiatry forms catalogue");
  });
});
