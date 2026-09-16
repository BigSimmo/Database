import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSearchRequestDeadline,
  searchRequestTimeoutMs,
  searchSlowNoticeMs,
  searchTimedOutMessage,
} from "@/components/clinical-dashboard/search-utils";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSearchRequestDeadline", () => {
  it("leaves a fast request alone", () => {
    const onSlow = vi.fn();
    const deadline = createSearchRequestDeadline({ onSlow });

    vi.advanceTimersByTime(searchSlowNoticeMs - 1);
    expect(onSlow).not.toHaveBeenCalled();
    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.timedOut).toBe(false);

    deadline.cancel();
  });

  // The notice must not cancel anything: a merely slow search still returns useful results.
  it("announces a slow request without aborting it", () => {
    const onSlow = vi.fn();
    const deadline = createSearchRequestDeadline({ onSlow });

    vi.advanceTimersByTime(searchSlowNoticeMs);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.timedOut).toBe(false);

    deadline.cancel();
  });

  it("aborts and marks itself timed out at the deadline", () => {
    const deadline = createSearchRequestDeadline();

    vi.advanceTimersByTime(searchRequestTimeoutMs - 1);
    expect(deadline.signal.aborted).toBe(false);

    vi.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut).toBe(true);
    expect(deadline.signal.reason).toBeInstanceOf(DOMException);
    expect((deadline.signal.reason as DOMException).name).toBe("TimeoutError");

    deadline.cancel();
  });

  // This is the distinction the caller depends on: a caller abort stays silent, a timeout
  // surfaces as a visible failure.
  it("follows a caller abort without claiming it timed out", () => {
    const caller = new AbortController();
    const deadline = createSearchRequestDeadline({ signal: caller.signal });

    caller.abort();
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut).toBe(false);

    deadline.cancel();
  });

  it("is already aborted when the caller aborted before it was created", () => {
    const deadline = createSearchRequestDeadline({ signal: AbortSignal.abort() });

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut).toBe(false);

    deadline.cancel();
  });

  it("stops both timers on cancel, so a settled request cannot be aborted later", () => {
    const onSlow = vi.fn();
    const deadline = createSearchRequestDeadline({ onSlow });

    deadline.cancel();
    vi.advanceTimersByTime(searchRequestTimeoutMs * 2);

    expect(onSlow).not.toHaveBeenCalled();
    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.timedOut).toBe(false);
  });

  it("tolerates cancel being called more than once", () => {
    const deadline = createSearchRequestDeadline();
    deadline.cancel();
    expect(() => deadline.cancel()).not.toThrow();
  });

  it("does not announce a request the caller already abandoned", () => {
    const caller = new AbortController();
    const onSlow = vi.fn();
    createSearchRequestDeadline({ signal: caller.signal, onSlow });

    caller.abort();
    vi.advanceTimersByTime(searchSlowNoticeMs);

    expect(onSlow).not.toHaveBeenCalled();
  });

  it("honours caller-supplied thresholds", () => {
    const onSlow = vi.fn();
    const deadline = createSearchRequestDeadline({ onSlow, slowMs: 10, timeoutMs: 20 });

    vi.advanceTimersByTime(10);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(deadline.signal.aborted).toBe(false);

    vi.advanceTimersByTime(10);
    expect(deadline.timedOut).toBe(true);

    deadline.cancel();
  });
});

describe("searchTimedOutMessage", () => {
  it("names the search and says what happened in seconds, not milliseconds", () => {
    const message = searchTimedOutMessage("Document search");
    expect(message).toContain("Document search");
    expect(message).toContain(`${Math.round(searchRequestTimeoutMs / 1000)} seconds`);
    expect(message).not.toMatch(/\d{4,}/);
  });
});
