import { z } from "zod";

import { isAccessObjectIdShape } from "@/lib/caring-contacts/access-audit";

/**
 * The body `POST /api/caring-contacts/plans/[planId]/contacts/[contactId]` accepts.
 *
 * ## Why this is a module of its own rather than a `const` in the route
 *
 * The route is the only thing that ENFORCES this shape, and until now it was the only thing that
 * described it. That left the client free to send a body the route would refuse, and nothing able to
 * notice: the DOM suite's mirror of the route `JSON.parse`d the body and read four fields off it, so
 * a renamed or missing field on the client side sailed through a green suite, and the route's own
 * suite built its request from a fixture of its own rather than from the client. **A double that
 * diverges from the real thing makes everything downstream of it green and meaningless**, which is
 * exactly the defect a `{ value: null }` mirror produced one round earlier.
 *
 * So the schema lives where both can import it. It cannot live in the route (that module reaches
 * `server-only` and `next/headers`, so a jsdom test cannot load it), and it cannot live in
 * `src/lib/caring-contacts/` (nothing under that tree may import anything non-relative, and this
 * needs Zod). This file is the remaining place: plain validation, no React, no server imports, and
 * one non-relative import of the sealed domain's own id-shape predicate.
 *
 * ## `.strict()`, and the two things it is doing
 *
 * A discriminated union of ONE member, strict. A second kind of reschedule is a new member carrying
 * its own required fields, never an optional field bolted on to this one — `changeContactDate` needs
 * a reason and a recorded team-lead approver, and an optional approval field is precisely the shape
 * that lets an approval be omitted. Strict also means an EXTRA field is a refusal rather than
 * something silently dropped, so a client sending more than the route will act on finds out.
 *
 * Nothing here decides whether a time is acceptable. `toHour` and `toMinute` are checked for being a
 * wall-clock hour and minute AT ALL, which is a fact about the shape of a request;
 * `moveContactWithinDay` in the sealed domain owns both rules that matter — the move must stay on the
 * contact's own AWST calendar day, and the instant must fall inside the approved send window — and
 * refuses each by its own name. A copy of `09:00-18:00` here would be a second copy of a rule the
 * domain already holds, free to drift from it.
 */
export const contactMoveRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("moveWithinDay"),
      toHour: z.number().int().min(0).max(23),
      toMinute: z.number().int().min(0).max(59),
      expectedContactVersion: z.number().int().positive(),
      /**
       * Constrained to the audit trail's own id grammar, the same way `auditableIdentifier` does it
       * at the route boundary: free text is refused here rather than travelling into the audit path,
       * where it would be rejected too late to matter.
       */
      idempotencyKey: z.string().refine(isAccessObjectIdShape, { message: "must be an identifier, not free text" }),
    })
    .strict(),
]);

export type ContactMoveRequestBody = z.infer<typeof contactMoveRequestSchema>;
