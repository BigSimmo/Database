import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as the sibling dom suites (ward-ed-screen.dom.test.tsx, ward-screen.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS, type Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE BOOKING CONTROL ON THE ED SCREEN, AND THE ONE THING IT MUST NEVER DO.
 *
 * `TR-D1` (owner, 2026-08-30) puts the booking on the sending team, because that team knows the
 * two facts a booking needs — who is collecting, and whether this person needs an escort.
 *
 * ⚠️ **THE ESCORT QUESTION OPENS BLANK, BY THE OWNER'S OWN RULING** (relayed 2026-08-30), taken
 * after the trade-off was put to him as a clinician. **A pre-filled clinical judgement is answered
 * by clicking past it**, and the record then asserts that a clinician decided when nobody did —
 * worse than the honest derivation it replaces, because it launders an automatic value through a
 * human's name. `tests/ward-book-transport.test.ts` pins the model half (the event REQUIRES an
 * answer); this file pins the half a convention in one component would otherwise be the only thing
 * holding: that the SCREEN offers no answer, from legal status or from anywhere else.
 *
 * ⚠️ **THE FIXTURE IS CHOSEN SO A PRE-FILL WOULD BE VISIBLE.** The first held bed in the seed
 * belongs to a patient the deleted derivation would have escorted (`legalStatus !== "Voluntary"`),
 * which the first test asserts before it asserts anything else. Against a Voluntary patient the
 * blank-radio checks below would pass whether or not somebody wired `legalStatus` back in.
 *
 * Everything here is driven through the real screen, the real provider and the real reducer.
 * Nothing dispatches directly: the panel is opened, the fields are set and the control is pressed
 * exactly as a clinician would, and the result is read back through `useWardFlow`.
 */
function heldBedMovement(): Movement {
  const movement = seedWardFlowState().movements.find(
    (candidate) => candidate.stage === "bed_held" && candidate.transport === undefined,
  );
  expect(
    movement,
    "the fixture must hold an unbooked movement with a bed held, or nothing here is exercised",
  ).toBeDefined();
  return movement!;
}

/** A movement at the SAME department that is not at `bed_held` — the stage guard's own case,
 *  discovered rather than named, so a fixture change cannot leave this suite asserting nothing. */
function notHeldMovementAtSameEd(edId: string): Movement {
  const movement = seedWardFlowState().movements.find(
    (candidate) =>
      candidate.originEdId === edId &&
      candidate.stage !== "bed_held" &&
      candidate.stage !== "arrived" &&
      candidate.closure === undefined,
  );
  expect(
    movement,
    `the fixture must hold a non-held open movement at ${edId}, or the stage guard is untested`,
  ).toBeDefined();
  return movement!;
}

/** Reads the booked job and the reducer's refusals back out of live state. `rejections` is the
 *  half that matters most: a control that dispatched something the reducer refused would look
 *  identical on screen to one that did nothing, which is the silent-refusal defect this repo has
 *  hit before. */
function TransportProbe({ movementId }: { movementId: string }) {
  const { movements, rejections } = useWardFlow();
  const transport = movements.find((movement) => movement.id === movementId)?.transport;
  return (
    <p data-testid="transport-probe">
      {transport ? `${transport.provider}|escort=${transport.escortRequired}` : "no-transport"}|rejections=
      {rejections.length}
    </p>
  );
}

function renderEdFor(movement: Movement) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={movement.originEdId} />
      <TransportProbe movementId={movement.id} />
    </WardFlowProvider>,
  );
}

const escortRadios = (movementId: string) => ({
  yes: screen.getByTestId(`ward-ed-transport-escort-yes-${movementId}`),
  no: screen.getByTestId(`ward-ed-transport-escort-no-${movementId}`),
});

describe("booking transport from the sending emergency department", () => {
  it("⚠️ OPENS THE ESCORT QUESTION BLANK, for a patient the deleted derivation would have escorted", () => {
    const movement = heldBedMovement();
    // Stated first, because every assertion below is only meaningful against this patient: the
    // derivation being replaced (`escortRequired: movement.legalStatus !== "Voluntary"`) would
    // have pre-selected "Escort required" here.
    expect(
      movement.legalStatus,
      "this fixture no longer bites — pick a held bed whose patient the old derivation would have escorted",
    ).not.toBe("Voluntary");

    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));

    const escort = escortRadios(movement.id);
    expect(escort.yes).not.toBeChecked();
    expect(escort.no).not.toBeChecked();

    // Non-vacuity: there really are two answers on screen, so an empty fieldset could not pass the
    // two checks above by rendering nothing at all.
    const offered = screen.getByTestId(`ward-ed-transport-escort-${movement.id}`).querySelectorAll("input[type=radio]");
    expect(offered).toHaveLength(2);
  });

  it("offers every declared provider and none of them chosen", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));

    const picker = screen.getByTestId(`ward-ed-transport-provider-${movement.id}`) as HTMLSelectElement;
    expect(picker.value, "a provider nobody chose is the same unmade claim as a pre-filled escort answer").toBe("");

    // Derived from the exported array, in its declared order — a hand-written options list is how
    // a cohort was silently omitted from this screen once before.
    const offered = [...picker.options].slice(1).map((option) => option.value);
    expect(offered).toEqual([...TRANSPORT_PROVIDERS]);
    expect(offered.length, "non-vacuity: an emptied list could not pass the comparison above").toBeGreaterThan(2);
  });

  it("⚠️ REFUSES TO OFFER A BOOKING WHILE THE ESCORT QUESTION IS UNANSWERED, and says why", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[0] },
    });

    const confirm = screen.getByTestId(`ward-ed-book-transport-confirm-${movement.id}`);
    // `aria-disabled` and NOT the native attribute: the reason has to stay reachable by keyboard,
    // and the two together is the shape `require-button-wiring` fails.
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).not.toHaveAttribute("disabled");
    const reasonId = confirm.getAttribute("aria-describedby");
    expect(reasonId, "an unavailable control with no reachable reason is the defect, not the fix").toBeTruthy();
    expect(document.getElementById(reasonId!)?.textContent ?? "").toContain("escort");

    // Pressing it books nothing AND refuses nothing: a dispatch the reducer rejected would leave
    // the screen looking exactly like this one while a rejection piled up behind it.
    fireEvent.click(confirm);
    expect(screen.getByTestId("transport-probe")).toHaveTextContent("no-transport|rejections=0");
  });

  it("books the answer the clinician gave — including no escort for a detained patient", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[1] },
    });
    fireEvent.click(escortRadios(movement.id).no);

    const confirm = screen.getByTestId(`ward-ed-book-transport-confirm-${movement.id}`);
    expect(confirm, "both questions are answered, so the control must be available").not.toHaveAttribute(
      "aria-disabled",
    );
    fireEvent.click(confirm);

    // `escort=false` is an ANSWER, and it survives for a patient whose legal status would have
    // produced `true`. `rejections=0` proves the screen dispatched as a role the reducer permits —
    // a coordinator dispatch would have been refused at the role gate and shown here.
    expect(screen.getByTestId("transport-probe")).toHaveTextContent(
      `${TRANSPORT_PROVIDERS[1]}|escort=false|rejections=0`,
    );
  });

  it("⚠️ WILL NOT OFFER A SECOND BOOKING once a job exists — it is cancel-then-rebook, not rebook", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[0] },
    });
    fireEvent.click(escortRadios(movement.id).yes);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-confirm-${movement.id}`));
    expect(screen.getByTestId("transport-probe")).toHaveTextContent(
      `${TRANSPORT_PROVIDERS[0]}|escort=true|rejections=0`,
    );

    // The movement stays at `bed_held` after a booking, so this card is exactly where a second
    // booking would be attempted — and the control must now be unavailable rather than replacing
    // a job the provider may already have accepted.
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toHaveAttribute("disabled");
    const reasonId = toggle.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId!)?.textContent ?? "").toContain("cancelled");

    // And pressing it opens nothing, so there is no second panel to book from.
    fireEvent.click(toggle);
    expect(screen.queryByTestId(`ward-ed-book-transport-${movement.id}`)).toBeNull();
  });

  it("⚠️ CARRIES NOTHING OVER when the panel is reopened — a remembered answer is a derived one", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);

    fireEvent.click(toggle);
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[0] },
    });
    fireEvent.click(escortRadios(movement.id).yes);
    expect(
      escortRadios(movement.id).yes,
      "non-vacuity: the answer must actually take, or reopening proves nothing",
    ).toBeChecked();

    fireEvent.click(toggle); // closes
    fireEvent.click(toggle); // reopens

    const reopened = escortRadios(movement.id);
    expect(reopened.yes).not.toBeChecked();
    expect(reopened.no).not.toBeChecked();
    expect((screen.getByTestId(`ward-ed-transport-provider-${movement.id}`) as HTMLSelectElement).value).toBe("");
  });

  it("does not offer a booking outside stage bed_held, and names the stage it is at", () => {
    const held = heldBedMovement();
    const other = notHeldMovementAtSameEd(held.originEdId);
    renderEdFor(other);

    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${other.id}`);
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toHaveAttribute("disabled");
    const reasonId = toggle.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId!)?.textContent ?? "").toContain("not bed held");
    expect(screen.queryByTestId(`ward-ed-book-transport-${other.id}`)).toBeNull();
  });
});
