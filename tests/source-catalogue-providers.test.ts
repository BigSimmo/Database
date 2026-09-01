import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import formsSnapshot from "../data/forms-page-snapshot.json";
import dsmClinicalContent from "../src/data/dsm-clinical-content.json";
import therapies from "../src/data/therapies-source.json";
import { calculators } from "@/components/calculators/calculator-fixtures";
import { factsheets } from "@/components/factsheets/factsheets-data";
import { dictionarySources } from "@/lib/dictionary-data";
import { formulationMechanisms, formulationSourceLibrary } from "@/lib/formulation";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import { loadServicesSnapshot } from "@/lib/service-catalog";
import { authoritativeSources, loadSpecifiersContent } from "@/lib/specifiers-content";
import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import { GOVERNED_SOURCE_HOSTS } from "@/lib/sources/source-url-policy";
import {
  repositorySourceCoverageIssues,
  repositorySourceProviders,
  repositorySourceReferenceIssues,
  repositorySourceReferences,
  specifierAuthoritativeSourceReferences,
} from "@/lib/sources/repository-providers";

const expectedProviders = {
  dictionary: ["src/lib/dictionary-data.ts"],
  factsheets: ["src/components/factsheets/factsheets-data.ts"],
  formulation: ["src/data/formulation-content.json"],
  therapies: ["src/data/therapies-source.json"],
  specifiers: ["data/specifiers-content.json"],
  forms: ["data/forms-page-snapshot.json"],
  mha: ["data/mha-2014-sections.source.json"],
  medications: ["data/medications-snapshot.json"],
  services: ["data/services-snapshot.json"],
  dsm: ["src/data/dsm-clinical-content.json"],
  calculators: ["src/components/calculators/calculator-fixtures.ts"],
} as const;

function provider(id: keyof typeof expectedProviders) {
  const match = repositorySourceProviders.find((candidate) => candidate.id === id);
  expect(match, `missing ${id} provider`).toBeDefined();
  return match!;
}

function specifierSourceFamilies() {
  const content = loadSpecifiersContent();
  const families = new Set<string>();
  for (const specifier of content.universalSpecifiers) {
    if (specifier.review.sourceFamily) families.add(specifier.review.sourceFamily);
  }
  for (const category of content.categories) {
    for (const disorder of category.disorders) {
      for (const group of disorder.groups) {
        for (const item of group.items) {
          if (item.review.sourceFamily) families.add(item.review.sourceFamily);
        }
      }
    }
  }
  return families;
}

describe("repository source providers", () => {
  it("registers the complete production-owner inventory exactly once", () => {
    expect(Object.fromEntries(repositorySourceProviders.map((entry) => [entry.id, entry.sourcePaths]))).toEqual(
      expectedProviders,
    );
    expect(new Set(repositorySourceProviders.map((entry) => entry.id)).size).toBe(repositorySourceProviders.length);
    expect(new Set(repositorySourceProviders.flatMap((entry) => entry.sourcePaths)).size).toBe(
      repositorySourceProviders.flatMap((entry) => entry.sourcePaths).length,
    );
  });

  it("pins the 49 currently governed structured source hosts without deriving trust at runtime", () => {
    const emittedHosts = new Set(
      repositorySourceReferences()
        .map((reference) => reference.canonicalUrl)
        .filter((value): value is string => Boolean(value))
        .map((value) => new URL(value).hostname),
    );

    expect(GOVERNED_SOURCE_HOSTS).toHaveLength(49);
    expect(new Set(GOVERNED_SOURCE_HOSTS)).toEqual(emittedHosts);
  });

  it("returns valid references with traceable application usages from every provider", () => {
    for (const entry of repositorySourceProviders) {
      const references = entry.references();
      expect(references.length, `${entry.id} returned no references`).toBeGreaterThan(0);
      expect(
        references.every(
          (reference) =>
            Boolean(reference.usage.modeId) &&
            Boolean(reference.usage.recordId) &&
            Boolean(reference.usage.recordLabel) &&
            Boolean(reference.usage.field),
        ),
        `${entry.id} returned an untraceable usage`,
      ).toBe(true);
    }
    expect(repositorySourceReferences().every((reference) => reference.usage.recordId && reference.usage.field)).toBe(
      true,
    );
  });

  it("captures every current structured owner record automatically", () => {
    const dictionaryReferences = provider("dictionary").references();
    expect(new Set(dictionaryReferences.map((reference) => reference.sourceId))).toEqual(
      new Set(dictionarySources.map((source) => source.id)),
    );

    const factsheetReferences = provider("factsheets").references();
    expect(factsheetReferences).toHaveLength(factsheets.reduce((total, sheet) => total + sheet.sources.length, 0));
    for (const sheet of factsheets) {
      expect(factsheetReferences.filter((reference) => reference.usage.recordId === sheet.slug)).toHaveLength(
        sheet.sources.length,
      );
    }

    const formulationReferences = provider("formulation").references();
    expect(new Set(formulationReferences.map((reference) => reference.sourceId))).toEqual(
      new Set(Object.keys(formulationSourceLibrary)),
    );
    for (const mechanism of formulationMechanisms) {
      expect(
        new Set(
          formulationReferences
            .filter((reference) => reference.usage.recordId === mechanism.id)
            .map((reference) => reference.sourceId),
        ),
      ).toEqual(new Set(mechanism.sources));
    }

    const specifierReferences = provider("specifiers").references();
    expect(specifierReferences.filter((reference) => reference.canonicalUrl)).toHaveLength(
      authoritativeSources().length,
    );
    expect(
      new Set(
        specifierReferences.filter((reference) => reference.referenceText).map((reference) => reference.referenceText),
      ),
    ).toEqual(specifierSourceFamilies());

    const formsReferences = provider("forms").references();
    expect(new Set(formsReferences.map((reference) => reference.sourceId))).toEqual(
      new Set(formsSnapshot.sourceDocuments.map((document) => document.id)),
    );
    for (const form of formsSnapshot.forms) {
      expect(formsReferences).toContainEqual(
        expect.objectContaining({
          sourceId: form.sourceDocumentId,
          usage: {
            modeId: "forms",
            recordId: form.id,
            recordLabel: form.name,
            field: "sourceDocumentId",
          },
        }),
      );
    }

    const medicationReferences = provider("medications").references();
    const medicationSourceRows = loadMedicationSnapshot().flatMap((medication) =>
      medication.sections.flatMap((section) =>
        section.rows.filter((row) => section.title === "Sources" || row.key === "Source Review"),
      ),
    );
    expect(medicationReferences).toHaveLength(medicationSourceRows.length);

    const serviceReferences = provider("services").references();
    const services = loadServicesSnapshot().services;
    expect(serviceReferences.filter((reference) => reference.canonicalUrl)).toHaveLength(
      services.reduce((total, service) => total + service.public_source_urls.length, 0),
    );
    expect(serviceReferences.filter((reference) => reference.referenceText)).toHaveLength(
      services.reduce((total, service) => total + service.source_documents.length, 0),
    );

    const dsmReferences = provider("dsm").references();
    expect(dsmReferences).toHaveLength(dsmClinicalContent.diagnoses.length);
    expect(new Set(dsmReferences.map((reference) => reference.datasetLocation))).toEqual(
      new Set([dsmClinicalContent.source_repository]),
    );

    expect(provider("calculators").references()).toHaveLength(calculators.length);
  });

  it("keeps specifier authoritative-source usage IDs stable across insertion and reordering", () => {
    const existingSources = [
      { label: "Source A", url: "https://example.test/source-a" },
      { label: "Source B", url: "https://example.test/source-b" },
    ];
    const changedSources = [
      { label: "Inserted source", url: "https://example.test/inserted" },
      existingSources[1],
      existingSources[0],
    ];
    const before = new Map(
      specifierAuthoritativeSourceReferences(existingSources).map((reference) => [
        reference.canonicalUrl,
        reference.usage.recordId,
      ]),
    );
    const after = new Map(
      specifierAuthoritativeSourceReferences(changedSources).map((reference) => [
        reference.canonicalUrl,
        reference.usage.recordId,
      ]),
    );

    expect(after.get(existingSources[0].url)).toBe(before.get(existingSources[0].url));
    expect(after.get(existingSources[1].url)).toBe(before.get(existingSources[1].url));
    expect([...before.values()].every((recordId) => !/^authoritative-source-\d+$/.test(recordId))).toBe(true);
  });

  it("reports formulation library entries with no mechanism usage", () => {
    expect(
      repositorySourceCoverageIssues({
        formulationMechanisms: [],
        formulationSourceLibrary: {
          "orphan-source": {
            id: "orphan-source",
            title: "Orphan source fixture",
            url: "https://example.test/orphan-source",
          },
        },
      }),
    ).toContain("Formulation source orphan-source has no mechanism usage");
  });

  it("keeps every provider reference valid at the reusable offline-check seam", () => {
    for (const entry of repositorySourceProviders) {
      expect(repositorySourceReferenceIssues(entry.id, entry.references())).toEqual([]);
    }
  });

  it("rejects HTTPS source URLs with embedded credentials consistently with catalogue canonicalisation", () => {
    const credentialUrl = (() => {
      const url = new URL("https://example.test/source");
      url.username = "fixture-user";
      url.password = "fixture-pass-not-a-real-secret";
      return url.toString();
    })();
    const credentialReference = {
      ...provider("dictionary").references()[0],
      canonicalUrl: credentialUrl,
    };

    const issues = repositorySourceReferenceIssues("credential-fixture", [credentialReference]);
    expect(issues).toContain("Provider credential-fixture returned unsafe structured URL");
    expect(JSON.stringify(issues)).not.toContain("fixture-user");
    expect(JSON.stringify(issues)).not.toContain("fixture-pass-not-a-real-secret");
    expect(canonicalizeSourceReferences([credentialReference])[0].warnings).toContain("unsafe_location");
  });

  it("fails closed for unallowlisted hosts and credential-bearing query parameters without echoing values", () => {
    const baseReference = provider("dictionary").references()[0];
    const secret = "provider-query-secret";
    const references = [
      { ...baseReference, canonicalUrl: "https://unreviewed-source.example/guidance" },
      { ...baseReference, canonicalUrl: `https://www.ranzcp.org/guidance?X_AMZ_SIGNATURE=${secret}` },
    ];

    const issues = repositorySourceReferenceIssues("url-policy-fixture", references);

    expect(issues).toEqual([
      "Provider url-policy-fixture returned unsafe structured URL",
      "Provider url-policy-fixture returned unsafe structured URL",
    ]);
    expect(JSON.stringify(issues)).not.toContain("unreviewed-source");
    expect(JSON.stringify(issues)).not.toContain(secret);
  });

  it("accepts only the two current benign provider query forms", () => {
    const baseReference = provider("dictionary").references()[0];
    const allowed = [
      { ...baseReference, canonicalUrl: "https://www.health.gov.au/resource?language=en" },
      { ...baseReference, canonicalUrl: "https://www.legislation.wa.gov.au/act?OpenElement" },
    ];
    const rejected = [
      { ...baseReference, canonicalUrl: "https://www.ranzcp.org/guidance?view=summary" },
      { ...baseReference, canonicalUrl: "https://www.health.gov.au/resource?language=en&view=summary" },
    ];

    expect(repositorySourceReferenceIssues("allowed-query-fixture", allowed)).toEqual([]);
    expect(repositorySourceReferenceIssues("rejected-query-fixture", rejected)).toEqual([
      "Provider rejected-query-fixture returned unsafe structured URL",
      "Provider rejected-query-fixture returned unsafe structured URL",
    ]);
  });

  it("reports malformed structured dates without echoing their raw values", () => {
    const malformedDate = "not-a-date-provider-secret";
    const invalidReference = {
      ...provider("dictionary").references()[0],
      publicationDate: malformedDate,
    };

    const issues = repositorySourceReferenceIssues("date-policy-fixture", [invalidReference]);

    expect(issues).toContain("Provider date-policy-fixture returned an invalid structured date");
    expect(JSON.stringify(issues)).not.toContain(malformedDate);
  });

  it("keeps therapy citation prose as one provisional D-band source per explicit item", () => {
    const references = provider("therapies").references();
    const explicitSourceCount = therapies.reduce((total, therapy) => total + therapy.sources.length, 0);
    expect(references).toHaveLength(explicitSourceCount);
    expect(references.every((reference) => reference.publisher === null && reference.sourceId === null)).toBe(true);
    expect(references.every((reference) => reference.validationStatus === "unverified")).toBe(true);
    expect(canonicalizeSourceReferences(references).every((entry) => entry.rating.band === "D")).toBe(true);
  });
});
