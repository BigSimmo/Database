import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";

import formsActSectionCues from "../data/forms-act-section-cues.json";
import formsPdfManifest from "../data/forms-pdf-manifest.json";
import { derivePdfPasswordProtection } from "../scripts/build-forms-pdf-manifest.mjs";

import { formDetailsClipboardText } from "@/components/forms/form-detail-page";
import { formCatalogDetails } from "@/lib/form-catalog";
import { defaultFormSlug, formRecords, formStaticParams, getFormRecord, searchFormRecords } from "@/lib/forms";
import { buildDefaultFormRows } from "@/lib/registry-fixtures";
import { mergeRegistryRecordsWithDefaults } from "@/lib/registry-seed";

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
    // Draft section summaries and supplemental form mappings remain staged for
    // Every other form reaches the same card from its own section cue, or from the
    // supplemental map for the seven the archive never indexed.
    expect(getFormRecord("form-1b")?.summaryCards?.some((card) => card.id === "source")).toBe(false);
    expect(getFormRecord("form-13")?.summaryCards?.some((card) => card.id === "source")).toBe(false);
    const form4c = formCatalogDetails(getFormRecord("transfer-order")!);
    expect(form4c?.actSections?.map((entry) => entry.section)).toEqual(["66", "91"]);
    expect(form4c?.actSections?.every((entry) => entry.summary?.trim())).toBe(true);
  });

  it("gives every one of the 54 forms an Act-sections card", () => {
    expect(formRecords).toHaveLength(54);
    for (const form of formRecords) {
      expect(
        form.summaryCards?.map((card) => card.id),
        form.slug,
      ).toEqual(["clock", "authority", "criteria", "act-sections"]);
      const sections = formCatalogDetails(form)?.actSections;
      expect(sections?.length, form.slug).toBeGreaterThan(0);
      expect(
        sections?.every((entry) => entry.summary?.trim()),
        form.slug,
      ).toBe(true);
    }
  });

  it("never lets a seeded owner row keep a superseded Act summary", () => {
    // Reproduces the merge path an owner seeded before an Act amendment or a summary
    // correction takes: mergeRegistryRecordWithDefaults spreads the stored payload over
    // the baseline, so without forcing actSections from the baseline the owner would read
    // the superseded legal summary forever and bypass the hash gate entirely.
    const rows = buildDefaultFormRows("00000000-0000-4000-8000-000000000001");
    const seeded = structuredClone(rows.find((row) => row.slug === "form-1b"))!;
    const payload = seeded.catalog_payload as { actSections?: { section: string; summary?: string }[] };
    payload.actSections = [{ section: "66", summary: "SUPERSEDED SUMMARY" }];

    const merged = mergeRegistryRecordsWithDefaults("form", [seeded as never]);
    const record = merged.find((entry) => entry.slug === "form-1b");
    const summaries = formCatalogDetails(record!)?.actSections?.map((entry) => entry.summary);
    expect(summaries).not.toContain("SUPERSEDED SUMMARY");
    expect(summaries).toEqual(formCatalogDetails(getFormRecord("form-1b")!)?.actSections?.map((s) => s.summary));
  });

  it("covers the seven unindexed forms from the supplemental cue map", () => {
    // These have no archive row, so no sourceFacts.sectionCue of their own. Their
    // governing sections are asserted in data/forms-act-section-cues.json with a stated
    // basis, and each entry must still resolve to a written summary.
    expect(formsActSectionCues.forms).toHaveLength(7);
    for (const entry of formsActSectionCues.forms) {
      const record = formRecords.find((form) => formCatalogDetails(form)?.form === entry.code);
      expect(record, entry.code).toBeTruthy();
      const details = formCatalogDetails(record!);
      expect(details?.sourceFacts?.sectionCue, entry.code).toBeFalsy();
      expect(
        details?.actSections?.map((section) => section.section),
        entry.code,
      ).toEqual(entry.sections);
      expect(
        details?.actSections?.every((section) => section.summary?.trim()),
        entry.code,
      ).toBe(true);
      expect(entry.basis.trim().length, entry.code).toBeGreaterThan(40);
    }
  });

  it("keeps the existing reviewed Form 1A override renderable", () => {
    // Form 1A's existing reviewed override remains the only renderable Act-section
    // card until the staged shared summaries receive review sign-off.
    const form1a = getFormRecord("form-1a");
    expect(formCatalogDetails(form1a!)?.actSections).toHaveLength(6);
    expect(form1a?.summaryCards?.find((card) => card.id === "act-sections")?.detail).toBe(
      "26 · 31 · 36 · 37 · 41 · 42",
    );
  });

  it("normalizes form lookup and static params", () => {
    expect(defaultFormSlug()).toBe("form-1a");
    expect(getFormRecord(" FORM-1A ")?.title).toBe("Referral for examination by a psychiatrist");
    expect(getFormRecord(" TRANSPORT-CRISIS-FORM ")?.title).toBe("Transport order");
    expect(getFormRecord("13yarn")).toBeNull();
    expect(formStaticParams()).toEqual(formRecords.map((form) => ({ slug: form.slug })));
  });

  it("ships a stored PDF for every downloadable form", () => {
    const manifestAssets = (formsPdfManifest as { assets: Array<{ code: unknown; passwordProtected: unknown }> })
      .assets;
    for (const asset of manifestAssets) {
      // A malformed manifest entry (missing `code`, or a non-boolean `passwordProtected`)
      // must fail loudly here rather than silently comparing `undefined === undefined`
      // below once both sides of the manifest lookup resolve to nothing.
      expect(typeof asset.code, JSON.stringify(asset)).toBe("string");
      expect(typeof asset.passwordProtected, JSON.stringify(asset)).toBe("boolean");
    }
    const manifestMap = new Map(
      (manifestAssets as Array<{ code: string; passwordProtected: boolean }>).map((asset) => [
        asset.code.toUpperCase(),
        asset.passwordProtected,
      ]),
    );
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
      expect(details?.officialPdfPasswordProtected, details?.form).toBe(manifestMap.get(details!.form.toUpperCase()));
    }

    const form12a = getFormRecord("form-12a");
    expect(form12a).toBeTruthy();
    expect(formCatalogDetails(form12a!)?.officialPdfPasswordProtected).toBe(false);
  });

  // The manifest flag is what the Forms detail page turns into a badge a psychiatrist
  // reads before relying on the file at the bedside. The assertions above only compare
  // the manifest against the catalogue that reads it, so a wrong flag would agree with
  // itself. This pins every flag to the generated contract: the committed bytes.
  it("derives every manifest passwordProtected flag from the committed PDF bytes", async () => {
    const assets = (
      formsPdfManifest as { assets: Array<{ code: string; localPath: string; passwordProtected: boolean }> }
    ).assets;
    expect(assets).toHaveLength(51);
    for (const asset of assets) {
      const bytes = readFileSync(join(process.cwd(), "public", asset.localPath.replace(/^\//, "")));
      // "Requires a user password to open", not "carries an /Encrypt dictionary": a PDF
      // with an owner password and an empty user password is encrypted yet opens freely,
      // and badging that file as protected teaches clinicians to ignore the warning on
      // the files where it is true.
      const derived = await derivePdfPasswordProtection(bytes, `Form ${asset.code}`);
      expect(derived.failure, asset.code).toBeNull();
      expect(derived.passwordProtected, asset.code).toBe(asset.passwordProtected);
    }
    // Form 12A is the one readable form on the register, and other assertions in this
    // file extract its text. Keep that asymmetry visible rather than implied by a loop.
    expect(assets.filter((asset) => !asset.passwordProtected).map((asset) => asset.code)).toEqual(["12A"]);
  });

  it("fails closed to password protected when a form PDF cannot be classified", async () => {
    // `false` asserts the clinician can open the file, so under-warning is the unsafe
    // direction: planning a Form 10A and finding at the bedside that it will not open is
    // a workflow failure at a time-critical statutory step. Every unclassifiable input
    // must therefore report `true` AND surface a failure the generator turns into a hard
    // exit — never a silent `false`.
    const readable = readFileSync(join(process.cwd(), "public", "forms-pdf", "form-12a.pdf"));
    expect(await derivePdfPasswordProtection(readable, "Form 12A")).toEqual({
      passwordProtected: false,
      failure: null,
    });

    for (const [label, corrupt] of [
      ["truncated", readable.subarray(0, 2048)],
      ["not a pdf", Buffer.from("%PDF-1.7 this is not a document")],
      ["empty", Buffer.alloc(0)],
    ] as Array<[string, Buffer | Uint8Array]>) {
      const derived = await derivePdfPasswordProtection(corrupt, `corrupt fixture (${label})`);
      expect(derived.passwordProtected, label).toBe(true);
      expect(derived.failure, label).toContain("could not be opened or classified");
    }
  });

  it("reports a PDF that carries /Encrypt but opens with an empty user password as not password protected", async () => {
    // The whole reason this flag is derived by ATTEMPTING to open the file, rather than by
    // looking for an /Encrypt marker, is that the two answers can differ: a PDF encrypted
    // with an owner password but no user password carries /Encrypt and still opens freely.
    //
    // Every committed form happens to agree under both rules — 50 carry /Encrypt and refuse
    // an empty user password, and form-12a.pdf carries neither — so nothing in this corpus
    // would catch a future "simplification" of the deriver into a grep for /Encrypt. This
    // synthetic fixture is the discriminating case, and it is the only test that fails if
    // that shortcut is ever taken.
    const ownerPasswordOnly = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ ownerPassword: "owner-only-secret", permissions: { printing: "highResolution" } });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.text("Owner password only; the user password is empty.");
      doc.end();
    });

    // Precondition: the fixture really is the confusing shape, not merely an unencrypted file.
    expect(ownerPasswordOnly.includes("/Encrypt")).toBe(true);

    expect(await derivePdfPasswordProtection(ownerPasswordOnly, "owner-password-only fixture")).toEqual({
      passwordProtected: false,
      failure: null,
    });
  });

  it("populates Form 12A statutory Authority and Criteria priority facts from readable approved PDF", () => {
    const form12a = getFormRecord("form-12a");
    expect(form12a).toBeTruthy();
    const details = formCatalogDetails(form12a!);
    expect(details?.priorityFacts?.clock?.title).toBe("Valid until revoked or resigned");
    expect(details?.priorityFacts?.clock?.detail).toContain("Revocable at any time");
    expect(details?.priorityFacts?.authority?.title).toBe("Person understanding effect (any age, incl. child)");
    expect(details?.priorityFacts?.authority?.detail).toContain("nominee adult 18+");
    expect(details?.priorityFacts?.authority?.body).toMatch(/s273.*s274.*s275/);
    expect(details?.priorityFacts?.criteria?.title).toBe("Person understands effect of nomination (s273)");
    expect(details?.priorityFacts?.criteria?.detail).toMatch(/Max 1 nominee/);
    expect(details?.priorityFacts?.criteria?.body).toMatch(/s273.*s276.*s263.*s266/);
    expect(details?.maker).toContain("s273");
    expect(details?.maker).toContain("s275");
    expect(details?.threshold).toContain("s273");
    expect(details?.threshold).toContain("s276");
    expect(details?.authorises).toMatch(/s266.*s263/);
    expect(details?.doesNotAuthorise).toContain("consent to or refuse treatment");
    expect(form12a?.summaryCards?.map((card) => card.id)).toEqual(["clock", "authority", "criteria", "act-sections"]);
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
