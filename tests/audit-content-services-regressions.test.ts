import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { generateMetadata as generateFormMetadata } from "@/app/forms/[slug]/page";
import { generateMetadata as generateServiceMetadata } from "@/app/services/[slug]/page";
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
        status: "Source checked",
      },
    });
    expect(transport?.source).toHaveProperty("url");
    expect(transport?.source).toHaveProperty("reviewed");
    expect(transport?.source).not.toHaveProperty("published");
    expect(transport?.source).not.toHaveProperty("reviewDue");
    expect(JSON.stringify(transport?.source)).not.toMatch(/\b\d+\s+pages?\b/);
    expect(formDetailSource).not.toContain("01 May 2026");
    expect(formDetailSource).not.toMatch(/\b(?:1A|3A|4A|4B)\b|5\(2\)|Admission order|Treatment order/);
    expect(formDetailSource).not.toMatch(/Pathway navigation is not available yet|Full pathway unavailable/);
    expect(formDetailSource).toContain("No linked full pathway is available for this record.");
    expect(normalizedFormDetailSource).toContain("...(hasText(form.source?.reviewed) ? [{ icon: CalendarDays");

    for (const form of formRecords) {
      expect(form.verification?.locallyVerified, form.slug).toBe(false);
      expect(form.verification?.confidence, form.slug).toBe("Medium");
      expect(form.source?.status, form.slug).toContain("Source");
      expect(form.source?.reviewed, form.slug).toMatch(/Official register checked/);
      expect(form.source?.url, form.slug).toMatch(/^https?:\/\//);
    }

    expect(formsSearchSource).not.toMatch(
      /\b(?:1A|3A|4A|4B)\b|Evidence 278|Pathways 12|Tasks 8|PSOLIS|Source verified|Official source|Aligned to MHA|Open account setup|View full pathway|Filter controls are coming soon/,
    );
    expect(formsSearchSource).toContain("statusToneClass(chip.tone)");
    expect(formsSearchSource).toContain("Title or identifier match");
    expect(formsSearchSource).toContain("Match in form record details");
    expect(formsSearchSource).toContain("Browse all forms");
    expect(formsHomeSource).not.toMatch(/Source verified|Open account setup/);
    expect(formsHomeSource).not.toMatch(
      /Number, pathway, clock|Maker, clock, copies|Browse pathways|Before, current, parallel, after|starter set of MHA 2014 forms|follow a pathway/,
    );
    expect(formsHomeSource).toContain("Local confirmation required");
    expect(formsHomeSource).toContain("form records confirmed");
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
    expect(normalizedFormDetailSource).toContain("{form.source?.url || details?.localPdfPath ? (");
    expect(normalizedFormDetailSource).toMatch(/\{form\.source\?\.url \|\| details\?\.localPdfPath \? \(/);
    expect(normalizedFormDetailSource).toContain("<a href={form.source.url}");
    expect(normalizedFormDetailSource).toContain("> Official");
    expect(normalizedFormDetailSource).toContain("> Stored copy");
    expect(normalizedFormDetailSource).toContain("Source link pending");
  });
});
