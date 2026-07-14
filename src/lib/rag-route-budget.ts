import type { AnswerRouteMode } from "@/lib/rag-routing";

export const answerRouteBudgetMs = {
  unsupported: 0,
  extractive: 12_000,
  fast: 25_000,
  strong: 35_000,
} as const satisfies Record<AnswerRouteMode, number>;

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
  race<T>(promise: Promise<T>): Promise<T>;
  dispose(): void;
};

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
