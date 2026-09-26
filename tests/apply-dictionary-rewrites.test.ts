import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { dictionaryEntries } from "@/lib/dictionary-data";
import {
  isDefinitionReviewApplied,
  reconcileDefinitionReviews,
  type DictionaryDefinitionReview,
} from "@/lib/dictionary-editorial/definition-reviews";

import {
  DEFINITION_REVIEWS_PATH,
  DICTIONARY_DATA_PATH,
  planDictionaryRewrites,
  runApplyDictionaryRewrites,
} from "../scripts/apply-dictionary-rewrites";
import { collectionOf, recordContentSha256, recordPinState } from "../scripts/lib/clinical-record-review-contract.mjs";

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const SOURCE = `const topicSeeds = [
  {
    slug: "alpha",
    title: "Alpha",
    entries: [
      [
        "First term",
        "Old wording one.",
        "assessment",
      ],
      ["Second term", "Old wording two.", "assessment"],
    ],
  },
] as const satisfies readonly TopicSeed[];
`;

function review(overrides: Partial<DictionaryDefinitionReview> = {}): DictionaryDefinitionReview {
  const baselineWording = overrides.baselineWording ?? "Old wording one.";
  return {
    id: "ENTRY-001",
    entrySlug: "first-term",
    title: "First term",
    category: "Assessment",
    repositoryLocation: `${DICTIONARY_DATA_PATH} :: topicSeeds[slug="alpha"].entries[0]`,
    verdict: "Verified but wording should be improved",
    baselineWording,
    baselineWordingSha256: sha256(baselineWording),
    proposedWording: "New wording one.",
    disposition: "rewrite",
    rationale: "Clearer.",
    reviewGate: "clinical approval pending",
    legacyCitation: null,
    applyAutomatically: false,
    publicationAllowed: false,
    reviewer: null,
    provenance: {
      document: "reference/RESEARCH_MASTER.md",
      documentSha256: "0".repeat(64),
      anchor: "entry-001",
      lineStart: 1,
      lineEnd: 2,
      rawBlockSha256: "0".repeat(64),
    },
    ...overrides,
  };
}

/** Signs the review the way `npm run clinical:review` does: the pin is over its attested content. */
function approve(target: DictionaryDefinitionReview): DictionaryDefinitionReview {
  return {
    ...target,
    clinicalApproval: {
      status: "approved",
      reviewer: "Dr Test Reviewer",
      reviewedAt: "2026-09-20T01:02:03Z",
      reviewedContentSha256: recordContentSha256(target, "dictionary-rewrite"),
    },
  };
}

const doc = (...reviews: DictionaryDefinitionReview[]) => ({ reviews });

describe("planDictionaryRewrites", () => {
  it("fixture approvals carry a current pin", () => {
    const [view] = collectionOf("dictionary-rewrite", doc(approve(review())));
    expect(recordPinState(view, "dictionary-rewrite")).toBe("current");
  });

  it("applies an approved, current, actionable rewrite as exactly one literal replacement", () => {
    const plan = planDictionaryRewrites(doc(approve(review())), SOURCE);
    expect(plan.problems).toEqual([]);
    expect(plan.toApply.map((rewrite) => rewrite.reviewId)).toEqual(["ENTRY-001"]);
    expect(plan.nextSource).toBe(SOURCE.replace('"Old wording one."', '"New wording one."'));
  });

  it("refuses a review edited after sign-off (stale pin)", () => {
    const stale = { ...approve(review()), proposedWording: "Wording nobody signed." };
    const plan = planDictionaryRewrites(doc(stale), SOURCE);
    expect(plan.problems.join("\n")).toMatch(/pin is stale/);
    expect(plan.toApply).toEqual([]);
    expect(plan.nextSource).toBe(SOURCE);
  });

  it("refuses when the live wording no longer matches the baseline (conflict)", () => {
    const drifted = SOURCE.replace('"Old wording one."', '"Someone improved this since."');
    const plan = planDictionaryRewrites(doc(approve(review())), drifted);
    expect(plan.problems.join("\n")).toMatch(/reconcile says conflict/);
    expect(plan.nextSource).toBe(drifted);
  });

  it("refuses when the baseline literal occurs more than once in the file", () => {
    const duplicated = SOURCE.replace('"Old wording two."', '"Old wording one."');
    const plan = planDictionaryRewrites(doc(approve(review())), duplicated);
    expect(plan.problems.join("\n")).toMatch(/occurs 2 times/);
    expect(plan.nextSource).toBe(duplicated);
  });

  it("refuses when the literal is escaped differently from the recorded baseline", () => {
    const escaped = SOURCE.replace('"Old wording one."', '"Old wording \\u006fne."');
    const plan = planDictionaryRewrites(doc(approve(review())), escaped);
    expect(plan.problems.join("\n")).toMatch(/escaped or quoted differently/);
  });

  it("applies nothing when any one approved review is refused", () => {
    const good = approve(review());
    const stale = {
      ...approve(
        review({
          id: "ENTRY-002",
          entrySlug: "second-term",
          title: "Second term",
          baselineWording: "Old wording two.",
          repositoryLocation: `${DICTIONARY_DATA_PATH} :: topicSeeds[slug="alpha"].entries[1]`,
        }),
      ),
      rationale: "Edited after sign-off.",
    };
    const plan = planDictionaryRewrites(doc(good, stale), SOURCE);
    expect(plan.problems).toHaveLength(1);
    expect(plan.toApply).toEqual([]);
    expect(plan.nextSource).toBe(SOURCE);
  });

  it("ignores reviews without an approval, even conflicted ones", () => {
    const unapproved = review();
    const conflicted = review({ id: "ENTRY-009", baselineWording: "Some older wording." });
    const plan = planDictionaryRewrites(doc(unapproved, conflicted), SOURCE);
    expect(plan).toEqual({ toApply: [], alreadyApplied: [], problems: [], nextSource: SOURCE });
  });

  it("refuses a malformed approval rather than skipping it", () => {
    const malformed = {
      ...review(),
      clinicalApproval: { status: "approved" },
    } as unknown as DictionaryDefinitionReview;
    const plan = planDictionaryRewrites(doc(malformed), SOURCE);
    expect(plan.problems.join("\n")).toMatch(/reviewer must name the clinician/);
  });

  it("treats a live wording equal to the approved proposal as applied, and an unapproved one as a conflict", () => {
    const approved = approve(review());
    const live = [{ slug: "first-term", definition: "New wording one." }];
    expect(isDefinitionReviewApplied(approved, "New wording one.")).toBe(true);
    expect(reconcileDefinitionReviews([approved], live)[0].outcome).toBe("applied");
    expect(reconcileDefinitionReviews([review()], live)[0].outcome).toBe("conflict");
  });

  it("changes one line of the real dictionary source for one approved real review", () => {
    const realDocument = JSON.parse(readFileSync(DEFINITION_REVIEWS_PATH, "utf8")) as {
      reviews: DictionaryDefinitionReview[];
    };
    const realSource = readFileSync(DICTIONARY_DATA_PATH, "utf8");
    const index = realDocument.reviews.findIndex((candidate) => candidate.proposedWording !== null);
    const target = realDocument.reviews[index];
    const reviews = realDocument.reviews.map((candidate, at) => (at === index ? approve(candidate) : candidate));

    const plan = planDictionaryRewrites({ ...realDocument, reviews }, realSource, dictionaryEntries);
    expect(plan.problems).toEqual([]);
    expect(plan.toApply.map((rewrite) => rewrite.reviewId)).toEqual([target.id]);

    const before = realSource.split("\n");
    const after = plan.nextSource.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = before.flatMap((line, at) => (line === after[at] ? [] : [at]));
    expect(changed).toHaveLength(1);
    expect(after[changed[0]]).toBe(
      before[changed[0]].replace(JSON.stringify(target.baselineWording), JSON.stringify(target.proposedWording)),
    );
  });
});

describe("runApplyDictionaryRewrites (temp directory)", () => {
  let root: string | null = null;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  function fixtureRoot(reviews: DictionaryDefinitionReview[]): string {
    const directory = mkdtempSync(join(tmpdir(), "apply-dictionary-rewrites-"));
    for (const [relative, content] of [
      [DICTIONARY_DATA_PATH, SOURCE],
      [DEFINITION_REVIEWS_PATH, `${JSON.stringify(doc(...reviews), null, 2)}\n`],
      // Keep Prettier out of the fixture so the byte expectations are exact.
      [".prettierignore", `${DICTIONARY_DATA_PATH}\n`],
    ] as const) {
      mkdirSync(dirname(join(directory, relative)), { recursive: true });
      writeFileSync(join(directory, relative), content, "utf8");
    }
    return directory;
  }

  const quiet = () => undefined;

  it("writes nothing in report mode", async () => {
    root = fixtureRoot([approve(review())]);
    const reviewsBefore = readFileSync(join(root, DEFINITION_REVIEWS_PATH), "utf8");
    const result = await runApplyDictionaryRewrites({ root, write: false, log: quiet });
    expect(result).toMatchObject({ exitCode: 0, wrote: false });
    expect(result.plan.toApply).toHaveLength(1);
    expect(readFileSync(join(root, DICTIONARY_DATA_PATH), "utf8")).toBe(SOURCE);
    expect(readFileSync(join(root, DEFINITION_REVIEWS_PATH), "utf8")).toBe(reviewsBefore);
  });

  it("is idempotent: a second --write reports the rewrite as applied and changes nothing", async () => {
    root = fixtureRoot([approve(review())]);
    const reviewsBefore = readFileSync(join(root, DEFINITION_REVIEWS_PATH), "utf8");
    const expected = SOURCE.replace('"Old wording one."', '"New wording one."');

    const first = await runApplyDictionaryRewrites({ root, write: true, log: quiet });
    expect(first).toMatchObject({ exitCode: 0, wrote: true });
    expect(readFileSync(join(root, DICTIONARY_DATA_PATH), "utf8")).toBe(expected);

    const second = await runApplyDictionaryRewrites({ root, write: true, log: quiet });
    expect(second).toMatchObject({ exitCode: 0, wrote: false });
    expect(second.plan.alreadyApplied).toEqual([{ reviewId: "ENTRY-001", entrySlug: "first-term" }]);
    expect(readFileSync(join(root, DICTIONARY_DATA_PATH), "utf8")).toBe(expected);
    // The owner's approval, baseline and pin are untouched.
    expect(readFileSync(join(root, DEFINITION_REVIEWS_PATH), "utf8")).toBe(reviewsBefore);
  });

  it("exits non-zero and writes nothing when refusing", async () => {
    root = fixtureRoot([{ ...approve(review()), proposedWording: "Unsigned wording." }]);
    const lines: string[] = [];
    const result = await runApplyDictionaryRewrites({ root, write: true, log: (line) => lines.push(line) });
    expect(result).toMatchObject({ exitCode: 1, wrote: false });
    expect(lines.join("\n")).toMatch(/Refusing: nothing was changed/);
    expect(readFileSync(join(root, DICTIONARY_DATA_PATH), "utf8")).toBe(SOURCE);
  });
});
