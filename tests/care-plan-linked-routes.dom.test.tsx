import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CarePlanErrorBoundary } from "@/components/care-plan/mockups/care-plan-error-boundary";
import { CarePlanPrototypeProvider } from "@/components/care-plan/mockups/prototype-provider";
import { CarePlanRouteSurface } from "@/components/care-plan/mockups/routable-suite";
import { CARE_PLAN_ROUTES, carePlanRoute } from "@/components/care-plan/mockups/routes";

function renderRoute(pathname: string, query = "") {
  const navigate = vi.fn();
  render(
    <CarePlanPrototypeProvider>
      <CarePlanRouteSurface pathname={pathname} query={query} navigate={navigate} />
    </CarePlanPrototypeProvider>,
  );
  return navigate;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Care Plan route shell", () => {
  it("gives every route exactly one first-level heading", () => {
    for (const route of Object.values(CARE_PLAN_ROUTES)) {
      const { unmount } = render(
        <CarePlanPrototypeProvider>
          <CarePlanRouteSurface pathname={route} query="" navigate={vi.fn()} />
        </CarePlanPrototypeProvider>,
      );
      expect(screen.getAllByRole("heading", { level: 1 }), `${route} must have one <h1>`).toHaveLength(1);
      unmount();
    }
  });

  it("moves keyboard focus to the route heading so a routed page announces itself", () => {
    renderRoute(CARE_PLAN_ROUTES.patients);
    const heading = screen.getByRole("heading", { level: 1, name: "Patients" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).toHaveFocus();
  });

  // The commonest navigation in this product is patient to patient on the same
  // route, and both patients resolve to the same heading. If focus keys on the
  // heading text rather than the address, a screen-reader user moves to a
  // different patient's plan and hears nothing at all.
  it("moves focus again when only the patient changes and the heading text does not", () => {
    const navigate = vi.fn();
    const surface = (pathname: string) => (
      <CarePlanPrototypeProvider>
        <CarePlanRouteSurface pathname={pathname} query="" navigate={navigate} />
      </CarePlanPrototypeProvider>
    );
    const { rerender } = render(surface(carePlanRoute.managementPlan("SYN-PATIENT-001")));

    const heading = screen.getByRole("heading", { level: 1, name: "Management Plan" });
    expect(heading).toHaveFocus();

    // Simulate the user tabbing away, then navigating to another patient.
    (document.activeElement as HTMLElement | null)?.blur();
    expect(heading).not.toHaveFocus();

    rerender(surface(carePlanRoute.managementPlan("SYN-PATIENT-002")));

    const headingAfter = screen.getByRole("heading", { level: 1, name: "Management Plan" });
    // Same node: the shell persists across navigation rather than remounting,
    // which is also what lets the search field keep what was typed into it.
    expect(headingAfter).toBe(heading);
    expect(headingAfter).toHaveFocus();
  });

  it("keeps the typed search term across a navigation because the shell persists", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const surface = (pathname: string) => (
      <CarePlanPrototypeProvider>
        <CarePlanRouteSurface pathname={pathname} query="" navigate={navigate} />
      </CarePlanPrototypeProvider>
    );
    const { rerender } = render(surface(CARE_PLAN_ROUTES.home));

    await user.type(screen.getByRole("searchbox", { name: "Search patients" }), "Rowan");
    rerender(surface(CARE_PLAN_ROUTES.patients));
    expect(screen.getByRole("searchbox", { name: "Search patients" })).toHaveValue("Rowan");
  });

  it("announces a route change once, through the heading, not through a second live region", () => {
    renderRoute(CARE_PLAN_ROUTES.patients);
    const heading = screen.getByRole("heading", { level: 1, name: "Patients" });
    expect(heading).toHaveFocus();
    // A hand-rolled aria-live region repeating the heading would make every
    // route change announce twice.
    const liveRegions = Array.from(document.querySelectorAll("[aria-live]")).filter(
      (node) => node.textContent?.trim() === "Patients",
    );
    expect(liveRegions).toEqual([]);
  });

  it("states the synthetic boundary and that nothing is saved", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    expect(screen.getByText("Synthetic prototype — fictional data only")).toBeInTheDocument();
    expect(screen.getByText("Nothing is saved. Reloading this page starts over.")).toBeInTheDocument();
  });

  it("names the signed-in synthetic clinician and their role", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    const identity = screen.getByTestId("care-plan-active-user");
    expect(within(identity).getByText("Dr Casey Example")).toBeInTheDocument();
    expect(within(identity).getByText("Emergency Physician, North River Hospital ED")).toBeInTheDocument();
  });

  it("renders the desktop rail as real links built from the route registry", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    const rail = screen.getByRole("navigation", { name: "Care Plan sections" });
    for (const [label, href] of [
      ["Home", CARE_PLAN_ROUTES.home],
      ["Patients", CARE_PLAN_ROUTES.patients],
      ["Reviews", CARE_PLAN_ROUTES.reviews],
      ["Team", CARE_PLAN_ROUTES.team],
      ["Governance", CARE_PLAN_ROUTES.governance],
    ] as const) {
      expect(within(rail).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(
      within(screen.getByRole("navigation", { name: "Care Plan prototype tools" })).getByRole("link", {
        name: "System states",
      }),
    ).toHaveAttribute("href", CARE_PLAN_ROUTES.systemStates);
  });

  it("renders the phone dock and reaches the remaining destinations through More", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home);
    const dock = screen.getByRole("navigation", { name: "Care Plan phone navigation" });
    for (const [label, href] of [
      ["Home", CARE_PLAN_ROUTES.home],
      ["Patients", CARE_PLAN_ROUTES.patients],
      ["Reviews", CARE_PLAN_ROUTES.reviews],
    ] as const) {
      expect(within(dock).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }

    await user.click(within(dock).getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(within(sheet).getByRole("link", { name: /^Team/ })).toHaveAttribute("href", CARE_PLAN_ROUTES.team);
    expect(within(sheet).getByRole("link", { name: /^Governance/ })).toHaveAttribute(
      "href",
      CARE_PLAN_ROUTES.governance,
    );
    expect(within(sheet).getByRole("link", { name: /^System states/ })).toHaveAttribute(
      "href",
      CARE_PLAN_ROUTES.systemStates,
    );
  });

  it("keeps the phone dock out of a printed page", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    expect(screen.getByRole("navigation", { name: "Care Plan phone navigation" })).toHaveAttribute(
      "data-print-hide",
      "true",
    );
  });

  // A printed Care Plan leaves the screen: it is carried to a bedside or sent
  // with a handover. Paper that shows a clinical heading with nothing saying the
  // content is fictional is the failure this asserts against, so the marker must
  // survive print on every route — most of all the three print routes.
  it.each([
    CARE_PLAN_ROUTES.managementPlanPrint,
    CARE_PLAN_ROUTES.patientPlanPrint,
    CARE_PLAN_ROUTES.safetyPlanPrint,
    CARE_PLAN_ROUTES.home,
  ])("keeps the synthetic marker on the printed page for %s", (pathname) => {
    renderRoute(pathname);
    const marker = screen.getByTestId("care-plan-synthetic-marker");
    expect(marker).toHaveTextContent("Synthetic prototype — fictional data only");
    expect(marker.closest("[data-print-hide='true']")).toBeNull();

    const memoryNotice = screen.getByText("Nothing is saved. Reloading this page starts over.");
    expect(memoryNotice.closest("[data-print-hide='true']")).toBeNull();

    // The search slot is chrome, and chrome still goes.
    expect(screen.getByRole("search").closest("[data-print-hide='true']")).not.toBeNull();
  });

  it.each([
    [CARE_PLAN_ROUTES.home, "Home"],
    [CARE_PLAN_ROUTES.patients, "Patients"],
    [CARE_PLAN_ROUTES.patient, "Patients"],
    [CARE_PLAN_ROUTES.managementPlan, "Patients"],
    [CARE_PLAN_ROUTES.presentation, "Patients"],
    [CARE_PLAN_ROUTES.reviews, "Reviews"],
    [CARE_PLAN_ROUTES.team, "Team"],
    [CARE_PLAN_ROUTES.governance, "Governance"],
  ])("marks %s as the current destination %s", (pathname, destination) => {
    renderRoute(pathname);
    const rail = screen.getByRole("navigation", { name: "Care Plan sections" });
    expect(within(rail).getByRole("link", { name: destination })).toHaveAttribute("aria-current", "page");
    const others = within(rail)
      .getAllByRole("link")
      .filter((link) => link.textContent?.trim() !== destination);
    for (const link of others) expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks the system-states route current on its own rail link", () => {
    renderRoute(CARE_PLAN_ROUTES.systemStates);
    expect(
      within(screen.getByRole("navigation", { name: "Care Plan prototype tools" })).getByRole("link", {
        name: "System states",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it.each([
    [CARE_PLAN_ROUTES.home, "Home", "Search-first Home and Clinical Snapshot"],
    [CARE_PLAN_ROUTES.patients, "Patients", "Full patient directory and presentation-activity view"],
    [CARE_PLAN_ROUTES.patient, "Patient overview", "Patient overview and first-minute snapshot"],
    [
      CARE_PLAN_ROUTES.managementPlan,
      "Management Plan",
      "Full Current Plan, draft summary, review state, and version history entry points",
    ],
    [CARE_PLAN_ROUTES.managementPlanEdit, "Draft Management Plan Version", "Create or edit a draft version"],
    [
      CARE_PLAN_ROUTES.managementPlanReview,
      "Review submitted version",
      "Compare, return for changes, and approve a submitted version",
    ],
    [
      CARE_PLAN_ROUTES.managementPlanPrint,
      "Print Management Plan",
      "Print-optimised clinician summary to carry to the bedside or send with a handover",
    ],
    [
      CARE_PLAN_ROUTES.patientPlan,
      "Patient Plan",
      "The patient-facing edition of the Management Plan, with its own version and approval state",
    ],
    [
      CARE_PLAN_ROUTES.patientPlanEdit,
      "Draft Patient Plan",
      "Create the patient edition from the Current Plan, fill its flagged gaps, and approve it",
    ],
    [
      CARE_PLAN_ROUTES.patientPlanPrint,
      "Print Patient Plan",
      "Print-optimised patient copy, including their resources",
    ],
    [CARE_PLAN_ROUTES.safetyPlan, "Personal Safety Plan", "Current patient-owned Personal Safety Plan"],
    [
      CARE_PLAN_ROUTES.safetyPlanEdit,
      "Draft Personal Safety Plan Version",
      "Co-produce or revise a Personal Safety Plan Version",
    ],
    [CARE_PLAN_ROUTES.safetyPlanPrint, "Print Personal Safety Plan", "Print-optimised patient copy"],
    [CARE_PLAN_ROUTES.presentations, "ED Presentations", "Longitudinal ED Presentation timeline"],
    [CARE_PLAN_ROUTES.newPresentation, "Record ED Presentation", "Record a concise ED Presentation"],
    [CARE_PLAN_ROUTES.presentation, "ED Presentation", "View an episode, plan-use feedback, outcome, and amendments"],
    [
      CARE_PLAN_ROUTES.history,
      "History",
      "Combined plan, presentation-amendment, print, and contact-action audit chronology",
    ],
    [
      CARE_PLAN_ROUTES.reviews,
      "Reviews",
      "Awaiting Approval, Review Suggested, contact verification, and manual identification queues",
    ],
    [CARE_PLAN_ROUTES.team, "Team", "Synthetic CMHT and plan-owner directory"],
    [
      CARE_PLAN_ROUTES.governance,
      "Governance",
      "Prototype boundary, roles, lifecycle rules, and unresolved identification policy",
    ],
    [CARE_PLAN_ROUTES.systemStates, "System states", "Deterministic degraded-state specimens and scenario controls"],
  ])("maps %s to the %s route purpose surface", (pathname, heading, purpose) => {
    renderRoute(pathname);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    const surface = screen.getByTestId("care-plan-route-purpose");
    expect(within(surface).getByText(purpose)).toBeInTheDocument();
  });

  it("offers exactly one search slot and navigates it without putting record content in the URL", async () => {
    const user = userEvent.setup();
    const navigate = renderRoute(CARE_PLAN_ROUTES.home);
    const search = screen.getByRole("searchbox", { name: "Search patients" });
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    await user.type(search, "Rowan");
    await user.click(screen.getByRole("button", { name: "Search patients" }));
    expect(navigate).toHaveBeenCalledWith(CARE_PLAN_ROUTES.patients);
    expect(navigate.mock.calls.every(([href]) => !String(href).includes("Rowan"))).toBe(true);
  });

  it("reads the named specimen scenario from the URL and nothing else", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    expect(document.querySelector("[data-care-plan-scenario]")).toHaveAttribute("data-care-plan-scenario", "normal");

    document.body.innerHTML = "";
    renderRoute(CARE_PLAN_ROUTES.systemStates, "scenario=overdue-plan");
    expect(document.querySelector("[data-care-plan-scenario]")).toHaveAttribute(
      "data-care-plan-scenario",
      "overdue-plan",
    );

    document.body.innerHTML = "";
    renderRoute(CARE_PLAN_ROUTES.systemStates, "scenario=not-a-scenario");
    expect(document.querySelector("[data-care-plan-scenario]")).toHaveAttribute("data-care-plan-scenario", "normal");
  });

  it("shows no unavailable authoring controls on a reading surface", () => {
    renderRoute(CARE_PLAN_ROUTES.managementPlan);
    expect(screen.queryByTitle(/coming soon/i)).toBeNull();
    expect(document.querySelector("[aria-disabled='true']")).toBeNull();
  });
});

describe("Care Plan error boundary", () => {
  function Thrower(): never {
    throw new Error("Two versions are recorded as Current for SYN-MGMT-PLAN-001.");
  }

  it("catches an invariant violation and shows the shared recovery panel instead of a blank tree", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CarePlanErrorBoundary>
        <Thrower />
      </CarePlanErrorBoundary>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Care Plan could not be displayed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders its children untouched when nothing throws", () => {
    render(
      <CarePlanErrorBoundary>
        <p>Route content</p>
      </CarePlanErrorBoundary>,
    );
    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Care Plan could not be displayed" })).toBeNull();
  });
});
