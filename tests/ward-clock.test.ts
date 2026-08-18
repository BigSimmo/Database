import { describe, expect, it } from "vitest";

import {
  clockState,
  formatElapsed,
  formatInstant,
  formatRemaining,
  minutesUntil,
} from "../src/components/ward-management/ward-clock";

const NOW = 10 * 60 + 42; // 10:42 on the synthetic day

describe("ward clock", () => {
  it("counts minutes forward and backward from now", () => {
    expect(minutesUntil(NOW + 93, NOW)).toBe(93);
    expect(minutesUntil(NOW - 42, NOW)).toBe(-42);
  });

  it("classifies a deadline by how much time is left", () => {
    expect(clockState(NOW - 1, NOW)).toBe("breached");
    expect(clockState(NOW + 30, NOW)).toBe("critical");
    expect(clockState(NOW + 120, NOW)).toBe("due");
    expect(clockState(NOW + 400, NOW)).toBe("clear");
  });

  it("formats a remaining duration for a coordinator, not a machine", () => {
    expect(formatRemaining(93)).toBe("1h 33m left");
    expect(formatRemaining(45)).toBe("45m left");
    expect(formatRemaining(-42)).toBe("42m overdue");
    expect(formatRemaining(-93)).toBe("1h 33m overdue");
  });

  it("formats an instant as a wall-clock time", () => {
    expect(formatInstant(NOW)).toBe("10:42");
    expect(formatInstant(9 * 60 + 5)).toBe("09:05");
  });

  it("formats an elapsed duration as a wait, never as a breach", () => {
    // A movement opened 95 minutes ago: minutesUntil(now, openedAt) = now - openedAt.
    expect(formatElapsed(minutesUntil(NOW, NOW - 95))).toBe("1h 35m waiting");
    expect(formatElapsed(45)).toBe("45m waiting");
    // formatRemaining would call this "overdue"; formatElapsed must not, and must not go
    // negative even if given a future instant by mistake.
    expect(formatElapsed(-10)).toBe("0m waiting");
  });
});
