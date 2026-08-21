import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CarePlanErrorBoundary } from "@/components/care-plan/mockups/care-plan-error-boundary";
import { buildPatientSnapshot } from "@/components/care-plan/mockups/domain";
import { PROTOTYPE_NOW } from "@/components/care-plan/mockups/fixtures";
import { PatientWorkspace } from "@/components/care-plan/mockups/patient-workspace";
import { CarePlanPrototypeProvider } from "@/components/care-plan/mockups/prototype-provider";
import { createInitialPrototypeState } from "@/components/care-plan/mockups/prototype-state";
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

  // Exercised on two shell-owned routes. Home and Patients own an in-flow
  // directory search of their own from Task 4 onwards, so the shell composer is
  // not rendered there and there is never a second search field on one page.
  it("keeps the typed search term across a navigation because the shell persists", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const surface = (pathname: string) => (
      <CarePlanPrototypeProvider>
        <CarePlanRouteSurface pathname={pathname} query="" navigate={navigate} />
      </CarePlanPrototypeProvider>
    );
    const { rerender } = render(surface(CARE_PLAN_ROUTES.reviews));

    await user.type(screen.getByRole("searchbox", { name: "Search patients" }), "Rowan");
    rerender(surface(CARE_PLAN_ROUTES.team));
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

  // Home, Patients and the patient Overview are deliberately absent: Task 4
  // replaced their purpose surface with the real Clinical Snapshot, and the
  // block below asserts they no longer render a purpose surface at all.
  it.each([
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
    const navigate = renderRoute(CARE_PLAN_ROUTES.reviews);
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

  it("replaces the route-purpose surface on the three Clinical Snapshot routes", () => {
    for (const route of [CARE_PLAN_ROUTES.home, CARE_PLAN_ROUTES.patients, CARE_PLAN_ROUTES.patient]) {
      const { unmount } = render(
        <CarePlanPrototypeProvider>
          <CarePlanRouteSurface pathname={route} query="" navigate={vi.fn()} />
        </CarePlanPrototypeProvider>,
      );
      expect(screen.queryByTestId("care-plan-route-purpose"), `${route} still shows a purpose surface`).toBeNull();
      unmount();
    }
  });
});

describe("Care Plan patient directory", () => {
  async function searchAndOpen(query: string, openName: RegExp) {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home);
    await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), query);
    await user.click(screen.getByRole("button", { name: openName }));
    return user;
  }

  // The brief's worked example, corrected against the fixtures: Mira's plan
  // carries Current version 1 and Awaiting Approval version 2, not 2 and 3.
  it("finds a synthetic patient and keeps Current Plan above an awaiting draft", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home, "scenario=overdue-plan");
    await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), "SYN-MRN-0002");
    await user.click(screen.getByRole("button", { name: /Open Mira Example/i }));

    const workspace = screen.getByRole("region", { name: "Mira Example clinical snapshot" });
    expect(within(workspace).getByRole("heading", { level: 2, name: "Current Plan" })).toBeInTheDocument();
    expect(within(workspace).getByText(/Awaiting Approval version 2/i)).toBeInTheDocument();
    expect(within(workspace).getByText(/Current version 1 remains in use/i)).toBeInTheDocument();

    // Hierarchy, not merely presence: the awaiting version must never be able to
    // drift above the version a clinician is meant to act on.
    const current = within(workspace).getByRole("heading", { level: 2, name: "Current Plan" });
    const awaiting = within(workspace).getByText(/Awaiting Approval version 2/i);
    expect(current.compareDocumentPosition(awaiting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["full name", "Mira Example"],
    ["preferred name", "Mira"],
    ["alias", "Mira Example-Hale"],
    ["MRN", "SYN-MRN-0002"],
    ["ISO date of birth", "1948-09-22"],
    ["displayed date of birth", "22/09/1948"],
  ])("searches the supported %s identity field", async (_label, query) => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home);
    await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), query);
    expect(screen.getByRole("button", { name: /Open Mira Example/i })).toBeInTheDocument();
  });

  it("does not search plan or presentation content", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home);
    // A distinctive phrase from Mira's Current Plan content. Identity search
    // must not become a full-text search of clinical text.
    await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), "hearing aids");
    expect(screen.queryByRole("button", { name: /Open Mira Example/i })).toBeNull();
    expect(screen.getByTestId("care-plan-directory-no-results")).toBeInTheDocument();
  });

  it("shows deterministic no-results content and no patient rows", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home);
    await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), "SYN-MRN-9999");
    const results = screen.getByTestId("care-plan-directory-results");
    expect(within(results).queryAllByRole("button", { name: /^Open / })).toEqual([]);
    const empty = screen.getByTestId("care-plan-directory-no-results");
    expect(empty).toHaveTextContent("No synthetic patient matches SYN-MRN-9999");
    expect(empty).toHaveTextContent(/Check the MRN, or try a different spelling/i);
  });

  it("offers recent patients before anything is typed", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    expect(screen.getByRole("heading", { name: "Recent patients" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open / }).length).toBeGreaterThan(0);
  });

  it("states the lookback window and that counts decide nothing", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    const directory = screen.getByRole("region", { name: "Synthetic patient directory" });
    expect(within(directory).getByText(/in the 12 months to 20\/08\/2026/i)).toBeInTheDocument();
    expect(
      within(directory).getByText(
        /Counts describe what happened\. They do not determine eligibility for a Management Plan\./i,
      ),
    ).toBeInTheDocument();
  });

  // Ranking everyone by attendance is the banned label without the word. It
  // exists only inside Identification Review, which is not this surface.
  it("offers no way to sort or rank the directory by presentation count", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    const directory = screen.getByRole("region", { name: "Synthetic patient directory" });
    expect(within(directory).queryAllByRole("button", { name: /sort|rank|most|highest/i })).toEqual([]);
    expect(within(directory).queryAllByRole("combobox")).toEqual([]);
    expect(within(directory).queryAllByRole("columnheader")).toEqual([]);
  });

  it("offers a manual Identification Review entry point rather than an automatic rule", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    const directory = screen.getByRole("region", { name: "Synthetic patient directory" });
    expect(within(directory).getByRole("link", { name: /Refer someone for Identification Review/i })).toHaveAttribute(
      "href",
      CARE_PLAN_ROUTES.reviews,
    );
  });

  it("keeps exactly one search field on Home, owned by the directory", () => {
    renderRoute(CARE_PLAN_ROUTES.home);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("searchbox", { name: "Search synthetic patients" })).toBeInTheDocument();
  });

  it("keeps the whole snapshot free of unavailable authoring controls", async () => {
    await searchAndOpen("SYN-MRN-0002", /Open Mira Example/i);
    expect(screen.queryByTitle(/coming soon/i)).toBeNull();
    expect(document.querySelector("[aria-disabled='true']")).toBeNull();
  });
});

describe("Care Plan clinical snapshot", () => {
  const FIRST_MINUTE_HEADINGS = [
    "1. How to approach this person",
    "2. What helps",
    "3. What makes it worse",
    "4. What we have agreed to do",
    "5. What would make this presentation different",
  ];

  it("renders exactly the five first-minute sections, in order", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const sections = screen.getByTestId("care-plan-first-minute-sections");
    expect(
      within(sections)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(FIRST_MINUTE_HEADINGS);
  });

  // Presence is not enough. The specification requires section 5 to be visually
  // distinct from the other four and never collapsed, truncated, clipped, or put
  // behind a disclosure — all of which leave it in the DOM.
  it("keeps the fifth section visually distinct and never collapsed, truncated or hidden", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const boundary = screen
      .getByRole("heading", { level: 3, name: "5. What would make this presentation different" })
      .closest("section");
    const ordinary = screen.getByRole("heading", { level: 3, name: "2. What helps" }).closest("section");
    expect(boundary).not.toBeNull();
    expect(ordinary).not.toBeNull();

    const boundaryClasses = (boundary?.className ?? "").split(/\s+/).filter(Boolean);
    const ordinaryClasses = (ordinary?.className ?? "").split(/\s+/).filter(Boolean);
    const distinguishing = boundaryClasses.filter((token) => !ordinaryClasses.includes(token));
    expect(distinguishing.length, "section 5 must carry a treatment the other four do not").toBeGreaterThan(0);

    // …and that treatment must not be a way of hiding or shortening it.
    for (const suppression of [/^sr-only$/, /^hidden$/, /^truncate$/, /line-clamp/, /^max-h-/, /^overflow-hidden$/]) {
      for (const token of boundaryClasses) {
        expect(token, `section 5 must not be suppressed by ${suppression}`).not.toMatch(suppression);
      }
    }
    expect(boundary?.closest("details"), "section 5 must not sit behind a disclosure").toBeNull();
    expect(boundary?.closest("[hidden]")).toBeNull();
    expect(boundary?.getAttribute("aria-hidden")).toBeNull();
  });

  it("uses none of the removed nineteen-field vocabulary on the summary card", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const card = screen.getByRole("region", { name: "Current Plan" });
    for (const removed of [
      /preferred engagement/i,
      /may increase distress/i,
      /immediate continuity considerations/i,
      /helpful interventions/i,
      /usual presentation pattern/i,
    ]) {
      expect(card.textContent ?? "", `${removed} is a removed field name`).not.toMatch(removed);
    }
  });

  it("pins the safety boundary beneath identity, above all plan content, and keeps it in print", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const identity = screen.getByTestId("care-plan-identity-band");
    const pinned = screen.getByTestId("care-plan-pinned-safety-boundary");
    const card = screen.getByRole("region", { name: "Current Plan" });

    expect(identity.compareDocumentPosition(pinned) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pinned.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pinned.closest("[data-print-hide='true']")).toBeNull();
    // It links to the full section; it never replaces it.
    expect(within(pinned).getByRole("link", { name: /What would make this presentation different/i })).toHaveAttribute(
      "href",
      "#care-plan-first-minute-whatWouldMakeThisDifferent",
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "5. What would make this presentation different" }),
    ).toHaveAttribute("id", "care-plan-first-minute-whatWouldMakeThisDifferent");
  });

  it("states the fresh-assessment boundary on every view of the plan", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    expect(
      within(screen.getByRole("region", { name: "Current Plan" })).getByText(
        "This plan supports continuity. It never replaces fresh triage, physical assessment, mental-state assessment, immediate risk assessment, clinical judgement, or legal obligations.",
      ),
    ).toBeInTheDocument();
  });

  it("presents version, owner, approver, dates and links as metadata", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const metadata = screen.getByTestId("care-plan-current-plan-metadata");
    expect(metadata).toHaveTextContent("Current version 2");
    expect(metadata).toHaveTextContent("Morgan Sample");
    expect(metadata).toHaveTextContent("Dr Taylor Fiction");
    expect(metadata).toHaveTextContent("20/05/2026");
    expect(metadata).toHaveTextContent("20/05/2027");
    expect(metadata).toHaveTextContent("Within review");
    expect(metadata).toHaveTextContent("North River CMHT");
    expect(within(metadata).getByRole("link", { name: /Personal Safety Plan/i })).toHaveAttribute(
      "href",
      carePlanRoute.safetyPlan("SYN-PATIENT-001"),
    );
    // Metadata is not a sixth content section.
    expect(within(metadata).queryAllByRole("heading", { level: 3 })).toEqual([]);
  });

  it("derives an overdue review from the date and keeps the content readable below the warning", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-002"));
    const warning = screen.getByTestId("care-plan-review-warning");
    expect(warning).toHaveTextContent(/Review overdue/i);
    expect(warning).toHaveTextContent("16/07/2026");
    const card = screen.getByRole("region", { name: "Current Plan" });
    expect(warning.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getByText(/check that Mira has her hearing aids in/i)).toBeInTheDocument();
  });

  it("says No Current Plan and keeps a Draft visibly separate without promoting it", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-005"));
    const workspace = screen.getByRole("region", { name: "Alex Fiction clinical snapshot" });
    expect(within(workspace).getByText("No Current Plan")).toBeInTheDocument();
    expect(within(workspace).queryByRole("region", { name: "Current Plan" })).toBeNull();
    const draft = within(workspace).getByRole("region", { name: "Version in progress" });
    expect(draft).toHaveTextContent(/Draft version 1/i);
    expect(draft).toHaveTextContent(/This is not a plan in use\./i);
    expect(within(draft).queryByRole("heading", { level: 2, name: "Current Plan" })).toBeNull();
  });

  it("names the withdrawal date, clinician and reason instead of a bare No Current Plan", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-004"));
    const withdrawn = screen.getByTestId("care-plan-withdrawn-notice");
    expect(withdrawn).toHaveTextContent("Plan withdrawn on 04/07/2026 by Dr Taylor Fiction");
    expect(withdrawn).toHaveTextContent(/Evelyn's circumstances have changed substantially/i);
    expect(screen.queryByText("No Current Plan")).toBeNull();
  });

  it("marks a version written without the person's involvement", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-005"));
    expect(
      within(screen.getByRole("region", { name: "Version in progress" })).getByText(
        "Written without this person's involvement",
      ),
    ).toBeInTheDocument();
  });

  it("keeps identity and currency facts visible in the identity band", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const band = screen.getByTestId("care-plan-identity-band");
    expect(band).toHaveTextContent("Rowan Sample");
    expect(band).toHaveTextContent("SYN-MRN-0001");
    expect(band).toHaveTextContent("12/04/1986");
    expect(band).toHaveTextContent("Adult");
    expect(band).toHaveTextContent("Rowan");
    expect(band).toHaveTextContent("they/them");
    expect(band).toHaveTextContent("North River Health Service");
    expect(band).toHaveTextContent(/Current Plan.*version 2/i);
    expect(band).toHaveTextContent(/Personal Safety Plan/i);
    expect(band).toHaveTextContent(/verified/i);
    expect(band).toHaveTextContent(/in the 12 months to 20\/08\/2026/i);
    expect(within(band).getByText("Synthetic prototype — fictional people, teams, and hospitals")).toBeInTheDocument();
  });

  // Never display a nearby patient's plan as a fallback.
  it("refuses to show plan content when the record is not confirmed as the right person", () => {
    renderRoute(CARE_PLAN_ROUTES.patient, "scenario=identity-uncertain");
    expect(screen.queryByRole("region", { name: "Current Plan" })).toBeNull();
    expect(screen.getByTestId("care-plan-identity-uncertain")).toHaveTextContent(/Return to search/i);
  });

  it("links the four primary patient sections and History from the selected patient", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-002"));
    const nav = screen.getByRole("navigation", { name: "Patient sections" });
    for (const [label, href] of [
      ["Overview", carePlanRoute.patient("SYN-PATIENT-002")],
      ["Management Plan", carePlanRoute.managementPlan("SYN-PATIENT-002")],
      ["Personal Safety Plan", carePlanRoute.safetyPlan("SYN-PATIENT-002")],
      ["ED Presentations", carePlanRoute.presentations("SYN-PATIENT-002")],
      ["History", carePlanRoute.history("SYN-PATIENT-002")],
    ] as const) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  // Home embeds the workspace beside a directory. Marking Overview as the
  // current page there announces a link to `/patients/<id>` as the address the
  // reader is already on, which it is not.
  it.each([CARE_PLAN_ROUTES.home, CARE_PLAN_ROUTES.patients])(
    "marks no patient section as the current page on %s",
    (pathname) => {
      renderRoute(pathname);
      const nav = screen.getByRole("navigation", { name: "Patient sections" });
      for (const link of within(nav).getAllByRole("link")) {
        expect(link, `${link.textContent} must not claim to be the current page`).not.toHaveAttribute("aria-current");
      }
    },
  );

  // Selecting a patient changes no address, so the shell's route-heading focus
  // never fires. Without a focus move the workspace appears in the next column
  // on a desktop and below the entire directory list on a 320px phone, with
  // nothing announced and nothing visibly changed above the fold.
  it("moves focus to the workspace when a patient is selected", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.home);
    expect(screen.getByRole("region", { name: "Rowan Sample clinical snapshot" })).not.toHaveFocus();

    await user.type(screen.getByRole("searchbox", { name: "Search synthetic patients" }), "SYN-MRN-0002");
    await user.click(screen.getByRole("button", { name: /Open Mira Example/i }));

    const workspace = screen.getByRole("region", { name: "Mira Example clinical snapshot" });
    expect(workspace).toHaveAttribute("tabindex", "-1");
    expect(workspace).toHaveFocus();
  });

  // …but it must not steal the mount-time focus the shell puts on the route
  // heading, or every page load would jump past the line saying where you are.
  //
  // Asserting the *final* focus cannot see this: the shell's effect is a
  // parent's and therefore runs last, so it would quietly repair the theft on
  // every render and the guard would be untestable. A positive control proved
  // exactly that — removing the mount-time guard left all 89 tests passing. So
  // this records the focus events in order and asserts the workspace never
  // appears among them, momentarily or otherwise.
  it("never takes mount-time focus from the shell heading, even momentarily", () => {
    const focusedNames: string[] = [];
    const listener = (event: Event) => {
      const target = event.target as HTMLElement | null;
      focusedNames.push(target?.getAttribute("aria-label") ?? target?.tagName ?? "");
    };
    document.addEventListener("focusin", listener);
    try {
      renderRoute(CARE_PLAN_ROUTES.home);
    } finally {
      document.removeEventListener("focusin", listener);
    }

    expect(focusedNames.filter((name) => name.endsWith("clinical snapshot"))).toEqual([]);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toHaveFocus();
    expect(screen.getByRole("region", { name: "Rowan Sample clinical snapshot" })).not.toHaveFocus();
  });

  it("leaves focus to the shell heading on a patient address, where the route did change", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-002"));
    expect(screen.getByRole("heading", { level: 1, name: "Patient overview" })).toHaveFocus();
    expect(screen.getByRole("region", { name: "Mira Example clinical snapshot" })).not.toHaveFocus();
  });

  // Patient-to-patient on a patient address is a real route change, and the
  // shell already owns it. Two owners would both fire, the parent's would land
  // last, and the competition would be invisible in the final state — so this
  // watches the focus events instead.
  it("does not compete with the shell heading when the patient address itself changes", () => {
    const navigate = vi.fn();
    const surface = (pathname: string) => (
      <CarePlanPrototypeProvider>
        <CarePlanRouteSurface pathname={pathname} query="" navigate={navigate} />
      </CarePlanPrototypeProvider>
    );
    const { rerender } = render(surface(carePlanRoute.patient("SYN-PATIENT-001")));

    const focusedNames: string[] = [];
    const listener = (event: Event) => {
      const target = event.target as HTMLElement | null;
      focusedNames.push(target?.getAttribute("aria-label") ?? target?.tagName ?? "");
    };
    document.addEventListener("focusin", listener);
    try {
      rerender(surface(carePlanRoute.patient("SYN-PATIENT-002")));
    } finally {
      document.removeEventListener("focusin", listener);
    }

    expect(focusedNames.filter((name) => name.endsWith("clinical snapshot"))).toEqual([]);
    expect(screen.getByRole("heading", { level: 1, name: "Patient overview" })).toHaveFocus();
  });
});

// A Current version whose `reviewDueAt` is null derives no review state at all.
// `deriveReviewState` was deliberately made to return `overdue` for a date it
// cannot parse, because a clinical currency indicator must not resolve to the
// most reassuring state on bad input. An absent date is the same situation, and
// it reaches a different code path — the one that renders nothing.
//
// No fixture patient is in this state, so the snapshot is constructed.
describe("Care Plan review currency with no review date", () => {
  function undatedWorkspace() {
    const state = createInitialPrototypeState();
    const base = buildPatientSnapshot(state, "SYN-PATIENT-001", PROTOTYPE_NOW);
    if (base === null || base.currentManagementVersion === null) {
      throw new Error("SYN-PATIENT-001 must have a Current version for this test to mean anything.");
    }
    render(
      <PatientWorkspace
        snapshot={{
          ...base,
          currentManagementVersion: { ...base.currentManagementVersion, reviewDueAt: null },
          reviewState: null,
        }}
        users={state.users}
        scenario="normal"
        outcome={null}
        activeSection={null}
        reviewsHref={CARE_PLAN_ROUTES.reviews}
        onRecordContactIntent={() => {}}
      />,
    );
  }

  it("says the review currency is unknown rather than showing nothing", () => {
    undatedWorkspace();
    const warning = screen.getByTestId("care-plan-review-warning");
    expect(warning).toHaveTextContent("Review currency unknown");
    expect(warning).toHaveTextContent(/Treat it as due for review/i);
  });

  it("does not let the summary card imply the plan is within review", () => {
    undatedWorkspace();
    const metadata = screen.getByTestId("care-plan-current-plan-metadata");
    expect(metadata).toHaveTextContent("Review currency unknown");
    expect(metadata).not.toHaveTextContent("Within review");
  });

  it("keeps the plan itself fully readable", () => {
    undatedWorkspace();
    const card = screen.getByRole("region", { name: "Current Plan" });
    expect(within(card).getAllByRole("heading", { level: 3 })).toHaveLength(5);
  });
});

describe("Care Plan CMHT contact actions", () => {
  it("exposes only intent-safe CMHT launch links", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    expect(screen.getByRole("link", { name: "Email North River CMHT" })).toHaveAttribute(
      "href",
      "mailto:north-river.cmht@example.org?subject=Care+Plan+%E2%80%94+team+contact+request",
    );
    expect(screen.getByRole("link", { name: "Call North River CMHT" })).toHaveAttribute("href", "tel:+61491570101");
  });

  // An allowlist, not a denylist. The requirement forbids five classes of
  // content — name, MRN, date of birth, presentation content, plan content — and
  // a list of strings can only ever cover the ones somebody thought of: a
  // planted `&plan=…`, or `12 April 1986` instead of `12/04/1986`, would walk
  // straight past it. Pinning the whole query string to the single expected pair
  // fails on any added parameter whatever it carries.
  it("puts nothing but the generic subject in the mailto", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const href = screen.getByRole("link", { name: "Email North River CMHT" }).getAttribute("href") ?? "";
    const [address, query = "", ...rest] = href.split("?");

    expect(address).toBe("mailto:north-river.cmht@example.org");
    expect(rest, "a mailto carries exactly one query string").toEqual([]);
    expect(query).toBe("subject=Care+Plan+%E2%80%94+team+contact+request");
    expect([...new URLSearchParams(query).keys()], "subject is the only permitted parameter").toEqual(["subject"]);
    expect(new URLSearchParams(query).get("subject")).toBe("Care Plan — team contact request");
    expect(href, "a mailto carries no fragment either").not.toContain("#");
  });

  it("shows the displayed contact details, hours, coordinator and after-hours route", () => {
    renderRoute(CARE_PLAN_ROUTES.patient);
    const contacts = screen.getByRole("region", { name: "Community mental health team" });
    expect(contacts).toHaveTextContent("north-river.cmht@example.org");
    expect(contacts).toHaveTextContent("0491 570 101");
    expect(contacts).toHaveTextContent("Monday to Friday, 8:30 am to 5:00 pm AWST");
    expect(contacts).toHaveTextContent("Sam Placeholder");
    expect(contacts).toHaveTextContent("1300 555 788");
    expect(contacts).toHaveTextContent("30/07/2026");
  });

  it("records a contact intent and claims only that an application was requested", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.patient);
    await user.click(screen.getByRole("link", { name: "Email North River CMHT" }));
    const outcome = screen.getByTestId("care-plan-outcome");
    expect(outcome).toHaveTextContent(
      "An email application was asked to open. This prototype records only that request, not what happens next.",
    );
    for (const overclaim of [/sent/i, /delivered/i, /received/i, /replied/i, /notified/i]) {
      expect(outcome.textContent ?? "").not.toMatch(overclaim);
    }
  });

  it("keeps unverified contact details visible with a warning, last-verified date and a Reviews link", () => {
    renderRoute(carePlanRoute.patient("SYN-PATIENT-003"));
    const contacts = screen.getByRole("region", { name: "Community mental health team" });
    // Details stay visible: withholding them would send nobody anywhere.
    expect(contacts).toHaveTextContent("wandoo-district.cmht@example.org");
    expect(within(contacts).getByRole("link", { name: "Call Wandoo District CMHT" })).toHaveAttribute(
      "href",
      "tel:+61491570121",
    );
    const warning = within(contacts).getByTestId("care-plan-contact-verification-warning");
    expect(warning).toHaveTextContent(/have not been verified/i);
    expect(warning).toHaveTextContent("20/01/2025");
    expect(warning.textContent ?? "").not.toMatch(/available now|currently available|reachable/i);
    expect(within(warning).getByRole("link", { name: /Reviews/i })).toHaveAttribute("href", CARE_PLAN_ROUTES.reviews);
  });

  it("keeps details visible and explains a launch failure in three parts", async () => {
    const user = userEvent.setup();
    renderRoute(CARE_PLAN_ROUTES.patient, "scenario=launch-failure");
    await user.click(screen.getByRole("link", { name: "Email North River CMHT" }));
    const failure = screen.getByTestId("care-plan-launch-failure");
    expect(failure).toHaveTextContent(/could not be opened/i);
    expect(failure).toHaveTextContent(/Nothing was sent/i);
    expect(failure).toHaveTextContent(/north-river\.cmht@example\.org/);
    // The contact details themselves are still on screen.
    const contacts = screen.getByRole("region", { name: "Community mental health team" });
    expect(within(contacts).getByRole("link", { name: "Call North River CMHT" })).toBeInTheDocument();
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
