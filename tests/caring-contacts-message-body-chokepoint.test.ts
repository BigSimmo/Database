import { describe, expect, it } from "vitest";

import type { PlannedContact } from "@/lib/caring-contacts/schedule";
import type { DispatchRecord } from "@/lib/caring-contacts/repository";

/**
 * Ledger #B16HW8. `validateGovernedMessage` in `src/lib/caring-contacts/message-policy.ts` is the
 * chokepoint that enforces the segment limit, the prohibited vocabulary, the required support
 * fragments and the fictional-contact check. It gates message CONTENT.
 *
 * Nothing outbound passes through it today, and that is not a bug: this prototype has no send path,
 * and no shape in the domain carries a message body for one to send. `PlannedContact` names a
 * `messageType` but holds no text, and `DispatchRecord` tracks attempts and provider status but no
 * content. The validator is the mechanism a future sender must use, not a control that is currently
 * failing open.
 *
 * The hazard the row exists for is that someone reads "the validator refuses this" as "the system
 * refuses this". These tests turn that from a note into a tripwire. A message body can only reach a
 * recipient by first being carried on one of these two shapes, so adding a body field to either is
 * the moment the wiring becomes required. When that happens these fail, and the fix is to route the
 * new body through `validateGovernedMessage` before anything can dispatch it — not to widen the
 * expected key list here.
 *
 * These are type-level assertions. They cost nothing at runtime and fail during `typecheck`, which
 * is where a new field would first appear.
 */

/** Exact-key assertion: fails to compile if either side gains or loses a member. */
type AssertKeys<Actual extends string, Expected extends Actual & string> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : { missingFromActual: Exclude<Expected, Actual> }
  : { unexpectedOnActual: Exclude<Actual, Expected> };

type PlannedContactKeys = keyof PlannedContact;
type DispatchRecordKeys = keyof DispatchRecord;

const PLANNED_CONTACT_SHAPE_IS_BODYLESS: AssertKeys<
  PlannedContactKeys,
  "sequence" | "cadenceLabel" | "calendarDay" | "sendAt" | "messageType" | "suppressed"
> = true;

const DISPATCH_RECORD_SHAPE_IS_BODYLESS: AssertKeys<
  DispatchRecordKeys,
  | "contactId"
  | "planId"
  | "attempt"
  | "startedAt"
  | "expectedStatus"
  | "reportedStatus"
  | "discrepancyResolvedAt"
  | "discrepancyResolution"
> = true;

describe("caring contacts: no message body exists outside the governed chokepoint", () => {
  it("PlannedContact carries a message type but no body", () => {
    // The compile-time assertion above is the real gate; this keeps the reason visible in the
    // suite, so a failure names the wiring requirement rather than just a type error.
    expect(PLANNED_CONTACT_SHAPE_IS_BODYLESS).toBe(true);
  });

  it("DispatchRecord tracks an attempt but no content", () => {
    expect(DISPATCH_RECORD_SHAPE_IS_BODYLESS).toBe(true);
  });
});
