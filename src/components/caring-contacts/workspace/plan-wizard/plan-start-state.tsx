import { CircleAlert } from "lucide-react";
import Link from "next/link";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import type { ReferralState } from "@/lib/caring-contacts/model";

import { ListEmptyState } from "../list-empty-state";
import { StatedReason } from "./stated-reason";

/**
 * Every reason the activation wizard does not start, said honestly.
 *
 * A Server Component with no hooks, deliberately: none of these states needs the wizard's client
 * boundary, and rendering them on the server means the whole screen still says something useful
 * with JavaScript turned off, exactly as the workspace's other screens do.
 *
 * RULING [111] SETS THE RULE THESE STATES OBEY. A referral this actor may not see is not an error
 * to explain in detail and is never a 404: a 404 would distinguish "no such referral" from
 * "another team's", and the store deliberately answers those two identically so that nobody can
 * find out a record exists by being refused it. So the answer here is one answer for both, and it
 * says so in words rather than leaving a clinician to guess which they hit.
 *
 * THE REMEDIES ARE REAL (Ruling 93). Where nothing on this screen can change the state, that is
 * what the remedy says. Naming a control that does not exist is worse than naming none, because
 * the reader will hunt for it — and referrals are not listed anywhere in this workspace yet, so
 * there is deliberately no "find a referral" link offered below.
 */
export type PlanStartState =
  /** The acting role cannot start a caring-contact plan at all. Decided from the ACTOR. */
  | { kind: "not-permitted" }
  /** The URL named no referral. */
  | { kind: "no-referral-named" }
  /** The URL named one this actor may not see — no such referral, or another team's, indistinguishably. */
  | { kind: "referral-not-visible" }
  /** A referral this actor may see, which has not been accepted. */
  | { kind: "referral-not-accepted"; referralId: string; state: ReferralState };

/**
 * Plain words for a referral's state.
 *
 * A `Record<ReferralState, string>` rather than a switch with a fallback: a state added to the
 * union and left unlabelled stops this file compiling, instead of rendering a clinician the raw
 * identifier or, worse, a stale label belonging to a different state.
 */
const REFERRAL_STATE_LABELS: Record<ReferralState, string> = {
  awaitingHandover: "waiting to be handed over",
  accepted: "accepted",
  returnedForClarification: "returned for clarification",
  declined: "declined",
};

const backClass =
  "inline-flex min-h-tap min-w-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border-[CanvasText]";

function BackToCaseload() {
  return (
    <Link href={CARING_CONTACTS_ROUTES.patients} data-internal-link="true" className={backClass}>
      Back to this team&rsquo;s patients
    </Link>
  );
}

export function PlanStartStateNotice({ state }: { state: PlanStartState }) {
  switch (state.kind) {
    case "not-permitted":
      return (
        <ListEmptyState
          kind="not-permitted"
          heading="Starting a plan is not part of this role"
          because="Putting a patient onto a caring-contact plan needs a role that may both read the referral it starts from and claim a plan for it. The role you are acting in holds neither, or only one of them, so this screen cannot begin."
          changedBy="Nothing on this screen changes it, and there is no control for it anywhere in this workspace. The role this demonstration acts in is set outside the interface; a coordinator can start a plan."
          action={<BackToCaseload />}
        />
      );
    case "no-referral-named":
      return (
        <ListEmptyState
          kind="no-data"
          heading="No referral named"
          explanation="A caring-contact plan is always started for a referral this team has accepted, and the link that opens this screen is what names which one. Nothing named one here, so there is nothing to start. Referrals are not listed anywhere in this workspace yet, so there is no control on this page that can pick one."
          action={<BackToCaseload />}
        />
      );
    case "referral-not-visible":
      return (
        <ListEmptyState
          kind="not-permitted"
          heading="That referral is not one you can open"
          because="The referral named in the link is not among the ones this team holds. A referral that does not exist and a referral belonging to another team give the same answer here, on purpose, so that nobody can find out a record exists by being refused it."
          changedBy="Opening this screen from a referral this team has accepted starts a plan for it. Nothing on this page can reach the one that was named."
          action={<BackToCaseload />}
        />
      );
    case "referral-not-accepted":
      return (
        <div className="flex min-w-0 flex-col gap-4">
          <StatedReason
            heading="This referral has not been accepted"
            because={`${state.referralId} is ${REFERRAL_STATE_LABELS[state.state]}. A plan is created for a referral a team has taken responsibility for, and accepting it is also where the pathway can first be named, so a plan cannot be started before that.`}
            changedBy="Accepting the referral. That is done where referrals are handled, which is not built in this workspace yet, so nothing on this page changes it."
            icon={<CircleAlert aria-hidden="true" className="size-icon-md shrink-0" />}
          />
          <div>
            <BackToCaseload />
          </div>
        </div>
      );
    default: {
      const unstated: never = state;
      return unstated;
    }
  }
}
