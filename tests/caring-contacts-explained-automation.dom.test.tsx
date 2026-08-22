import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AutomatedState } from "@/components/caring-contacts/workspace/automated-state";
import { ServiceStateBanner } from "@/components/caring-contacts/workspace/service-state-banner";
import { CaringContactsShell } from "@/components/caring-contacts/workspace/shell";
import { fixedClock } from "@/lib/caring-contacts/clock";
import { actorId, teamId } from "@/lib/caring-contacts/ids";
import {
  applyServiceStop,
  REQUIRED_RESTART_APPROVAL_ROLES,
  runningService,
  type ServiceState,
} from "@/lib/caring-contacts/service-state";

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

  it("names what would restart the service, not only why it stopped", () => {
    // Spec 4.4 has two halves and the banner owes both. The reason half is
    // asserted above; without this, `describeServiceStop`'s third sentence could
    // be deleted outright and every test on this branch would stay green — the
    // one surface that renders on EVERY screen to EVERY team would then state a
    // stop with no way out of it. Proven by deleting that sentence and watching
    // this redden.
    render(<ServiceStateBanner state={stoppedServiceState()} />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/still needed/i);
    // All three roles, because none is recorded yet on this fixture. The count
    // comes from the sealed list rather than a second copy of the number.
    expect(REQUIRED_RESTART_APPROVAL_ROLES).toHaveLength(3);
    expect(banner).toHaveTextContent("the incident lead");
    expect(banner).toHaveTextContent("the privacy and security owner");
    expect(banner).toHaveTextContent("the clinical programme lead");
    // The restart is a three-PERSON decision, not three tick-boxes one person can
    // supply; a banner that omits this misdescribes the remedy.
    expect(banner).toHaveTextContent(/each from a different person/i);
  });

  it("cannot put the responder's incident note on screen, whatever the note says", () => {
    // The whole rendered markup, not only its text: an attribute leak (a title, an
    // aria-label, a data-*) would be just as public as a paragraph.
    // The anti-vacuity guard has to inspect the fixture that was RENDERED. A
    // freshly constructed second copy is equivalent under the fixed clock today,
    // but the guard exists precisely for the day the fixture stops being stopped,
    // and then only the rendered object tells the truth.
    const rendered = stoppedServiceState();
    expect(rendered).toMatchObject({ stopped: true });
    const { container } = render(<ServiceStateBanner state={rendered} />);
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
    expect(control).toHaveAttribute("type", "button");
    expect(control).toHaveAttribute("title", expect.stringContaining("coming soon"));
    // Native `disabled` would remove the tab stop, so the stated reason could
    // never be reached by keyboard. The two attributes are never used together.
    expect(control).not.toHaveAttribute("disabled");
    const describedBy = control!.getAttribute("aria-describedby");
    expect(describedBy, "the control states no reason").toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent ?? "").not.toBe("");
    expect(banner.querySelector("a")).toBeNull();
  });

  it("gives the banner's service-stop control a name of its own", () => {
    // The More panel already carries a destination named exactly "Service stop".
    // Two controls sharing an accessible name are indistinguishable in a screen
    // reader's control list, so the banner's — the one with incident context —
    // takes the longer name.
    render(
      <CaringContactsShell title="Today" serviceState={stoppedServiceState()}>
        content
      </CaringContactsShell>,
    );
    expect(screen.getAllByRole("button", { name: "Service stop" })).toHaveLength(1);
    const bannerControl = screen.getByRole("status").querySelector("button");
    expect(bannerControl, "the banner offers no service-stop control").not.toBeNull();
    expect(bannerControl!.textContent).not.toBe("Service stop");
    expect(bannerControl!.textContent ?? "").toContain("Service stop");
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

const WORKSPACE_DIR = path.join(process.cwd(), "src", "components", "caring-contacts", "workspace");

/** The one component in this directory allowed to be a Client Component. Read the block below
 * before adding to this list — it is not a formality. */
const ALLOWED_CLIENT_COMPONENTS = ["unavailable-destination.tsx"];

const USE_CLIENT_DIRECTIVE = /^\s*(?:"use client"|'use client')/m;

function workspaceSourceFiles(): { name: string; source: string }[] {
  return readdirSync(WORKSPACE_DIR)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => ({ name, source: readFileSync(path.join(WORKSPACE_DIR, name), "utf8") }));
}

/**
 * The half of the note guarantee the type system does NOT hold.
 *
 * `ServiceStopBannerFacts` omits `note` by construction, so the banner cannot
 * RENDER it — that half is a compile error and holds forever. But
 * `CaringContactsShellProps.serviceState` is a whole `ServiceState`, so the note
 * is in scope for every future edit of the shell, and the only reason it never
 * reaches a browser is that nothing on that path is a Client Component.
 *
 * Nothing enforced that. It was checked by hand once, which is a point-in-time
 * verification rather than a regression guard. Adding `"use client"` to
 * `shell.tsx` or `service-state-banner.tsx`, or handing `serviceState` to a new
 * client child, would serialise a responder's free-text note into the RSC
 * payload — readable in the page source, by every team, without ever appearing
 * on screen — and every DOM test above would stay green, because JSDOM has no RSC
 * payload to inspect.
 */
describe("the service-state path stays on the server", () => {
  it("keeps every workspace component but the one allowed client control a Server Component", () => {
    const clientComponents = workspaceSourceFiles()
      .filter(({ source }) => USE_CLIENT_DIRECTIVE.test(source))
      .map(({ name }) => name)
      .sort();

    expect(
      clientComponents,
      "A new Client Component appeared under src/components/caring-contacts/workspace/. The shell " +
        "hands that tree a whole ServiceState, whose `note` is patient data, and a client boundary " +
        "serialises props into the RSC payload for every team to read in the page source. If this " +
        "component genuinely must run on the client, prove the note cannot reach it, then add it to " +
        "ALLOWED_CLIENT_COMPONENTS deliberately.",
    ).toEqual([...ALLOWED_CLIENT_COMPONENTS].sort());
  });

  it("keeps the service state out of the one client component that does exist", () => {
    // The complement of the allowlist above, and deliberately the modest version.
    // Tracing which props a JSX element actually receives is not something source
    // text can answer reliably, so this does not attempt it. What it does answer
    // reliably: the allowed client component never names the service-state module
    // or its type at all, so it cannot be handed one without this going red too.
    for (const name of ALLOWED_CLIENT_COMPONENTS) {
      const source = readFileSync(path.join(WORKSPACE_DIR, name), "utf8");
      expect(source, `${name} references the service-state module`).not.toMatch(/service-state/);
      expect(source, `${name} names ServiceState`).not.toMatch(/ServiceState/);
    }
  });
});
