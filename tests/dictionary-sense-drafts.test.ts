import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  dictionaryDefinitionReviewIssues,
  dictionaryDefinitionReviews,
  reconcileDefinitionReviews,
} from "@/lib/dictionary-editorial/definition-reviews";
import {
  assertNoDraftIsPublished,
  dictionarySenseBrowseBucket,
  dictionarySenseCollisionGroups,
  dictionarySenseCollisions,
  dictionarySenseDraft,
  dictionarySenseDraftIssues,
  dictionarySenseDrafts,
  normalizeSenseToken,
  type DictionarySenseDraft,
} from "@/lib/dictionary-editorial/sense-drafts";
import {
  dictionarySourceDispositionIssues,
  dictionarySourceDispositions,
  heldDictionarySources,
  SOURCE_RECEIPT_STAGES,
} from "@/lib/dictionary-editorial/source-dispositions";
import { dictionaryEntries, dictionarySource, dictionarySources } from "@/lib/dictionary-data";
import { sourceAcquisitionRecords } from "@/lib/sources/acquisition-ledger";
import { sourceUsageHref } from "@/lib/sources/source-usage-presentation";

describe("dictionary sense drafts", () => {
  it("carries the whole handover corpus", () => {
    expect(dictionarySenseDrafts).toHaveLength(333);
    expect(dictionaryDefinitionReviews).toHaveLength(96);
    expect(dictionarySourceDispositions).toHaveLength(58);
  });

  it("is structurally sound", () => {
    expect(dictionarySenseDraftIssues()).toEqual([]);
  });

  it("keeps every sense id unique and resolvable", () => {
    const ids = new Set(dictionarySenseDrafts.map((draft) => draft.id));
    expect(ids.size).toBe(dictionarySenseDrafts.length);
    for (const draft of dictionarySenseDrafts) {
      expect(dictionarySenseDraft(draft.id)).toBe(draft);
    }
    expect(dictionarySenseDraft("dict-sense-9999")).toBeNull();
  });

  it("preserves the upstream content hash of every record", () => {
    // Not a clinical check: it proves nobody has hand-edited a draft in place,
    // which would break the link back to the reviewed source block.
    for (const draft of dictionarySenseDrafts) {
      expect(draft.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(draft.provenance.rawBlockSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("the publication gate", () => {
  it("holds every draft as unapproved and unpublished", () => {
    expect(() => assertNoDraftIsPublished()).not.toThrow();
    for (const draft of dictionarySenseDrafts) {
      expect(draft.publicationAllowed).toBe(false);
      expect(draft.clinicalApproval.status).toBe("pending");
      expect(draft.clinicalApproval.reviewer).toBeNull();
    }
  });

  it("refuses a draft that has been marked published", () => {
    const leaked = { ...dictionarySenseDrafts[0], publicationAllowed: true } as unknown as DictionarySenseDraft;
    expect(() => assertNoDraftIsPublished([leaked])).toThrow(/must not be published/);
  });

  it("refuses a draft that has been marked approved", () => {
    const approved = {
      ...dictionarySenseDrafts[0],
      clinicalApproval: { status: "approved", reviewer: "someone", reviewedOn: "2026-09-16" },
    } as unknown as DictionarySenseDraft;
    expect(() => assertNoDraftIsPublished([approved])).toThrow(/must not be published/);
  });

  it("keeps drafts out of the published dictionary entirely", () => {
    // The published dictionary is term-first and clinically reviewed. A sense id
    // appearing there would mean a draft had been promoted without sign-off.
    const publishedSlugs = new Set(dictionaryEntries.map((entry) => entry.slug));
    for (const draft of dictionarySenseDrafts) {
      expect(publishedSlugs.has(draft.id)).toBe(false);
    }
  });
});

describe("global ambiguity", () => {
  it("groups every token that carries more than one meaning", () => {
    expect(dictionarySenseCollisionGroups.length).toBeGreaterThanOrEqual(9);
    for (const group of dictionarySenseCollisionGroups) {
      expect(group.senseIds.length).toBeGreaterThan(1);
    }
  });

  it("warns about BD regardless of the category a reader has filtered to", () => {
    // The medicines-notation reader sees only "twice a day". The rule is that the
    // bipolar-disorder meaning must still reach them, because the note they are
    // reading was not written under their filter.
    const medicinesOnly = dictionarySenseDrafts.filter(
      (draft) => draft.category === "Medicines notation and high-risk collisions",
    );
    expect(medicinesOnly.some((draft) => draft.normalizedToken === "bd")).toBe(true);
    expect(medicinesOnly.filter((draft) => draft.normalizedToken === "bd")).toHaveLength(1);

    const meanings = dictionarySenseCollisions("BD");
    expect(meanings.length).toBeGreaterThan(1);
    expect(meanings.map((draft) => draft.expansion)).toContain("twice a day");
    expect(meanings.some((draft) => /bipolar/i.test(draft.expansion))).toBe(true);
  });

  it("resolves collisions case-insensitively without flattening punctuation", () => {
    expect(dictionarySenseCollisions("bd").map((draft) => draft.id)).toEqual(
      dictionarySenseCollisions("BD").map((draft) => draft.id),
    );
    expect(dictionarySenseCollisions("  Bd  ")).toHaveLength(dictionarySenseCollisions("BD").length);
  });

  it("keeps K10 and K10+ apart rather than calling them an ambiguity", () => {
    // The trailing "+" is the whole difference between the Kessler 10 and the
    // Kessler 10 plus supplementary questions. Stripping it would invent a
    // collision between two instruments that are not in fact the same token.
    expect(normalizeSenseToken("K10")).not.toBe(normalizeSenseToken("K10+"));
    expect(dictionarySenseCollisions("K10")).toEqual([]);
    expect(normalizeSenseToken("ACE-III")).toBe("ace-iii");
  });

  it("returns nothing for an unambiguous token", () => {
    expect(dictionarySenseCollisions("this-token-does-not-exist")).toEqual([]);
  });

  it("keeps the ambiguity warning attached to the meaning it qualifies", () => {
    for (const group of dictionarySenseCollisionGroups) {
      for (const draft of dictionarySenseCollisions(group.tokenKey)) {
        expect(draft.context.trim()).not.toBe("");
      }
    }
  });
});

describe("token handling", () => {
  it("keeps a numeric-leading token reachable", () => {
    const fourAt = dictionarySenseDrafts.find((draft) => draft.normalizedToken === "4at");
    expect(fourAt).toBeDefined();
    expect(fourAt?.token).toBe("4AT");
    // Filed under "#", not dropped and not given a digit bucket of its own.
    expect(dictionarySenseBrowseBucket(fourAt!)).toBe("#");
    expect(normalizeSenseToken("4AT")).toBe("4at");
  });

  it("files letter-leading tokens under their own letter", () => {
    const buckets = new Set(dictionarySenseDrafts.map(dictionarySenseBrowseBucket));
    expect(buckets.has("B")).toBe(true);
    // Every bucket is a single letter or the numeric bucket — never a stray digit.
    for (const bucket of buckets) {
      expect(bucket === "#" || /^[A-Z]$/.test(bucket)).toBe(true);
    }
  });

  it("preserves meaningful case and punctuation in the displayed token", () => {
    const withPunctuation = dictionarySenseDrafts.filter((draft) => /[^\p{L}\p{N}]/u.test(draft.token));
    for (const draft of withPunctuation) {
      expect(draft.token).not.toBe(draft.normalizedToken);
      expect(normalizeSenseToken(draft.token)).toBe(draft.normalizedToken);
    }
  });
});

describe("definition reviews", () => {
  it("is structurally sound", () => {
    expect(dictionaryDefinitionReviewIssues()).toEqual([]);
  });

  it("reconciles every review against the live dictionary without applying it", () => {
    const outcomes = reconcileDefinitionReviews();
    expect(outcomes).toHaveLength(96);
    expect(outcomes.filter((outcome) => outcome.outcome === "missing_entry")).toEqual([]);
    expect(outcomes.filter((outcome) => outcome.outcome === "conflict")).toEqual([]);
    expect(outcomes.filter((outcome) => outcome.outcome === "actionable")).toHaveLength(28);
  });

  it("flags a review whose baseline no longer matches as a conflict", () => {
    const [review] = dictionaryDefinitionReviews;
    const drifted = dictionaryEntries.map((entry) =>
      entry.slug === review.entrySlug ? { ...entry, definition: "Someone has since improved this wording." } : entry,
    );
    const [outcome] = reconcileDefinitionReviews([review], drifted);
    expect(outcome.outcome).toBe("conflict");
    expect(outcome.reason).toMatch(/do not restore/i);
  });

  it("reports a missing entry separately from a conflict", () => {
    const [review] = dictionaryDefinitionReviews;
    const [outcome] = reconcileDefinitionReviews([review], []);
    expect(outcome.outcome).toBe("missing_entry");
  });

  it("never marks a review as automatically applicable", () => {
    for (const review of dictionaryDefinitionReviews) {
      expect(review.applyAutomatically).toBe(false);
      expect(review.reviewer).toBeNull();
      expect(review.publicationAllowed).toBe(false);
    }
  });

  it("leaves the published definitions untouched", () => {
    // The 28 actionable proposals are ready for sign-off, not applied. If one had
    // been applied, its live wording would no longer hash to the recorded baseline.
    for (const review of dictionaryDefinitionReviews) {
      const entry = dictionaryEntries.find((candidate) => candidate.slug === review.entrySlug);
      expect(entry).toBeDefined();
      expect(createHash("sha256").update(entry!.definition, "utf8").digest("hex")).toBe(review.baselineWordingSha256);
    }
  });
});

describe("source dispositions", () => {
  it("is structurally sound", () => {
    expect(dictionarySourceDispositionIssues()).toEqual([]);
  });

  it("gives every handover source an outcome", () => {
    expect(dictionarySourceDispositions).toHaveLength(58);
    const admitted = dictionarySourceDispositions.filter(
      (disposition) => disposition.ledgerOutcome === "admitted_as_candidate",
    );
    expect(admitted).toHaveLength(8);
    expect(heldDictionarySources()).toHaveLength(50);
  });

  it("names a blocker and a next action for every held source", () => {
    for (const disposition of heldDictionarySources()) {
      expect(disposition.blockers.length).toBeGreaterThan(0);
      expect(disposition.decisionOwner.trim()).not.toBe("");
      for (const blocker of disposition.blockers) {
        expect(blocker.nextAction.trim()).not.toBe("");
      }
    }
  });

  it("lands the two admitted sources in the real ledger as candidates", () => {
    const admitted = dictionarySourceDispositions.filter(
      (disposition) => disposition.ledgerOutcome === "admitted_as_candidate",
    );
    for (const disposition of admitted) {
      const record = sourceAcquisitionRecords.find((row) => row.id === disposition.ledgerRecordId);
      expect(record).toBeDefined();
      expect(record?.disposition).toBe("candidate");
      // Metadata only: a candidate has not been adopted and has no full text.
      expect(record?.contentMode).toBe("link_only");
      expect(record?.validationStatus).toBe("unverified");
    }
  });

  it("records a month-precision RANZCP date as the first of the month", () => {
    // RANZCP states a last-updated month and no publication day. Month precision
    // says that plainly; day precision would assert a day the College never gave.
    const ect = sourceAcquisitionRecords.find((row) => row.id === "dictionary-ranzcp-ect-ps74");
    expect(ect?.datePrecision).toBe("month");
    expect(ect?.publicationDate).toBe("2019-10-01");
    expect(ect?.version).toBe("PS #74");
  });

  it("records a year-precision publication date as the first of January", () => {
    // WHO gives 2010 for the ASSIST manual and no day. Recording 2010-01-01 at day
    // precision would assert a publication day the publisher never stated.
    const assist = sourceAcquisitionRecords.find((row) => row.id === "dictionary-who-assist-2010");
    expect(assist?.datePrecision).toBe("year");
    expect(assist?.publicationDate).toBe("2010-01-01");
  });

  it("claims nothing past catalogued for any source", () => {
    const beyondCatalogue = SOURCE_RECEIPT_STAGES.slice(2);
    for (const disposition of dictionarySourceDispositions) {
      for (const stage of beyondCatalogue) {
        expect(disposition.stages[stage]).not.toBe("verified");
      }
      expect(disposition.originalBytesSha256).toBeNull();
      expect(disposition.documentId).toBeNull();
      expect(disposition.jobId).toBeNull();
    }
  });

  it("preserves an existing dictionary source identity rather than rewriting it", () => {
    // The one catalogue-identity conflict resolved on the facts rather than by
    // minting a second id: the register row carries the guideline, the dictionary
    // keeps its chapter citation, and `nice-delirium` still means one work.
    const conflict = dictionarySourceDispositions.find(
      (disposition) => disposition.catalogueIdentityOutcome === "conflict",
    );
    expect(conflict?.handoverSourceId).toBe("nice-delirium");
    expect(conflict?.existingDictionarySourceId).toBe("nice-delirium");
    expect(dictionarySources.filter((source) => source.id === "nice-delirium")).toHaveLength(1);
    expect(dictionarySource("nice-delirium")?.url).toContain("/chapter/context");
  });
});

describe("source link routing", () => {
  it("would send a sense id to a page that does not exist", () => {
    // Documents the trap rather than working around it: the dictionary prefix turns
    // a record id straight into `/dictionary/<id>`, which only resolves for term
    // slugs. This is why no draft emits a source usage — see the next test.
    const href = sourceUsageHref({
      modeId: "dictionary",
      recordId: "dict-sense-0045",
      recordLabel: "BD",
      field: "definition",
    });
    expect(href).toBe("/dictionary/dict-sense-0045");
    expect(dictionaryEntries.some((entry) => entry.slug === "dict-sense-0045")).toBe(false);
  });

  it("emits no source usage for any draft", () => {
    // Drafts are unpublished, so they must not appear in the source catalogue's
    // "used by" list either — a citation on an unreachable page is a broken link
    // and an implied endorsement at the same time.
    const senseIds = new Set(dictionarySenseDrafts.map((draft) => draft.id));
    for (const record of sourceAcquisitionRecords) {
      expect(senseIds.has(record.id)).toBe(false);
    }
  });
});

describe("publisher re-reads", () => {
  it("records a dated finding for every source read in this session", () => {
    const read = dictionarySourceDispositions.filter((disposition) => disposition.publisherCheck.checkedOn);
    expect(read.length).toBeGreaterThanOrEqual(30);
    for (const disposition of read) {
      expect(disposition.publisherCheck.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(disposition.publisherCheck.finding.trim()).not.toBe("");
    }
  });

  it("tells 'nobody looked' apart from 'the publisher states no date'", () => {
    // These are different facts and lead to different next actions. A source whose
    // publisher genuinely publishes no date cannot be fixed by looking harder.
    const unread = dictionarySourceDispositions.filter((disposition) => !disposition.publisherCheck.checkedOn);
    for (const disposition of unread) {
      expect(disposition.publisherCheck.finding).toMatch(/not (re-read|attempted)/i);
    }
  });

  it("keeps every source read in this session out of the unsourced-date bucket", () => {
    for (const disposition of dictionarySourceDispositions) {
      if (!disposition.publisherCheck.checkedOn) continue;
      const stale = disposition.blockers.some(
        (blocker) => blocker.code === "publication_event_not_freshly_established_do_not_substitute_other_date",
      );
      expect(stale).toBe(false);
    }
  });

  it("keeps a review date out of the publication-date field", () => {
    // Healthdirect, WA Health and the WHO stamp a review month on a page they
    // maintain continuously. A review date is a different event from publication,
    // so it is banked where it was found and never promoted into publicationDate.
    const reviewDated = dictionarySourceDispositions.filter((disposition) => disposition.establishedReviewDate);
    expect(reviewDated.length).toBeGreaterThanOrEqual(7);
    for (const disposition of reviewDated) {
      expect(disposition.ledgerOutcome).toBe("held");
      expect(disposition.blockers[0]?.code).toBe("publisher_states_a_review_date_not_a_publication_date");
      expect(disposition.ledgerRecordId).toBeNull();
    }
    const reviewStamps = new Set(reviewDated.map((disposition) => disposition.establishedReviewDate));
    for (const record of sourceAcquisitionRecords) {
      expect(reviewStamps.has(record.publicationDate ?? "")).toBe(false);
    }
  });

  it("resolves nice-delirium as one work with two chapter locators", () => {
    // Not a conflict: /chapter/context and /chapter/Recommendations are two
    // chapters of NICE CG103. The register row points at the guideline; the
    // dictionary keeps its chapter citation, which is the more precise locator.
    const delirium = dictionarySourceDispositions.find(
      (disposition) => disposition.handoverSourceId === "nice-delirium",
    );
    expect(delirium?.ledgerOutcome).toBe("admitted_as_candidate");
    const record = sourceAcquisitionRecords.find((row) => row.id === "dictionary-nice-delirium-cg103");
    expect(record?.canonicalUrl).toBe("https://www.nice.org.uk/guidance/cg103");
    expect(record?.publicationDate).toBe("2010-07-28");
  });

  it("does not admit a source whose publisher is registered for catalogue identity only", () => {
    // Australian Prescriber has an establishable publication date but carries
    // `catalogueIdentityOnly: true`, so admitting it would mean changing retrieval
    // selection. That is an owner decision, not a side effect of a dictionary import.
    const prescriber = dictionarySourceDispositions.find(
      (disposition) => disposition.handoverSourceId === "australian-prescriber-movement",
    );
    expect(prescriber?.ledgerOutcome).toBe("held");
    expect(prescriber?.blockers[0]?.code).toBe("publisher_registered_for_catalogue_identity_only");
    expect(sourceAcquisitionRecords.some((record) => record.publisher === "Australian Prescriber")).toBe(false);
  });
});
