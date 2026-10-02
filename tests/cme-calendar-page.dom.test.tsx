import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CmeCalendarPage } from "@/components/cme/cme-calendar-page";
import { DEMO_CME_ENTRIES, DEMO_CME_INSTANT, DEMO_CME_YEAR } from "@/lib/cme/demo-year";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/cme/calendar",
}));

describe("the CPD calendar page", () => {
  it("marks its dates with grey shapes and a legend in words", async () => {
    // The phone-calendar link below the month asks the server whether a feed exists.
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ subscribed: false, available: false }), { status: 200 }));
    render(
      <CmeCalendarPage
        set={DEMO_CME_YEAR}
        entries={DEMO_CME_ENTRIES}
        routines={[]}
        nowIso={DEMO_CME_INSTANT.toISOString()}
      />,
    );
    const legend = screen.getByRole("list", { name: "What the marks mean" });
    expect(legend).toHaveTextContent("Logged");
    expect(legend).toHaveTextContent("Deadline");
    expect(screen.queryByRole("list", { name: "What the dots mean" })).toBeNull();
    expect(screen.getByTestId("cme-calendar-view-grid").innerHTML).not.toContain("--tone-");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
  it("folds the subscription card, wording unchanged, behind one How this works disclosure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ subscribed: false, available: true }), { status: 200 }),
    );
    render(
      <CmeCalendarPage
        set={DEMO_CME_YEAR}
        entries={DEMO_CME_ENTRIES}
        routines={[]}
        nowIso={DEMO_CME_INSTANT.toISOString()}
      />,
    );
    const fold = screen.getByTestId("cme-calendar-subscribe-fold");
    expect(fold.tagName).toBe("DETAILS");
    expect(fold).not.toHaveAttribute("open");
    expect(fold.querySelector("summary")).toHaveTextContent("How this works");
    const card = await screen.findByTestId("cme-calendar-subscribe-create");
    expect(fold).toContainElement(card);
    expect(fold).toHaveTextContent(/One private link keeps Google, Outlook or Apple Calendar up to date/);
  });
  it("names the CPD month feed as coming up", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ subscribed: false, available: false }), { status: 200 }),
    );
    render(
      <CmeCalendarPage
        set={DEMO_CME_YEAR}
        entries={[]}
        routines={[
          {
            id: "routine",
            title: "Peer review",
            cadence: "monthly",
            usualHours: 1,
            usualAllocations: [],
            nextDue: "2026-09-25",
            archivedAt: null,
          },
        ]}
        nowIso={DEMO_CME_INSTANT.toISOString()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Coming up in September" })).toBeInTheDocument();
  });
});
