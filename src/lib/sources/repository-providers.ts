import "server-only";

import { createHash } from "node:crypto";

import formsSnapshot from "../../../data/forms-page-snapshot.json";
import dsmClinicalContent from "../../data/dsm-clinical-content.json";
import therapiesSource from "../../data/therapies-source.json";
import { calculators } from "../../components/calculators/calculator-fixtures";
import { factsheets } from "../../components/factsheets/factsheets-data";
import {
  dictionaryComparisonPairs,
  dictionaryEntries,
  dictionarySources,
  type DictionarySourceRef,
} from "@/lib/dictionary-data";
import {
  formulationMechanisms,
  formulationSourceLibrary,
  type FormulationMechanism,
  type FormulationSource,
} from "@/lib/formulation";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import { mhaActMetadata } from "@/lib/mha-act-sections";
import { loadServicesSnapshot } from "@/lib/service-catalog";
import { authoritativeSources, loadSpecifiersContent, type AuthoritativeSource } from "@/lib/specifiers-content";
import { safeHttpsUrl } from "@/lib/sources/catalogue-core";
import type { ClinicalSourceReferenceInput, ClinicalSourceType, SourceUsage } from "@/lib/sources/catalogue-types";
import { hasInvalidStructuredSourceDate, strictSourceDate } from "@/lib/sources/source-date-policy";

export type ClinicalSourceProvider = {
  id:
    | "dictionary"
    | "factsheets"
    | "formulation"
    | "therapies"
    | "specifiers"
    | "forms"
    | "mha"
    | "medications"
    | "services"
    | "dsm"
    | "calculators";
  sourcePaths: readonly string[];
  references(): ClinicalSourceReferenceInput[];
};

function reference(
  usage: SourceUsage,
  overrides: Partial<ClinicalSourceReferenceInput> = {},
): ClinicalSourceReferenceInput {
  return {
    sourceId: null,
    documentId: null,
    title: null,
    aliases: [],
    publisher: null,
    publisherCode: null,
    canonicalUrl: null,
    datasetLocation: null,
    version: null,
    publicationDate: null,
    reviewDate: null,
    expiryDate: null,
    jurisdiction: null,
    evidenceType: "unknown",
    documentStatus: "unknown",
    validationStatus: "unknown",
    contentMode: "metadata_only",
    lifecycleStatus: "active",
    supersedes: [],
    supersededBy: [],
    topics: [],
    usage,
    referenceText: null,
    ...overrides,
  };
}

const dictionarySourceById = new Map<string, (typeof dictionarySources)[number]>(
  dictionarySources.map((source) => [source.id, source]),
);

function dictionaryReference(sourceRef: DictionarySourceRef, usage: SourceUsage, topics: string[]) {
  const source = dictionarySourceById.get(sourceRef.sourceId);
  if (!source) return null;
  return reference(usage, {
    sourceId: source.id,
    title: source.title,
    publisher: source.organisation,
    canonicalUrl: source.url,
    reviewDate: source.accessedOn,
    jurisdiction: source.region,
    validationStatus: "unverified",
    contentMode: "link_only",
    topics,
  });
}

const dictionaryProvider: ClinicalSourceProvider = {
  id: "dictionary",
  sourcePaths: ["src/lib/dictionary-data.ts"],
  references() {
    const references: ClinicalSourceReferenceInput[] = [];
    for (const entry of dictionaryEntries) {
      for (const sourceRef of entry.sourceRefs) {
        for (const field of sourceRef.supports) {
          const projected = dictionaryReference(
            sourceRef,
            { modeId: "dictionary", recordId: entry.slug, recordLabel: entry.term, field },
            [entry.topicSlug],
          );
          if (projected) references.push(projected);
        }
      }
      for (const distinction of entry.distinctions) {
        for (const sourceRef of distinction.sourceRefs) {
          const projected = dictionaryReference(
            sourceRef,
            {
              modeId: "dictionary",
              recordId: entry.slug,
              recordLabel: entry.term,
              field: `distinctions.${distinction.slug}`,
            },
            [entry.topicSlug],
          );
          if (projected) references.push(projected);
        }
      }
    }
    for (const comparison of dictionaryComparisonPairs) {
      for (const sourceRef of comparison.sourceRefs) {
        const projected = dictionaryReference(
          sourceRef,
          {
            modeId: "dictionary",
            recordId: comparison.slugs.join("--"),
            recordLabel: comparison.slugs.join(" / "),
            field: "comparison",
          },
          ["comparison"],
        );
        if (projected) references.push(projected);
      }
    }
    return references;
  },
};

function factsheetEvidenceType(tag: string): ClinicalSourceType {
  if (tag === "Consumer") return "consumer_reference";
  if (tag === "Reference") return "professional_reference";
  return "unknown";
}

const factsheetProvider: ClinicalSourceProvider = {
  id: "factsheets",
  sourcePaths: ["src/components/factsheets/factsheets-data.ts"],
  references: () =>
    factsheets.flatMap((sheet) =>
      sheet.sources.map((source) =>
        reference(
          { modeId: "factsheets", recordId: sheet.slug, recordLabel: sheet.title, field: "sources" },
          {
            title: source.title,
            publisher: source.org,
            canonicalUrl: source.url ?? null,
            publicationDate: null,
            evidenceType: factsheetEvidenceType(source.tag),
            contentMode: source.url ? "link_only" : "metadata_only",
            topics: [sheet.category],
          },
        ),
      ),
    ),
};

const formulationProvider: ClinicalSourceProvider = {
  id: "formulation",
  sourcePaths: ["src/data/formulation-content.json"],
  references: () =>
    formulationMechanisms.flatMap((mechanism) =>
      mechanism.sources.flatMap((sourceId) => {
        const source = formulationSourceLibrary[sourceId];
        if (!source) return [];
        return [
          reference(
            {
              modeId: "formulation",
              recordId: mechanism.id,
              recordLabel: mechanism.name,
              field: "sources",
            },
            {
              sourceId: source.id,
              title: source.title,
              canonicalUrl: source.url,
              contentMode: "link_only",
              topics: [...mechanism.domains],
            },
          ),
        ];
      }),
    ),
};

type TherapySourceRecord = {
  slug: string;
  name: string;
  reviewStatus: string;
  reviewChecklist?: { sourceChecked?: boolean };
  sources: Array<{ title: string; sourceType: string; reference: string }>;
};

const therapyProvider: ClinicalSourceProvider = {
  id: "therapies",
  sourcePaths: ["src/data/therapies-source.json"],
  references: () =>
    (therapiesSource as TherapySourceRecord[]).flatMap((therapy) =>
      therapy.sources.map((source) =>
        reference(
          { modeId: "therapy-compass", recordId: therapy.slug, recordLabel: therapy.name, field: "sources" },
          {
            title: source.title,
            evidenceType: "uploaded_document",
            validationStatus:
              therapy.reviewStatus === "needs_review" || therapy.reviewChecklist?.sourceChecked === false
                ? "unverified"
                : "unknown",
            referenceText: source.reference,
          },
        ),
      ),
    ),
};

function specifierReviewReferences() {
  const content = loadSpecifiersContent();
  const references: ClinicalSourceReferenceInput[] = [];
  const add = (sourceFamily: string | undefined, usage: SourceUsage) => {
    if (!sourceFamily?.trim()) return;
    references.push(
      reference(usage, {
        title: sourceFamily,
        validationStatus: "unverified",
        referenceText: sourceFamily,
      }),
    );
  };
  for (const specifier of content.universalSpecifiers) {
    add(specifier.review.sourceFamily, {
      modeId: "specifiers",
      recordId: specifier.review.rowKey,
      recordLabel: specifier.title,
      field: "review.sourceFamily",
    });
  }
  for (const category of content.categories) {
    for (const disorder of category.disorders) {
      for (const group of disorder.groups) {
        for (const item of group.items) {
          add(item.review.sourceFamily, {
            modeId: "specifiers",
            recordId: item.review.rowKey,
            recordLabel: item.label,
            field: "review.sourceFamily",
          });
        }
      }
    }
  }
  return references;
}

export function specifierAuthoritativeSourceReferences(
  sources: readonly AuthoritativeSource[],
): ClinicalSourceReferenceInput[] {
  return sources.map((source) =>
    reference(
      {
        modeId: "specifiers",
        recordId: `authoritative-source-${createHash("sha256").update(source.url).digest("hex").slice(0, 16)}`,
        recordLabel: source.label,
        field: "authoritativeSources",
      },
      {
        title: source.label,
        canonicalUrl: source.url,
        contentMode: "link_only",
      },
    ),
  );
}

const specifierProvider: ClinicalSourceProvider = {
  id: "specifiers",
  sourcePaths: ["data/specifiers-content.json"],
  references: () => [...specifierAuthoritativeSourceReferences(authoritativeSources()), ...specifierReviewReferences()],
};

const formsProvider: ClinicalSourceProvider = {
  id: "forms",
  sourcePaths: ["data/forms-page-snapshot.json"],
  references: () =>
    formsSnapshot.sourceDocuments.flatMap((document) => {
      const referencingForms = formsSnapshot.forms.filter((form) => form.sourceDocumentId === document.id);
      const usages: SourceUsage[] = referencingForms.length
        ? referencingForms.map((form) => ({
            modeId: "forms",
            recordId: form.id,
            recordLabel: form.name,
            field: "sourceDocumentId",
          }))
        : [
            {
              modeId: "forms",
              recordId: document.id,
              recordLabel: document.title || document.fileName,
              field: "sourceDocuments",
            },
          ];
      return usages.map((usage) =>
        reference(usage, {
          sourceId: document.id,
          title: document.title || document.fileName,
          datasetLocation: `Forms source document (${document.kind})`,
          topics: [document.kind],
        }),
      );
    }),
};

const mhaProvider: ClinicalSourceProvider = {
  id: "mha",
  sourcePaths: ["data/mha-2014-sections.source.json"],
  references: () => [
    reference(
      {
        modeId: "forms",
        recordId: "mental-health-act-2014-wa",
        recordLabel: "Mental Health Act 2014 (WA)",
        field: "act",
      },
      {
        sourceId: "mental-health-act-2014-wa",
        title: "Mental Health Act 2014 (WA)",
        canonicalUrl: mhaActMetadata.sourceUrl,
        version: mhaActMetadata.actVersion,
        reviewDate: mhaActMetadata.actAsAt,
        jurisdiction: "Australia/WA",
        evidenceType: "legislation",
        contentMode: "link_only",
        topics: ["Mental Health Act", "legislation"],
      },
    ),
  ],
};

function medicationSourceRows() {
  return loadMedicationSnapshot().flatMap((medication) =>
    medication.sections.flatMap((section) =>
      section.rows
        .filter((row) => section.title === "Sources" || row.key === "Source Review")
        .map((row) => ({ medication, section, row })),
    ),
  );
}

const medicationProvider: ClinicalSourceProvider = {
  id: "medications",
  sourcePaths: ["data/medications-snapshot.json"],
  references: () =>
    medicationSourceRows().map(({ medication, section, row }) =>
      reference(
        {
          modeId: "prescribing",
          recordId: medication.slug,
          recordLabel: medication.name,
          field: `${section.title}.${row.key}`,
        },
        {
          title: `${medication.name}: ${row.key || section.title}`,
          validationStatus: "unverified",
          referenceText: row.val,
          topics: [medication.category, medication.class].filter(Boolean),
        },
      ),
    ),
};

const servicesProvider: ClinicalSourceProvider = {
  id: "services",
  sourcePaths: ["data/services-snapshot.json"],
  references: () =>
    loadServicesSnapshot().services.flatMap((service) => [
      ...service.public_source_urls.map((url) =>
        reference(
          { modeId: "services", recordId: service.id, recordLabel: service.name, field: "public_source_urls" },
          {
            title: service.name,
            canonicalUrl: url,
            contentMode: "link_only",
            topics: [...service.tags.setting_flags, ...service.tags.acuity_flags],
          },
        ),
      ),
      ...service.source_documents.map((sourceDocument) =>
        reference(
          { modeId: "services", recordId: service.id, recordLabel: service.name, field: "source_documents" },
          {
            title: sourceDocument,
            validationStatus: "unverified",
            referenceText: sourceDocument,
            topics: [...service.tags.setting_flags, ...service.tags.acuity_flags],
          },
        ),
      ),
    ]),
};

type DsmClinicalContent = {
  export_format_version: string;
  generated_at: string;
  source_repository: string;
  diagnoses: Array<{ record_id: string; title: string; category?: { label?: string } }>;
};

const dsmProvider: ClinicalSourceProvider = {
  id: "dsm",
  sourcePaths: ["src/data/dsm-clinical-content.json"],
  references: () => {
    const content = dsmClinicalContent as DsmClinicalContent;
    return content.diagnoses.map((diagnosis) =>
      reference(
        { modeId: "dsm", recordId: diagnosis.record_id, recordLabel: diagnosis.title, field: "source_repository" },
        {
          sourceId: content.source_repository,
          title: "DSM clinical content dataset",
          datasetLocation: content.source_repository,
          version: content.export_format_version,
          publicationDate: strictSourceDate(content.generated_at.slice(0, 10)),
          evidenceType: "dataset",
          topics: diagnosis.category?.label ? [diagnosis.category.label] : [],
        },
      ),
    );
  },
};

const calculatorProvider: ClinicalSourceProvider = {
  id: "calculators",
  sourcePaths: ["src/components/calculators/calculator-fixtures.ts"],
  references: () =>
    calculators.map((calculator) =>
      reference(
        { modeId: "calculators", recordId: calculator.id, recordLabel: calculator.name, field: "source" },
        {
          title: `${calculator.abbrev} source`,
          validationStatus: "unverified",
          referenceText: calculator.source,
          topics: [calculator.domain],
        },
      ),
    ),
};

export const repositorySourceProviders: readonly ClinicalSourceProvider[] = [
  dictionaryProvider,
  factsheetProvider,
  formulationProvider,
  therapyProvider,
  specifierProvider,
  formsProvider,
  mhaProvider,
  medicationProvider,
  servicesProvider,
  dsmProvider,
  calculatorProvider,
];

export function repositorySourceReferences() {
  return repositorySourceProviders.flatMap((provider) => provider.references());
}

export function repositorySourceReferenceIssues(
  providerId: string,
  references: readonly ClinicalSourceReferenceInput[],
): string[] {
  const issues: string[] = [];
  for (const sourceReference of references) {
    const usage = sourceReference.usage;
    if (!usage.modeId || !usage.recordId || !usage.recordLabel || !usage.field) {
      issues.push(`Provider ${providerId} returned a reference without a complete usage`);
    }
    if (sourceReference.canonicalUrl && !safeHttpsUrl(sourceReference.canonicalUrl)) {
      issues.push(`Provider ${providerId} returned unsafe structured URL`);
    }
    if (
      [sourceReference.publicationDate, sourceReference.reviewDate, sourceReference.expiryDate].some(
        hasInvalidStructuredSourceDate,
      )
    ) {
      issues.push(`Provider ${providerId} returned an invalid structured date`);
    }
  }
  return issues;
}

function coverageKey(reference: ClinicalSourceReferenceInput) {
  return [
    reference.sourceId,
    reference.canonicalUrl,
    reference.referenceText,
    reference.usage.recordId,
    reference.usage.field,
  ].join("\u0000");
}

type RepositorySourceCoverageInputs = {
  formulationMechanisms?: readonly Pick<FormulationMechanism, "id" | "name" | "sources">[];
  formulationSourceLibrary?: Readonly<Record<string, FormulationSource>>;
};

export function repositorySourceCoverageIssues(inputs: RepositorySourceCoverageInputs = {}): string[] {
  const issues: string[] = [];
  const references = repositorySourceReferences();
  const keys = new Set(references.map(coverageKey));
  const providerReferences = new Map(repositorySourceProviders.map((provider) => [provider.id, provider.references()]));
  const checkedFormulationMechanisms = inputs.formulationMechanisms ?? formulationMechanisms;
  const checkedFormulationSourceLibrary = inputs.formulationSourceLibrary ?? formulationSourceLibrary;

  const dictionaryIds = new Set<string>(dictionarySources.map((source) => source.id));
  const usedDictionaryIds = [
    ...dictionaryEntries.flatMap((entry) => [
      ...entry.sourceRefs.map((source) => source.sourceId),
      ...entry.distinctions.flatMap((distinction) => distinction.sourceRefs.map((source) => source.sourceId)),
    ]),
    ...dictionaryComparisonPairs.flatMap((comparison) => comparison.sourceRefs.map((source) => source.sourceId)),
  ];
  for (const sourceId of usedDictionaryIds) {
    if (!dictionaryIds.has(sourceId)) issues.push(`Dictionary usage references missing source ${sourceId}`);
  }
  const capturedDictionaryIds = new Set(providerReferences.get("dictionary")?.map((item) => item.sourceId));
  for (const source of dictionarySources) {
    if (!capturedDictionaryIds.has(source.id)) issues.push(`Dictionary source ${source.id} has no catalogue usage`);
  }

  for (const mechanism of checkedFormulationMechanisms) {
    for (const sourceId of mechanism.sources) {
      if (!checkedFormulationSourceLibrary[sourceId]) {
        issues.push(`Formulation mechanism ${mechanism.id} references missing source ${sourceId}`);
      }
      const expected = reference(
        { modeId: "formulation", recordId: mechanism.id, recordLabel: mechanism.name, field: "sources" },
        { sourceId, canonicalUrl: checkedFormulationSourceLibrary[sourceId]?.url ?? null },
      );
      if (!keys.has(coverageKey(expected)))
        issues.push(`Formulation source ${sourceId} is missing usage ${mechanism.id}`);
    }
  }
  const usedFormulationSources = new Set(checkedFormulationMechanisms.flatMap((mechanism) => mechanism.sources));
  for (const sourceId of Object.keys(checkedFormulationSourceLibrary)) {
    if (!usedFormulationSources.has(sourceId)) issues.push(`Formulation source ${sourceId} has no mechanism usage`);
  }

  for (const calculator of calculators) {
    const expected = reference(
      { modeId: "calculators", recordId: calculator.id, recordLabel: calculator.name, field: "source" },
      { referenceText: calculator.source },
    );
    if (!keys.has(coverageKey(expected))) issues.push(`Calculator ${calculator.id} source is not captured`);
  }

  for (const { medication, section, row } of medicationSourceRows()) {
    const expected = reference(
      {
        modeId: "prescribing",
        recordId: medication.slug,
        recordLabel: medication.name,
        field: `${section.title}.${row.key}`,
      },
      { referenceText: row.val },
    );
    if (!keys.has(coverageKey(expected))) issues.push(`Medication ${medication.slug} source row is not captured`);
  }

  for (const service of loadServicesSnapshot().services) {
    for (const url of service.public_source_urls) {
      const expected = reference(
        { modeId: "services", recordId: service.id, recordLabel: service.name, field: "public_source_urls" },
        { canonicalUrl: url },
      );
      if (!keys.has(coverageKey(expected))) issues.push(`Service ${service.id} URL ${url} is not captured`);
    }
    for (const sourceDocument of service.source_documents) {
      const expected = reference(
        { modeId: "services", recordId: service.id, recordLabel: service.name, field: "source_documents" },
        { referenceText: sourceDocument },
      );
      if (!keys.has(coverageKey(expected))) {
        issues.push(`Service ${service.id} source document ${sourceDocument} is not captured`);
      }
    }
  }

  const formIds = new Set(providerReferences.get("forms")?.map((item) => item.sourceId));
  for (const document of formsSnapshot.sourceDocuments) {
    if (!formIds.has(document.id)) issues.push(`Forms source document ${document.id} is not captured`);
  }
  const formReferences = providerReferences.get("forms") ?? [];
  for (const form of formsSnapshot.forms) {
    if (
      !formReferences.some(
        (item) =>
          item.sourceId === form.sourceDocumentId &&
          item.usage.recordId === form.id &&
          item.usage.recordLabel === form.name &&
          item.usage.field === "sourceDocumentId",
      )
    ) {
      issues.push(`Forms record ${form.id} source document usage is not captured`);
    }
  }

  const dsmReferences = providerReferences.get("dsm") ?? [];
  const dsmContent = dsmClinicalContent as DsmClinicalContent;
  for (const diagnosis of dsmContent.diagnoses) {
    if (
      !dsmReferences.some(
        (item) => item.datasetLocation === dsmContent.source_repository && item.usage.recordId === diagnosis.record_id,
      )
    ) {
      issues.push(`DSM source_repository is missing diagnosis usage ${diagnosis.record_id}`);
    }
  }

  return [...new Set(issues)].sort();
}
