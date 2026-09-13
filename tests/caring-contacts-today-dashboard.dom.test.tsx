import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayDashboard } from "@/components/caring-contacts/workspace/today-dashboard";
import type { ScheduleDay } from "@/lib/caring-contacts/schedule-view";
import type { ServiceState } from "@/lib/caring-contacts/service-state";
import type { TeamWorkloadView } from "@/lib/caring-contacts/team-workload";
import { actorId, contactId, patientId, planId, teamId } from "@/lib/caring-contacts/ids";

const dummyServiceState: ServiceState = {
  stopped: false,
  reportedByTeamId: teamId("team-test"),
};

const emptyScheduleDay: ScheduleDay = {
  calendarDay: "2026-09-12",
  windows: [
    {
      preference: "morning",
      label: "Morning (09:00 - 11:00)",
      sendTime: "09:00",
      entries: [],
      counts: {
        total: 0,
        alreadySent: 0,
        stillToSend: 0,
        willNotBeSent: 0,
        due: 0,
        held: 0,
        needsReview: 0,
      },
    },
    {
      preference: "afternoon",
      label: "Afternoon (12:00 - 14:00)",
      sendTime: "12:00",
      entries: [],
      counts: {
        total: 0,
        alreadySent: 0,
        stillToSend: 0,
        willNotBeSent: 0,
        due: 0,
        held: 0,
        needsReview: 0,
      },
    },
    {
      preference: "earlyEvening",
      label: "Early Evening (16:00 - 18:00)",
      sendTime: "16:00",
      entries: [],
      counts: {
        total: 0,
        alreadySent: 0,
        stillToSend: 0,
        willNotBeSent: 0,
        due: 0,
        held: 0,
        needsReview: 0,
      },
    },
  ],
  outsideApprovedWindows: {
    entries: [],
    counts: {
      total: 0,
      alreadySent: 0,
      stillToSend: 0,
      willNotBeSent: 0,
      due: 0,
      held: 0,
      needsReview: 0,
    },
  },
  exceptions: {
    entries: [],
    counts: {
      total: 0,
      alreadySent: 0,
      stillToSend: 0,
      willNotBeSent: 0,
      due: 0,
      held: 0,
      needsReview: 0,
    },
  },
  counts: {
    total: 0,
    alreadySent: 0,
    stillToSend: 0,
    willNotBeSent: 0,
    due: 0,
    held: 0,
    needsReview: 0,
  },
  disposition: "noContactsPlanned",
};

const emptyTeamWorkload: TeamWorkloadView = {
  asAtIso: "2026-09-12T12:00:00+08:00",
  coordinators: [],
  unclaimed: {
    plans: 0,
    escalated: 0,
    oldestMinutesUnclaimed: null,
    state: "noUnclaimedWork",
    clearedBy: null,
    exceptionBacklog: { contacts: 0, oldestMinutesSinceScheduledSend: null },
  },
  thresholdMinutes: 60,
};

describe("TodayDashboard — Empty State", () => {
  it("renders onboarding guidance and never the placeholder 'What this screen will show'", () => {
    const { container } = render(
      <TodayDashboard
        scheduleDay={emptyScheduleDay}
        teamWorkload={emptyTeamWorkload}
        serviceState={dummyServiceState}
        todayCalendarDay="2026-09-12"
      />,
    );

    expect(container.textContent).not.toContain("What this screen will show");
    expect(screen.getByTestId("caring-contacts-today-empty")).toBeInTheDocument();
    expect(screen.getByText("No caring contacts active today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New care plan/i })).toHaveAttribute("href", "/caring-contacts/plans/new");
    expect(screen.getByRole("link", { name: /Manual referral intake/i })).toHaveAttribute(
      "href",
      "/caring-contacts/intake",
    );
  });
});

describe("TodayDashboard — Active Caseload", () => {
  const activeScheduleDay: ScheduleDay = {
    ...emptyScheduleDay,
    counts: {
      total: 3,
      alreadySent: 0,
      stillToSend: 3,
      willNotBeSent: 0,
      due: 2,
      held: 0,
      needsReview: 1,
    },
    disposition: "contactsDue",
    windows: [
      {
        ...emptyScheduleDay.windows[0],
        counts: {
          total: 2,
          alreadySent: 0,
          stillToSend: 2,
          willNotBeSent: 0,
          due: 2,
          held: 0,
          needsReview: 0,
        },
        entries: [
          {
            planId: planId("plan-alpha"),
            patientId: patientId("pt-001"),
            contactId: contactId("ct-001"),
            planState: "active",
            contactVersion: 1,
            calendarDay: "2026-09-12",
            sendAt: new Date("2026-09-12T01:00:00Z"),
            cadenceLabel: "Week 1",
            messageType: "standard",
            state: "scheduled",
            sendability: "stillToSend",
            planHold: null,
            isDue: true,
            notSendingReason: null,
            needsReview: false,
          },
        ],
      },
      emptyScheduleDay.windows[1],
      emptyScheduleDay.windows[2],
    ],
    exceptions: {
      counts: {
        total: 1,
        alreadySent: 0,
        stillToSend: 1,
        willNotBeSent: 0,
        due: 0,
        held: 0,
        needsReview: 1,
      },
      entries: [
        {
          planId: planId("plan-beta"),
          patientId: patientId("pt-002"),
          contactId: contactId("ct-002"),
          planState: "active",
          contactVersion: 2,
          calendarDay: "2026-09-12",
          sendAt: new Date("2026-09-12T01:00:00Z"),
          cadenceLabel: "Month 1",
          messageType: "standard",
          state: "notDelivered",
          sendability: "willNotBeSent",
          planHold: null,
          isDue: false,
          notSendingReason: "missed",
          needsReview: true,
        },
      ],
    },
  };

  const activeTeamWorkload: TeamWorkloadView = {
    asAtIso: "2026-09-12T12:00:00+08:00",
    coordinators: [
      {
        actorId: actorId("coordinator-sarah"),
        activePlans: 4,
        heldPlans: [],
        coveredByAnother: 0,
        coveringForAnother: 0,
        exceptionBacklog: { contacts: 1, oldestMinutesSinceScheduledSend: 120 },
      },
    ],
    unclaimed: {
      plans: 2,
      escalated: 1,
      oldestMinutesUnclaimed: 75,
      state: "escalated",
      clearedBy: "aCoordinatorClaimsThePlan",
      exceptionBacklog: { contacts: 0, oldestMinutesSinceScheduledSend: null },
    },
    thresholdMinutes: 60,
  };

  it("populates urgent triage bar, severity tags, and action queue links", () => {
    render(
      <TodayDashboard
        scheduleDay={activeScheduleDay}
        teamWorkload={activeTeamWorkload}
        serviceState={dummyServiceState}
        todayCalendarDay="2026-09-12"
      />,
    );

    // Urgent Triage Bar rendered
    expect(screen.getByTestId("caring-contacts-urgent-triage")).toBeInTheDocument();
    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Unclaimed cases")).toBeInTheDocument();

    // Escalated tag present
    expect(screen.getByText("Escalated (>60m)")).toBeInTheDocument();

    // Action Queue
    expect(screen.getByTestId("caring-contacts-action-queue")).toBeInTheDocument();
    expect(screen.getByText("pt-001")).toBeInTheDocument();
    expect(screen.getByText("pt-002")).toBeInTheDocument();
    expect(screen.getByText("Review: notDelivered")).toBeInTheDocument();

    // Links present and valid
    const reviewPatientLink = screen.getByRole("link", { name: /Review Patient/i });
    expect(reviewPatientLink).toHaveAttribute("href", "/caring-contacts/patients/pt-002?plan=plan-beta");

    const viewPlanLink = screen.getByRole("link", { name: /View Plan/i });
    expect(viewPlanLink).toHaveAttribute("href", "/caring-contacts/patients/pt-001?plan=plan-alpha");

    // Team caseload rendered
    expect(screen.getByTestId("caring-contacts-team-caseload")).toBeInTheDocument();
    expect(screen.getByText("coordinator-sarah")).toBeInTheDocument();
  });

  it("shows a service-wide stop instead of claiming dispatches are ready or running", () => {
    render(
      <TodayDashboard
        scheduleDay={activeScheduleDay}
        teamWorkload={activeTeamWorkload}
        serviceState={{
          stopped: true,
          reportedByTeamId: teamId("team-test"),
          reason: "audit-integrity-loss",
          stoppedBy: actorId("incident-lead"),
          stoppedAt: "2026-09-12T12:00:00+08:00",
          note: "Test-only incident",
          restartApprovals: [],
        }}
        todayCalendarDay="2026-09-12"
      />,
    );

    expect(screen.getByText("Dispatch stopped")).toBeInTheDocument();
    expect(screen.getByText("All dispatches held by emergency stop")).toBeInTheDocument();
    expect(screen.queryByText("Dispatch ready")).toBeNull();
    expect(screen.queryByText("Dispatches running")).toBeNull();
  });

  it("includes due contacts outside approved windows in the action queue", () => {
    const outsideEntry = {
      ...activeScheduleDay.windows[0].entries[0],
      contactId: contactId("ct-outside"),
      patientId: patientId("pt-outside"),
      planId: planId("plan-outside"),
    };
    render(
      <TodayDashboard
        scheduleDay={{
          ...activeScheduleDay,
          windows: emptyScheduleDay.windows,
          outsideApprovedWindows: {
            entries: [outsideEntry],
            counts: { ...emptyScheduleDay.outsideApprovedWindows.counts, total: 1, stillToSend: 1, due: 1 },
          },
        }}
        teamWorkload={activeTeamWorkload}
        serviceState={dummyServiceState}
        todayCalendarDay="2026-09-12"
      />,
    );

    expect(screen.getByText("pt-outside")).toBeInTheDocument();
    expect(screen.getByText("Due outside approved window")).toBeInTheDocument();
  });
});
