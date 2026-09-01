import { answerQualityEvalCases, ragEvalCases } from "@/lib/rag/rag-eval-cases";

import type { LedgerOpenItem, LedgerSnapshot } from "./ledger-snapshot";

export type NamedEvalCase = { id: string; question: string };

export type ClinicalAnswerFailure = {
  item: LedgerOpenItem;
  /**
   * The eval cases this item's text NAMES. A mention is a reference, not a
   * verdict on that case -- see `resolveClinicalAnswerFailures` for why the
   * difference is load-bearing, and never relabel this field as the cases the
   * item reports broken.
   */
  cases: NamedEvalCase[];
};

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

/**
 * Every eval case the repository names, keyed by id, with duplicates collapsed.
 *
 * Read-only. This module imports a protected RAG surface and must never write to
 * one: the case list is the repository's own record of which clinical questions
 * the answer engine is held to, and duplicating it here would create a second
 * source of truth that drifts silently.
 */
function allEvalCases(): NamedEvalCase[] {
  const byId = new Map<string, NamedEvalCase>();
  for (const testCase of [...ragEvalCases, ...answerQualityEvalCases]) {
    if (!byId.has(testCase.id)) byId.set(testCase.id, { id: testCase.id, question: testCase.question });
  }
  return [...byId.values()];
}

/**
 * Whether `haystack` names `id` as a whole token rather than as part of a longer
 * one.
 *
 * This is the difference between a correct panel and a quietly wrong one. Case
 * ids nest: `discharge-documentation` is a real case and is also a substring of
 * the real case `quality-discharge-documentation`. A plain `includes` therefore
 * reports the short case as failing whenever the long one is mentioned, and the
 * panel would show a clinical question that nothing said was broken. Requiring
 * the surrounding characters to fall outside the id alphabet removes that whole
 * class without needing to know which pairs happen to nest today.
 */
function namesCase(haystack: string, id: string): boolean {
  const isIdCharacter = (character: string | undefined) => character !== undefined && /[a-z0-9-]/.test(character);
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(id, from);
    if (at === -1) return false;
    if (!isIdCharacter(haystack[at - 1]) && !isIdCharacter(haystack[at + id.length])) return true;
    from = at + 1;
  }
}

/**
 * The open ledger items that name at least one of the repository's clinical eval
 * cases, newest concern first by priority.
 *
 * **What this is, and what it deliberately is not.** It is the set of recorded
 * problems whose text names a clinical question. It is *not* a complete picture
 * of clinical answer quality: an item that describes a bad answer without naming
 * a case is invisible here, and so is a case that is failing right now but that
 * nobody has written an item about.
 *
 * **A named case is a REFERENCE, not an assertion that the case is failing, and
 * the two cannot be told apart from the text.** Raised in review of PR #2498
 * against a real item: `#J8SJQ9` is about `quality-antipsychotic-metabolic-monitoring`,
 * and names `quality-discharge-documentation` only as the *contrast* -- the case
 * that "deliberately drops mustContainAny" because a source pointer is a
 * legitimate answer there. Reporting that as a failure states the opposite of
 * what the ledger says, about a clinical question.
 *
 * Two tempting fixes were rejected against the real data. Restricting the match
 * to the `source` field fixes `#J8SJQ9` and **hides both genuinely broken
 * questions in `#S4R2W3`**, which names them only in its detail prose; on this
 * panel a false negative is worse than a loose one. Guessing intent from the
 * surrounding words is the fragile heuristic this panel exists to avoid. So the
 * assertion is made at the level it is sound at -- the item -- and named cases
 * are presented as references. The panel's wording must match that, and a
 * curated per-case association would need the ledger to record one explicitly.
 *
 * The matching is derived rather than curated on purpose. A hand-kept list of
 * ledger ids would be exact on the day it was written and wrong a month later,
 * with nothing to catch the drift.
 */
export function resolveClinicalAnswerFailures(snapshot: LedgerSnapshot): ClinicalAnswerFailure[] {
  const cases = allEvalCases();

  return snapshot.open
    .map((item) => {
      const haystack = `${item.summary} ${item.detail} ${item.source}`;
      return { item, cases: cases.filter((testCase) => namesCase(haystack, testCase.id)) };
    })
    .filter((failure) => failure.cases.length > 0)
    .sort((a, b) => {
      const byPriority = (PRIORITY_ORDER[a.item.priority] ?? 99) - (PRIORITY_ORDER[b.item.priority] ?? 99);
      return byPriority !== 0 ? byPriority : a.item.id.localeCompare(b.item.id);
    });
}

/**
 * The distinct clinical questions REFERENCED across the open items. Named for
 * what it counts: these are questions the items mention, not questions proven to
 * be failing. It was called `affectedQuestionCount` until review of PR #2498
 * showed the panel was counting a contrast case as affected.
 */
export function referencedQuestionCount(failures: ClinicalAnswerFailure[]): number {
  return new Set(failures.flatMap((failure) => failure.cases.map((testCase) => testCase.id))).size;
}
