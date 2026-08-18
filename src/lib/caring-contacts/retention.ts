// src/lib/caring-contacts/retention.ts
//
// Retention policy and de-identification for caring-contact episodes and their audit trail.
//
// Contract (decision lock, 2026-08-19):
//   * DEFAULT_RETENTION_POLICY holds the one hard-coded retention period in this module -- every
//     other file in this directory reaches for it (or an explicit override) rather than repeating
//     the number. A sibling-scanning test in this suite enforces that.
//   * an episode becomes due for de-identification only once it has reached a terminal state AND
//     the policy period has elapsed since it did, measured in AWST calendar days -- never UTC, and
//     never from any other milestone.
//   * de-identifying an episode removes everything that identifies the patient (name, mobile,
//     identifiers, cultural identity) and keeps everything needed for aggregate reporting (plan
//     dates, pathway version, team, outcome, counts).
//   * de-identifying an audit event keeps only the five fields that tell the story of what
//     happened -- actor id, action, timestamp, object type, outcome -- and drops everything else,
//     including the object id, which could otherwise point back at a specific patient's record.
//   * both de-identification functions are idempotent: applying either a second time returns the
//     same value as applying it once, so a caller never has to track whether it already ran.
import type { AuditEvent, AuditOutcome } from "./audit";
import { awstCalendarDay } from "./clock";
import type { Clock } from "./clock";
import type { ActorId, PathwayVersionId, TeamId } from "./ids";

export type RetentionPolicy = { years: number };

/** The one hard-coded retention period in this domain. Callers may override it per call. */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = Object.freeze({ years: 7 });

export type EpisodeState = "draft" | "active" | "paused" | "withdrawn" | "cancelled" | "completed";

const TERMINAL_EPISODE_STATES: readonly EpisodeState[] = Object.freeze(["withdrawn", "cancelled", "completed"]);

export type EpisodeCounts = {
  contactsScheduled: number;
  contactsSent: number;
  contactsDelivered: number;
};

export type EpisodePlanDates = {
  dischargeAt: Date;
  /** The instant the episode reached its terminal state; null while it is still open. */
  completedAt: Date | null;
};

export type Episode = {
  state: EpisodeState;
  patientName: string;
  patientMobileNumber: string;
  patientIdentifiers: readonly string[];
  culturalIdentity: string | null;
  planDates: EpisodePlanDates;
  pathwayVersionId: PathwayVersionId;
  teamId: TeamId;
  outcome: string;
  counts: EpisodeCounts;
};

export type DeidentifiedEpisode = {
  state: EpisodeState;
  planDates: EpisodePlanDates;
  pathwayVersionId: PathwayVersionId;
  teamId: TeamId;
  outcome: string;
  counts: EpisodeCounts;
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Adds whole years to an AWST calendar day, clamping 29 Feb to 28 Feb in a non-leap target year. */
function addYearsToCalendarDay(calendarDay: string, years: number): string {
  const [year, month, day] = calendarDay.split("-").map(Number);
  const targetYear = year + years;
  const clampedDay = Math.min(day, daysInMonth(targetYear, month));
  return `${String(targetYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * True only once an episode has reached a terminal state and `policy.years` whole years have
 * elapsed since it did, both sides measured as an AWST calendar day. An episode that has not
 * completed, or whose completion instant is unknown, is never due.
 */
export function isDueForDeidentification(episode: Episode, policy: RetentionPolicy, clock: Clock): boolean {
  if (!TERMINAL_EPISODE_STATES.includes(episode.state)) return false;
  if (episode.planDates.completedAt === null) return false;

  const completedCalendarDay = awstCalendarDay(episode.planDates.completedAt);
  const dueCalendarDay = addYearsToCalendarDay(completedCalendarDay, policy.years);
  const nowCalendarDay = awstCalendarDay(clock.now());
  return nowCalendarDay >= dueCalendarDay;
}

/**
 * Removes patient name, mobile number, identifiers, and cultural identity; keeps plan dates,
 * pathway version, team, outcome, and counts. Accepts an already-de-identified episode too, so
 * applying it twice is exactly the same as applying it once.
 */
export function deidentifyEpisode(episode: Episode | DeidentifiedEpisode): DeidentifiedEpisode {
  const { state, planDates, pathwayVersionId, teamId, outcome, counts } = episode;
  return Object.freeze({
    state,
    planDates: Object.freeze({ ...planDates }),
    pathwayVersionId,
    teamId,
    outcome,
    counts: Object.freeze({ ...counts }),
  });
}

export type DeidentifiedAuditEvent = {
  actorId: ActorId;
  action: string;
  timestamp: string;
  objectType: string;
  outcome: AuditOutcome;
  /** Always cleared: the object id can point back at a specific patient's record. */
  objectId: string;
};

/**
 * Keeps exactly actor id, action, timestamp, object type, and outcome; clears object id and drops
 * every other field (actor roles, team id, idempotency key). Accepts an already-de-identified
 * event too, so applying it twice is exactly the same as applying it once.
 */
export function deidentifyAuditEvent(event: AuditEvent | DeidentifiedAuditEvent): DeidentifiedAuditEvent {
  const { actorId, action, timestamp, objectType, outcome } = event;
  return Object.freeze({ actorId, action, timestamp, objectType, outcome, objectId: "" });
}
