import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { INSTANT_FIELDS, shiftInstants } from "@/components/ward-management/ward-reanchor";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const MODEL_FILE = "src/components/ward-management/ward-model.ts";

/**
 * The re-anchor must move EVERY point in time and nothing else.
 *
 * WHY THIS EXISTS. `shiftInstants` moves fields by NAME, which is only safe while the name list
 * matches the model. Add an `Instant` field to `ward-model.ts` and forget this list and the fixture
 * ships with one timestamp still on the old anchor - and nothing goes red, because every other
 * screen agrees with itself. A clinician reads a single wrong time as bad data rather than as a
 * bug, which is the worst kind of failure this prototype can have.
 *
 * The expected set is DERIVED FROM THE MODEL'S OWN DECLARATIONS rather than hand-listed twice.
 * That is normally how a check that cannot fail gets built, and it is safe here for the same reason
 * `ward-flow-data-boundary.test.ts` gives: the model is the SUBJECT, and the claim is about a
 * different file's list agreeing with it. If a field is renamed this follows the rename and keeps
 * checking the same property; if one is added, it goes red until somebody decides.
 */
function isInstantType(type: ts.TypeNode): boolean {
  if (ts.isUnionTypeNode(type)) {
    const parts = type.types.filter(
      (member) =>
        member.kind !== ts.SyntaxKind.UndefinedKeyword &&
        !(ts.isLiteralTypeNode(member) && member.literal.kind === ts.SyntaxKind.NullKeyword),
    );
    return parts.length > 0 && parts.every(isInstantType);
  }
  return ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === "Instant";
}

function declaredInstantFields(): Set<string> {
  const source = ts.createSourceFile(MODEL_FILE, readFileSync(MODEL_FILE, "utf8"), ts.ScriptTarget.Latest, true);
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertySignature(node) && node.type && ts.isIdentifier(node.name)) {
      // The property's own type must BE an Instant, not merely CONTAIN one. Matching the type's
      // TEXT instead caught `escalation`, `examination`, `localBedSought` and `withdrawnReferrals`
      // - containers whose inline object types have an `at: Instant` inside them. Adding those
      // four to INSTANT_FIELDS would have turned this red green while making the shift try to add
      // a number to an object, which the typeof check in `shift` quietly declines to do: a repair
      // that satisfies the guard and does nothing. The nested `at` is found on its own by the
      // recursive walk below, which is why being strict here loses nothing.
      if (isInstantType(node.type)) found.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("re-anchoring moves every instant and nothing else", () => {
  it("knows what it is checking, so it cannot pass by scanning nothing", () => {
    // The canary. Both assertions below pass by finding agreement, which reads identically to two
    // empty sets or a file that failed to parse.
    expect(INSTANT_FIELDS.size).toBeGreaterThan(10);
    expect(declaredInstantFields().size).toBeGreaterThan(10);
  });

  it("shifts exactly the field names the model declares as instants", () => {
    expect(
      [...declaredInstantFields()].sort(),
      "ward-model.ts declares a different set of Instant fields than ward-reanchor.ts shifts. A " +
        "field the model calls an Instant and this list omits stays on the OLD anchor when the " +
        "demo clock re-anchors, so one timestamp on one screen disagrees with every other and " +
        "nothing goes red. Add it to INSTANT_FIELDS - or, if it is genuinely a duration rather " +
        "than a point in time, say so here beside clockOffsetMinutes rather than leaving the two " +
        "lists silently different.",
    ).toEqual([...INSTANT_FIELDS].sort());
  });

  it("preserves every relative offset, which is the whole property", () => {
    const state = seedWardFlowState();
    const shifted = shiftInstants(state, 137);

    const opened = state.movements.map((movement) => movement.openedAt);
    const openedShifted = shifted.movements.map((movement) => movement.openedAt);

    expect(opened.length, "no movements to compare - the fixture is empty").toBeGreaterThan(30);
    expect(
      openedShifted.map((instant, index) => instant - opened[index]),
      "re-anchoring moved the seeded movements by inconsistent amounts. Every instant must move by " +
        "the same offset or the fixture's shape changes: waits, gaps and overdue-ness are all " +
        "differences, and only a uniform shift leaves them alone.",
    ).toEqual(opened.map(() => 137));
  });

  it("leaves durations and counts where they are", () => {
    const shifted = shiftInstants(seedWardFlowState(), 137);
    expect(
      shifted.clockOffsetMinutes,
      "clockOffsetMinutes is a DURATION the advance-clock control has added, not a point in time. " +
        "Shifting it double-counts the re-anchor and the demo clock jumps twice.",
    ).toBe(0);
    expect(shifted.referralSequence, "referralSequence is a counter, not a time").toBe(0);
  });

  it("is a copy, so the pinned path and the live path differ only in the offset", () => {
    const state = seedWardFlowState();
    const copy = shiftInstants(state, 0);
    expect(copy).toEqual(state);
    expect(copy).not.toBe(state);
    expect(copy.movements[0]).not.toBe(state.movements[0]);
  });
});
