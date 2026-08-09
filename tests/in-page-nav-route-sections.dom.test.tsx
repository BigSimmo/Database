import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DsmDiagnosisPage } from "@/components/dsm/dsm-diagnosis-page";
import { dsmDiagnosisNavSections } from "@/components/dsm/dsm-diagnosis-nav-header";
import {
  DsmDifferentialConsiderationsPage,
  dsmDifferentialNavSections,
  type DsmDifferentialConsideration,
} from "@/components/dsm/dsm-differential-considerations-page";
import { FormDetailPage, formNavSections } from "@/components/forms/form-detail-page";
import { FormulationMechanismPage } from "@/components/formulation/formulation-mechanism-page";
import { formulationNavSections } from "@/components/formulation/formulation-nav-header";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { sectionTargetIds, type PageSection } from "@/components/in-page-nav/page-section-index";
import { ServiceDetailPage, serviceNavSections } from "@/components/services/service-detail-page";
import { specifierNavSections } from "@/components/specifiers/specifier-nav-header";
import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { SpecifierReferencePage } from "@/components/specifiers/specifier-reference-page";
import { dsmDiagnoses } from "@/lib/dsm";
import { formRecords } from "@/lib/forms";
import { formulationMechanisms } from "@/lib/formulation";
import { serviceRecords } from "@/lib/services";
import { specifierCatalogItems, curatedEnrichmentFor } from "@/lib/specifiers-content";
import { specifierRecords } from "@/lib/specifiers";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    isAuthenticated: true,
    setFavourite: vi.fn(async () => true),
  }),
}));

afterEach(cleanup);

/**
 * The guard `/issues #256` asks for, and the one the pill rail never had.
 *
 * The rail declared section sets in a table beside the pages rather than inside
 * them, and `AvailableInformationPageNavigation` silently dropped any section
 * whose anchor was missing — so a set could rot to nothing and the only symptom
 * was a route quietly drawing no navigation. Two routes were in exactly that
 * state when this was written: `/dsm/diagnoses/<slug>` rendered three of five
 * declared anchors, and its `/differentials` child rendered one of four.
 *
 * The stop rule from that issue is what shapes this file: **assert against the
 * rendered DOM, never a source grep**. Several anchors reach the DOM through a
 * prop (`SpecifierSafetyNote id=…`, the local `Section` helper on the services
 * page), so a scan for `id="…"` reports live sections as dead.
 */
type RouteCase = {
  name: string;
  sections: readonly PageSection[];
  render: () => ReactElement;
  /**
   * Anchors that legitimately depend on the record. Each is asserted present on
   * a fixture that has the data and absent on one that does not, rather than
   * being skipped.
   */
  conditional?: readonly string[];
};

const specifierRecord = specifierRecords[0];
const specifierCatalogItem = specifierCatalogItems().find((item) => curatedEnrichmentFor(item));
const dsmDiagnosisWithKeyFeatures = dsmDiagnoses.find(
  (diagnosis) => diagnosis.key_features.length > 0 && diagnosis.criteria_display.length > 0,
);
const dsmDiagnosisWithDifferentials = dsmDiagnoses.find((diagnosis) => diagnosis.differentials.length > 0);

function buildConsiderations(values: string[]): DsmDifferentialConsideration[] {
  return values.map((value, index) => ({
    id: `${index}-consideration`,
    title: value,
    fullText: value,
    rationale: "Listed as a differential consideration in the supplied diagnosis record.",
    group: "overlap",
  }));
}

const routes: RouteCase[] = [
  {
    name: "/services/[slug]",
    sections: serviceNavSections,
    render: () => <ServiceDetailPage service={serviceRecords[0]} />,
  },
  {
    name: "/forms/[slug]",
    sections: formNavSections,
    render: () => <FormDetailPage form={formRecords[0]} />,
  },
  {
    name: "/specifiers/[slug] (curated record)",
    sections: specifierNavSections,
    render: () => <SpecifierRecordPage record={specifierRecord} />,
  },
  {
    name: "/specifiers/[slug] (catalogue reference)",
    sections: specifierNavSections,
    render: () => <SpecifierReferencePage item={specifierCatalogItem!} />,
    // Only the enriched reference page renders the fit panel.
    conditional: ["specifier-fit"],
  },
  {
    name: "/formulation/[slug]",
    sections: formulationNavSections,
    render: () => <FormulationMechanismPage mechanism={formulationMechanisms[0]} />,
  },
  {
    name: "/dsm/diagnoses/[slug]",
    sections: dsmDiagnosisNavSections,
    render: () => <DsmDiagnosisPage diagnosis={dsmDiagnosisWithKeyFeatures!} />,
    conditional: ["key-features"],
  },
  {
    name: "/dsm/diagnoses/[slug]/differentials",
    sections: dsmDifferentialNavSections,
    render: () => (
      <DsmDifferentialConsiderationsPage
        diagnosis={{
          slug: dsmDiagnosisWithDifferentials!.slug,
          title: dsmDiagnosisWithDifferentials!.title,
          icdCode: dsmDiagnosisWithDifferentials!.icd_code,
          category: dsmDiagnosisWithDifferentials!.category.label,
        }}
        considerations={buildConsiderations(dsmDiagnosisWithDifferentials!.differentials)}
      />
    ),
  },
];

describe("in-page navigation section contracts", () => {
  it.each(routes.map((route) => [route.name, route] as const))(
    "%s renders an anchor for every declared section",
    (_name, route) => {
      const { container } = render(route.render());

      for (const section of route.sections) {
        // A section may declare several breakpoint copies; jsdom applies no
        // Tailwind, so both are in the DOM here and any one of them proves the
        // anchor exists. Which copy is *displayed* is resolved at runtime by
        // `useResolvedPageSections`, and covered by the Playwright pair check.
        const found = sectionTargetIds(section).some((id) => container.querySelector(`#${CSS.escape(id)}`));
        expect(found, `${route.name}: no element renders an anchor for "${section.id}"`).toBe(true);
      }
    },
  );

  it.each(routes.map((route) => [route.name, route] as const))(
    "%s gives every anchor the shared in-page scroll margin",
    (_name, route) => {
      // Information-page sections carried no scroll-mt at all before the shared
      // header existed, so without this every jump lands underneath it.
      const { container } = render(route.render());

      for (const section of route.sections) {
        const anchor = sectionTargetIds(section)
          .map((id) => container.querySelector(`#${CSS.escape(id)}`))
          .find((element): element is Element => element !== null);
        expect(anchor?.className, `${route.name}: "${section.id}" has no in-page scroll margin`).toContain(
          inPageAnchor,
        );
      }
    },
  );

  it("drops a conditional section rather than declaring a dead anchor", () => {
    // The other half of the conditional cases above: with the data absent the
    // anchor must be absent too, so `useResolvedPageSections` filters the entry
    // out instead of the header offering a jump that goes nowhere.
    const withoutKeyFeatures = dsmDiagnoses.find((diagnosis) => diagnosis.key_features.length === 0);
    if (withoutKeyFeatures) {
      const { container } = render(<DsmDiagnosisPage diagnosis={withoutKeyFeatures} />);
      expect(container.querySelector("#key-features")).toBeNull();
      // The unconditional ones still render, so this is a filtered section and
      // not a page that failed to render at all.
      expect(container.querySelector("#criteria")).not.toBeNull();
      cleanup();
    }

    const withoutEnrichment = specifierCatalogItems().find((item) => !curatedEnrichmentFor(item));
    if (withoutEnrichment) {
      const { container } = render(<SpecifierReferencePage item={withoutEnrichment} />);
      expect(container.querySelector("#specifier-fit")).toBeNull();
      expect(container.querySelector("#specifier-overview")).not.toBeNull();
    }
  });

  it("covers every route that mounts the shared header", () => {
    // A seventh component converted without a case here would leave its
    // declared sections unguarded, which is the whole failure mode.
    expect(routes).toHaveLength(7);
  });
});
