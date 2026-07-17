// Process-local counters for the in-flight answer coalescer.
//
// These measurements intentionally contain no request key, owner, query, or
// document data. They show whether this process is absorbing duplicate answer
// work, which is otherwise invisible when considering replica changes.

let originations = 0;
let coalescedWaiters = 0;
let activeOriginations = 0;

export type AnswerCoalescingMetricsSnapshot = {
  originations: number;
  coalescedWaiters: number;
  activeOriginations: number;
  // 0..1; 0 when no coalescible request has completed or joined yet.
  coalescingRate: number;
};

export function recordAnswerOrigination(): void {
  originations += 1;
  activeOriginations += 1;
}

export function recordAnswerOriginationFinished(): void {
  // A defensive floor means an unexpected cleanup path cannot emit a negative
  // gauge, which would be misleading to the operator polling this endpoint.
  activeOriginations = Math.max(0, activeOriginations - 1);
}

export function recordCoalescedAnswerWaiter(): void {
  coalescedWaiters += 1;
}

export function answerCoalescingMetricsSnapshot(): AnswerCoalescingMetricsSnapshot {
  const totalRequests = originations + coalescedWaiters;
  return {
    originations,
    coalescedWaiters,
    activeOriginations,
    coalescingRate: totalRequests > 0 ? coalescedWaiters / totalRequests : 0,
  };
}

/** Test-only: reset process-local counters between cases. */
export function resetAnswerCoalescingMetrics(): void {
  originations = 0;
  coalescedWaiters = 0;
  activeOriginations = 0;
}
