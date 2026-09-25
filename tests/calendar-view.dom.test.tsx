import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarView } from "@/components/calendar/calendar-view";
import type { CalendarEvent } from "@/lib/calendar/calendar-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/cme/calendar" }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const EVENTS: CalendarEvent[] = [
  { id: "jc", title: "Journal club", date: "2026-09-15", kind: "due", recurrence: "monthly", href: "/cme/routines" },
  { id: "end", title: "End of the 2026 CPD year", date: "2026-12-31", kind: "deadline" },
  { id: "today", title: "Grand round", date: "2026-09-25", startTime: "12:30", kind: "logged" },
];

describe("calendar view", () => {
  it("opens on today's month with today's events listed under the grid", () => {
    render(<CalendarView events={EVENTS} today="2026-09-25" exportName="CME 2026" />);
    expect(screen.getByRole("heading", { level: 2, name: "September 2026" })).toBeInTheDocument();
    const day = screen.getByTestId("calendar-view-day");
    expect(day).toHaveTextContent("Friday 25 September · Today");
    expect(day).toHaveTextContent("Grand round");
    expect(day).toHaveTextContent("12:30 pm");
    expect(screen.getByRole("button", { name: "Tuesday 15 September, 1 event" })).toBeInTheDocument();
  });

  it("changes month with the arrows, expanding repeats into the new month", async () => {
    const user = userEvent.setup();
    render(<CalendarView events={EVENTS} today="2026-09-25" exportName="CME 2026" />);
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { level: 2, name: "October 2026" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thursday 15 October, 1 event" }));
    expect(screen.getByTestId("calendar-view-day")).toHaveTextContent("Journal club");
    expect(screen.getByTestId("calendar-view-day")).toHaveTextContent("Every month");
    await user.click(screen.getByRole("button", { name: "Back to today" }));
    expect(screen.getByRole("heading", { level: 2, name: "September 2026" })).toBeInTheDocument();
  });

  it("offers a file, Google and Outlook for one event, and says what each sends", async () => {
    const user = userEvent.setup();
    render(<CalendarView events={EVENTS} today="2026-09-25" exportName="CME 2026" />);
    await user.click(screen.getByRole("button", { name: "Add Grand round to your calendar" }));
    const sheet = await screen.findByTestId("calendar-view-add-sheet");
    expect(within(sheet).getByTestId("calendar-add-google")).toHaveAttribute(
      "href",
      expect.stringContaining("calendar.google.com"),
    );
    expect(within(sheet).getByTestId("calendar-add-outlook")).toHaveAttribute(
      "href",
      expect.stringContaining("outlook.office.com"),
    );
    expect(sheet).toHaveTextContent("The calendar file stays on this device.");
  });

  it("downloads one calendar file for the export set", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:calendar");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<CalendarView events={EVENTS} exportEvents={[EVENTS[1]]} today="2026-09-25" exportName="CME 2026" />);
    await user.click(screen.getByTestId("calendar-view-export"));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const text = await blob.text();
    expect(text).toContain("SUMMARY:End of the 2026 CPD year");
    expect(text).not.toContain("Journal club");
  });
});
