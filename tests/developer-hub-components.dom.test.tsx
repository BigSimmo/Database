import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EnvironmentStrip } from "@/components/developer-area/hub/environment-strip";
import { FreshnessStamp } from "@/components/developer-area/hub/freshness-stamp";
import { PanelCard } from "@/components/developer-area/hub/panel-card";

afterEach(cleanup);

/**
 * Formats the date the way the component does. The test timezone is not pinned
 * (`Australia/Perth` locally, UTC on many CI boxes), so a hardcoded locale string
 * would be environment-sensitive; deriving it keeps the assertion about *which*
 * date rendered rather than about the formatter.
 */
function mediumDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { dateStyle: "medium" });
}

describe("FreshnessStamp", () => {
  it("always renders, and says so when the revision is unknown", () => {
    render(<FreshnessStamp freshness={{ contentAt: null, viewedAt: "2026-08-21T00:00:00Z", ageHours: null }} />);
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/revision unknown/i);
  });

  it("reports the gap between ledger content and build", () => {
    render(
      <FreshnessStamp
        freshness={{ contentAt: "2026-08-20T00:00:00Z", viewedAt: "2026-08-21T00:00:00Z", ageHours: 24 }}
      />,
    );
    const stamp = screen.getByTestId("developer-hub-freshness");
    expect(stamp).toHaveTextContent(/24 hours/i);
    // The age alone is not the claim: an implementation that printed the gap but
    // dropped the date it was measured from would still be unfalsifiable.
    expect(stamp).toHaveTextContent(mediumDate("2026-08-20T00:00:00Z"));
  });

  it("says the revision is unknown when the recorded date cannot be parsed", () => {
    render(
      <FreshnessStamp
        freshness={{ contentAt: "not-a-date", viewedAt: "2026-08-21T00:00:00Z", ageHours: Number.NaN }}
      />,
    );
    const stamp = screen.getByTestId("developer-hub-freshness");
    expect(stamp).toHaveTextContent(/revision unknown/i);
    // A confident-looking stamp carrying no information is the failure this
    // component exists to prevent.
    expect(stamp).not.toHaveTextContent(/invalid date/i);
    expect(stamp).not.toHaveTextContent(/NaN/);
  });
});

describe("EnvironmentStrip", () => {
  it("names each unknown instead of dropping it", () => {
    // This is the shape the hub renders in phase 1: nothing has been read yet,
    // so every fact must name its own gap. `demoMode={null}` is the load-bearing
    // one — a component that fell back to "Live data" here would state the
    // opposite of the truth in demo mode, which is the one way this strip can be
    // actively wrong rather than merely incomplete.
    render(<EnvironmentStrip demoMode={null} documentCount={null} buildSha={null} email={null} />);
    const strip = screen.getByTestId("developer-hub-environment-strip");
    expect(strip).toHaveTextContent("environment unknown");
    expect(strip).toHaveTextContent("document count unavailable");
    expect(strip).toHaveTextContent("build unknown");
    expect(strip).toHaveTextContent("account unknown");
    // Neither of the two states an unread environment must not be mistaken for.
    expect(strip).not.toHaveTextContent("Live data");
    expect(strip).not.toHaveTextContent("Demo corpus");
    expect(strip).not.toHaveTextContent(/null|undefined|NaN/);
  });

  it("says demo corpus when the environment was read and is demo", () => {
    // The third state, pinned separately so a future wiring change cannot
    // collapse "unread" and "demo" into one label.
    render(<EnvironmentStrip demoMode documentCount={12} buildSha={null} email={null} />);
    const strip = screen.getByTestId("developer-hub-environment-strip");
    expect(strip).toHaveTextContent("Demo corpus");
    expect(strip).not.toHaveTextContent("environment unknown");
    expect(strip).not.toHaveTextContent("Live data");
  });

  it("reports the live figures when they are known", () => {
    render(
      <EnvironmentStrip demoMode={false} documentCount={2851} buildSha="e52198827abcdef" email="dev@example.com" />,
    );
    const strip = screen.getByTestId("developer-hub-environment-strip");
    expect(strip).toHaveTextContent("Live data");
    expect(strip).toHaveTextContent("2,851 documents");
    expect(strip).toHaveTextContent("build e521988");
    expect(strip).toHaveTextContent("dev@example.com");
    expect(strip).not.toHaveTextContent("environment unknown");
    expect(strip).not.toHaveTextContent("account unknown");
  });
});

describe("PanelCard", () => {
  it("links a built panel", () => {
    render(
      <PanelCard
        panel={{
          id: "task-ledger",
          name: "Task ledger",
          summary: "s",
          group: "work",
          phase: 1,
          href: "/mockups/development/ledger",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /task ledger/i })).toHaveAttribute("href", "/mockups/development/ledger");
  });

  it("marks a planned panel unavailable with a reachable reason, never native disabled", () => {
    render(
      <PanelCard panel={{ id: "work-in-flight", name: "Work in flight", summary: "s", group: "work", phase: 2 }} />,
    );
    const button = screen.getByRole("button", { name: /work in flight/i });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("title", expect.stringContaining("coming soon"));

    // Resolve the id the button actually points at, so this pins the *link*
    // between control and reason. A dangling `aria-describedby` leaves the
    // stated reason unreachable, which is the defect the convention prevents.
    const describedBy = button.getAttribute("aria-describedby") ?? "";
    const note = document.getElementById(describedBy);
    expect(note).not.toBeNull();
    expect(note).toHaveTextContent(/not built yet/i);

    // `aria-disabled` is advisory only — it keeps the tab stop, so the control
    // stays operable unless the inert handler cancels the activation.
    const activation = new MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(activation);
    expect(activation.defaultPrevented).toBe(true);
  });
});
