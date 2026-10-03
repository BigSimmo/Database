import { describe, expect, it } from "vitest";

import mhaTimeframes from "../data/mha-timeframes.json";
import signOffStore from "../src/lib/admin/today-rule-sign-offs.json";
import { ruleGate, type TodayRuleSignOffStore } from "@/lib/admin/rule-sign-off";
import { FATIGUE_RULE_SET } from "@/lib/roster/fatigue-rules-source";
import type { MhaTimeframesFile } from "@/lib/mha-timeline";
import { ACCOUNT_ID_STEPS, runSigning, signOffCode } from "../scripts/sign-today-rules";

const store = signOffStore as TodayRuleSignOffStore;
const timeframes = mhaTimeframes as MhaTimeframesFile;
const now = new Date("2026-10-04T02:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";

/** Answers questions in order; a question no answer matches fails the test, so the script's order is pinned. */
function scripted(answers: [RegExp, string][]) {
  const printed: string[] = [];
  let index = 0;
  return {
    printed,
    io: {
      print: (line: string) => printed.push(line),
      ask: async (question: string) => {
        const next = answers[index];
        if (!next || !next[0].test(question)) throw new Error(`Unexpected question ${index}: ${question}`);
        index += 1;
        return next[1];
      },
    },
  };
}

const addSigner: [RegExp, string][] = [
  [/account ID/i, USER_ID],
  [/Your name/, "Dr Jane Example"],
  [/Type ADD/, "ADD"],
];
const agreeAll: [RegExp, string][] = [
  [/word for word/, "y"],
  [/figure the engine uses/, "y"],
  [/apply to the doctors/, "y"],
];

describe("rules:sign", () => {
  it("ships with no signer and every rule set unsigned and off", () => {
    expect(store.approvedSigners).toEqual([]);
    for (const signOff of [store.fatigue, store.cpd, store.mhaTimerSwitch.signOff]) {
      expect(signOff).toEqual({
        enabled: false,
        signedBy: null,
        signedByUserId: null,
        signedAt: null,
        signedContentSha256: null,
      });
    }
    expect(store.mhaTimerSwitch.medicalDeviceRuling).toBeNull();
  });

  it("tells the owner where to find their account ID, and looks nothing up", async () => {
    const run = scripted([[/account ID/i, "not-a-uid"]]);
    expect(await runSigning(run.io, store, timeframes, now)).toBeNull();
    expect(run.printed).toEqual(expect.arrayContaining(ACCOUNT_ID_STEPS));
  });

  it("adds the signer and signs fatigue only after every question and the typed code", async () => {
    const run = scripted([
      ...addSigner,
      [/Review and sign: Roster fatigue/, "y"],
      ...agreeAll,
      [/Type the sign-off code/, signOffCode(FATIGUE_RULE_SET).toLowerCase()],
      [/Switch it on now/, "y"],
      [/Review and sign: CPD/, "n"],
      [/Review and sign: Mental Health Act/, "n"],
    ]);
    const next = await runSigning(run.io, store, timeframes, now);
    expect(next?.approvedSigners).toEqual([{ userId: USER_ID, name: "Dr Jane Example" }]);
    expect(next?.fatigue).toMatchObject({ enabled: true, signedBy: "Dr Jane Example", signedByUserId: USER_ID });
    expect(ruleGate(next!.fatigue, FATIGUE_RULE_SET, next!.approvedSigners, now.getTime() + 1000)).toEqual({
      on: true,
    });
    expect(next?.cpd).toEqual(store.cpd);
  });

  it("does not sign when any answer is no, or the code is wrong", async () => {
    const declined = scripted([
      ...addSigner,
      [/Review and sign: Roster fatigue/, "y"],
      [/word for word/, "y"],
      [/figure the engine uses/, "n"],
      [/Review and sign: CPD/, "y"],
      ...agreeAll,
      [/Type the sign-off code/, "WRONG123"],
      [/Review and sign: Mental Health Act/, "n"],
    ]);
    const next = await runSigning(declined.io, store, timeframes, now);
    // Only the signer was added; neither rule set was signed.
    expect(next?.fatigue).toEqual(store.fatigue);
    expect(next?.cpd).toEqual(store.cpd);
  });

  it("refuses a system or role name for the signer", async () => {
    const run = scripted([
      [/account ID/i, USER_ID],
      [/Your name/, "PsychSift"],
    ]);
    expect(await runSigning(run.io, store, timeframes, now)).toBeNull();
  });

  it("needs a dated, recorded medical-device ruling before the countdown switch can be signed", async () => {
    const run = scripted([
      ...addSigner,
      [/Review and sign: Roster fatigue/, "n"],
      [/Review and sign: CPD/, "n"],
      [/Review and sign: Mental Health Act/, "y"],
      [/Date you confirmed/, "soon"],
      [/Where that decision/, ""],
    ]);
    const next = await runSigning(run.io, store, timeframes, now);
    expect(next?.mhaTimerSwitch).toEqual(store.mhaTimerSwitch);
  });

  it("asks an existing signer to confirm their account ID", async () => {
    const signed: TodayRuleSignOffStore = { ...store, approvedSigners: [{ userId: USER_ID, name: "Dr Jane Example" }] };
    const run = scripted([[/Paste your account ID/, "22222222-2222-4222-8222-222222222222"]]);
    expect(await runSigning(run.io, signed, timeframes, now)).toBeNull();
  });
});
