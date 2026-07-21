import type { AnswerRouteMode } from "@/lib/rag/rag-routing";

export const answerRouteBudgetMs = {
  unsupported: 0,
  extractive: 12_000,
  fast: 25_000,
  strong: 35_000,
} as const satisfies Record<AnswerRouteMode, number>;

// A generation attempt must never spend the recovery path's share of the route budget.
// Fixed (not a fraction): recovery cost is O(1) — measured 26ms post-retrieval extractive
// (eval run #57 clozapine case) and ~100ms-1s for fallback + verification + logging
// cross-region — so 2s is ~2x the worst observed while costing only 8% of the fast budget.
export const generationRecoveryReserveMs = 2_000;
// A truncation self-heal retry needs at least this much wall time to be worth attempting:
// truncated attempts measure ~20s+ before hitting max_output_tokens, and the strong retry
// spends MORE reasoning under a boosted cap, so anything shorter is a guaranteed-discard.
export const minimumGenerationRetryMs = 5_000;

export class AnswerRouteDeadlineExceededError extends Error {
  readonly routeMode: AnswerRouteMode;
  readonly budgetMs: number;

  constructor(routeMode: AnswerRouteMode, budgetMs: number) {
    super(`RAG ${routeMode} route deadline exceeded after ${budgetMs}ms`);
    this.name = "AnswerRouteDeadlineExceededError";
    this.routeMode = routeMode;
    this.budgetMs = budgetMs;
  }
}

export type AnswerRouteDeadline = {
  budgetMs: number;
  signal: AbortSignal;
  readonly deadlineExceeded: boolean;
  remainingMs(): number;
  requestTimeoutMs(maximumMs: number): number;
  /** Like requestTimeoutMs, but holds back generationRecoveryReserveMs so the
   * source-backed recovery path always fits inside the route budget. */
  generationRequestTimeoutMs(maximumMs: number): number;
  race<T>(promise: Promise<T>): Promise<T>;
  dispose(): void;
};

/** True when enough budget remains for a generation retry to plausibly complete
 * AND still leave the recovery reserve. Zero-budget routes always return false. */
export function deadlineAllowsGenerationRetry(deadline: Pick<AnswerRouteDeadline, "remainingMs" | "budgetMs">) {
  if (deadline.budgetMs <= 0) return false;
  return deadline.remainingMs() >= generationRecoveryReserveMs + minimumGenerationRetryMs;
}

export function answerRouteResultCanBeCached(deadline: Pick<AnswerRouteDeadline, "deadlineExceeded">) {
  return !deadline.deadlineExceeded;
}

function abortReason(signal: AbortSignal) {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

export function createAnswerRouteDeadline(args: {
  routeMode: AnswerRouteMode;
  callerSignal?: AbortSignal;
  startedAt?: number;
  now?: () => number;
}): AnswerRouteDeadline {
  const now = args.now ?? Date.now;
  const budgetMs = answerRouteBudgetMs[args.routeMode];
  const controller = new AbortController();
  const deadlineAt = budgetMs > 0 ? (args.startedAt ?? now()) + budgetMs : null;
  let deadlineExceeded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const abortFromCaller = () => controller.abort(abortReason(args.callerSignal!));
  if (args.callerSignal?.aborted) abortFromCaller();
  else args.callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  if (deadlineAt !== null && !controller.signal.aborted) {
    timer = setTimeout(
      () => {
        deadlineExceeded = true;
        controller.abort(new AnswerRouteDeadlineExceededError(args.routeMode, budgetMs));
      },
      Math.max(1, deadlineAt - now()),
    );
    if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") timer.unref();
  }

  const remainingMs = () => (deadlineAt === null ? 0 : Math.max(0, deadlineAt - now()));
  const throwIfAborted = () => {
    if (controller.signal.aborted) throw abortReason(controller.signal);
    if (deadlineAt !== null && remainingMs() <= 0) {
      deadlineExceeded = true;
      const error = new AnswerRouteDeadlineExceededError(args.routeMode, budgetMs);
      controller.abort(error);
      throw error;
    }
  };

  return {
    budgetMs,
    signal: controller.signal,
    get deadlineExceeded() {
      return deadlineExceeded;
    },
    remainingMs,
    requestTimeoutMs(maximumMs) {
      throwIfAborted();
      return Math.max(1, Math.min(maximumMs, remainingMs()));
    },
    generationRequestTimeoutMs(maximumMs) {
      throwIfAborted();
      // Structurally identical to requestTimeoutMs (same 1ms degenerate floor, same
      // zero-budget behavior) minus the recovery reserve.
      return Math.max(1, Math.min(maximumMs, remainingMs() - generationRecoveryReserveMs));
    },
    race<T>(promise: Promise<T>) {
      try {
        throwIfAborted();
      } catch (error) {
        return Promise.reject(error);
      }

      return new Promise<T>((resolve, reject) => {
        const cleanup = () => controller.signal.removeEventListener("abort", onAbort);
        const onAbort = () => {
          cleanup();
          reject(abortReason(controller.signal));
        };
        controller.signal.addEventListener("abort", onAbort, { once: true });
        promise.then(
          (value) => {
            cleanup();
            resolve(value);
          },
          (error) => {
            cleanup();
            reject(error);
          },
        );
      });
    },
    dispose() {
      if (timer) clearTimeout(timer);
      args.callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

export function isAnswerRouteDeadlineExceeded(error: unknown) {
  return error instanceof AnswerRouteDeadlineExceededError;
}
