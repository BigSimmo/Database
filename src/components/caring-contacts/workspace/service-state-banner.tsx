import { OctagonX } from "lucide-react";

import {
  describeServiceStop,
  type ServiceState,
  type ServiceStopBannerFacts,
} from "@/lib/caring-contacts/service-state";

import { UnavailableDestination } from "./unavailable-destination";

/**
 * The state word, in plain language, carried as text.
 *
 * Not a transport word: "Not delivered" describes one message, and this
 * describes the whole service. Nothing here is ever a patient-state label.
 */
const SERVICE_STOP_STATE_LABEL = "Sending stopped";

/**
 * The rendering half of the banner, and the reason this file has two functions.
 *
 * `ServiceState` carries `note` — free text a responder types mid-incident, which
 * the sealed domain classifies as patient data because it routinely names a
 * patient, a number or a ward. This banner renders on EVERY screen, to EVERY
 * team, including teams that had no part in the incident (spec §4.2), so the note
 * must not merely be left unrendered; it must be out of reach.
 *
 * `ServiceStopBannerFacts` omits `note` by construction, so inside this function
 * the note is not in scope at all and a later edit that tries to show it is a
 * type error rather than a judgement call. That is why the JSX lives here and
 * not in `ServiceStateBanner` below, where the whole state IS in scope: a
 * comment asking a future editor not to interpolate a field sitting in scope is
 * not a guarantee, and the difference between the two functions is the guarantee.
 */
function StoppedServiceBanner({ facts }: { facts: ServiceStopBannerFacts }) {
  // The one source of the banner's wording. `describeServiceStop` returns the
  // categorised reason in plain words, the count of restart approvals recorded
  // out of three, and the roles still outstanding — so what stopped sending,
  // and what would start it again, are stated together and stated here.
  const explanation = describeServiceStop(facts);
  if (explanation === null) return null;

  return (
    <div
      role="status"
      data-testid="caring-contacts-service-state-banner"
      className="flex min-w-0 flex-col gap-2 border-b border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 sm:px-6 lg:px-8 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas]"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--danger-text)] forced-colors:text-[CanvasText]">
        <OctagonX aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="min-w-0">{SERVICE_STOP_STATE_LABEL}</span>
      </p>
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text)]">{explanation}</p>
      {/*
        Ruling 52 and `docs/wiring-conventions.md`: `CARING_CONTACTS_ROUTES.serviceStop`
        has no page until Plan 2B builds it, so this states its reason instead of
        linking into a not-found page. Adding the `<Link href={…}>` is the whole of
        that later change; nothing else here moves.
      */}
      <UnavailableDestination
        id="service-state-banner"
        label="Service stop"
        reason="Recording what stopped sending, and the three approvals from three different people that start it again."
        className="inline-flex min-h-tap w-fit items-center rounded-[var(--radius-md)] border border-[color:var(--danger-border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--text)]"
      />
    </div>
  );
}

/**
 * The service-wide safety stop, stated on every screen while it is active.
 *
 * `null` while the service is running. Spec §4.2 makes this service-wide rather
 * than per-team on purpose: the stop is evidence that the sending path itself
 * cannot currently be trusted, so a team with no part in the incident still has
 * to learn that sending is halted — on every screen, including screens showing
 * no patient at all.
 *
 * The signature takes the whole `ServiceState` because that is what a caller
 * holds. It reads exactly three of its fields and hands them to the narrowed
 * renderer above; `note` is read nowhere and reaches no JSX.
 */
export function ServiceStateBanner({ state }: { state: ServiceState }) {
  if (!state.stopped) return null;
  return (
    <StoppedServiceBanner facts={{ stopped: true, reason: state.reason, restartApprovals: state.restartApprovals }} />
  );
}
