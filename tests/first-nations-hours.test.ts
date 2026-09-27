import { describe, expect, it } from "vitest";
import { callState, dayTrack, hoursInWords, isOverdue } from "@/lib/first-nations/hours";

const weekdays = { days: [1, 2, 3, 4, 5], open: "08:00", close: "16:30" };
const at = (iso: string) => new Date(iso); // Perth is UTC+8 all year
// 2026-09-22 is a Tuesday, 2026-09-25 a Friday, 2026-09-28 WA's King's Birthday (a Monday).

describe("callState", () => {
  it("is open at 14:20 on a weekday", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T06:20:00Z"))).toEqual({ kind: "open", closesAt: "16:30" });
  });
  it("is still open at 16:29", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T08:29:00Z")).kind).toBe("open");
  });
  it("is closed at exactly 16:30 and opens tomorrow at 08:00", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T08:30:00Z"))).toEqual({
      kind: "closed",
      opensAt: "08:00",
      opensOn: "tomorrow",
    });
  });
  it("is closed at midnight", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T16:00:00Z")).kind).toBe("closed");
  });
  it("opens today when it is early morning", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T23:00:00Z"))).toEqual({
      kind: "closed",
      opensAt: "08:00",
      opensOn: "today",
    });
  });
  it("is closed on a WA public holiday", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-28T02:00:00Z"))).toEqual({
      kind: "closed",
      opensAt: "08:00",
      opensOn: "tomorrow",
    });
  });
  it("skips the weekend and the holiday on a Friday evening", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-25T09:40:00Z"))).toEqual({
      kind: "closed",
      opensAt: "08:00",
      opensOn: "Tue",
    });
  });
  it("is overdue once the 90-day recheck passes, even in hours", () => {
    expect(callState(weekdays, "2026-06-01", at("2026-09-22T06:20:00Z"))).toEqual({ kind: "overdue" });
  });
  it("is unconfirmed without hours", () => {
    expect(callState(undefined, "2026-09-01", at("2026-09-22T06:20:00Z"))).toEqual({ kind: "unconfirmed" });
  });
});

describe("isOverdue", () => {
  it("is false at 90 days and true at 91", () => {
    expect(isOverdue("2026-06-24", at("2026-09-22T02:00:00Z"))).toBe(false);
    expect(isOverdue("2026-06-23", at("2026-09-22T02:00:00Z"))).toBe(true);
  });
});

describe("dayTrack", () => {
  it("places today's open hours and now on a 24-hour line", () => {
    const track = dayTrack(weekdays, at("2026-09-22T06:20:00Z"));
    expect(track?.open?.from).toBeCloseTo(8 / 24);
    expect(track?.open?.to).toBeCloseTo(16.5 / 24);
    expect(track?.now).toBeCloseTo((14 + 20 / 60) / 24);
  });
  it("shows no open segment on a closed day and nothing without hours", () => {
    expect(dayTrack(weekdays, at("2026-09-27T02:00:00Z"))?.open).toBeNull();
    expect(dayTrack(undefined, at("2026-09-27T02:00:00Z"))).toBeNull();
  });
});

describe("hoursInWords", () => {
  it("says weekdays and every day in words", () => {
    expect(hoursInWords(weekdays)).toBe("Open 08:00–16:30, Monday to Friday");
    expect(hoursInWords({ days: [1, 2, 3, 4, 5, 6, 7], open: "08:00", close: "16:30" })).toBe(
      "Open 08:00–16:30, 7 days",
    );
    expect(hoursInWords({ days: [1, 3], open: "09:00", close: "12:00" })).toBe(
      "Open 09:00–12:00, Monday and Wednesday",
    );
  });
});
