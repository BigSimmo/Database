/**
 * Proves the coalesce poison race:
 * last waiter aborts the shared controller but leaves the map entry until
 * the producer's .finally deletes it; a new healthy caller joins the dying
 * promise and fails even though its own signal is not aborted.
 *
 * Mirrors src/lib/openai.ts awaitInflightEmbedding / embedTextWithTelemetry
 * and src/app/api/search/route.ts coalesceScopedSearch.
 */
import { setTimeout as delay } from "node:timers/promises";

function awaitWithCallerSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError"),
    );
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(
        signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError"),
      );
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
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
}

async function runBuggyPattern({ deleteOnLastWaiterAbort }) {
  const inflight = new Map();
  let producerStarts = 0;
  let sharedAbortCount = 0;

  async function awaitInflight(entry, signal) {
    entry.waiters += 1;
    try {
      return await awaitWithCallerSignal(entry.promise, signal);
    } finally {
      entry.waiters -= 1;
      if (entry.waiters === 0 && !entry.settled) {
        entry.controller.abort(new DOMException("No active waiters.", "AbortError"));
        sharedAbortCount += 1;
        if (deleteOnLastWaiterAbort && inflight.get("k") === entry) {
          inflight.delete("k");
        }
      }
    }
  }

  async function coalesce(signal) {
    signal.throwIfAborted();
    let entry = inflight.get("k");
    if (!entry) {
      const controller = new AbortController();
      producerStarts += 1;
      entry = {
        promise: Promise.resolve(null),
        controller,
        waiters: 0,
        settled: false,
      };
      entry.promise = delay(50, "ok", { signal: controller.signal }).finally(() => {
        entry.settled = true;
        if (inflight.get("k") === entry) inflight.delete("k");
      });
      inflight.set("k", entry);
    }
    return awaitInflight(entry, signal);
  }

  const firstController = new AbortController();
  const first = coalesce(firstController.signal);
  await delay(0);
  firstController.abort(new DOMException("first left", "AbortError"));
  await first.catch(() => {});

  // Map still holds the dying entry in the buggy pattern.
  const mapHasDyingEntry = inflight.has("k");
  const dyingAborted = inflight.get("k")?.controller.signal.aborted ?? false;

  const secondController = new AbortController();
  let secondError = null;
  let secondValue = null;
  try {
    secondValue = await coalesce(secondController.signal);
  } catch (error) {
    secondError = error;
  }

  return {
    deleteOnLastWaiterAbort,
    producerStarts,
    sharedAbortCount,
    mapHasDyingEntryAfterFirstAbort: mapHasDyingEntry,
    dyingAbortedAfterFirstAbort: dyingAborted,
    secondCallerSignalAborted: secondController.signal.aborted,
    secondValue,
    secondErrorName: secondError?.name ?? null,
    secondErrorMessage: secondError?.message ?? null,
    poisoned: Boolean(secondError) && !secondController.signal.aborted,
  };
}

const buggy = await runBuggyPattern({ deleteOnLastWaiterAbort: false });
const fixed = await runBuggyPattern({ deleteOnLastWaiterAbort: true });

console.log("=== coalesce poison race repro ===");
console.log("BUGGY (leave map entry after last-waiter abort):");
console.log(JSON.stringify(buggy, null, 2));
console.log("FIXED (delete map entry immediately on last-waiter abort):");
console.log(JSON.stringify(fixed, null, 2));

if (!buggy.poisoned) {
  console.error("EXPECTED buggy pattern to poison the healthy second caller.");
  process.exit(1);
}
if (fixed.poisoned || fixed.secondValue !== "ok" || fixed.producerStarts !== 2) {
  console.error("EXPECTED fixed pattern to start a fresh producer and succeed.");
  process.exit(1);
}
console.log("PROOF OK: buggy poisons healthy caller; immediate delete recovers.");
