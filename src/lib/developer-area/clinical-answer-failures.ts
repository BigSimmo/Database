import { answerQualityEvalCases, ragEvalCases } from "@/lib/rag/rag-eval-cases";

import type { LedgerOpenItem, LedgerSnapshot } from "./ledger-snapshot";

export type NamedEvalCase = { id: string; question: string };

export type ClinicalAnswerFailure = {
  item: LedgerOpenItem;
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
 * problems that point at a named clinical question. It is *not* a complete
 * picture of clinical answer quality: an item that describes a bad answer
 * without naming a case is invisible here, and so is a case that is failing
 * right now but that nobody has written an item about. The panel that renders
 * this has to say so, because a surface that implies completeness it does not
 * have is worse on a clinical system than no surface at all.
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

/** The distinct clinical questions named across every open failure. */
export function affectedQuestionCount(failures: ClinicalAnswerFailure[]): number {
  return new Set(failures.flatMap((failure) => failure.cases.map((testCase) => testCase.id))).size;
}
