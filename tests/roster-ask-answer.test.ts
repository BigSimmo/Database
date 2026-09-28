import { describe, expect, it } from "vitest";

import { answerQuestion, type AskAnswerData } from "@/lib/roster/ask/answer";

const actorId = "11111111-1111-4111-8111-111111111111";
const base: AskAnswerData = {
  today: "2026-10-01",
  shifts: [],
  assignments: [],
  actorId,
  teamName: "Example Hospital",
  loadedRange: { from: "2026-09-24", to: "2026-11-24" },
  publication: { periodStart: "2026-10-01", periodEnd: "2026-10-31", publishedAt: "2026-10-02T08:10:00Z" },
};

describe("Ask Roster answers", () => {
  it("never calls an uncovered empty date a day off", () => {
    const result = answerQuestion({ kind: "on_date", span: { from: "2026-12-14", to: "2026-12-14" } }, base);
    expect(result.lines.join(" ")).toMatch(/outside|can't confirm/i);
    expect(result.lines.join(" ")).not.toMatch(/day off|free/i);
  });

  it("shows four weekends with unknown coverage clearly marked", () => {
    const result = answerQuestion(
      { kind: "next_weekend_off" },
      { ...base, publication: { ...base.publication!, periodEnd: "2026-10-04" } },
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows?.slice(1).every((row) => row.detail === "Coverage not loaded")).toBe(true);
  });

  it("only names a colleague when the published team window covers the date", () => {
    const assignment = {
      id: "a",
      userId: "2",
      name: "Sam Example",
      grade: "registrar",
      startsAt: "2026-10-03T00:00:00Z",
      endsAt: "2026-10-03T08:00:00Z",
      kind: "day",
      shiftCode: "D",
    };
    const result = answerQuestion(
      { kind: "who_on", date: "2026-10-03", grade: "registrar" },
      { ...base, assignments: [assignment] },
    );
    expect(result.rows?.[0]?.label).toBe("Sam Example");
    expect(result.source).toMatch(/published/);
  });
});
