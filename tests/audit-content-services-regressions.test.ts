import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { generateMetadata as generateFormMetadata } from "@/app/(search-app)/forms/[slug]/page";
import { generateMetadata as generateServiceMetadata } from "@/app/(search-app)/services/[slug]/page";
import { sourceToneClass } from "@/components/forms/form-detail-page";
import { toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";
import { formRecords, getFormRecord, type FormRecord } from "@/lib/forms";
import { canCompareServices, serviceNavigatorMetrics } from "@/lib/service-navigator-metrics";
import { serviceRecords, type ServiceRecord } from "@/lib/services";

vi.mock("@/components/forms/form-detail-client", () => ({ FormDetailClient: () => null }));
vi.mock("@/components/services/service-detail-client", () => ({ ServiceDetailClient: () => null }));

const formDetailSource = readFileSync(new URL("../src/components/forms/form-detail-page.tsx", import.meta.url), "utf8");
const normalizedFormDetailSource = formDetailSource.replace(/\s+/g, " ");
const formsHomeSource = readFileSync(new URL("../src/components/forms/forms-home-page.tsx", import.meta.url), "utf8");
const formsSearchSource = readFileSync(
  new URL("../src/components/forms/forms-search-results-page.tsx", import.meta.url),
  "utf8",
);
const serviceNavigatorSource = readFileSync(
  new URL("../src/components/services/services-navigator-page.tsx", import.meta.url),
  "utf8",
);
const normalizedServiceNavigatorSource = serviceNavigatorSource.replace(/\s+/g, " ");

function service(slug: string, fields: Partial<ServiceRecord> = {}): ServiceRecord {
  return { slug, title: slug, ...fields };
}

function formWithProvenance(status: string, locallyVerified: boolean): FormRecord {
  const form = formRecords[0]!;
  return {
    ...form,
    source: { ...form.source, status },
    verification: { ...form.verification, locallyVerified },
  };
}

describe("content and services audit regressions", () => {
  it("derives service navigator metrics and requires two records for comparison", () => {
    const records = [
      service("high", {
        criteria: [
          { label: "Eligible", tone: "meet" },
          { label: "Confirm catchment", tone: "caution" },
        ],
        verification: { confidence: "High" },
      }),
      service("medium", {
        criteria: [{ label: "Excluded", tone: "reject" }],
        verification: { confidence: "Medium" },
      }),
      service("low", { verification: { confidence: "Low" } }),
      service("unknown"),
    ];

    expect(serviceNavigatorMetrics(records)).toEqual({
      meets: 1,
      cautions: 1,
      rejects: 1,
      high: 1,
      medium: 1,
      low: 1,
      unknown: 1,
      verified: 0,
      localConfirmation: 0,
    });
    expect(canCompareServices([])).toBe(false);
    expect(canCompareServices(records.slice(0, 1))).toBe(false);
    expect(canCompareServices(records.slice(0, 2))).toBe(true);
    expect(normalizedServiceNavigatorSource).toContain(
      'key={selected.length === 0 ? "empty" : selected.length === 1 ? "single" : "multiple"}',
    );
    expect(serviceNavigatorSource).not.toContain("useEffect(");
    expect(serviceNavigatorSource).toContain("aria-pressed={selected}");
    expect(serviceNavigatorSource).toContain("Add ${service.title} to comparison");
    expect(serviceNavigatorSource).toContain("Remove ${service.title} from comparison");
  });

  it("counts only explicit local verification and lets confirmation-required status veto it", () => {
    const records = [
      service("explicit", {
        verification: { locallyVerified: true, confidence: "High" },
        source: { status: "Official source" },
      }),
      service("status-only", {
        verification: { confidence: "High" },
        source: { status: "Official verified source" },
      }),
      service("confirmation-veto", {
        verification: { locallyVerified: true, confidence: "High" },
        source: { status: "Local source confirmation required" },
      }),
      service("unrelated-required-status", {
        verification: { confidence: "Unknown" },
        source: { status: "Referral required" },
      }),
    ];

    expect(serviceNavigatorMetrics(records)).toMatchObject({ verified: 1, localConfirmation: 1 });
  });

  it("keeps seeded form provenance explicitly unverified and free of invented source facts", () => {
    const transport = getFormRecord("transport-crisis-form");

    expect(transport).not.toBeNull();
    expect(transport).toMatchObject({
      verification: { locallyVerified: false, confidence: "Medium" },
      source: {
        label: "Office of the Chief Psychiatrist WA — approved MHA 2014 forms",
        status: "Source checked",
      },
    });
    expect(transport?.source).toHaveProperty("url");
    expect(transport?.source).toHaveProperty("reviewed");
    expect(transport?.source).not.toHaveProperty("pages");
    expect(transport?.source).not.toHaveProperty("pageCount");
    expect(transport?.source).not.toHaveProperty("reviewDue");
    expect(JSON.stringify(transport?.source)).not.toMatch(/\b\d+\s+pages?\b|\bstatutory\b/i);
    expect(formDetailSource).not.toMatch(/\b\d+\s+pages?\b|\bReview due\b/i);
    expect(formDetailSource).not.toContain("01 May 2026");
    expect(formDetailSource).not.toMatch(/5\(2\)|Admission order|Treatment order/);
    expect(formDetailSource).toContain("Open official source / pathway");
    expect(normalizedFormDetailSource).toContain(
      'label: "Source currency", value: displayText(form.source?.reviewed, "Review locally")',
    );

    for (const form of formRecords) {
      if (form.source?.url) continue;
      expect(form.verification?.locallyVerified, form.slug).toBe(false);
      expect(form.verification?.confidence, form.slug).toBe("Unknown");
      expect(form.source?.status, form.slug).toMatch(/confirmation required/i);
      expect(form.source?.reviewed, form.slug).toBeUndefined();
    }

    expect(formsSearchSource).toContain("Title or content match");
    expect(formsSearchSource).toContain("Content match in record details");
    expect(formsSearchSource).not.toContain("Content match in related pathway");
    expect(formsSearchSource).toContain("View all forms");
    expect(formsSearchSource).toContain('appModeHomeHref("forms", { query, focus: true, run: true })');
    expect(formsSearchSource).not.toContain('href="/forms"');
    expect(formsHomeSource).not.toMatch(/Source verified|Open account setup/);
    expect(formsHomeSource).not.toMatch(
      /Number, pathway, clock|Maker, clock, copies|Browse pathways|Before, current, parallel, after|starter set of MHA 2014 forms|follow a pathway/,
    );
    expect(formsHomeSource).toContain("local confirmation");
    expect(formsHomeSource).toContain("Source catalogue reviewed");
  });

  it("does not render negative or text-only source statuses as verified", () => {
    expect(sourceToneClass(formWithProvenance("Unverified", true))).toBe(toneWarning);
    expect(sourceToneClass(formWithProvenance("Official verified source", false))).toBe(toneNeutral);
    expect(sourceToneClass(formWithProvenance("Official source", true))).toBe(toneSuccess);
  });

  it("generates form and service metadata from each requested slug", async () => {
    const firstForm = formRecords[0]!;
    const secondForm = formRecords[1]!;
    const firstService = serviceRecords[0]!;
    const secondService = serviceRecords[1]!;

    const [
      firstFormMetadata,
      secondFormMetadata,
      firstServiceMetadata,
      secondServiceMetadata,
      registryOnlyFormMetadata,
      registryOnlyServiceMetadata,
    ] = await Promise.all([
      generateFormMetadata({ params: Promise.resolve({ slug: firstForm.slug }) }),
      generateFormMetadata({ params: Promise.resolve({ slug: secondForm.slug }) }),
      generateServiceMetadata({ params: Promise.resolve({ slug: firstService.slug }) }),
      generateServiceMetadata({ params: Promise.resolve({ slug: secondService.slug }) }),
      generateFormMetadata({ params: Promise.resolve({ slug: "registry-only-form" }) }),
      generateServiceMetadata({ params: Promise.resolve({ slug: "registry-only-service" }) }),
    ]);

    expect(firstFormMetadata).toEqual({
      title: `${firstForm.title} - Forms - Clinical KB`,
      description: firstForm.subtitle,
    });
    expect(secondFormMetadata).toEqual({
      title: `${secondForm.title} - Forms - Clinical KB`,
      description: secondForm.subtitle,
    });
    expect(firstServiceMetadata).toEqual({
      title: `${firstService.title} - Services - Clinical KB`,
      description: firstService.subtitle,
    });
    expect(secondServiceMetadata).toEqual({
      title: `${secondService.title} - Services - Clinical KB`,
      description: secondService.subtitle,
    });
    expect(firstFormMetadata.title).not.toEqual(secondFormMetadata.title);
    expect(firstServiceMetadata.title).not.toEqual(secondServiceMetadata.title);
    expect(registryOnlyFormMetadata.title).toBe("Form record - Forms - Clinical KB");
    expect(registryOnlyServiceMetadata.title).toBe("Service record - Services - Clinical KB");
  });

  it("claims and renders a form source link only when the record has a URL", () => {
    expect(normalizedFormDetailSource).toContain("sourceHref={form.source?.url ?? null}");
    expect(normalizedFormDetailSource).toContain("href={form.source.url}");
    expect(normalizedFormDetailSource).toContain('target="_blank"');
    expect(normalizedFormDetailSource).toContain('rel="noopener noreferrer"');
    expect(normalizedFormDetailSource).toContain("inline-flex min-h-10");
    expect(formDetailSource).toContain("Source link pending");
    expect(formDetailSource).toContain("Official");
  });
});
