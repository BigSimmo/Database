import { describe, expect, it } from "vitest";

import {
  RECURRING_SESSION_MAX_PERIODS,
  nextTeachingOccurrence,
  recurringSessionDateParts,
} from "@/lib/dates/recurring-session";
import * as teachingSchedule from "@/lib/on-call/teaching-schedule";

describe("the neutral recurring-session date module", () => {
  it("is the one implementation On Call's old names point at", () => {
    expect(teachingSchedule.nextTeachingOccurrence).toBe(nextTeachingOccurrence);
    expect(teachingSchedule.onCallTeachingDateParts).toBe(recurringSessionDateParts);
    expect(teachingSchedule.ON_CALL_RECURRENCE_MAX_PERIODS).toBe(RECURRING_SESSION_MAX_PERIODS);
  });

  it("rolls weekly, fortnightly and monthly anchors forward exactly as before", () => {
    expect(nextTeachingOccurrence("2026-01-01", "weekly", "2026-09-16")).toBe("2026-09-17");
    expect(nextTeachingOccurrence("2026-01-01", "fortnightly", "2026-09-16")).toBe("2026-09-24");
    expect(nextTeachingOccurrence("2026-01-31", "monthly", "2026-02-10")).toBe("2026-02-28");
    expect(nextTeachingOccurrence("2026-09-01", null, "2026-09-16")).toBeNull();
    expect(nextTeachingOccurrence("2026-02-30", "weekly", "2026-09-16")).toBeNull();
  });

  it("splits a date key into the parts a card prints", () => {
    expect(recurringSessionDateParts("2026-09-17")).toEqual({ weekday: "Thu", day: "17", month: "Sep", year: "2026" });
    expect(recurringSessionDateParts("nonsense")).toEqual({ weekday: "", day: "", month: "", year: "" });
  });

  it("still labels a whole date the Australian way through On Call's own helper", () => {
    expect(teachingSchedule.onCallTeachingDateLabel("2026-09-17")).toBe("Thu 17 Sep 2026");
  });
});
