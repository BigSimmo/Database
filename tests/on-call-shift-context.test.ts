// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { clearOnCallDeviceState, onCallShiftPickStorageKey } from "@/lib/on-call/device-state-keys";
import {
  msUntilOnCallShiftContextChange,
  onCallClockPeriod,
  onCallShiftContext,
  readOnCallShiftPick,
  saveOnCallShiftPick,
} from "@/lib/on-call/shift-context";
import type { OnCallShift } from "@/lib/on-call/shifts/model";

// Perth is UTC+8 all year (no daylight saving), so UTC instants are exact here.
const at = (iso: string) => new Date(iso);
const shift = (id: string, startsAt: string, endsAt: string) =>
  ({ id, startsAt, endsAt, title: "Synthetic shift", location: "" }) as unknown as OnCallShift;
const NIGHT = shift("s-night", "2026-09-26T13:30:00.000Z", "2026-09-27T00:00:00.000Z"); // 21:30 to 08:00 Perth

beforeEach(() => window.localStorage.clear());

describe("onCallClockPeriod", () => {
  it.each([
    ["2026-09-26T01:00:00.000Z", "day"], // 09:00 Perth
    ["2026-09-26T10:00:00.000Z", "evening"], // 18:00
    ["2026-09-26T15:00:00.000Z", "night"], // 23:00
    ["2026-09-26T21:00:00.000Z", "night"], // 05:00
  ] as const)("%s is %s", (iso, period) => expect(onCallClockPeriod(at(iso))).toBe(period));
});

describe("onCallShiftContext", () => {
  it("uses the rostered shift that is on now, and says it has just started", () => {
    const context = onCallShiftContext({ shifts: [NIGHT], pick: null, now: at("2026-09-26T14:00:00.000Z") });
    expect(context).toMatchObject({ kind: "roster", shiftKey: "s-night", phase: "start", period: "night" });
  });

  it("moves to the end-of-shift list in the last hour", () => {
    expect(onCallShiftContext({ shifts: [NIGHT], pick: null, now: at("2026-09-26T23:30:00.000Z") }).phase).toBe("end");
    expect(onCallShiftContext({ shifts: [NIGHT], pick: null, now: at("2026-09-26T18:00:00.000Z") }).phase).toBe(
      "during",
    );
  });

  it("falls back to the one-tap pick, keyed to the date the night began", () => {
    const now = at("2026-09-26T18:00:00.000Z"); // 02:00 Perth on the 27th
    const context = onCallShiftContext({ shifts: [], pick: { period: "night", at: "2026-09-26T13:00:00.000Z" }, now });
    expect(context).toEqual({ kind: "picked", shiftKey: "picked:2026-09-26:night", period: "night", phase: "unknown" });
  });

  it("ignores a pick older than 16 hours", () => {
    const context = onCallShiftContext({
      shifts: [],
      pick: { period: "day", at: "2026-09-25T01:00:00.000Z" },
      now: at("2026-09-26T10:00:00.000Z"),
    });
    expect(context.kind).toBe("none");
  });

  it("gives a fresh key each clock period with no roster and no pick, so the order resets", () => {
    const evening = onCallShiftContext({ shifts: [], pick: null, now: at("2026-09-26T10:00:00.000Z") });
    const night = onCallShiftContext({ shifts: [], pick: null, now: at("2026-09-26T15:00:00.000Z") });
    expect(evening.shiftKey).not.toBe(night.shiftKey);
    expect(evening.kind).toBe("none");
    // A night read at 05:00 belongs to the night that began the evening before.
    const lateNight = onCallShiftContext({ shifts: [], pick: null, now: at("2026-09-26T21:00:00.000Z") });
    expect(lateNight.shiftKey).toBe(night.shiftKey);
  });
});

describe("the one-tap pick", () => {
  it("is forgotten after 16 hours", () => {
    saveOnCallShiftPick("evening", at("2026-09-26T09:00:00.000Z"));
    expect(readOnCallShiftPick(at("2026-09-26T10:00:00.000Z"))?.period).toBe("evening");
    expect(readOnCallShiftPick(at("2026-09-27T02:00:00.000Z"))).toBeNull();
  });

  it("stores a word and a time, nothing else", () => {
    saveOnCallShiftPick("day", at("2026-09-26T01:00:00.000Z"));
    expect(JSON.parse(window.localStorage.getItem(onCallShiftPickStorageKey) ?? "{}")).toEqual({
      period: "day",
      at: "2026-09-26T01:00:00.000Z",
    });
  });

  it("is cleared at sign-out", () => {
    saveOnCallShiftPick("night");
    clearOnCallDeviceState();
    expect(readOnCallShiftPick()).toBeNull();
  });
});

describe("msUntilOnCallShiftContextChange", () => {
  const MINUTE = 60_000;

  it("wakes at the next Perth clock boundary with no roster and no pick", () => {
    // 16:30 Perth: the evening begins at 17:00.
    expect(msUntilOnCallShiftContextChange({ shifts: [], pick: null, now: at("2026-09-26T08:30:00.000Z") })).toBe(
      30 * MINUTE,
    );
    // 23:00 Perth: the next boundary is 08:00 tomorrow.
    expect(msUntilOnCallShiftContextChange({ shifts: [], pick: null, now: at("2026-09-26T15:00:00.000Z") })).toBe(
      9 * 60 * MINUTE,
    );
  });

  it("wakes when a rostered shift enters its last hour, so the end-of-shift list comes forward untouched", () => {
    // 06:30 Perth on the 27th; the night ends at 08:00, so its last hour starts at 07:00.
    const now = at("2026-09-26T22:30:00.000Z");
    expect(msUntilOnCallShiftContextChange({ shifts: [NIGHT], pick: null, now })).toBe(30 * MINUTE);
    expect(onCallShiftContext({ shifts: [NIGHT], pick: null, now: at("2026-09-26T23:00:00.000Z") }).phase).toBe("end");
  });

  it("wakes when a pick expires", () => {
    // Picked 20:00 Perth on the 25th; it expires at 12:00 Perth on the 26th.
    const pick = { period: "evening" as const, at: "2026-09-25T12:00:00.000Z" };
    // 11:50 Perth: the pick's expiry (12:00) comes before the 17:00 boundary.
    expect(msUntilOnCallShiftContextChange({ shifts: [], pick, now: at("2026-09-26T03:50:00.000Z") })).toBe(
      10 * MINUTE,
    );
  });
});
