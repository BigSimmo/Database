import { render, screen } from "@testing-library/react";
import { type ReactNode, useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PatientId } from "../src/components/ward-management/ward-patients";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Dispatches a real `ADD_PATIENT` event through the live provider/reducer, then renders that
 * person's own screen once the state carries them. This exists only for the "fresh patient" test
 * below — `WardFlowProvider` takes no seed-state override prop, so the honest way to get a person
 * with none of R-2026-09-04-A's nine fields set is to add one the same way the app does.
 */
function AddPatientThenShowScreen() {
  const { dispatch, patients } = useWardFlow();
  /*
   * A REF, NOT STATE, AND THE LINT RULE IS RIGHT. This guard exists only to make the dispatch
   * happen once; nothing renders from it. Holding it in state meant calling `setDispatched` inside
   * the effect, which schedules a second render for a value no one reads — the cascading-render
   * pattern `react-hooks/set-state-in-effect` exists to stop. The re-render that matters here is
   * the one the provider triggers when `patients` actually changes.
   */
  const dispatchedRef = useRef(false);

  useEffect(() => {
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    dispatch({
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW_ANCHOR,
      umrn: "UM900999",
      givenName: "Freshly",
      familyName: "Added",
      dateOfBirth: "2000-01-01",
    });
  }, [dispatch]);

  const added = patients.find((patient) => patient.umrn === "UM900999");
  if (added === undefined) return null;
  return <PersonScreen patientId={added.id} />;
}

/**
 * OWNER RULING R-2026-09-04-A (`docs/ward-flow/owner-rulings-2026-09-04.md` section A): `Patient`
 * may hold, among seven others, Aboriginal or Torres Strait Islander status and interpreter /
 * preferred language. The ruling is about what the record may HOLD, not how these two are
 * PRESENTED — that stays open with the Aboriginal health review — but where a screen does render
 * them, the placement rule binds absolutely:
 *
 *   1. The two fields must not sit adjacent to each other.
 *   2. Neither may sit directly above the psychiatric history panel.
 *
 * ⚠️ HALF 2 WAS MISSED ONCE ALREADY. An earlier fix moved Aboriginal status out of the position
 * directly above the history panel and pushed interpreter language into that exact spot instead —
 * satisfying half 1 while failing half 2, and the single non-adjacency test in place at the time
 * passed throughout, because it never asked "and is the one that moved IN now the problem?" That is
 * why this file asserts the two halves separately, each with its own mutation, rather than folding
 * them into one "placement is fine" check that a single reordering could satisfy by accident.
 *
 * There is no psychiatric history panel on this screen yet (`Movement` carries no `patientId` — see
 * `person-screen.tsx`'s header comment), so "directly above it" is operationalised as: neither
 * sensitive field is the LAST fact rendered in the "Placement details" panel, which is the last
 * info panel on the screen today and therefore the one a future history panel would sit beneath.
 */
describe("the placement rule for the two sensitive fields (R-2026-09-04-A)", () => {
  const withBoth = seedWardFlowState().patients.find(
    (patient) =>
      patient.aboriginalOrTorresStraitIslanderStatus !== undefined && patient.interpreterLanguage !== undefined,
  );

  function renderPerson(id: PatientId) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId={id} />
      </WardFlowProvider>,
    );
  }

  function placementListChildren(): Element[] {
    const panel = screen.getByTestId("ward-person-placement-details");
    const list = panel.querySelector("dl");
    if (list === null) throw new Error("Placement details panel has no <dl> — every assertion below is vacuous.");
    return Array.from(list.children);
  }

  it("has a seeded patient carrying both sensitive fields, or the assertions below are vacuous", () => {
    expect(
      withBoth,
      "the seed must carry at least one patient with both R-2026-09-04-A sensitive fields set",
    ).toBeDefined();
  });

  it("renders exactly the two sensitive slots the ruling names, and nothing else claims that attribute", () => {
    renderPerson(withBoth!.id);
    const slots = placementListChildren()
      .filter((child) => child.hasAttribute("data-sensitive-slot"))
      .map((child) => child.getAttribute("data-sensitive-slot"));
    expect(slots.sort(), "exactly two sensitive-slot facts, named for the two fields the placement rule binds").toEqual(
      ["aboriginalOrTorresStraitIslander", "interpreterLanguage"],
    );
  });

  it("ASSERTION 1 — Aboriginal/Torres Strait Islander status and interpreter/preferred language are NOT adjacent", () => {
    renderPerson(withBoth!.id);
    const children = placementListChildren();
    const sensitiveIndices = children
      .map((child, index) => (child.hasAttribute("data-sensitive-slot") ? index : -1))
      .filter((index) => index !== -1);
    expect(sensitiveIndices, "the two sensitive facts must both be present to test adjacency").toHaveLength(2);
    const [first, second] = sensitiveIndices;
    expect(
      second - first,
      "the two sensitive fields sit next to each other in the DOM. R-2026-09-04-A: they must not be adjacent.",
    ).toBeGreaterThan(1);
  });

  it("ASSERTION 2 — neither sensitive field is the LAST fact, so neither sits directly above a future history panel", () => {
    renderPerson(withBoth!.id);
    const children = placementListChildren();
    const last = children[children.length - 1];
    expect(
      last.hasAttribute("data-sensitive-slot"),
      "a sensitive field is the last fact rendered in the last panel on this screen. If a psychiatric " +
        "history panel is ever added below it, this is the field that would sit directly above it — " +
        "which R-2026-09-04-A forbids regardless of which of the two fields it is.",
    ).toBe(false);
  });

  it("falls back to 'Not recorded' rather than a blank field for a freshly added patient", () => {
    // The owner's add-patient flow collects identity only (ADD_PATIENT), so a person who has never
    // had these fields entered must render an honest gap, not an empty <dd> a reader could mistake
    // for a bug.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientThenShowScreen />
      </WardFlowProvider>,
    );

    const panel = screen.getByTestId("ward-person-placement-details");
    expect(panel.textContent ?? "").toMatch(/not recorded/i);
  });
});
