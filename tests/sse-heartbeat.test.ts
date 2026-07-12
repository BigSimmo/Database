import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { answerStreamHeartbeatIntervalMs, sseHeartbeatFrame, startSseHeartbeat } from "@/lib/sse-heartbeat";

describe("SSE heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits a complete ignorable SSE comment frame on each interval", () => {
    const frames: string[] = [];
    const stop = startSseHeartbeat((frame) => frames.push(frame));

    vi.advanceTimersByTime(answerStreamHeartbeatIntervalMs * 3);
    expect(frames).toEqual([sseHeartbeatFrame, sseHeartbeatFrame, sseHeartbeatFrame]);
    // Comment frames must parse as no-ops: leading ":" line, blank-line terminated.
    expect(sseHeartbeatFrame.startsWith(":")).toBe(true);
    expect(sseHeartbeatFrame.endsWith("\n\n")).toBe(true);

    stop();
    vi.advanceTimersByTime(answerStreamHeartbeatIntervalMs * 2);
    expect(frames).toHaveLength(3);
  });

  it("stops itself when the stream is closed and enqueue starts throwing", () => {
    let calls = 0;
    startSseHeartbeat(() => {
      calls += 1;
      throw new TypeError("Invalid state: Controller is already closed");
    });

    vi.advanceTimersByTime(answerStreamHeartbeatIntervalMs * 5);
    expect(calls).toBe(1);
  });
});
