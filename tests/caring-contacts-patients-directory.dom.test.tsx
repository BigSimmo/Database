// tests/caring-contacts-patients-directory.dom.test.tsx
//
// The Patients directory body (Task 5), tested as the pure Server Component it is: it is handed
// the records the page already read and decides only what to SHOW.
//
// The assertions that matter are about honesty rather than layout:
//   * an empty caseload and a caseload hidden by a filter are DIFFERENT facts, and the two
//     `ListEmptyState` kinds are not interchangeable (Task 1's whole reason for existing);
//   * a role that may not view plans at all must not be told the team has no patients;
//   * a directory releases the patient's NAME and no other identifying detail -- the name comes
//     from `listPatientNames`, whose type holds nothing else, and `getEpisode` (the only read that
//     releases a mobile number, an identifier list or a cultural identity) is never called here;
//   * a role that may not see names is TOLD so once, above the list, rather than left to wonder why
//     every row is headed by an identifier;
//   * a row's detail control is an UNAVAILABLE control with a stated reason, not a link into a
//     route that does not exist yet (Ruling 52).
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PatientsDirectory,
  parsePatientsDirectoryFilter,
  patientsDirectoryHref,
} from "@/components/caring-contacts/workspace/patients-directory";
import { CARING_CONTACTS_ROUTES, patientRoute } from "@/lib/caring-contacts-routes";
import { contactId, pathwayVersionId, patientId, planId, referralId, teamId } from "@/lib/caring-contacts/ids";
import type { PlanState } from "@/lib/caring-contacts/model";
import type { PatientNameProjection, PlanRecord, StoredContact } from "@/lib/caring-contacts/repository";

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

/**
 * What `listPatientNames` releases when it releases nothing for these plans -- a de-identified
 * episode, or a role that may list plans without holding `viewPatientRecord`. Most tests below use
 * it because they are about something other than the name, and it keeps the row on its fallback:
 * headed by the synthetic identifier, exactly as Task 5 shipped it.
 */
const NO_NAMES: readonly PatientNameProjection[] = [];

/** The names read's answer for one plan. Two fields, which is all the type has. */
function name(planIdText: string, patientName: string): PatientNameProjection {
  return { planId: planId(planIdText), patientName };
}

describe("Patients directory - the two empty states are not interchangeable", () => {
  it("an empty caseload renders the no-data kind, which states how a first patient arrives", () => {
    const { container } = render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[]} filter={ALL} mayViewPlans />,
    );

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

    const { container } = render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={records} filter={filter} mayViewPlans />,
    );

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

    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={records} filter={filter} mayViewPlans />,
    );

    const empty = screen.getByRole("group", { name: /no patients match/i });
    expect(empty.textContent ?? "").toContain("nothing-matches-this");
  });

  it("a role that may not view plans is never told the team has no patients", () => {
    const { container } = render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[]} filter={ALL} mayViewPlans={false} />,
    );

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
    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[]} filter={ALL} mayViewPlans={false} />,
    );
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
    const restricted = render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[]} filter={ALL} mayViewPlans={false} />,
    );
    const restrictedIcon = restricted.container.querySelector("[role='group'] svg")?.getAttribute("class") ?? "";
    restricted.unmount();

    const filtered = render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
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
    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[]} filter={ALL} mayViewPlans={false} />,
    );
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

    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={records} filter={ALL} mayViewPlans />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "patient-plan-1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "patient-plan-2" })).toBeInTheDocument();
  });

  it("states each plan's state in words, not by colour alone", () => {
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[planRecord({ id: "plan-1", state: "paused" })]}
        filter={ALL}
        mayViewPlans
      />,
    );
    const row = screen.getAllByRole("listitem")[0];
    expect(row.textContent ?? "").toContain("Paused");
  });

  it("explains a contact the SYSTEM suppressed, in place, with why and what would change it", () => {
    const withAbsorbed = planRecord({
      id: "plan-1",
      state: "active",
      contacts: [contact(1), contact(2, { absorbed: true })],
    });

    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[withAbsorbed]}
        filter={ALL}
        mayViewPlans
      />,
    );

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

    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[record]} filter={ALL} mayViewPlans />,
    );

    const automated = screen.getByRole("group", { name: "Suppressed" });
    expect(within(automated).getByText(/Why:/)).toBeInTheDocument();
    expect(within(automated).getByText(/What changes it:/)).toBeInTheDocument();
    // Not the Week 1 wording -- that reason is false for this contact.
    expect(automated.textContent ?? "").not.toMatch(/Week 1/);
    // And the remedy is honest about being final rather than inventing one.
    expect(automated.textContent ?? "").toMatch(/final/i);
  });

  // N-3. `scheduled` changed definition this round -- it counts `contacts.length` minus the
  // contacts whose OWN state is suppressed, where it used to subtract only the schedule's absorbed
  // ones. Nothing asserted the rendered number, so the change could have been silently wrong on
  // every row. This is a clinician-facing count of how many messages a patient will receive.
  it("states how many messages remain in the schedule, and subtracts every suppressed one", () => {
    const plain = planRecord({ id: "plan-1", state: "active", contacts: [contact(1), contact(2)] });
    const withSuppressed = planRecord({
      id: "plan-2",
      state: "active",
      contacts: [contact(1), contact(2, { suppressed: true }), contact(3, { absorbed: true })],
    });

    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[plain, withSuppressed]}
        filter={ALL}
        mayViewPlans
      />,
    );

    const [first, second] = screen.getAllByRole("listitem");
    expect(first.textContent ?? "").toContain("2 messages in the schedule");
    // Three contacts, two of them suppressed by two different causes, so one message remains.
    expect(second.textContent ?? "").toContain("1 message in the schedule");
  });

  // N-2. The count subtracts EVERY suppressed contact, so the reason beside it has to account for
  // every one of them. The first shape branched on whether an absorbed contact existed at all, so
  // this plan showed a count short by two beside a reason explaining one.
  it("accounts for both causes when a plan carries an absorbed AND a transition-suppressed contact", () => {
    const record = planRecord({
      id: "plan-1",
      state: "active",
      contacts: [contact(1), contact(2, { absorbed: true }), contact(3, { suppressed: true })],
    });

    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={[record]} filter={ALL} mayViewPlans />,
    );

    const automated = screen.getByRole("group", { name: "Suppressed" });
    const text = automated.textContent ?? "";
    // The absorbed cause, with its own remedy...
    expect(text).toMatch(/Week 1/);
    expect(text).toMatch(/first-contact date/i);
    // ...and the other one, with its own, which is a different remedy entirely.
    expect(text).toMatch(/does not hold what caused that/i);
    expect(text).toMatch(/final/i);
  });

  it("says nothing about suppression when the system suppressed nothing", () => {
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={ALL}
        mayViewPlans
      />,
    );
    expect(screen.queryByRole("group", { name: "Suppressed" })).toBeNull();
  });

  // Ruling 99, Task 6. This control was an `UnavailableDestination` while
  // `/caring-contacts/patients/[patientId]` did not exist -- Ruling 52: an unbuilt destination is
  // an unavailable control with a stated reason, never a link into a route that would 404. That
  // screen now exists, so the assertion inverts with it: the control must be a real `<Link>` at
  // the patient route, and it must still be NAMED by the identifier, which is the only thing
  // distinguishing one row's control from the next to a screen reader.
  it("offers the row's detail control as a Link to the patient overview, named by the identifier", () => {
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={ALL}
        mayViewPlans
      />,
    );

    const control = screen.getByRole("link", { name: /patient-plan-1/i });
    expect(control).toHaveAttribute("href", "/caring-contacts/patients/patient-plan-1");
    // The route module builds it -- never a path literal assembled in the component.
    expect(control).toHaveAttribute("href", patientRoute("patient-plan-1"));
    // Nothing here reaches the PLAN detail route, whose page Task 7 builds...
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/\/caring-contacts\/plans\//);
      // ...nor reaches an internal route by a raw anchor. `data-internal-link` is the marker the
      // shell test uses to tell a `<Link>` from an `<a href="/…">`, which render identically.
      expect(link.getAttribute("data-internal-link"), `${link.getAttribute("href")} is not a <Link>`).toBe("true");
    }
  });

  it("releases the name and nothing else - a directory never calls getEpisode", () => {
    const records = [planRecord({ id: "plan-1", state: "active" })];
    const { container } = render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={[name("plan-1", "Jordan Nguyen")]}
        records={records}
        filter={ALL}
        mayViewPlans
      />,
    );

    // The name is rendered WITH the names read in place, so the absences below are the screen
    // holding nothing else rather than the screen holding nothing at all.
    expect(screen.getByRole("heading", { name: "Jordan Nguyen" })).toBeInTheDocument();
    // `PlanRecord` carries no identifying detail by construction and `PatientNameProjection` has
    // two fields, so the other three fields `getEpisode` releases have nowhere to come from. This
    // pins that the screen does not invent a place to put one either.
    // "patient name" is back in the alternation (review M-6). The screen renders the name itself
    // but never that literal phrase as a label, so dropping it bought nothing and lost a guard
    // against a future row growing a "Patient name:" field label beside a widened read.
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
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={records}
        filter={parsePatientsDirectoryFilter({ state: "paused" })}
        mayViewPlans
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "patient-plan-2" })).toBeInTheDocument();
  });

  it("matches the identifier search case-insensitively against the patient and plan identifiers", () => {
    // Unchanged by the names projection: an identifier search still works with no name in play.
    const records = [planRecord({ id: "plan-1", state: "active" }), planRecord({ id: "plan-2", state: "active" })];
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={records}
        filter={parsePatientsDirectoryFilter({ q: "PLAN-2" })}
        mayViewPlans
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "patient-plan-2" })).toBeInTheDocument();
  });

  it("submits the search as an ordinary GET form, so the filter needs no JavaScript", () => {
    const { container } = render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[]}
        filter={parsePatientsDirectoryFilter({ state: "active" })}
        mayViewPlans
      />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", CARING_CONTACTS_ROUTES.patients);
    // The state filter rides along in a hidden field, so searching cannot silently widen it.
    expect(form?.querySelector('input[type="hidden"][name="state"]')).toHaveValue("active");
  });

  it("marks the current state filter, so the screen and the URL cannot disagree", () => {
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[]}
        filter={parsePatientsDirectoryFilter({ state: "paused" })}
        mayViewPlans
      />,
    );
    expect(screen.getByRole("link", { name: "Paused" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Active" })).not.toHaveAttribute("aria-current");
  });
});

describe("Patients directory - the names-only projection (Ruling 91)", () => {
  it("heads the row with the patient's name, and keeps the synthetic identifier beside it", () => {
    const records = [planRecord({ id: "plan-1", state: "active" })];

    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={[name("plan-1", "Jordan Nguyen")]}
        records={records}
        filter={ALL}
        mayViewPlans
      />,
    );

    expect(screen.getByRole("heading", { name: "Jordan Nguyen" })).toBeInTheDocument();
    // Still present in the row's own body, because two patients can share a name.
    //
    // M7 in the mutation ledger: this assertion was first written as "the row's text contains the
    // identifier", which the DETAIL CONTROL satisfies on its own -- so deleting the identifier line
    // entirely left the file green. It reads the line itself now.
    const row = screen.getAllByRole("listitem")[0];
    expect(within(row).getByText(/Synthetic identifier: patient-plan-1/)).toBeInTheDocument();
    // And the control is still named by the identifier, which is what distinguishes one row's
    // control from the next to a screen reader.
    expect(screen.getByRole("link", { name: /patient-plan-1/i })).toBeInTheDocument();
  });

  it("falls back to the synthetic identifier, and labels it as one, when no name came back", () => {
    // The case a role without `viewPatientRecord` produces: `listPatientNames` answers `[]`, exactly
    // as `listPlans` answers an actor who may not read it, and the screen must not present an
    // identifier as though it were a name.
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={ALL}
        mayViewPlans
      />,
    );

    expect(screen.getByRole("heading", { name: "patient-plan-1" })).toBeInTheDocument();
    expect(screen.getByText("Synthetic patient identifier")).toBeInTheDocument();
  });

  it("treats a de-identified plan's empty name as no name held, never as a blank heading", () => {
    // `markRetentionCleared` writes the empty string for a removed name in both stores, so the
    // projection carries an entry whose name is "". Rendering it verbatim would give the row an
    // empty heading and no identifier at all -- a row naming nobody.
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={[name("plan-1", "")]}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={ALL}
        mayViewPlans
      />,
    );

    expect(screen.getByRole("heading", { name: "patient-plan-1" })).toBeInTheDocument();
    expect(screen.getByText("Synthetic patient identifier")).toBeInTheDocument();
  });

  it("matches the search against the name as well as the identifiers, still without client state", () => {
    const records = [planRecord({ id: "plan-1", state: "active" }), planRecord({ id: "plan-2", state: "active" })];
    const names = [name("plan-1", "Jordan Nguyen"), name("plan-2", "Alex Whitlock")];

    const { container } = render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={names}
        records={records}
        filter={parsePatientsDirectoryFilter({ q: "nguyen" })}
        mayViewPlans
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Jordan Nguyen" })).toBeInTheDocument();
    // The whole filter is still the URL: an ordinary GET form and a server render, no controlled
    // input and no client boundary. Ruling 13.
    expect(container.querySelector("form")).toHaveAttribute("method", "get");
  });

  it("finds no row by a name it does not hold, when the names read released nothing", () => {
    // The empty haystack segment must not turn into a wildcard: a role that may not read names
    // searching for one must find nothing, not everything.
    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={parsePatientsDirectoryFilter({ q: "Jordan" })}
        mayViewPlans
      />,
    );

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("group", { name: /no patients match/i })).toBeInTheDocument();
  });
});

describe("Patients directory - a role that may not see names is told once, not per row", () => {
  const records = [planRecord({ id: "plan-1", state: "active" }), planRecord({ id: "plan-2", state: "active" })];

  it("states the role restriction once above the list, with a reason and a remedy", () => {
    render(
      <PatientsDirectory
        mayViewPatientNames={false}
        patientNames={NO_NAMES}
        records={records}
        filter={ALL}
        mayViewPlans
      />,
    );

    const notice = screen.getByRole("note", { name: /names are not shown in this role/i });
    expect(within(notice).getByText(/Why:/)).toBeInTheDocument();
    expect(within(notice).getByText(/What changes it:/)).toBeInTheDocument();
    // ONCE, not per row: two rows, one notice.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("note")).toHaveLength(1);
    // Reachable as text, never only as a hover title -- spec 4.4.
    expect(notice.querySelector("[title]")).toBeNull();
    // And it must not claim anything about whether names are held, which it cannot know.
    expect(notice.textContent ?? "").toMatch(/says nothing about\s+whether a name is held/i);
  });

  it("never prints the notice for a role that may see names, so a nameless row means de-identified", () => {
    // This is the whole point of stating the actor-level fact: with no notice on the page, the only
    // remaining cause of a nameless row is a retention clearance. A notice printed here would make
    // that inference false.
    render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={records} filter={ALL} mayViewPlans />,
    );

    expect(screen.queryByRole("note")).toBeNull();
  });

  it("offers a name search only when names are released, so the control cannot promise what it cannot find", () => {
    const withNames = render(
      <PatientsDirectory mayViewPatientNames patientNames={NO_NAMES} records={records} filter={ALL} mayViewPlans />,
    );
    expect(
      screen.getByLabelText(/Search by name, or by synthetic patient, plan or referral identifier/i),
    ).toBeInTheDocument();
    expect(withNames.container.querySelector("input[type='search']")).toHaveAttribute(
      "placeholder",
      "Name or synthetic ID",
    );
    withNames.unmount();

    const withoutNames = render(
      <PatientsDirectory
        mayViewPatientNames={false}
        patientNames={NO_NAMES}
        records={records}
        filter={ALL}
        mayViewPlans
      />,
    );
    expect(screen.getByLabelText(/^Search by synthetic patient, plan or referral identifier$/i)).toBeInTheDocument();
    expect(withoutNames.container.querySelector("input[type='search']")).toHaveAttribute(
      "placeholder",
      "Synthetic identifier",
    );
  });

  // Review M-5: the row's eyebrow label had only its dangerous direction pinned. Collapsing it to
  // always-"Synthetic patient identifier" left the suite green even with a name rendered above it --
  // a row that reads "Synthetic patient identifier / Jordan Nguyen" is a mislabelled name, which is
  // the same class of defect as an unlabelled one. Both branches are read here.
  it("labels the heading for what it is, in both directions", () => {
    const named = render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={[name("plan-1", "Jordan Nguyen")]}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={ALL}
        mayViewPlans
      />,
    );
    const namedRow = screen.getAllByRole("listitem")[0];
    expect(within(namedRow).getByText("Patient")).toBeInTheDocument();
    expect(within(namedRow).queryByText("Synthetic patient identifier")).toBeNull();
    named.unmount();

    render(
      <PatientsDirectory
        mayViewPatientNames
        patientNames={NO_NAMES}
        records={[planRecord({ id: "plan-1", state: "active" })]}
        filter={ALL}
        mayViewPlans
      />,
    );
    const fallbackRow = screen.getAllByRole("listitem")[0];
    expect(within(fallbackRow).getByText("Synthetic patient identifier")).toBeInTheDocument();
    expect(within(fallbackRow).queryByText("Patient")).toBeNull();
  });
});
