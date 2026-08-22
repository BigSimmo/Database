import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AutomatedState } from "@/components/caring-contacts/workspace/automated-state";
import { ServiceStateBanner } from "@/components/caring-contacts/workspace/service-state-banner";
import { CaringContactsShell } from "@/components/caring-contacts/workspace/shell";
import { fixedClock } from "@/lib/caring-contacts/clock";
import { actorId, teamId } from "@/lib/caring-contacts/ids";
import { applyServiceStop, runningService, type ServiceState } from "@/lib/caring-contacts/service-state";

/**
 * A string that appears in the fixture's incident note and NOWHERE else.
 *
 * The reason for a sentinel rather than only the plausible literals below: a
 * name-and-number check (`/Rowan|Mira|\+61/`) only catches the leak it happened
 * to imagine. The note is free text a responder types mid-incident, so the next
 * one could name a ward, a message id, or a street — none of which those
 * literals would catch. The sentinel catches ANY path from `note` to the DOM,
 * whatever the note happens to say.
 */
const NOTE_SENTINEL = "NOTE-LEAK-SENTINEL-9F3C";

const INCIDENT_CLOCK = fixedClock("2026-08-19T02:00:00.000Z");

/**
 * A stopped service whose note carries both the sentinel and the kind of patient
 * detail a real responder would write: a name, a second name, a mobile number.
 */
function stoppedServiceState(): ServiceState {
  const stopped = applyServiceStop(
    runningService(teamId("TEAM-A")),
    {
      reason: "wrong-recipient",
      actorId: actorId("ACTOR-RESPONDER"),
      note: `${NOTE_SENTINEL} Week 3 message for Rowan went to Mira on +61 400 000 000.`,
    },
    INCIDENT_CLOCK,
  );
  if (!stopped.ok) throw new Error(`fixture could not stop the service: ${stopped.reason}`);
  return stopped.value;
}

describe("explained automation", () => {
  it("never shows a bare automated state without a reason and a remedy", () => {
    render(
      <AutomatedState
        state="Suppressed"
        because="Week 1 falls on the first contact day."
        changedBy="Move the first contact date on the plan."
      />,
    );
    const region = screen.getByRole("group", { name: /Suppressed/ });
    expect(region).toHaveTextContent("Week 1 falls on the first contact day.");
    expect(region).toHaveTextContent("Move the first contact date on the plan.");
  });

  it("puts the reason and the remedy in the page, never in a tooltip alone", () => {
    // Spec 4.4: a reason reachable only by hovering is not reachable at all for a
    // keyboard or screen-reader user. Nothing here may hold the explanation in a
    // `title` attribute instead of in text.
    const { container } = render(
      <AutomatedState
        state="Suppressed"
        because="Week 1 falls on the first contact day."
        changedBy="Move the first contact date on the plan."
      />,
    );
    for (const node of container.querySelectorAll("[title]")) {
      expect(node.getAttribute("title")).not.toContain("Week 1 falls on the first contact day.");
      expect(node.getAttribute("title")).not.toContain("Move the first contact date on the plan.");
    }
    const region = screen.getByRole("group", { name: /Suppressed/ });
    expect(region.textContent).toContain("Week 1 falls on the first contact day.");
    expect(region.textContent).toContain("Move the first contact date on the plan.");
  });

  it("shows nothing while the service is running", () => {
    const { container } = render(<ServiceStateBanner state={runningService(teamId("TEAM-A"))} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("states the reason and the approval count while stopped, with no patient information", () => {
    render(<ServiceStateBanner state={stoppedServiceState()} />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/0 of 3/);
    expect(banner).toHaveTextContent(/wrong recipient/i);
    expect(banner.textContent ?? "").not.toMatch(/Rowan|Mira|\+61/);
  });

  it("cannot put the responder's incident note on screen, whatever the note says", () => {
    // The whole rendered markup, not only its text: an attribute leak (a title, an
    // aria-label, a data-*) would be just as public as a paragraph.
    const { container } = render(<ServiceStateBanner state={stoppedServiceState()} />);
    expect(stoppedServiceState()).toMatchObject({ stopped: true });
    expect(container.innerHTML).not.toContain(NOTE_SENTINEL);
  });

  it("keeps the note out of the banner on every screen the shell renders", () => {
    const { container } = render(
      <CaringContactsShell title="Today" serviceState={stoppedServiceState()}>
        content
      </CaringContactsShell>,
    );
    expect(container.innerHTML).not.toContain(NOTE_SENTINEL);
    expect(container.innerHTML).not.toMatch(/Rowan|Mira|\+61/);
  });

  it("says the service is stopped in words, so the state does not depend on colour", () => {
    render(<ServiceStateBanner state={stoppedServiceState()} />);
    const banner = screen.getByRole("status");
    // Text content is what survives greyscale, forced colours and a screen reader.
    expect(banner.textContent ?? "").toContain("Sending stopped");
    expect(banner.textContent ?? "").toContain("stopped for the whole service");
    // The icon is decoration on top of that text, never the carrier of it.
    for (const icon of banner.querySelectorAll("svg")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("reaches the service-stop screen through a control that states its reason", () => {
    render(<ServiceStateBanner state={stoppedServiceState()} />);
    const banner = screen.getByRole("status");
    const control = banner.querySelector("button");
    expect(control, "the banner offers no way to reach the service-stop screen").not.toBeNull();
    // Ruling 52: the service-stop screen has no page yet, so this is an
    // unavailable control that says so — never a link into a 404.
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).not.toHaveAttribute("disabled");
    const describedBy = control!.getAttribute("aria-describedby");
    expect(describedBy, "the control states no reason").toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent ?? "").not.toBe("");
    expect(banner.querySelector("a")).toBeNull();
  });

  it("cannot be rendered by a screen that never read the service state", () => {
    // Ruling 56. Spec 4.2 puts the banner on EVERY screen while a stop is active,
    // and "everywhere" cannot rest on each page author remembering an optional
    // prop: a screen whose author forgot would show no banner at all during a live
    // stop, and a clinician would keep working believing sending was fine.
    //
    // This assertion is a TYPE assertion, checked by `tsc --noEmit`, not by the
    // runtime below. `@ts-expect-error` fails compilation when the error it expects
    // stops occurring — so if anyone makes `serviceState` optional again, the
    // typecheck goes red here rather than the omission going unnoticed.
    const omitted = (
      // @ts-expect-error serviceState is required — a screen must read it, not omit it.
      <CaringContactsShell title="Today">content</CaringContactsShell>
    );
    expect(omitted).toBeTruthy();
  });

  it("keeps the banner on every screen the shell renders", () => {
    render(
      <CaringContactsShell title="Today" serviceState={stoppedServiceState()}>
        content
      </CaringContactsShell>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows no banner on a shell whose service is running", () => {
    render(
      <CaringContactsShell title="Today" serviceState={runningService(teamId("TEAM-A"))}>
        content
      </CaringContactsShell>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
