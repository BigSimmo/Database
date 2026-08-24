import type { ClinicalAskEvidence, ClinicalAskRequest, SourceReviewState } from "@/lib/clinical-ask/contracts";
import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import { deriveGovernanceFromSnapshot } from "@/lib/differential-records";
import { searchDifferentialRecords, searchPresentationWorkflows } from "@/lib/differentials";
import { dsmDiagnosisSummary, rankDsmDiagnoses } from "@/lib/dsm";
import { searchFormulationMechanisms } from "@/lib/formulation";
import { searchFormRecords } from "@/lib/forms";
import { searchServiceRecords } from "@/lib/services";
import { searchSpecifiers } from "@/lib/specifiers";
import { specifierCatalogItems } from "@/lib/specifiers-content";
import { therapyRecordHref } from "@/lib/therapy-compass-navigation";
import { therapySourceMetadata } from "@/lib/therapy-source-governance";
import { searchTherapyRecords } from "@/lib/therapies";

const RESULT_LIMIT = 12;
const EXTRACT_LIMIT = 2_000;

function abortIfRequested(signal: AbortSignal) {
  if (!signal.aborted) return;
  const error = new Error("The catalogue request was aborted.");
  error.name = "AbortError";
  throw error;
}

function text(parts: Array<string | null | undefined>) {
  const extract = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return extract.slice(0, EXTRACT_LIMIT);
}

function evidence(
  request: ClinicalAskRequest,
  slug: string,
  fields: Pick<ClinicalAskEvidence, "title" | "publisher" | "href" | "extract" | "reviewState"> &
    Partial<Pick<ClinicalAskEvidence, "jurisdiction" | "publishedAt" | "updatedAt">>,
): ClinicalAskEvidence {
  return {
    id: `catalogue:${request.mode}:${slug}`,
    tier: "catalogue",
    jurisdiction: fields.jurisdiction ?? null,
    publishedAt: fields.publishedAt ?? null,
    updatedAt: fields.updatedAt ?? null,
    retrievedAt: null,
    ...fields,
  };
}

function serviceReviewState(status: string | null | undefined): SourceReviewState {
  if (!status) return "unknown";
  const normalized = status.toLowerCase();
  if (normalized.includes("verified") || normalized.includes("reviewed")) return "reviewed";
  if (normalized.includes("review") || normalized.includes("verify")) return "needs_review";
  return "unknown";
}

function serviceEvidence(request: ClinicalAskRequest) {
  const matches = searchServiceRecords(request.question, RESULT_LIMIT);
  const ranked = matches.length ? matches : searchServiceRecords("", RESULT_LIMIT);
  return ranked.map(({ service }) =>
    evidence(request, service.slug, {
      title: service.title,
      publisher: service.source?.label?.trim() || service.catalogueLabel?.trim() || "Services catalogue",
      jurisdiction: service.location?.trim() || null,
      href: `/services/${service.slug}`,
      extract: text([service.subtitle, service.bestUse, service.eligibility, service.referral, service.location]),
      reviewState: serviceReviewState(service.source?.status ?? service.source?.reviewed),
      publishedAt: service.source?.published ?? null,
      updatedAt: service.source?.reviewed ?? null,
    }),
  );
}

function formEvidence(request: ClinicalAskRequest) {
  const matches = searchFormRecords(request.question, RESULT_LIMIT);
  const ranked = matches.length ? matches : searchFormRecords("", RESULT_LIMIT);
  return ranked.map(({ service: form }) =>
    evidence(request, form.slug, {
      title: form.title,
      publisher: form.source?.label?.trim() || "Forms catalogue",
      jurisdiction: form.location?.trim() || null,
      href: `/forms/${form.slug}`,
      extract: text([form.subtitle, form.bestUse, form.eligibility, form.referral]),
      reviewState: serviceReviewState(form.source?.status ?? form.source?.reviewed),
      publishedAt: form.source?.published ?? null,
      updatedAt: form.source?.reviewed ?? null,
    }),
  );
}

function differentialEvidence(request: ClinicalAskRequest) {
  const snapshot = loadDifferentialSnapshot();
  const governance = deriveGovernanceFromSnapshot(snapshot);
  const reviewState: SourceReviewState =
    governance.validation_status === "locally_reviewed"
      ? governance.source_status === "review_due"
        ? "needs_review"
        : "reviewed"
      : "unknown";
  const diagnoses = searchDifferentialRecords(request.question);
  const presentations = searchPresentationWorkflows(request.question);
  const rankedDiagnoses = diagnoses.length ? diagnoses : searchDifferentialRecords("");
  const rankedPresentations = presentations.length ? presentations : searchPresentationWorkflows("");
  return [
    ...rankedDiagnoses.map((record) =>
      evidence(request, `diagnosis:${record.slug}`, {
        title: record.title,
        publisher: snapshot.governance.sourceTitle,
        href: `/differentials/diagnoses/${record.slug}`,
        extract: text([record.subtitle, record.clinicalHinge, record.safetySnapshot.summary]),
        reviewState,
        updatedAt: snapshot.exportedAt,
      }),
    ),
    ...rankedPresentations.map((workflow) =>
      evidence(request, `presentation:${workflow.id}`, {
        title: workflow.title,
        publisher: snapshot.governance.sourceTitle,
        href: `/differentials/presentations/${workflow.id}`,
        extract: text([workflow.subtitle, workflow.safetySnapshot.summary, workflow.highestUrgencyNote]),
        reviewState,
        updatedAt: workflow.sourceStatus.lastUpdated || snapshot.exportedAt,
      }),
    ),
  ].slice(0, RESULT_LIMIT);
}

function formulationEvidence(request: ClinicalAskRequest) {
  const matches = searchFormulationMechanisms(request.question);
  const ranked = matches.length ? matches : searchFormulationMechanisms("");
  return ranked.slice(0, RESULT_LIMIT).map(({ mechanism }) =>
    evidence(request, mechanism.id, {
      title: mechanism.name,
      publisher: "Formulation catalogue",
      href: `/formulation/${mechanism.id}`,
      extract: text([mechanism.summary, mechanism.coreProcess, mechanism.formulationUse, ...mechanism.caveats]),
      reviewState: mechanism.sourceStatus.toLowerCase().includes("pending") ? "needs_review" : "unknown",
    }),
  );
}

function dsmEvidence(request: ClinicalAskRequest) {
  const matches = rankDsmDiagnoses(request.question, RESULT_LIMIT);
  const ranked = matches.length ? matches : rankDsmDiagnoses("", RESULT_LIMIT);
  return ranked.map(({ diagnosis }) => {
    const summary = dsmDiagnosisSummary(diagnosis);
    return evidence(request, diagnosis.slug, {
      title: summary.title,
      publisher: "Authorised DSM clinical catalogue",
      href: `/dsm/diagnoses/${diagnosis.slug}`,
      extract: text([summary.category.label, summary.icd_code, summary.summary]),
      reviewState: "reviewed",
    });
  });
}

function specifierEvidence(request: ClinicalAskRequest) {
  const rankedLabels = new Map(searchSpecifiers(request.question).map(({ record }, index) => [record.name, index]));
  const items = specifierCatalogItems().filter((item) =>
    request.question.trim()
      ? `${item.label} ${item.disorderName}`.toLowerCase().includes(request.question.toLowerCase())
      : true,
  );
  const candidates = (items.length ? items : specifierCatalogItems())
    .map((item, index) => ({ item, rank: rankedLabels.get(item.label) ?? rankedLabels.size + index }))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, RESULT_LIMIT);
  return candidates.map(({ item }) =>
    evidence(request, item.slug, {
      title: item.label,
      publisher: item.definition?.sourceFamily || "Authorised specifier catalogue",
      href: `/specifiers/${item.slug}`,
      extract: text([item.disorderName, item.definition?.meaning, item.definition?.clinicalNote, item.icd11Context]),
      reviewState:
        item.review.sourceVerificationStatus.includes("needs") || item.review.clinicianReviewStatus.includes("pending")
          ? "needs_review"
          : "reviewed",
    }),
  );
}

function therapyEvidence(request: ClinicalAskRequest) {
  const matches = searchTherapyRecords(request.question);
  const ranked = matches.length ? matches : searchTherapyRecords("");
  return ranked.slice(0, RESULT_LIMIT).map(({ record }) => {
    const source = therapySourceMetadata(
      { title: record.name, sourceType: record.category, reference: record.clinicalSummary },
      record.reviewStatus,
    );
    return evidence(request, record.slug, {
      title: record.name,
      publisher: "Therapy Compass catalogue",
      href: therapyRecordHref(record.slug),
      extract: text([record.clinicalSummary, record.bestUsedFor, record.targetSymptoms, record.indications]),
      reviewState: source.clinical_validation_status === "locally_reviewed" ? "reviewed" : "needs_review",
    });
  });
}

export async function retrieveCatalogueEvidence(
  request: ClinicalAskRequest,
  signal: AbortSignal,
): Promise<ClinicalAskEvidence[]> {
  abortIfRequested(signal);
  let result: ClinicalAskEvidence[];
  switch (request.mode) {
    case "services":
      result = serviceEvidence(request);
      break;
    case "forms":
      result = formEvidence(request);
      break;
    case "differentials":
      result = differentialEvidence(request);
      break;
    case "formulation":
      result = formulationEvidence(request);
      break;
    case "dsm":
      result = dsmEvidence(request);
      break;
    case "specifiers":
      result = specifierEvidence(request);
      break;
    case "therapy-compass":
      result = therapyEvidence(request);
      break;
  }
  abortIfRequested(signal);
  return result;
}
