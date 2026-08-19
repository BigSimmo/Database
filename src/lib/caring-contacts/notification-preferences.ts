// src/lib/caring-contacts/notification-preferences.ts
//
// Per-user, per-alert-class opt-in notification preferences.
//
// Contract (spec §4.2): alerts contain no patient identifiers and require authentication;
// opt-in happens per user, per alert class, and a preview must demonstrate the identifier-free
// alert body before a user opts in. Two rules follow directly:
//
//   * a brand-new user starts opted IN TO NOTHING. Silence is the safe default -- an
//     over-notified user is an inconvenience, but a user auto-subscribed to something they never
//     agreed to receive is the failure mode this module exists to prevent. Opt-in only ever adds,
//     it is never assumed.
//   * `alertBodyFor` returns a body built only from the alert class (named in plain words) and a
//     count. It can never carry a name, a mobile number, a patient id, or a plan id, because it
//     is never handed one -- the function's own signature has nowhere for that data to enter.
import type { ActorId } from "./ids";

export type AlertClass =
  | "unclaimedWorkEscalation"
  | "permanentDeliveryFailure"
  | "serviceSafetyStop"
  | "exceptionBacklog"
  | "pathwayRetired";

export const ALERT_CLASSES: readonly AlertClass[] = Object.freeze([
  "unclaimedWorkEscalation",
  "permanentDeliveryFailure",
  "serviceSafetyStop",
  "exceptionBacklog",
  "pathwayRetired",
]);

export type NotificationPreferences = {
  actorId: ActorId;
  optedIn: readonly AlertClass[];
};

/** A new user is opted in to nothing. Opt-in is additive and explicit, never assumed. */
export function defaultNotificationPreferences(actorId: ActorId): NotificationPreferences {
  return Object.freeze({ actorId, optedIn: Object.freeze([]) });
}

/**
 * Adds or removes a single alert class from `preferences.optedIn` without disturbing any other
 * class's membership. Idempotent: opting in to an already-opted-in class (or out of an
 * already-opted-out one) leaves `optedIn` set-equal to what it was.
 */
export function setAlertOptIn(
  preferences: NotificationPreferences,
  alertClass: AlertClass,
  optedIn: boolean,
): NotificationPreferences {
  const withoutClass = preferences.optedIn.filter((existing) => existing !== alertClass);
  const nextOptedIn = optedIn ? [...withoutClass, alertClass] : withoutClass;
  return Object.freeze({ actorId: preferences.actorId, optedIn: Object.freeze(nextOptedIn) });
}

const ALERT_CLASS_LABELS: Record<AlertClass, string> = {
  unclaimedWorkEscalation: "unclaimed work escalation",
  permanentDeliveryFailure: "permanent delivery failure",
  serviceSafetyStop: "service safety stop",
  exceptionBacklog: "exception backlog",
  pathwayRetired: "pathway retired",
};

/**
 * The identifier-free preview body the spec requires: names the alert class in plain words and a
 * count, nothing else. There is no parameter through which a name, mobile number, patient id, or
 * plan id could reach this string.
 */
export function alertBodyFor(alertClass: AlertClass, count: number): string {
  const label = ALERT_CLASS_LABELS[alertClass];
  const noun = count === 1 ? "item" : "items";
  return `${count} ${noun} affected by ${label}.`;
}
