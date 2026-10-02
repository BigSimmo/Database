import { describe, expect, it } from "vitest";

import { parseAsk, type AskContext } from "@/lib/roster/ask/parse";

const NIGHT_20_OCT = "33333333-3333-4333-8333-333333333333";
const ctx: AskContext = {
  today: "2026-10-01",
  actorId: "11111111-1111-4111-8111-111111111111",
  assignments: [
    {
      id: NIGHT_20_OCT,
      userId: "11111111-1111-4111-8111-111111111111",
      name: "Alex Example",
      grade: "registrar",
      startsAt: "2026-10-20T13:00:00Z",
      endsAt: "2026-10-21T05:00:00Z",
      kind: "night",
      shiftCode: "N",
    },
  ],
  people: [],
  codes: ["N"],
};

describe("Ask Roster parser", () => {
  it("stops on a qualifier", () => {
    expect(parseAsk("I can't work 12-16 Oct except the 14th", ctx)).toMatchObject({ kind: "clarify" });
  });

  it("turns a specific own shift into a give-away handoff", () => {
    expect(parseAsk("I can't do Tue 20 Oct night", ctx)).toEqual({
      kind: "change",
      intent: { kind: "give_away", assignmentId: NIGHT_20_OCT },
    });
  });

  it("does not infer a team assignment from another person's shift", () => {
    expect(parseAsk("give away Tue 20 Oct day", ctx)).toMatchObject({ kind: "clarify" });
  });

  it("rejects unknown tokens rather than dropping them", () => {
    expect(parseAsk("I can't do Tue 20 Oct night pineapple", ctx)).toEqual({ kind: "not_understood" });
  });

  it("offers a person chooser when names collide", () => {
    const people = [
      { userId: "44444444-4444-4444-8444-444444444444", name: "Sam Example", grade: "registrar" },
      { userId: "55555555-5555-4555-8555-555555555555", name: "Sam Sample", grade: "resident" },
    ];
    expect(parseAsk("swap my Tue 20 Oct night with Sam", { ...ctx, people })).toMatchObject({
      kind: "clarify",
      options: [{ label: "S. Example, registrar" }, { label: "S. Sample, resident" }],
    });
  });
});
