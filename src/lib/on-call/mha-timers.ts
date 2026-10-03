import mhaTimeframes from "../../../data/mha-timeframes.json";
import { isNamedPerson, ruleContentSha256, ruleGate, type RuleGate, type RuleSignOff } from "@/lib/admin/rule-sign-off";
import { isReviewedTimeframe, timelineFor, type MhaTimeframeEntry, type MhaTimeframesFile } from "@/lib/mha-timeline";

/**
 * Mental Health Act 2014 (WA) countdowns for the On Call Today page.
 *
 * NO FIGURES LIVE HERE. Every duration, quote and section comes from the governed timeframe data
 * (`data/mha-timeframes.json`, read through `timelineFor` in `src/lib/mha-timeline.ts`), which pins
 * each entry to the verbatim Act text. This module adds only the per-order countdown and two
 * extra locks, because a live countdown for a real patient is a step beyond the form-page Timeline:
 *
 * 1. Each entry must be signed off by a NAMED clinician. The nine shipped entries are marked
 *    reviewed by "PsychSift", which `isNamedPerson` rejects, so today every entry is quote-only.
 * 2. The countdown switch (`MHA_TIMER_SWITCH`) must be signed by a named clinician over the exact
 *    entries and pins it covers, and must record that the medical-device ruling was re-checked
 *    for per-patient countdowns (the Today plan, "Safety, privacy and clinical sign-off").
 *    Re-signing any timeframe changes its pin and turns the switch off until it is signed again.
 *
 * Patient labels: a timer is identified only by the caller's opaque `timerId`. This module never
 * sees or stores a bed number or initials; a caller that shows one keeps it in the on-device
 * patient-label store that is wiped at shift end and sign-out, never in the database.
 *
 * These are memory aids, not legal advice: the Act, not this countdown, decides when a period ends.
 */

const shippedEntries = (mhaTimeframes as MhaTimeframesFile).entries;

/** What the countdown switch is signed over. Changing any of it needs a fresh sign-off. */
export type MhaTimerSwitchContent = {
  /** Every timeframe the switch covers, with the sign-off pin it was checked against. */
  readonly timeframes: readonly { readonly id: string; readonly reviewedContentSha256: string | null }[];
  /**
   * The date (YYYY-MM-DD) the owner confirmed or revised the medical-device ruling for per-patient
   * countdowns, and where that decision is written down. Null until then, which keeps the switch off.
   */
  readonly medicalDeviceRuling: { readonly confirmedOn: string; readonly record: string } | null;
};

export type MhaTimerSwitch = { readonly content: MhaTimerSwitchContent; readonly signOff: RuleSignOff };

/** The content a signer reviews: today's shipped entries and their current pins. */
export function currentMhaTimerSwitchContent(
  entries: readonly MhaTimeframeEntry[] = shippedEntries,
  medicalDeviceRuling: MhaTimerSwitchContent["medicalDeviceRuling"] = null,
): MhaTimerSwitchContent {
  return {
    timeframes: entries.map((entry) => ({ id: entry.id, reviewedContentSha256: entry.reviewedContentSha256 })),
    medicalDeviceRuling,
  };
}

/** Shipped OFF and unsigned. Only a named clinician fills in `signOff`; agents never do. */
export const MHA_TIMER_SWITCH: MhaTimerSwitch = {
  content: currentMhaTimerSwitchContent(),
  signOff: { enabled: false, signedBy: null, signedAt: null, signedContentSha256: null },
};

export type MhaTimerGate =
  RuleGate | { readonly on: false; readonly reason: "medical-device-ruling-pending" | "stale-switch" };

/** Whether countdowns may run at all. Fails closed. */
export function mhaTimerGate(
  timerSwitch: MhaTimerSwitch = MHA_TIMER_SWITCH,
  entries: readonly MhaTimeframeEntry[] = shippedEntries,
): MhaTimerGate {
  const signed = ruleGate(timerSwitch.signOff, timerSwitch.content);
  if (!signed.on) return signed;
  if (timerSwitch.content.medicalDeviceRuling === null) return { on: false, reason: "medical-device-ruling-pending" };
  // The switch must cover today's entries with today's pins: a re-signed or added timeframe
  // needs the switch signed again.
  const current = ruleContentSha256(currentMhaTimerSwitchContent(entries).timeframes);
  if (ruleContentSha256(timerSwitch.content.timeframes) !== current) return { on: false, reason: "stale-switch" };
  return { on: true };
}

/** One order the user is tracking. `timerId` is opaque: never a name, bed number or initials. */
export type MhaTimerInput = { readonly timerId: string; readonly formCode: string; readonly madeAt: Date };

export type MhaTimerQuoteOnlyReason =
  /** The countdown switch is off; `MhaTimersResult.gate` says why. */
  | "switched-off"
  /** Not signed off at all, or the pin no longer matches. */
  | "awaiting-review"
  /** Signed off, but by a system name such as "PsychSift" rather than a named clinician. */
  | "awaiting-named-sign-off"
  /** The Act ends this period at a second event the start time cannot see (`computeAllowed: false`). */
  | "not-calculable"
  /** The start time given is not a real instant. */
  | "invalid-start";

export type MhaTimerItem =
  | {
      readonly kind: "countdown";
      readonly timerId: string;
      readonly entry: MhaTimeframeEntry;
      readonly deadline: Date;
      /** Milliseconds from `now` to the deadline; negative once it has passed. */
      readonly remainingMs: number;
      readonly expired: boolean;
    }
  | {
      readonly kind: "quote-only";
      readonly timerId: string;
      readonly entry: MhaTimeframeEntry;
      readonly reason: MhaTimerQuoteOnlyReason;
    };

export type MhaTimersResult = { readonly gate: MhaTimerGate; readonly items: readonly MhaTimerItem[] };

/**
 * Every time limit that applies to each tracked order. Countdowns come first, soonest deadline
 * first; quote-only items follow in input order, so the Act's words are always on screen even
 * when nothing may be counted. "Due soon" banding is left to the screen: this module invents no
 * warning threshold.
 */
export function mhaTimers(
  inputs: readonly MhaTimerInput[],
  now: Date,
  options: { readonly timerSwitch?: MhaTimerSwitch; readonly entries?: readonly MhaTimeframeEntry[] } = {},
): MhaTimersResult {
  const entries = options.entries ?? shippedEntries;
  const gate = mhaTimerGate(options.timerSwitch ?? MHA_TIMER_SWITCH, entries);
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) throw new Error("mhaTimers: invalid now");

  const countdowns: Extract<MhaTimerItem, { kind: "countdown" }>[] = [];
  const quoteOnly: Extract<MhaTimerItem, { kind: "quote-only" }>[] = [];

  for (const input of inputs) {
    const validStart = !Number.isNaN(input.madeAt.getTime());
    for (const item of timelineFor(input.formCode, validStart ? input.madeAt : null, entries)) {
      const { entry } = item;
      const quote = (reason: MhaTimerQuoteOnlyReason) =>
        quoteOnly.push({ kind: "quote-only", timerId: input.timerId, entry, reason });
      if (item.quoteOnly) {
        quote(item.reason === "not-calculable" ? "not-calculable" : "awaiting-review");
      } else if (!isReviewedTimeframe(entry) || !isNamedPerson(entry.reviewedBy)) {
        quote("awaiting-named-sign-off");
      } else if (!gate.on) {
        quote("switched-off");
      } else if (!validStart || item.deadline === null) {
        quote("invalid-start");
      } else {
        const remainingMs = item.deadline.getTime() - nowMs;
        countdowns.push({
          kind: "countdown",
          timerId: input.timerId,
          entry,
          deadline: item.deadline,
          remainingMs,
          expired: remainingMs <= 0,
        });
      }
    }
  }

  countdowns.sort((a, b) => a.deadline.getTime() - b.deadline.getTime() || a.timerId.localeCompare(b.timerId));
  return { gate, items: [...countdowns, ...quoteOnly] };
}
