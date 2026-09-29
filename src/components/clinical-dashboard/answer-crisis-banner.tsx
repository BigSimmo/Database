"use client";

import { InlineNotice } from "@/components/ui-primitives";
import { WA_CRISIS_CONTACTS } from "@/lib/crisis-contacts";

// Numbers come from the one shared module, looked up by id, so they can never drift from
// the Patient Safety Plan or any other surface that prints them.
function crisisContact(id: (typeof WA_CRISIS_CONTACTS)[number]["id"]) {
  const contact = WA_CRISIS_CONTACTS.find((candidate) => candidate.id === id);
  if (!contact) throw new Error(`missing crisis contact ${id}`);
  return contact;
}
const EMERGENCY_CONTACT = crisisContact("SYN-CRISIS-CONTACT-001");
const LIFELINE_CONTACT = crisisContact("SYN-CRISIS-CONTACT-005");
const MHERL_METRO_CONTACT = crisisContact("SYN-CRISIS-CONTACT-002");

const telLink =
  "font-bold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** Shown above an Answer-mode reply whenever the question uses crisis wording (`hasCrisisWording`). */
export function AnswerCrisisBanner() {
  return (
    <InlineNotice tone="info" className="mb-3">
      <span data-testid="answer-crisis-banner">
        If you or someone else is in immediate danger, call{" "}
        <a className={telLink} href={`tel:${EMERGENCY_CONTACT.telephoneUri}`}>
          {EMERGENCY_CONTACT.telephoneDisplay}
        </a>
        . For support at any time, call {LIFELINE_CONTACT.name}{" "}
        <a className={telLink} href={`tel:${LIFELINE_CONTACT.telephoneUri}`}>
          {LIFELINE_CONTACT.telephoneDisplay}
        </a>{" "}
        (24 hours), or in Perth the Mental Health Emergency Response Line{" "}
        <a className={telLink} href={`tel:${MHERL_METRO_CONTACT.telephoneUri}`}>
          {MHERL_METRO_CONTACT.telephoneDisplay}
        </a>{" "}
        (24 hours).
      </span>
    </InlineNotice>
  );
}
