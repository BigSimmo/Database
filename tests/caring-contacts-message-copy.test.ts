import { describe, expect, it } from "vitest";

import { calculateGsm7, maxSeptetsWithin } from "@/lib/caring-contacts/message-policy";
import { PROVISIONAL_MESSAGE_RULES } from "@/lib/caring-contacts/message-rules";
import {
  AUTOMATED_REPLY_GSM7,
  AUTOMATED_REPLY_RESPONSE,
  EXACT_MESSAGE_GSM7,
  EXACT_PATIENT_VISIBLE_MESSAGE,
  PATIENT_VISIBLE_MESSAGE_BASE_SEPTETS,
  PATIENT_VISIBLE_NO_REPLY_NOTICE,
  PREFERRED_NAME_MAX_SEPTETS,
  SPECIMEN_PREFERRED_NAME,
  preferredNameMaxSeptets,
  resolvePatientVisibleMessage,
} from "@/lib/caring-contacts/message-copy";
import {
  DESIGNATED_FICTIONAL_MOBILE_NUMBERS,
  FICTIONAL_CONTACTS_BY_ROLE,
} from "@/lib/caring-contacts/synthetic-contacts";

describe("caring-contacts patient-visible copy", () => {
  it("keeps the patient-visible message inside its approved segment ceiling, for every name it accepts", () => {
    // THIS REPLACES THE EXACT `septets: 252` PIN, AND IT IS A STRICTLY STRONGER STATEMENT — the pin
    // was not deleted, it was superseded (2026-08-26).
    //
    // 252 was true of ONE message: the specimen, with the fictional name `Rowan` in it. The message
    // is a template now, so the interesting property is no longer "this one string is 252 septets"
    // but "no name this domain accepts can push this message past its ceiling". A number cannot say
    // that; a bound quantified over every accepted length can, and it stays true when the
    // PROVISIONAL wording changes — which the number could not.
    //
    // The specimen's own evidence is still pinned, in caring-contact-mockups.dom.test.tsx, where the
    // claim belongs: that is the string the mockups render.
    const ceiling = maxSeptetsWithin(PROVISIONAL_MESSAGE_RULES.maxSegments);

    for (let length = 1; length <= PREFERRED_NAME_MAX_SEPTETS; length += 1) {
      // Basic-set characters, so one character costs exactly one septet and `length` IS the septet
      // cost of this name. The extension-set case, where it is not, is its own test below.
      const name = "x".repeat(length);
      const resolved = resolvePatientVisibleMessage(name);

      expect(resolved).toMatchObject({ ok: true });
      if (!resolved.ok) continue;

      // The name really is IN the message. Without this, a template that stopped substituting
      // would hold every septet claim below constant at the base length and this whole loop would
      // go green while the message greeted nobody.
      expect(resolved.text).toContain(name);

      const evidence = calculateGsm7(resolved.text);
      expect(evidence.valid).toBe(true);
      expect(evidence.segments).toBeLessThanOrEqual(PROVISIONAL_MESSAGE_RULES.maxSegments);
      expect(evidence.septets).toBeLessThanOrEqual(ceiling);
    }
  });

  it("caps the name at the largest one that fits, and refuses the next character", () => {
    // Both ends, because a cap that is merely SAFE is not the same claim as a cap that is RIGHT. A
    // cap of 1 would pass the bound above and quietly refuse almost every real name.
    const ceiling = maxSeptetsWithin(PROVISIONAL_MESSAGE_RULES.maxSegments);
    const longestAccepted = "x".repeat(PREFERRED_NAME_MAX_SEPTETS);

    const accepted = resolvePatientVisibleMessage(longestAccepted);
    expect(accepted).toMatchObject({ ok: true });
    if (accepted.ok) {
      const evidence = calculateGsm7(accepted.text);
      // Exactly at the ceiling, not merely below it: the cap spends all the headroom there is.
      expect(evidence.septets).toBe(ceiling);
      expect(evidence.segments).toBe(PROVISIONAL_MESSAGE_RULES.maxSegments);
    }

    expect(resolvePatientVisibleMessage(`${longestAccepted}x`)).toEqual({
      ok: false,
      issue: {
        code: "preferred-name-too-long",
        septets: PREFERRED_NAME_MAX_SEPTETS + 1,
        maxSeptets: PREFERRED_NAME_MAX_SEPTETS,
      },
    });

    // And the refusal is not the cap being zero or negative: there is real room here. The comment in
    // message-copy.ts once read "no room left", which meant no room for one particular extra
    // sentence and was later read as meaning no headroom at all.
    expect(PREFERRED_NAME_MAX_SEPTETS).toBe(ceiling - PATIENT_VISIBLE_MESSAGE_BASE_SEPTETS);
    expect(PREFERRED_NAME_MAX_SEPTETS).toBeGreaterThan(0);
  });

  it("counts the name in septets rather than characters, so a two-septet character costs two", () => {
    // `€` is a GSM-7 EXTENSION character: one character, two septets. A cap measured in characters
    // would accept a name of `PREFERRED_NAME_MAX_SEPTETS` of them and produce a three-segment
    // message. The positive control is the half-length name, which must still be accepted — an
    // implementation that simply refused every `€` would pass the refusal alone.
    const halfLength = Math.floor(PREFERRED_NAME_MAX_SEPTETS / 2);

    const accepted = resolvePatientVisibleMessage("€".repeat(halfLength));
    expect(accepted).toMatchObject({ ok: true });
    if (accepted.ok) {
      expect(calculateGsm7(accepted.text).segments).toBe(PROVISIONAL_MESSAGE_RULES.maxSegments);
    }

    const refused = resolvePatientVisibleMessage("€".repeat(PREFERRED_NAME_MAX_SEPTETS));
    expect(refused).toMatchObject({ ok: false, issue: { code: "preferred-name-too-long" } });
  });

  it("gives the same cap rule to any text a name is substituted into, not just this template", () => {
    // A pathway version carries its own `messageTextByType`, and the demo corpus stores a copy of
    // the current wording there. A cap derived from THIS template does not bound that string, so the
    // rule is exposed rather than only its answer -- a second cap computed a second way is how two
    // answers to one question come to disagree.
    //
    // Applied to this module's own template it must give exactly the exported constant. That is the
    // control that the general function and the specific number are one rule.
    expect(preferredNameMaxSeptets(EXACT_PATIENT_VISIBLE_MESSAGE.replace(SPECIMEN_PREFERRED_NAME, ""))).toBe(
      PREFERRED_NAME_MAX_SEPTETS,
    );

    // A shorter text has more room, a longer one has less, and the difference is exactly the
    // difference in length -- so a wording change moves the cap rather than silently invalidating it.
    const ceiling = maxSeptetsWithin(PROVISIONAL_MESSAGE_RULES.maxSegments);
    expect(preferredNameMaxSeptets("Hi , from us.")).toBe(ceiling - "Hi , from us.".length);
    expect(preferredNameMaxSeptets("x".repeat(ceiling))).toBe(0);

    // A text with no room left yields a cap of zero or less, and every name is then refused as too
    // long. The honest arithmetic, not a floor that would let a name in.
    expect(preferredNameMaxSeptets("x".repeat(ceiling + 5))).toBeLessThan(0);
  });

  it("refuses rather than sending an unpersonalised greeting nobody has authored", () => {
    // There is no no-name wording, and inventing one would be an implementer drafting
    // patient-visible copy for a suicide-prevention message. So the absence is a loud refusal,
    // exactly as `resolveClosingContactMessageBody` refuses for the closing message.
    for (const absent of [null, "", "   "]) {
      expect(resolvePatientVisibleMessage(absent)).toEqual({
        ok: false,
        issue: { code: "preferred-name-not-recorded" },
      });
    }

    // Positive control: the same function DOES produce a message when a name is recorded, so the
    // three refusals above are the absence being refused rather than the function refusing always.
    expect(resolvePatientVisibleMessage("Rowan")).toMatchObject({ ok: true });
  });

  it("refuses a name this channel cannot carry, rather than emitting a message it would mangle", () => {
    // `ë` is outside the GSM-7 alphabet. `calculateGsm7` reports the whole message `valid: false`,
    // `validateGovernedMessage` checks the segment ceiling only when the message IS valid, and
    // `MessageValidationIssue` has no invalid-characters code — so an accepted `Zoë` produces a
    // message this domain reports as VALID with the ceiling never evaluated. The demonstrable
    // failure is that the two-segment limit silently stops being enforced, NOT that the message
    // arrives damaged: a real gateway re-encodes to UCS-2 and delivers it intact, at 70/67
    // characters per segment. Nothing here models that path, so within this system the message is
    // unencodable and refusing is the conservative answer. The character set is a telecom
    // specification, so nothing in the refusal decides anything about the patient.
    expect(resolvePatientVisibleMessage("Zoë")).toEqual({
      ok: false,
      issue: { code: "preferred-name-not-sendable", unsupportedCharacters: ["ë"] },
    });

    // Positive control on the alphabet itself: accented characters that ARE in GSM-7 are accepted,
    // so this is a transport limit rather than a blanket refusal of anything unfamiliar.
    expect(resolvePatientVisibleMessage("José")).toMatchObject({ ok: true });
  });

  it("builds the specimen from the template rather than holding a second copy of the wording", () => {
    // The reversal of Ruling [127] is narrow: the message gained a slot and nothing else changed.
    // The specimen is the template with the fictional name in it, so there is no second string that
    // could drift from the one the resolver produces.
    const resolved = resolvePatientVisibleMessage(SPECIMEN_PREFERRED_NAME);
    expect(resolved).toEqual({ ok: true, text: EXACT_PATIENT_VISIBLE_MESSAGE });
    expect(EXACT_PATIENT_VISIBLE_MESSAGE).toContain(`Hi ${SPECIMEN_PREFERRED_NAME},`);
  });

  it("keeps the pinned GSM-7 evidence for the automated reply", () => {
    // 218 -> 210 septets, owner-approved 2026-08-24 (items A2 + A3): the first sentence was
    // replaced, see the "A2 + A3" describe block below for the full covering tests. This one is
    // still a fixed string with no slot, so an exact pin is still the right claim about it.
    expect(AUTOMATED_REPLY_GSM7).toEqual({ invalidCharacters: [], segments: 2, septets: 210, valid: true });
  });

  it("derives its evidence from the single domain GSM-7 calculator", () => {
    expect(EXACT_MESSAGE_GSM7).toEqual(calculateGsm7(EXACT_PATIENT_VISIBLE_MESSAGE));
    expect(AUTOMATED_REPLY_GSM7).toEqual(calculateGsm7(AUTOMATED_REPLY_RESPONSE));
  });

  it("names the staffed line and crisis support in both strings and neither patient mobile", () => {
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).toContain(FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine);
      expect(text).toContain(FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact);
      expect(text).not.toContain(FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile);
      expect(text).not.toContain(FICTIONAL_CONTACTS_BY_ROLE.miraPatientMobile);
    }
  });

  it("states only that nobody reads replies, never that replies are not received", () => {
    expect(EXACT_PATIENT_VISIBLE_MESSAGE).toContain(PATIENT_VISIBLE_NO_REPLY_NOTICE);
    expect(PATIENT_VISIBLE_NO_REPLY_NOTICE).toBe("No one reads replies to this number");
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).not.toMatch(/replies are not received|we monitor|monitored/i);
    }
  });

  it("includes emergency escalation and therapeutic neutrality in both patient-visible strings", () => {
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).toContain("In an emergency call 000");
      expect(text).not.toContain("?");
      for (const prohibited of ["high risk", "safe", "engagement score", "campaign", "lead", "conversion", "inbox"]) {
        expect(text.toLowerCase()).not.toContain(prohibited);
      }
    }
  });

  it("uses four distinct reserved fictional numbers", () => {
    expect(new Set(DESIGNATED_FICTIONAL_MOBILE_NUMBERS).size).toBe(4);
    expect(DESIGNATED_FICTIONAL_MOBILE_NUMBERS).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// A2 + A3 (owner-approved 2026-08-24) — the automated reply no longer makes a storage claim
// nobody can currently verify, and it now tells the recipient the reply they are reading is
// automatic, so a person who was just told "no one reads this" cannot mistake a reply for a
// human response. See docs/caring-contacts/phase-2b-sdd-archive/task-c-brief.md.
// ---------------------------------------------------------------------------
describe("caring-contacts automated reply wording (A2 + A3, 2026-08-24)", () => {
  it("matches the owner-approved text exactly", () => {
    expect(AUTOMATED_REPLY_RESPONSE).toBe(
      "No one at Example Aftercare Team reads this number, and this reply is automatic. To talk to someone, " +
        `call ${FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine}, 9 am-6 pm every day. In an emergency call 000. ` +
        `Fictional Support Line: ${FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact}.`,
    );
  });

  it("stays within the two-segment GSM-7 ceiling (measured, not assumed)", () => {
    const evidence = calculateGsm7(AUTOMATED_REPLY_RESPONSE);
    expect(evidence.segments).toBe(2);
    expect(evidence.valid).toBe(true);
    expect(evidence.septets).toBe(210);
  });

  it("A2: drops the storage claim nobody can currently verify", () => {
    expect(AUTOMATED_REPLY_RESPONSE).not.toContain("has not been kept");
    expect(AUTOMATED_REPLY_RESPONSE).not.toContain("has not been seen by anyone");
  });

  it("A3: tells the recipient this reply itself is automatic", () => {
    expect(AUTOMATED_REPLY_RESPONSE).toContain("automatic");
  });

  it("leaves EXACT_PATIENT_VISIBLE_MESSAGE untouched by the A2/A3 wording change", () => {
    // Message A is 252 septets against the 2-segment ceiling -- deliberately not touched here.
    // See message-copy.ts's own comment and task-c-brief.md, "A2 + A3", for why.
    expect(EXACT_PATIENT_VISIBLE_MESSAGE).not.toContain("this reply is automatic");
    expect(calculateGsm7(EXACT_PATIENT_VISIBLE_MESSAGE).septets).toBe(252);
  });
});
