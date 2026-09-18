/**
 * Keeps a registry search answering when the canonical catalogue read cannot.
 *
 * WHAT THIS EXISTS FOR, measured against production on 2026-09-16. `read_site_content_public_records`
 * was taking longer than the 2500 ms budget `universal-search` gives a registry domain, every single
 * time. The domain therefore aborted, produced an errored empty group, and Forms, Medications and
 * Services returned NOTHING on the live site:
 *
 *     {"kind":"medications","total":0,"items":[],"latencyMs":2501,"error":true}
 *     {"kind":"services",   "total":0,"items":[],"latencyMs":2502,"error":true}
 *     {"kind":"forms",      "total":0,"items":[],"latencyMs":2503,"error":true}
 *
 * The in-bundle seed catalogue was already being passed into that read and thrown away on failure,
 * even though it is exactly what those domains served before 2026-09-09 and is still what guests and
 * the demo corpus get. Returning it is strictly better than returning nothing.
 *
 * THIS IS A STOPGAP, NOT THE FIX. The defect is that the read is too slow; see the ledger row for the
 * `kind` filter that cannot reach the scan beneath the left join to `site_content_publications`. When
 * that lands this helper should stop reporting `degraded` on its own, which is the signal that it is
 * no longer load-bearing.
 *
 * WHY A COOLDOWN AND NOT JUST A TIMEOUT. A bare per-request budget makes every keystroke wait the
 * full budget before falling back, which is still slow search. After one failure the read is skipped
 * outright for `catalogueSeedFallbackCooldownMs`, so the first search pays the probe and the rest are
 * immediate. It re-probes after the cooldown, so the moment the database is fixed this heals itself
 * with no deploy.
 *
 * CLINICAL CAVEAT, and the reason `degraded` is returned rather than swallowed. Seeds can lag behind
 * anything published since the last release. That is acceptable for a search index whose entries all
 * link to a detail page that reads canonically, and it is bounded by the cooldown, but a caller must
 * be able to tell the reader that the list may be stale. Never drop `degraded` on the floor.
 */

import { logger } from "@/lib/logger";

/** How long one canonical read may take before the reader is served seeds instead. */
export const catalogueSeedFallbackBudgetMs = 1_200;

/**
 * The budget for a whole-catalogue LIST read, which is a different job from a search read.
 *
 * Search sits under a 2500 ms per-domain timeout, so 1200 ms is generous there. A list route has
 * no such ceiling and legitimately takes longer — the medication catalogue alone is megabytes — so
 * reusing the search budget would abandon healthy reads and pin those routes to seeds. A read that
 * takes longer than this is unhealthy by any reading, which is why it is still short enough to
 * matter to someone waiting for the page.
 */
export const catalogueListFallbackBudgetMs = 6_000;

/** How long to skip the canonical read entirely after it fails, before probing again. */
export const catalogueSeedFallbackCooldownMs = 30_000;

/**
 * Cooldown scopes. A cooldown says "a read under THIS budget failed recently", so it cannot be
 * shared across callers whose budgets differ by five seconds: a search giving up at 1200 ms is no
 * evidence that a list read allowed 6000 ms would also fail, and keying the cooldown on kind alone
 * meant one search timeout sent every list request straight to seeds without trying, silently
 * bypassing the longer budget the list routes were given.
 */
export const catalogueSearchScope = "search";
export const catalogueListScope = "list";

type Outcome<T> = {
  /** Mutable so the per-domain rankers can sort in place; the seed path is copied, never aliased. */
  records: T[];
  /** True when seeds were served because the canonical read failed, timed out, or is cooling down. */
  degraded: boolean;
};

const cooldownUntil = new Map<string, number>();

/** Cooldowns are per (scope, kind): see the scope constants for why kind alone was wrong. */
function cooldownKey(scope: string, kind: string) {
  return `${scope}::${kind}`;
}

/**
 * Exported so the Sentry Logs allowlist can be pinned against it. The forwarding bridge rewrites
 * any message it does not recognise to a bare "Application error", so a drift between this string
 * and `SENTRY_LOG_MESSAGES.CATALOGUE_SEED_FALLBACK` silently un-does the point of logging it.
 */
export const catalogueSeedFallbackLogMessage = "Canonical catalogue read failed; search is serving in-bundle seeds";

/**
 * Falling back MUST be loud. The 2026-09-16 outage lasted seven days because degradation was
 * silent: the endpoint answered HTTP 200 with an empty body and nothing was logged, so there was
 * no error rate to spike and no signal to alert on. A fallback that hides the failure it is
 * absorbing would reproduce exactly that, only with results on screen to make it less visible.
 *
 * The cooldown rate-limits this for free. A read is only attempted when no cooldown is open, so
 * every failure reaching here is a transition into degraded mode: at most one line per kind per
 * `cooldownMs`, paired with one recovery line when the next probe succeeds.
 *
 * Carries the catalogue kind and the failure shape only. There is no user query on this path at
 * all — the read fetches every record of a kind — and none is passed here.
 */
function reportFallback(kind: string, error: unknown, budgetMs: number, cooldownMs: number) {
  logger.error(catalogueSeedFallbackLogMessage, {
    catalogue_kind: kind,
    failure: error instanceof Error ? error.name : typeof error,
    detail: error instanceof Error ? error.message : undefined,
    budget_ms: budgetMs,
    cooldown_ms: cooldownMs,
  });
}

function reportRecovery(kind: string) {
  logger.info("Canonical catalogue read recovered; search is no longer degraded", {
    catalogue_kind: kind,
  });
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

/**
 * Read `kind` canonically, or serve `seeds` when that cannot be done inside the budget.
 *
 * A CALLER abort is never a fallback: it means the whole search is being discarded, so it
 * propagates untouched and does not open the cooldown. Only the internal budget and a genuine read
 * failure do that.
 */
export async function readCatalogueWithSeedFallback<T>(input: {
  kind: string;
  /** Which caller's budget this read runs under. Defaults to search, the tighter of the two. */
  scope?: string;
  seeds: readonly T[];
  signal?: AbortSignal;
  read: (signal: AbortSignal) => Promise<T[]>;
  now?: () => number;
  budgetMs?: number;
  cooldownMs?: number;
}): Promise<Outcome<T>> {
  const now = input.now ?? Date.now;
  const budgetMs = input.budgetMs ?? catalogueSeedFallbackBudgetMs;
  const cooldownMs = input.cooldownMs ?? catalogueSeedFallbackCooldownMs;
  const key = cooldownKey(input.scope ?? catalogueSearchScope, input.kind);

  input.signal?.throwIfAborted();

  const coolingUntil = cooldownUntil.get(key);
  // Reaching past this point with a cooldown recorded means it has just expired, so this read is
  // the re-probe — which is what makes a success below a recovery worth reporting rather than an
  // ordinary read.
  const probing = coolingUntil !== undefined;
  if (coolingUntil !== undefined) {
    if (coolingUntil > now()) return { records: [...input.seeds], degraded: true };
    cooldownUntil.delete(key);
  }

  const budget = new AbortController();
  const forwardCallerAbort = () => budget.abort(input.signal?.reason);
  if (input.signal?.aborted) forwardCallerAbort();
  else input.signal?.addEventListener("abort", forwardCallerAbort, { once: true });
  const timer = setTimeout(() => {
    budget.abort(new DOMException(`Canonical ${input.kind} read exceeded ${budgetMs}ms.`, "TimeoutError"));
  }, budgetMs);
  (timer as { unref?: () => void }).unref?.();

  // RACE, do not merely signal. Aborting `budget` only asks the read to stop; a read that ignores
  // the signal, or is wedged below the layer that honours it, would otherwise hold this await open
  // past the budget and hand the domain the same empty group this helper exists to prevent. The
  // budget has to be enforced here, by whoever is waiting, or it is not a budget.
  let rejectOnAbort: ((reason: Error) => void) | undefined;
  const abandoned = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = reject;
  });
  const onAbort = () => rejectOnAbort?.(abortReason(budget.signal));
  budget.signal.addEventListener("abort", onAbort, { once: true });
  if (budget.signal.aborted) onAbort();

  try {
    const records = await Promise.race([input.read(budget.signal), abandoned]);
    cooldownUntil.delete(key);
    if (probing) reportRecovery(input.kind);
    return { records, degraded: false };
  } catch (error) {
    // The caller gave up on the whole search; nothing here is a catalogue-health signal.
    if (input.signal?.aborted) throw abortReason(input.signal);
    cooldownUntil.set(key, now() + cooldownMs);
    reportFallback(input.kind, error, budgetMs, cooldownMs);
    return { records: [...input.seeds], degraded: true };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", forwardCallerAbort);
    budget.signal.removeEventListener("abort", onAbort);
  }
}

/**
 * What a reader is told when a list came from the in-bundle catalogue rather than the published
 * one. Plain, short, and honest about the only thing that matters clinically: the entries are real
 * but the list may not include the most recent publication. Kept here beside the mechanism so
 * every surface says the same words.
 */
export const catalogueDegradedNotice = "may be out of date";

/**
 * Append the notice to a results heading when, and only when, the group was served from seeds.
 * A helper rather than an inline ternary so the wording is asserted in one place and cannot drift
 * between the surfaces that show it.
 */
export function withCatalogueDegradedNotice(heading: string, degraded: boolean | undefined): string {
  return degraded ? `${heading} · ${catalogueDegradedNotice}` : heading;
}

/** Test seam, and the hook an operator-triggered "try the database again now" would use. */
export function clearCatalogueSeedFallbackCooldown() {
  cooldownUntil.clear();
}
