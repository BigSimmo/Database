import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 EVERY FIELD ON A REFERRAL MUST HAVE SOMETHING THAT CAN WRITE IT.
 *
 * ⚠️ **THREE FIELDS IN ONE NIGHT LANDED WITH NO PRODUCER**, which makes it a pattern rather than
 * three slips:
 *
 * ```
 * edId + purpose   landed, nothing could write them  -> the intake form was fixed after the fact
 * triagedAt        landed, nothing could write it    -> this file, and the event field beside it
 * suburb           landed WITH a producer and a reducer check  <- what the other two should look like
 * ```
 *
 * ⚠️ **AND THE FAILURE IS INVISIBLE TO EVERY OTHER GATE.** A field with no producer typechecks, has
 * passing tests against hand-authored fixtures, and reads as complete in the model. The only thing
 * that reveals it is a screen rendering the absent branch forever — **and a screen showing "not in
 * department yet" for every patient looks exactly like correct handling of a legitimate case.**
 * `R46`: a thing built before its input exists cannot be built wrong, only empty, and empty is
 * indistinguishable from working. Found by Ward Referrals measuring the reducer rather than reading
 * the model.
 *
 * The check is deliberately structural rather than a list somebody maintains: it reads `Referral`'s
 * own field names out of `ward-model.ts` and requires each one to be written by the event that
 * creates a referral. A field added tomorrow is caught tomorrow, by nobody remembering anything.
 *
 * **A field that genuinely cannot come from the front door belongs in `WRITTEN_ELSEWHERE` with the
 * event that writes it named** — that list is the honest exception, and it is short on purpose.
 */
const MODEL = fileURLToPath(new URL("../src/components/ward-management/ward-model.ts", import.meta.url));
const REDUCER = fileURLToPath(new URL("../src/components/ward-management/ward-flow-reducer.ts", import.meta.url));

/** Fields no `RECEIVE_REFERRAL` can carry, each with the event that does write it. */
const WRITTEN_ELSEWHERE: Record<string, string> = {
  // The reducer mints it, and a caller choosing referral ids would be a different defect entirely.
  id: "assigned by the reducer from frontDoorReferralSequence",
  // Every destination starts queued; the answers land through ACCEPT_REFERRAL / DECLINE_REFERRAL.
  destinations: "RECEIVE_REFERRAL creates them queued; answered by ACCEPT_REFERRAL/DECLINE_REFERRAL",
  // The referral clock starts when the referral is made, so the event supplies `now`, not a field.
  raisedAt: "set to the event's own now",
  // Phase 8 D8-6, recorded later by a coordinator if it happened at all — never at intake.
  localBedSought: "RECORD_LOCAL_BED_SOUGHT, after the referral exists",
};

function referralFieldNames(): string[] {
  const source = readFileSync(MODEL, "utf8");
  const start = source.indexOf("export type Referral = {");
  expect(start, "the Referral declaration moved or was renamed — this check found nothing").toBeGreaterThan(-1);
  const end = source.indexOf("\n};", start);
  expect(end, "the Referral declaration has no end, so the slice below is the rest of the file").toBeGreaterThan(start);

  const body = source
    .slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  // Top-level keys only: two spaces of indentation is the type's own level, and anything deeper
  // belongs to a nested object literal inside a field.
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]!);
}

describe("every Referral field has something that can write it", () => {
  const fields = referralFieldNames();

  it("⚠️ FINDS THE FIELDS AT ALL — a matcher that matched nothing would pass every test below", () => {
    // The canary, and it is the failure mode of every source-text check: an extraction that finds
    // nothing turns "no field is unproducible" into a sentence about the empty set.
    expect(fields.length, "no Referral fields were extracted, so nothing below is checked").toBeGreaterThan(8);
    for (const known of ["suburb", "triagedAt", "homeRegion", "urgency"]) {
      expect(fields, `${known} is a Referral field and the extractor missed it`).toContain(known);
    }
    expect(fields, "a nested key leaked in, so the matcher is reading too deep").not.toContain("kind");
  });

  it("🔴 IS WRITTEN BY RECEIVE_REFERRAL, or is listed as written somewhere else and says where", () => {
    const source = readFileSync(REDUCER, "utf8");
    const start = source.indexOf('case "RECEIVE_REFERRAL": {');
    expect(start, "RECEIVE_REFERRAL is gone from the reducer").toBeGreaterThan(-1);
    const written = source.slice(start, source.indexOf("\n    case ", start + 10));
    expect(written.length, "the RECEIVE_REFERRAL slice is empty").toBeGreaterThan(200);

    for (const field of fields) {
      if (WRITTEN_ELSEWHERE[field]) continue;
      expect(
        written.includes(`${field}: event.${field}`),
        `Referral.${field} has no producer: RECEIVE_REFERRAL never writes it, so the only way a ` +
          "referral can carry it is a hand-authored fixture. Add it to the event, or list it in " +
          "WRITTEN_ELSEWHERE with the event that does write it.",
      ).toBe(true);
    }
  });

  it("keeps WRITTEN_ELSEWHERE honest — every excuse names a field that still exists", () => {
    // Otherwise the list becomes a graveyard of renamed fields, quietly excusing nothing while
    // looking like it excuses something.
    for (const [field, reason] of Object.entries(WRITTEN_ELSEWHERE)) {
      expect(fields, `WRITTEN_ELSEWHERE names "${field}", which is no longer a Referral field`).toContain(field);
      expect(reason.length, `the excuse for "${field}" says nothing`).toBeGreaterThan(10);
    }
  });

  it("⚠️ ACTUALLY CARRIES A TRIAGE INSTANT THROUGH THE REDUCER — the defect, end to end", () => {
    // The structural check above proves the line exists. This proves it works, because a text
    // match is not a behaviour: `triagedAt: event.triagedAt` inside a branch that never runs would
    // satisfy it.
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "ambulance",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      triagedAt: NOW_ANCHOR - 120,
    } as never);

    expect(state.rejections, "the walk was refused, so nothing below is exercised").toEqual([]);
    expect(state.referrals.at(-1)!.triagedAt).toBe(NOW_ANCHOR - 120);
  });

  it("refuses a triage instant later than the referral itself", () => {
    // A future triage would put a patient in the department before they got there, and the clock
    // clamps at zero — so the wrong value renders as a plausible "0m" rather than an obvious error.
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "ambulance",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      triagedAt: NOW_ANCHOR + 30,
    } as never);
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("triagedAt");
  });

  it("⚠️ HAS A REFERRAL ADDRESSED TO AN EMERGENCY DEPARTMENT IN THE SEED, or the hub is empty", () => {
    // The other half of the same finding. Without one, the ED psychiatry hub's inbox holds nothing
    // for any department, every row it could show renders the absent clock, and the screen is
    // indistinguishable from a correct one with nothing to show.
    const addressed = seedWardFlowState().referrals.filter((referral) =>
      referral.destinations.some((addressing) => addressing.destination.kind === "emergency_department"),
    );
    expect(addressed.length, "no seeded referral addresses an ED, so the hub has no data at all").toBeGreaterThan(0);
    expect(
      addressed.some((referral) => referral.triagedAt !== undefined),
      "no ED-addressed referral carries a triage instant, so the department clock never renders",
    ).toBe(true);
  });
});
