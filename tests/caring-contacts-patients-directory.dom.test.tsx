// tests/caring-contacts-patients-directory.dom.test.tsx
//
// The Patients directory body (Task 5), tested as the pure Server Component it is: it is handed
// the records the page already read and decides only what to SHOW.
//
// The assertions that matter are about honesty rather than layout:
//   * an empty caseload and a caseload hidden by a filter are DIFFERENT facts, and the two
//     `ListEmptyState` kinds are not interchangeable (Task 1's whole reason for existing);
//   * a role that may not view plans at all must not be told the team has no patients;
//   * a directory releases no patient-identifying detail -- `getEpisode` is the only read that
//     releases a name or a mobile number, and this screen never calls it;
//   * a row's detail control is an UNAVAILABLE control with a stated reason, not a link into a
//     route that does not exist yet (Ruling 52).
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PatientsDirectory,
  parsePatientsDirectoryFilter,
  patientsDirectoryHref,
} from "@/components/caring-contacts/workspace/patients-directory";
import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { contactId, pathwayVersionId, patientId, planId, referralId, teamId } from "@/lib/caring-contacts/ids";
import type { PlanState } from "@/lib/caring-contacts/model";
import type { PlanRecord, StoredContact } from "@/lib/caring-contacts/repository";

const TEAM = teamId("demo-team");

function contact(sequence: number, options: { absorbed?: boolean; suppressed?: boolean } = {}): StoredContact {
  return {
    contact: {
      id: contactId(`contact-${sequence}`),
      planId: planId("plan-1"),
      // Both stores write an absorbed contact straight into the terminal `suppressed` state so it
      // can never be dispatched (in-memory-repository.ts, `createPlan`). The fixture matches the
      // stores rather than the schedule, because the screen counts what the store holds.
      state: options.absorbed || options.suppressed ? "suppressed" : "scheduled",
      version: 1,
    },
    planned: {
      sequence,
      cadenceLabel: sequence === 1 ? "Day 1" : `Month ${sequence}`,
      calendarDay: "2026-03-02",
      sendAt: new Date("2026-03-02T02:00:00.000Z"),
      messageType: sequence === 1 ? "first" : "standard",
      ...(options.absorbed ? { suppressed: { reason: "absorbedByFirstContact" as const } } : {}),
    },
  };
}

function planRecord(options: { id: string; state: PlanState; contacts?: readonly StoredContact[] }): PlanRecord {
  return {
    plan: { id: planId(options.id), teamId: TEAM, state: options.state, version: 1 },
    patientId: patientId(`patient-${options.id}`),
    referralId: referralId(`referral-${options.id}`),
    pathwayVersionId: pathwayVersionId("pathway-1"),
    dischargeAt: new Date("2026-03-01T02:00:00.000Z"),
    completedAt: null,
    outcome: "inProgress",
    contacts: options.contacts ?? [contact(1), contact(2)],
  };
}

const ALL = parsePatientsDirectoryFilter({});

describe("Patients directory - the two empty states are not interchangeable", () => {
  it("an empty caseload renders the no-data kind, which states how a first patient arrives", () => {
    const { container } = render(<PatientsDirectory records={[]} filter={ALL} mayViewPlans />);

    const empty = screen.getByRole("group", { name: /no patients yet/i });
    expect(empty).toBeInTheDocument();
    // The "filtered" wording shape must never appear on a genuinely empty caseload: it would
    // tell a clinician that patients exist and something is hiding them.
    expect(container.textContent ?? "").not.toContain("What changes it:");
    expect(empty.textContent ?? "").toMatch(/referral/i);
  });

  it("a caseload hidden by the state filter renders the filtered kind, naming the filter and the remedy", () => {
    const records = [planRecord({ id: "plan-1", state: "active" }), planRecord({ id: "plan-2", state: "active" })];
    const filter = parsePatientsDirectoryFilter({ state: "paused" });

    const { container } = render(<PatientsDirectory records={records} filter={filter} mayViewPlans />);

    const empty = screen.getByRole("group", { name: /no patients match/i });
    expect(empty).toBeInTheDocument();
    expect(within(empty).getByText(/Why:/)).toBeInTheDocument();
    expect(within(empty).getByText(/What changes it:/)).toBeInTheDocument();
    // The reason must name the filter that is actually set, and the count it is hiding.
    expect(empty.textContent ?? "").toContain("Paused");
    expect(empty.textContent ?? "").toContain("2");
    // Never the no-data claim.
    expect(container.textContent ?? "").not.toContain("No patients yet");
    // The remedy is reachable, not merely described...
    const remedy = screen.getByRole("link", { name: /show every plan/i });
    expect(remedy).toHaveAttribute("href", CARING_CONTACTS_ROUTES.patients);
    // ...and reaches it as a `<Link>`, not a raw anchor. The row test below makes this assertion
    // for the filter chips; without it here, the empty state's own action was the one link on this
    // screen that nothing checked -- measured, not assumed: removing the attribute from this link
    // alone left the whole file green.
    expect(remedy).toHaveAttribute("data-internal-link", "true");
  });

  it("a caseload hidden by the identifier search names the search text as the reason", () => {
    const records = [planRecord({ id: "plan-1", state: "active" })];
    const filter = parsePatientsDirectoryFilter({ q: "nothing-matches-this" });

    render(<PatientsDirectory records={records} filter={filter} mayViewPlans />);

    const empty = screen.getByRole("group", { name: /no patients match/i });
    expect(empty.textContent ?? "").toContain("nothing-matches-this");
  });

  it("a role that may not view plans is never told the team has no patients", () => {
    const { container } = render(<PatientsDirectory records={[]} filter={ALL} mayViewPlans={false} />);

    expect(container.textContent ?? "").not.toContain("No patients yet");
    const empty = screen.getByRole("group", { name: /not visible in this role/i });
    expect(within(empty).getByText(/Why:/)).toBeInTheDocument();
    expect(within(empty).getByText(/What changes it:/)).toBeInTheDocument();
    // The reason must not claim anything about how many plans exist: a read this role may not make
    // and a team holding none are indistinguishable by design, and saying otherwise would leak the
    // very thing the store withholds.
    expect(empty.textContent ?? "").toMatch(/says nothing about how many/i);
  });

  // Ruling 93. Asserting that "What changes it:" is PRESENT is a shape check, and a shape check
  // certifies a well-formed lie: the first version of this screen said "The role switcher changes
  // which role you are acting in", and no role switcher exists anywhere in this workspace's
  // interface. Spec 4.4 requires a remedy that can be REACHED, so the content is pinned here.
  it("states a remedy that exists, and never names a control the workspace does not have", () => {
    render(<PatientsDirectory records={[]} filter={ALL} mayViewPlans={false} />);
    const empty = screen.getByRole("group", { name: /not visible in this role/i });
    const text = empty.textContent ?? "";

    expect(text).toMatch(/nothing on this screen changes it/i);
    expect(text).toMatch(/no control for it anywhere in this workspace/i);
    // The exact false claim this test was written to keep out.
    expect(text).not.toMatch(/role switcher/i);
  });

  it("uses the not-permitted kind, so the icon does not report a search nobody ran", () => {
    // Ruling 92: the words were honest under `"filtered"`, the TYPE and the ICON were not.
    // `"filtered"` selects `SearchX`; this case must not.
    const restricted = render(<PatientsDirectory records={[]} filter={ALL} mayViewPlans={false} />);
    const restrictedIcon = restricted.container.querySelector("[role='group'] svg")?.getAttribute("class") ?? "";
    restricted.unmount();

    const filtered = render(
      <PatientsDirectory
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={parsePatientsDirectoryFilter({ state: "paused" })}
        mayViewPlans
      />,
    );
    const filteredIcon = filtered.container.querySelector("[role='group'] svg")?.getAttribute("class") ?? "";

    expect(restrictedIcon).not.toBe("");
    expect(filteredIcon).not.toBe("");
    expect(restrictedIcon, "the role-restricted empty state reuses the search icon").not.toBe(filteredIcon);
  });

  it("hides the filter controls entirely for a role that may not view plans", () => {
    render(<PatientsDirectory records={[]} filter={ALL} mayViewPlans={false} />);
    expect(screen.queryByRole("link", { name: "Active" })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe("Patients directory - rows", () => {
  it("lists one row per plan the team may see, keyed by the synthetic patient identifier", () => {
    const records = [
      planRecord({ id: "plan-1", state: "active" }),
      planRecord({ id: "plan-2", state: "paused" }),
      planRecord({ id: "plan-3", state: "completed" }),
    ];

    render(<PatientsDirectory records={records} filter={ALL} mayViewPlans />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "patient-plan-1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "patient-plan-2" })).toBeInTheDocument();
  });

  it("states each plan's state in words, not by colour alone", () => {
    render(<PatientsDirectory records={[planRecord({ id: "plan-1", state: "paused" })]} filter={ALL} mayViewPlans />);
    const row = screen.getAllByRole("listitem")[0];
    expect(row.textContent ?? "").toContain("Paused");
  });

  it("explains a contact the SYSTEM suppressed, in place, with why and what would change it", () => {
    const withAbsorbed = planRecord({
      id: "plan-1",
      state: "active",
      contacts: [contact(1), contact(2, { absorbed: true })],
    });

    render(<PatientsDirectory records={[withAbsorbed]} filter={ALL} mayViewPlans />);

    const automated = screen.getByRole("group", { name: "Suppressed" });
    expect(within(automated).getByText(/Why:/)).toBeInTheDocument();
    expect(within(automated).getByText(/What changes it:/)).toBeInTheDocument();
    // Reachable as text, never only as a hover title.
    expect(automated.querySelector("[title]")).toBeNull();
  });

  it("explains a contact suppressed by the transition, which carries no schedule marker", () => {
    // M-8: `planned.suppressed` marks only the schedule's own absorption. A contact moved to
    // `suppressed` by `applyContactTransition` has no such marker, and counting the plan rather
    // than the outcome left it with no explanation at all.
    const record = planRecord({
      id: "plan-1",
      state: "active",
      contacts: [contact(1), contact(2, { suppressed: true })],
    });

    render(<PatientsDirectory records={[record]} filter={ALL} mayViewPlans />);

    const automated = screen.getByRole("group", { name: "Suppressed" });
    expect(within(automated).getByText(/Why:/)).toBeInTheDocument();
    expect(within(automated).getByText(/What changes it:/)).toBeInTheDocument();
    // Not the Week 1 wording -- that reason is false for this contact.
    expect(automated.textContent ?? "").not.toMatch(/Week 1/);
    // And the remedy is honest about being final rather than inventing one.
    expect(automated.textContent ?? "").toMatch(/final/i);
  });

  it("says nothing about suppression when the system suppressed nothing", () => {
    render(<PatientsDirectory records={[planRecord({ id: "plan-1", state: "active" })]} filter={ALL} mayViewPlans />);
    expect(screen.queryByRole("group", { name: "Suppressed" })).toBeNull();
  });

  it("offers the row's detail control as an unavailable control, never a link into a route with no page", () => {
    render(<PatientsDirectory records={[planRecord({ id: "plan-1", state: "active" })]} filter={ALL} mayViewPlans />);

    const control = screen.getByRole("button", { name: /patient-plan-1/i });
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAttribute("type", "button");
    expect(control).toHaveAttribute("title", expect.stringContaining("coming soon"));
    // Native `disabled` would remove the tab stop, so the stated reason could never be reached.
    expect(control).not.toHaveAttribute("disabled");
    // And nothing on this screen links into the not-yet-built detail routes...
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/\/caring-contacts\/(patients\/[^?]|plans\/)/);
      // ...nor reaches an internal route by a raw anchor. `data-internal-link` is the marker the
      // shell test uses to tell a `<Link>` from an `<a href="/…">`, which render identically.
      expect(link.getAttribute("data-internal-link"), `${link.getAttribute("href")} is not a <Link>`).toBe("true");
    }
  });

  it("releases no patient-identifying detail - a directory never calls getEpisode", () => {
    const records = [planRecord({ id: "plan-1", state: "active" })];
    const { container } = render(<PatientsDirectory records={records} filter={ALL} mayViewPlans />);
    // `PlanRecord` carries no name, mobile number, identifier list or cultural identity by
    // construction; this pins that the screen does not invent a place to put one either.
    expect(container.textContent ?? "").not.toMatch(/mobile|patient name|cultural/i);
  });
});

describe("Patients directory - the filter is a URL, not a client boundary", () => {
  it("parses a known plan state and ignores an unknown one rather than failing the render", () => {
    expect(parsePatientsDirectoryFilter({ state: "paused" }).state).toBe("paused");
    expect(parsePatientsDirectoryFilter({ state: "not-a-state" }).state).toBe("all");
    expect(parsePatientsDirectoryFilter({ state: ["active", "paused"] }).state).toBe("all");
  });

  it("trims the search text and treats a blank search as no search", () => {
    expect(parsePatientsDirectoryFilter({ q: "  plan-1  " }).query).toBe("plan-1");
    expect(parsePatientsDirectoryFilter({ q: "   " }).query).toBe("");
    expect(parsePatientsDirectoryFilter({}).query).toBe("");
  });

  it("builds every filter href from the route module, carrying the other filter with it", () => {
    expect(patientsDirectoryHref({ state: "all", query: "" })).toBe(CARING_CONTACTS_ROUTES.patients);
    expect(patientsDirectoryHref({ state: "active", query: "" })).toBe(
      `${CARING_CONTACTS_ROUTES.patients}?state=active`,
    );
    const both = patientsDirectoryHref({ state: "active", query: "plan 1" });
    expect(both.startsWith(`${CARING_CONTACTS_ROUTES.patients}?`)).toBe(true);
    expect(new URL(both, "https://example.invalid").searchParams.get("q")).toBe("plan 1");
  });

  it("filters by plan state without any client component in the tree", () => {
    const records = [planRecord({ id: "plan-1", state: "active" }), planRecord({ id: "plan-2", state: "paused" })];

    render(
      <PatientsDirectory records={records} filter={parsePatientsDirectoryFilter({ state: "paused" })} mayViewPlans />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "patient-plan-2" })).toBeInTheDocument();
  });

  it("matches the identifier search case-insensitively against the patient and plan identifiers", () => {
    const records = [planRecord({ id: "plan-1", state: "active" }), planRecord({ id: "plan-2", state: "active" })];
    render(<PatientsDirectory records={records} filter={parsePatientsDirectoryFilter({ q: "PLAN-2" })} mayViewPlans />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "patient-plan-2" })).toBeInTheDocument();
  });

  it("submits the search as an ordinary GET form, so the filter needs no JavaScript", () => {
    const { container } = render(
      <PatientsDirectory records={[]} filter={parsePatientsDirectoryFilter({ state: "active" })} mayViewPlans />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", CARING_CONTACTS_ROUTES.patients);
    // The state filter rides along in a hidden field, so searching cannot silently widen it.
    expect(form?.querySelector('input[type="hidden"][name="state"]')).toHaveValue("active");
  });

  it("marks the current state filter, so the screen and the URL cannot disagree", () => {
    render(<PatientsDirectory records={[]} filter={parsePatientsDirectoryFilter({ state: "paused" })} mayViewPlans />);
    expect(screen.getByRole("link", { name: "Paused" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Active" })).not.toHaveAttribute("aria-current");
  });
});
