import type { OnCallYouCalled } from "@/lib/on-call/call-marks";
import type { OnCallCallNowStep } from "@/lib/on-call/call-now";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import { compareOnCallTeams, type OnCallTeam } from "@/lib/on-call/handbook-title";
import { resolveHandbookPhone, type HandbookDial, type OnCallPeriod } from "@/lib/on-call/number-resolver";
import { perthTimeOf } from "@/lib/roster/shifts/perth-time";

/**
 * Now's row rules, pure so the page and its tests agree (plan 2.2, v6 Now).
 *
 * Nothing here invents a person or a number: every row is a published
 * handbook contact, the reader's own ladder step, or nothing at all.
 */

/** "Your team" shows three roles. */
export const ON_CALL_TEAM_ROW_LIMIT = 3;
/** The team whose first contact takes the last "Your team" slot after hours. */
export const ON_CALL_AFTER_HOURS_MANAGER: OnCallTeam = "After-hours manager";

function contacts(items: readonly HandbookItem[]): HandbookItem[] {
  return items.filter((item) => item.section === "contacts");
}

/** Every team the handbook's contacts name, common teams first (`ON_CALL_TEAMS` order), then by name. */
export function handbookTeams(items: readonly HandbookItem[]): OnCallTeam[] {
  const teams = new Set<OnCallTeam>();
  for (const item of contacts(items)) if (item.parsed.team) teams.add(item.parsed.team);
  return [...teams].sort(compareOnCallTeams);
}

/**
 * "Your team" (review F18):
 *  1. the contacts filed under the reader's team, in label order;
 *  2. in hours, up to three of them;
 *  3. after hours, up to two, then the first after-hours manager contact, only
 *     when one is recorded (no placeholder when none is);
 *  4. with no team chosen, the after-hours rule still applies;
 *  5. the manager is never listed twice.
 *
 * `period` is the HOSPITAL's period (`onCallHospitalPeriod`), not the app's
 * weekday rule: Now adapts to after hours only once the hospital has set its
 * times (owner, 19:06Z). Until then Now passes `"in-hours"`.
 */
export function yourTeamRows(
  items: readonly HandbookItem[],
  myTeam: OnCallTeam | null,
  period: OnCallPeriod,
): HandbookItem[] {
  const all = contacts(items);
  const team = myTeam ? all.filter((item) => item.parsed.team === myTeam) : [];
  if (period === "in-hours") return team.slice(0, ON_CALL_TEAM_ROW_LIMIT);
  const manager = all.find((item) => item.parsed.team === ON_CALL_AFTER_HOURS_MANAGER) ?? null;
  const own = team.filter((item) => item !== manager);
  if (!manager) return own.slice(0, ON_CALL_TEAM_ROW_LIMIT);
  return [...own.slice(0, ON_CALL_TEAM_ROW_LIMIT - 1), manager];
}

/** The hospital's switchboard: a contact titled "Switchboard" with no prefix. */
export function switchboardItem(items: readonly HandbookItem[]): HandbookItem | null {
  return (
    contacts(items).find(
      (item) => !item.parsed.prefix && !item.parsed.team && /^switchboard$/i.test(item.parsed.label.trim()),
    ) ?? null
  );
}

/**
 * The hospital's own after-hours window (Stage B field, set by each hospital's
 * editors; owner card 19:06Z). It does not exist in the database yet, so Now
 * passes `null` today and does not adapt.
 */
export type OnCallHospitalHours = {
  /** Perth wall clock, `HH:MM`, e.g. `17:30`. */
  readonly afterHoursFrom: string;
  /** Perth wall clock, `HH:MM`, e.g. `08:00`. */
  readonly afterHoursUntil: string;
};

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(time: string): number | null {
  const match = HH_MM.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** The hospital's period now, or null when the hospital has not set its times (or set them unreadably). */
export function onCallHospitalPeriod(hours: OnCallHospitalHours | null, now: Date): OnCallPeriod | null {
  if (!hours) return null;
  const from = minutesOf(hours.afterHoursFrom);
  const until = minutesOf(hours.afterHoursUntil);
  const at = minutesOf(perthTimeOf(now));
  if (from === null || until === null || at === null || from === until) return null;
  const after = from > until ? at >= from || at < until : at >= from && at < until;
  return after ? "after-hours" : "in-hours";
}

/**
 * The 24-hour day track (standard module 7 variant): the after-hours spans as
 * percentages of the day, and where "now" sits. Null without hospital times.
 */
export function onCallHoursTrack(
  hours: OnCallHospitalHours | null,
  now: Date,
): { readonly spans: readonly { readonly from: number; readonly to: number }[]; readonly now: number } | null {
  if (!hours || onCallHospitalPeriod(hours, now) === null) return null;
  const from = minutesOf(hours.afterHoursFrom) ?? 0;
  const until = minutesOf(hours.afterHoursUntil) ?? 0;
  const day = 24 * 60;
  const pct = (minutes: number) => Math.round((minutes / day) * 10_000) / 100;
  const spans =
    from > until
      ? [
          { from: 0, to: pct(until) },
          { from: pct(from), to: 100 },
        ]
      : [{ from: pct(from), to: pct(until) }];
  return { spans, now: pct(minutesOf(perthTimeOf(now)) ?? 0) };
}

/** The mark a ladder step called from Now records: an entry id and an order, never a number. */
export function onCallLadderStepMarkId(ladderId: string, order: number): string {
  return `ladder:${ladderId}:${order}`;
}

const LADDER_MARK = /^ladder:(.+):(\d+)$/;

/** What a number dials, as one comparable string: the `tel:` target, or the extension a desk phone keys. */
export function onCallDialKey(dial: HandbookDial | null): string | null {
  if (!dial) return null;
  return dial.tel ?? dial.copy ?? null;
}

export type OnCallLadder = {
  readonly id: string;
  readonly title: string;
  /** In the order "Who do I call now?" shows them: the steps for this hour first. */
  readonly steps: readonly OnCallCallNowStep[];
};

export type OnCallNeedsYou = {
  readonly ladderId: string;
  readonly ladderTitle: string;
  /** The rung the reader rang last, e.g. "Registrar". */
  readonly waitingOn: string;
  readonly calledAt: string;
  /** The next rung with a number. */
  readonly next: { readonly order: number; readonly whoToCall: string; readonly dial: HandbookDial };
};

/**
 * "Needs you" (v6 Now): the newest call the reader made to a rung of one of
 * their own Playbook ladders, and the next rung to ring.
 *
 * A call counts when it was made from Now's own "Needs you" row (a
 * `ladder:<id>:<order>` mark) or from any number row that dials exactly the
 * number the step records. Only the newest such call is considered, so ringing
 * the next rung moves the row on; a call to the last rung shows nothing. The
 * marks already expire after 12 hours. There is no wait time: the hospital's
 * ladder waits are a Stage B field (owner 19:06Z), so the row says when the
 * call was made and never that it is overdue.
 */
export function selectNeedsYou(input: {
  readonly ladders: readonly OnCallLadder[];
  readonly marks: readonly OnCallYouCalled[];
  /** What each number row this reader can see dials, by row id. */
  readonly dialKeys: ReadonlyMap<string, string>;
}): OnCallNeedsYou | null {
  const { ladders, marks, dialKeys } = input;
  const newestFirst = [...marks].sort((a, b) => b.calledAt.localeCompare(a.calledAt));
  for (const mark of newestFirst) {
    const hit = ladderStepFor(mark.entryId, ladders, dialKeys);
    if (!hit) continue;
    const { ladder, index } = hit;
    const waiting = ladder.steps[index];
    const nextStep = ladder.steps.slice(index + 1).find((step) => stepDial(step) !== null);
    const dial = nextStep ? stepDial(nextStep) : null;
    if (!nextStep || !dial) return null;
    return {
      ladderId: ladder.id,
      ladderTitle: ladder.title,
      waitingOn: waiting.whoToCall,
      calledAt: mark.calledAt,
      next: { order: nextStep.order, whoToCall: nextStep.whoToCall, dial },
    };
  }
  return null;
}

function stepDial(step: OnCallCallNowStep): HandbookDial | null {
  if (!step.phone) return null;
  const dial = resolveHandbookPhone(step.phone);
  return dial.kind === "none" || dial.kind === "text" ? null : dial;
}

function ladderStepFor(
  markId: string,
  ladders: readonly OnCallLadder[],
  dialKeys: ReadonlyMap<string, string>,
): { readonly ladder: OnCallLadder; readonly index: number } | null {
  const own = LADDER_MARK.exec(markId);
  if (own) {
    const ladder = ladders.find((candidate) => candidate.id === own[1]);
    const index = ladder ? ladder.steps.findIndex((step) => step.order === Number(own[2])) : -1;
    return ladder && index >= 0 ? { ladder, index } : null;
  }
  const key = dialKeys.get(markId);
  if (!key) return null;
  for (const ladder of ladders) {
    const index = ladder.steps.findIndex((step) => onCallDialKey(stepDial(step)) === key);
    if (index >= 0) return { ladder, index };
  }
  return null;
}
