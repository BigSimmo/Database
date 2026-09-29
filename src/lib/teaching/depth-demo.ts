import { addDays } from "@/lib/calendar/calendar-event";
import {
  unloggedReviewRows,
  type CpdReviewRow,
  type FeedbackTotals,
  type SessionRef,
  type SupervisionEntry,
  type SupervisionPairingView,
  type SupervisionTopic,
  type SupervisionType,
  type TeachRead,
} from "@/lib/teaching/depth-model";
import { DEMO_TEACHING_SERVICE_ID, DEMO_TEACHING_TEAM, demoTeachingLogbook } from "@/lib/teaching/demo-programme";
import { perthInstant } from "@/lib/teaching/time";

/*
 * The depth pages' made-up demo (part 4). Demo mode never calls the depth routes; the UI reads these,
 * and a demo "save" stays in page memory. Made-up people only; ids are fixed so a re-render keeps them,
 * and they never meet the demo programme's own ids.
 */

const id = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const team = { serviceId: DEMO_TEACHING_SERVICE_ID, serviceName: DEMO_TEACHING_TEAM.name, readOnlyUntil: null };

function demoEntry(
  n: number,
  date: string,
  minutes: number,
  type: SupervisionType,
  topics: SupervisionTopic[],
  confirmedOn: string | null,
): SupervisionEntry {
  return {
    entryId: id(n),
    date,
    minutes,
    type,
    topics,
    status: confirmedOn ? "confirmed" : "pending",
    confirmedAt: confirmedOn ? perthInstant(confirmedOn, "09:00") : null,
    confirmedByName: confirmedOn ? "Dr Demo Supervisor" : null,
    notes: [],
  };
}

function totals(entries: readonly SupervisionEntry[]) {
  const pending = entries.filter((entry) => entry.status === "pending");
  const sum = (list: readonly SupervisionEntry[]) => list.reduce((total, entry) => total + entry.minutes, 0);
  return {
    confirmedMinutes: sum(entries) - sum(pending),
    pendingMinutes: sum(pending),
    pendingCount: pending.length,
    oldestPendingAt: null,
  };
}

/** The demo reader is a registrar with Dr Demo Supervisor, and supervises Dr Demo Trainee. */
export function demoSupervision(today: string): SupervisionPairingView[] {
  const day = (offset: number) => addDays(today, offset);
  const mine = [
    demoEntry(201, day(-1), 60, "individual", ["case_review", "psychotherapy"], null),
    demoEntry(202, day(-3), 90, "group", ["case_review", "risk"], null),
    demoEntry(203, day(-10), 60, "individual", ["psychotherapy"], day(-9)),
    demoEntry(204, day(-17), 60, "individual", ["exam_prep"], day(-16)),
  ];
  const theirs = [
    demoEntry(211, day(-1), 60, "individual", ["formulation", "medication"], null),
    demoEntry(212, day(-9), 30, "group", ["risk"], null),
  ];
  const dates = { startsOn: day(-60), endsOn: day(120) };
  return [
    {
      ...team,
      ...dates,
      ...totals(mine),
      pairingId: id(101),
      access: "registrar",
      registrarName: "Dr Demo Registrar",
      supervisorName: "Dr Demo Supervisor",
      targetHours: 20,
      entries: mine,
    },
    {
      ...team,
      ...dates,
      ...totals(theirs),
      pairingId: id(102),
      access: "supervisor",
      registrarName: "Dr Demo Trainee",
      supervisorName: "Dr Demo Registrar",
      targetHours: null,
      entries: theirs,
    },
  ];
}

export function demoTeach(today: string): TeachRead {
  const talk = (n: number, title: string, offset: number): SessionRef => ({
    occurrenceId: id(n),
    serviceId: DEMO_TEACHING_SERVICE_ID,
    title,
    startsAt: perthInstant(addDays(today, offset), "12:30"),
    endsAt: perthInstant(addDays(today, offset), "13:30"),
  });
  const date = addDays(today, 6);
  return {
    upcoming: [
      {
        occurrenceId: id(301),
        serviceId: DEMO_TEACHING_SERVICE_ID,
        title: "Demo case-based discussion",
        startsAt: perthInstant(date, "08:00"),
        endsAt: perthInstant(date, "08:45"),
        venue: "Demo tutorial room",
        status: "scheduled",
        items: ["room", "slides_link"],
        deidConfirmedAt: null,
      },
    ],
    taught: [talk(302, "Demo topic A", -100), talk(303, "Demo topic B", -200)],
  };
}

export function demoFeedbackTotals(): FeedbackTotals {
  return {
    released: true,
    replies: 12,
    useful: { 1: 0, 2: 1, 3: 2, 4: 5, 5: 4 },
    pace: { slow: 1, right: 9, fast: 2 },
  };
}

export function demoFeedbackOpen(today: string): SessionRef[] {
  const date = addDays(today, -6);
  return [
    {
      occurrenceId: id(304),
      serviceId: DEMO_TEACHING_SERVICE_ID,
      title: "Demo grand round",
      startsAt: perthInstant(date, "12:30"),
      endsAt: perthInstant(date, "13:30"),
    },
  ];
}

export function demoCpdReview(now: Date): CpdReviewRow[] {
  return unloggedReviewRows(demoTeachingLogbook(now), now);
}
