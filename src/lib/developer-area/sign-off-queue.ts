import { loadFormCatalogDetails } from "@/lib/form-catalog";
import { formPageHref } from "@/lib/form-register";
import formulationContent from "@/data/formulation-content.json";
import { curatedDifferentials } from "@/lib/differential-curated";
import { curatedReviewFor } from "@/lib/differential-curated-review";
import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import { deriveGovernanceFromSnapshot } from "@/lib/differential-records";
import { dictionaryDefinitionReviews } from "@/lib/dictionary-editorial/definition-reviews";
import { dictionarySenseDrafts } from "@/lib/dictionary-editorial/sense-drafts";
import { specifierCatalogItems, loadSpecifiersContent } from "@/lib/specifiers-content";
import { therapyNeedsReview, therapyRecords } from "@/lib/therapies";
import { acquisitionReviewQueue } from "@/lib/sources/acquisition-ledger";
import { conceptReviewState, isFormulationSignedOffStatus } from "@/lib/formulation-review-status";
import { formulationConcepts, formulationGuides } from "@/lib/formulation-concepts";

/**
 * Every clinical record in this repository that is waiting for a person to sign
 * it off, read from the files that already hold it.
 *
 * **This module unifies nothing.** Seven families use five unrelated review
 * vocabularies — `drafted`, `clinical_review_required`, `unverified`,
 * `pending`, `clinician-review-pending`, `needs_review`, `candidate` — and each
 * word means something specific in the governance document that defined it.
 * Collapsing them into one shared status type would be a refactor through
 * clinical code, and worse, it would make seven different review decisions look
 * like one. So every family keeps its own vocabulary untouched: `nativeStatus`
 * carries the source's own word verbatim, and `statusLabel` is a display string
 * produced at this boundary and nowhere else.
 *
 * **It is read-only.** Nothing here publishes, approves or unhides a record.
 * The dictionary layer in particular must stay unpublished — `publicationAllowed`
 * and `clinicalApproval` are read and never written, and
 * `assertNoDraftIsPublished` remains the gate that enforces it.
 *
 * **Counts are derived, never written down.** A hand-maintained total is the one
 * thing on a queue page that can quietly go stale; `tests/sign-off-queue.test.ts`
 * pins the per-family counts so the page cannot silently report zero.
 */
export type SignOffFamilyId =
  "wa-mha-forms" | "formulation" | "differentials" | "dictionary" | "specifiers" | "therapy" | "sources";

export type SignOffRow = {
  family: SignOffFamilyId;
  /**
   * Unique across the whole queue, and the only value safe to use as a React
   * key. The record ids are not: three differential presentation workflows
   * (`substance-intoxication`, `substance-withdrawal`, `depression`) share an id
   * with a diagnosis record of the same name, so keying a list on `id` would
   * silently render three fewer rows than the count above it claims.
   */
  key: string;
  /** The record's own id or slug, as its source file writes it. */
  id: string;
  title: string;
  /** The source vocabulary's own word for this record's state. Never normalised. */
  nativeStatus: string;
  /** A display label produced here, at the boundary, for this one row. */
  statusLabel: string;
  /** What a person has to do for this record to count as signed off. */
  requires: string;
  /** An in-app route that renders the record, or null when none exists. */
  href: string | null;
};

export type SignOffFamily = {
  id: SignOffFamilyId;
  name: string;
  /** The file(s) the rows were read from, so a reader can go and open them. */
  source: string;
  /** The native field this family's status is read from, named exactly. */
  nativeField: string;
  /** What this family's own governance says about the state of these records. */
  note: string;
  /** True when no route in the app renders these records at all. */
  unrouted: boolean;
  rows: readonly SignOffRow[];
};

export type SignOffQueue = {
  families: readonly SignOffFamily[];
  /** Sum of every family's rows. Derived, so it cannot disagree with the list. */
  total: number;
};

function formsFamily(): SignOffFamily {
  const rows = loadFormCatalogDetails()
    .filter((details) => details.contentReviewStatus !== "reviewed")
    .map<SignOffRow>((details) => ({
      family: "wa-mha-forms",
      key: `form:${details.id}`,
      id: details.id,
      title: `Form ${details.form} — ${details.name}`,
      // `contentReviewStatus` is optional on the catalogue type: a form absent
      // from the review register carries none. `form-catalog.ts` states the
      // default explicitly — a missing row is a gap in the record, not evidence
      // of review — so it falls to `drafted` here, which is also why the filter
      // above keeps such a form in the queue rather than dropping it.
      nativeStatus: details.contentReviewStatus ?? "drafted",
      statusLabel: "Drafted, no clinician sign-off",
      requires:
        "A named reviewer checks the operational guidance against the Act and the current approved form, then records status, reviewedBy and reviewedAt.",
      // `formPageHref`, never `/forms/${details.id}`. The catalogue id is
      // `form-<code>` unconditionally; the ROUTE slug is that only for the 50
      // forms without a legacy slug. Building the path from the id shipped four
      // dead links to statutory forms — 3A, 4A, 4B and 4C — each landing on
      // "not in your registry" instead of the Mental Health Act guidance.
      href: formPageHref(details.form),
    }));
  return {
    id: "wa-mha-forms",
    name: "WA Mental Health Act forms",
    source: "data/forms-content-review.json",
    nativeField: "formContentReviewStatus(entry) — status + reviewedBy + reviewedAt",
    note: "Operational guidance drafted from the Act text and the approved form. Status alone is not a sign-off: all three fields have to be present, so a partial attestation falls back to drafted.",
    unrouted: false,
    rows,
  };
}

type FormulationMechanism = { id: string; name: string; reviewStatus: string };

/**
 * Formulation keeps its records in two files with two status fields: the 12
 * mechanisms carry `reviewStatus` in `formulation-content.json`, and the 46
 * contextual concepts and 6 guide modules carry `review.status` (plus a reviewer
 * slot) in `formulation-concepts.json`. Reading only the first file hid 52 of
 * the 64 unsigned records (ledger #33JDBW). Concepts and guides are filtered by
 * `conceptReviewState`, the same fail-closed decision their pages render, so the
 * queue and the badge cannot disagree about one record.
 */
function formulationFamily(): SignOffFamily {
  const mechanisms = (formulationContent as { mechanisms: FormulationMechanism[] }).mechanisms;
  const mechanismRows = mechanisms
    .filter((mechanism) => !isFormulationSignedOffStatus(mechanism.reviewStatus))
    .map<SignOffRow>((mechanism) => ({
      family: "formulation",
      key: `formulation:${mechanism.id}`,
      id: mechanism.id,
      title: mechanism.name,
      nativeStatus: mechanism.reviewStatus,
      statusLabel: "Clinical review required",
      requires:
        "A clinician confirms the mechanism description, its fit indicators and its treatment implications against the cited sources.",
      href: `/formulation/${mechanism.id}`,
    }));
  const recordRows = [
    ...formulationConcepts.map((record) => ({ record, kind: "concept" as const })),
    ...formulationGuides.map((record) => ({ record, kind: "guide" as const })),
  ]
    .filter(({ record }) => !conceptReviewState(record).reviewed)
    .map<SignOffRow>(({ record, kind }) => ({
      family: "formulation",
      key: `formulation-${kind}:${record.id}`,
      id: record.id,
      title: record.title,
      nativeStatus: record.review.status,
      statusLabel: "Clinical review required",
      requires:
        kind === "guide"
          ? "A named clinician checks the guide module's instructions against the cited sources and records themselves as reviewer."
          : "A named clinician checks the concept's summary, qualifications and warnings against the cited sources and records themselves as reviewer.",
      // A held record 404s at /formulation/<id>, so it is listed unlinked.
      href: record.release === "published" ? `/formulation/${record.id}` : null,
    }));
  return {
    id: "formulation",
    name: "Formulation mechanisms, concepts and guides",
    source: "src/data/formulation-content.json, src/data/formulation-concepts.json",
    nativeField: "reviewStatus (mechanisms); review.status + review.reviewer (concepts and guide modules)",
    note: "Source metadata was reviewed; the clinical claims themselves are ungraded and carry no named confirmation. A concept or guide counts as signed off only with a named reviewer.",
    unrouted: false,
    rows: [...mechanismRows, ...recordRows],
  };
}

function differentialsFamily(): SignOffFamily {
  const snapshot = loadDifferentialSnapshot();
  const governance = deriveGovernanceFromSnapshot(snapshot);
  const authored = new Set(Object.keys(curatedDifferentials));

  const diagnoses = snapshot.diagnoses.map<SignOffRow>((record) => ({
    family: "differentials",
    key: `differential-diagnosis:${record.slug}`,
    id: record.slug,
    title: record.title,
    nativeStatus: `validation_status: ${governance.validation_status} (source_status: ${governance.source_status})`,
    statusLabel: !authored.has(record.slug)
      ? "Unverified"
      : curatedReviewFor(record.slug)
        ? "Unverified export; locally authored overlay signed off"
        : "Unverified, with locally authored content",
    requires: authored.has(record.slug)
      ? "A clinician verifies the exported record and, separately, the locally authored overlay in src/lib/differential-curated.ts that is shown on top of it."
      : "A clinician verifies the exported record against a named source before its validation_status can move off unverified.",
    href: `/differentials/diagnoses/${record.slug}`,
  }));

  const presentations = snapshot.presentations.map<SignOffRow>((workflow) => ({
    family: "differentials",
    key: `differential-presentation:${workflow.id}`,
    id: workflow.id,
    title: workflow.title,
    nativeStatus: `validation_status: ${governance.validation_status} (source_status: ${governance.source_status})`,
    statusLabel: "Unverified",
    requires:
      "A clinician verifies the presentation workflow's candidates and review checklist against a named source.",
    href: `/differentials/presentations/${workflow.id}`,
  }));

  return {
    id: "differentials",
    name: "Differentials",
    source: "data/differentials-snapshot.json, src/lib/differential-curated.ts",
    nativeField: "validation_status, via deriveGovernanceFromSnapshot",
    note: `The snapshot's own governance block reads "${snapshot.governance.reviewStatus}" (${snapshot.governance.version}), which derives unverified for every record in it. ${authored.size} of the diagnosis records also carry a locally authored overlay, which is a separate review.`,
    unrouted: false,
    rows: [...diagnoses, ...presentations],
  };
}

function dictionaryFamily(): SignOffFamily {
  const senses = dictionarySenseDrafts.map<SignOffRow>((draft) => ({
    family: "dictionary",
    key: `dictionary-sense:${draft.id}`,
    id: draft.id,
    // The corpus writes most expansions as "TOKEN — meaning" already, so
    // prefixing the token unconditionally produced "4AT — 4AT — rapid delirium
    // assessment". Prefixed only when the expansion does not already carry it.
    title: draft.expansion.startsWith(draft.token) ? draft.expansion : `${draft.token} — ${draft.expansion}`,
    nativeStatus: `clinicalApproval.status: ${draft.clinicalApproval.status} (reviewState: ${draft.reviewState}, priority ${draft.editorialPriority})`,
    statusLabel: "Pending — unpublished draft",
    requires:
      "A named reviewer signs the sense off record by record; promotion into the published dictionary is a clinical decision, not a data migration.",
    href: null,
  }));

  const reviews = dictionaryDefinitionReviews.map<SignOffRow>((review) => ({
    family: "dictionary",
    key: `dictionary-definition:${review.id}`,
    id: review.id,
    title: `${review.title} — ${review.verdict}`,
    // These records carry no `clinicalApproval` field of their own; the
    // equivalent state is the pair the module's own contract pins, so both are
    // reported rather than one being dressed up as the other.
    nativeStatus: `publicationAllowed: ${review.publicationAllowed}, reviewer: ${review.reviewer === null ? "null" : "set"}`,
    statusLabel: review.proposedWording ? "Proposed rewrite, unapplied" : "Verdict recorded, no rewrite proposed",
    requires: review.proposedWording
      ? "A clinician signs off the proposed wording after it is reconciled against the live definition by hash; nothing here applies automatically."
      : `A clinician confirms the verdict and the recorded disposition: ${review.disposition}`,
    href: `/dictionary/${review.entrySlug}`,
  }));

  return {
    id: "dictionary",
    name: "Dictionary editorial layer",
    source: "src/data/dictionary-sense-drafts.json, src/data/dictionary-definition-reviews.json",
    nativeField: "clinicalApproval.status (senses), publicationAllowed + reviewer (definition reviews)",
    // The reason this family is on the page at all: before this panel its only
    // importer was a contract test, so nothing in the running app ever showed
    // these records to the person who has to sign them off.
    note: "The sense drafts have no route, no component and no link anywhere else in the app — this list is the only place they are readable. They stay unpublished: every draft keeps publicationAllowed false and clinicalApproval pending, and assertNoDraftIsPublished is the gate that holds it.",
    unrouted: true,
    rows: [...senses, ...reviews],
  };
}

function specifiersFamily(): SignOffFamily {
  const content = loadSpecifiersContent();
  const items = specifierCatalogItems()
    .filter((item) => item.review.clinicianReviewStatus !== "clinician-reviewed")
    .map<SignOffRow>((item) => ({
      family: "specifiers",
      key: `specifier:${item.slug}`,
      id: item.slug,
      title: `${item.disorderName} · ${item.groupLabel} · ${item.label}`,
      nativeStatus: `${item.review.clinicianReviewStatus} (source: ${item.review.sourceVerificationStatus})`,
      statusLabel: "Clinician review pending",
      requires:
        "A clinician confirms the specifier against current DSM-5-TR / ICD-11 materials; the auto-generated definition is withheld until then.",
      href: `/specifiers/${item.slug}`,
    }));
  // The universal specifiers sit outside the per-disorder catalogue and carry
  // the same `clinician-review-pending` state on the same field. The family note
  // already told the reader they were pending, so omitting them made this page
  // describe records it did not list — the one failure mode a sign-off queue
  // cannot have. They are deliberately unlinked: `publicSpecifierRecords()` is
  // built from curated records plus `specifierCatalogItems()`, and a universal is
  // in neither, so `/specifiers/<slug>` would not resolve for one.
  const universals = content.universalSpecifiers
    .filter((specifier) => specifier.review.clinicianReviewStatus !== "clinician-reviewed")
    .map<SignOffRow>((specifier) => ({
      family: "specifiers",
      key: `specifier-universal:${specifier.review.rowKey}`,
      id: specifier.review.rowKey,
      title: `Universal · ${specifier.title}`,
      nativeStatus: `${specifier.review.clinicianReviewStatus} (source: ${specifier.review.sourceVerificationStatus})`,
      statusLabel: "Clinician review pending",
      requires:
        "A clinician confirms the specifier against current DSM-5-TR / ICD-11 materials; it applies across disorders, so a wrong reading here carries further than a single catalogue entry.",
      href: null,
    }));
  return {
    id: "specifiers",
    name: "Specifiers",
    source: "data/specifiers-content.json",
    nativeField: "review.clinicianReviewStatus",
    note: `The export's own stats record ${content.stats.itemsPendingClinicianReview} specifier items pending clinician review, and a further ${content.universalSpecifiers.length} universal specifiers carry the same pending status outside the per-disorder catalogue. Both are listed here; the universals are the rows with no link, because no route renders one. Specifiers is an aide-memoire reference surface, not automated clinical decision support.`,
    unrouted: true,
    rows: [...items, ...universals],
  };
}

function therapyFamily(): SignOffFamily {
  const rows = therapyRecords.filter(therapyNeedsReview).map<SignOffRow>((record) => ({
    family: "therapy",
    key: `therapy:${record.slug}`,
    id: record.slug,
    title: record.name,
    nativeStatus: record.reviewStatus,
    statusLabel: "Needs review",
    requires:
      "A qualified clinician signs the record off; until then every Therapy Compass surface shows the awaiting-review badge rather than hiding the record.",
    href: `/therapy-compass/${record.slug}`,
  }));
  return {
    id: "therapy",
    name: "Therapy Compass records",
    // Read from the index projection rather than therapies-source.json: it is
    // generated from that file by scripts/build-therapies-index.mjs, carries the
    // identical slug and reviewStatus for all 205 records, and is the module the
    // rest of the server already resolves therapies through — importing the
    // ~2.5 MB source here would put it in the server graph for no added fact.
    source: "src/data/therapies-index.json, generated from src/data/therapies-source.json",
    nativeField: "reviewStatus",
    note: "Reachability is deliberately not gated on review status: a record awaiting sign-off is disclosed as such rather than hidden.",
    unrouted: false,
    rows,
  };
}

function sourcesFamily(): SignOffFamily {
  // Reuses acquisitionReviewQueue rather than re-deriving the filter: that
  // function already encodes which records count as awaiting sign-off (not
  // rejected, still unverified) and the worst-rung-first order the source
  // acquisition protocol reads them in.
  const rows = acquisitionReviewQueue().map<SignOffRow>((record) => ({
    family: "sources",
    key: `source-acquisition:${record.id}`,
    id: record.id,
    title: record.title,
    nativeStatus: `${record.disposition} / validationStatus: ${record.validationStatus} (rung ${record.rung})`,
    statusLabel: "Captured, not yet verified",
    requires:
      "The owner verifies the source against the acquisition protocol before any clinical content may cite it; an adopted source with validationStatus unverified is already a ledger error.",
    href: null,
  }));
  return {
    id: "sources",
    name: "Source acquisitions",
    source: "src/data/source-acquisitions.json",
    nativeField: "disposition + validationStatus, via acquisitionReviewQueue()",
    note: "Worst rung first, the order the source acquisition protocol reads them in. Rejected records are excluded by that queue, not by this page.",
    unrouted: true,
    rows,
  };
}

export function loadSignOffQueue(): SignOffQueue {
  const families: readonly SignOffFamily[] = [
    formsFamily(),
    formulationFamily(),
    differentialsFamily(),
    dictionaryFamily(),
    specifiersFamily(),
    therapyFamily(),
    sourcesFamily(),
  ];
  return {
    families,
    total: families.reduce((sum, family) => sum + family.rows.length, 0),
  };
}
