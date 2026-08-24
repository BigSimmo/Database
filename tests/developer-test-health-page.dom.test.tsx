import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DeveloperTestHealthPage, { QuarantineList } from "@/app/mockups/development/test-health/page";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

const snapshot = loadRepoAwarenessSnapshot();

const ENTRY = {
  id: "ui-smoke-composer",
  title: "phone composer stays docked @quarantine",
  spec: "tests/ui-smoke.spec.ts",
  reason: "Sub-pixel rounding on the dock reserve",
  owner: "frontend",
  reproduction: "npm run verify:ui -- --grep composer",
  first_seen: "2026-08-01",
  last_seen: "2026-08-03",
  expires: "2026-09-01",
  tracking: "docs/process-hardening.md#known-flakes",
};

describe("developer test health page", () => {
  it("renders inside the shared shell with the repository freshness label", () => {
    render(<DeveloperTestHealthPage />);
    expect(screen.getByTestId("developer-test-health")).toBeInTheDocument();
    expect(screen.getByTestId("developer-test-health-back")).toHaveAttribute("href", "/mockups/development");
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/Repository/);
  });

  it("shows the quarantined count as its own readable value", () => {
    render(<DeveloperTestHealthPage />);
    expect(screen.getByTestId("developer-test-health-count-quarantined-value")).toHaveTextContent(
      String(snapshot.test_health.counts.quarantined),
    );
  });

  it("states an empty ledger in words and quotes its own explanation", () => {
    render(<DeveloperTestHealthPage />);
    const { quarantined, note } = snapshot.test_health;
    if (quarantined.length === 0) {
      const empty = screen.getByTestId("developer-test-health-empty");
      expect(empty).toHaveTextContent(/No tests are quarantined/i);
      if (note) expect(empty).toHaveTextContent(note.slice(0, 40));
    } else {
      expect(within(screen.getByTestId("developer-test-health-list")).getAllByRole("listitem")).toHaveLength(
        quarantined.length,
      );
    }
  });
});

describe("QuarantineList", () => {
  it("renders every field a reader needs to act on an entry", () => {
    render(<QuarantineList entries={[ENTRY]} now={new Date("2026-08-22T12:00:00.000Z")} />);
    const row = screen.getByTestId(`developer-test-health-entry-${ENTRY.id}`);
    expect(row).toHaveTextContent(ENTRY.title);
    expect(row).toHaveTextContent(ENTRY.spec);
    expect(row).toHaveTextContent(ENTRY.reason);
    expect(row).toHaveTextContent(ENTRY.owner);
    expect(row).toHaveTextContent(ENTRY.reproduction);
    expect(row).toHaveTextContent(ENTRY.tracking);
  });

  it("marks an entry expired only after its expiry day has passed", () => {
    const { unmount } = render(<QuarantineList entries={[ENTRY]} now={new Date("2026-09-01T23:00:00.000Z")} />);
    expect(screen.getByTestId(`developer-test-health-entry-${ENTRY.id}`)).not.toHaveTextContent(/expired/i);
    unmount();

    render(<QuarantineList entries={[ENTRY]} now={new Date("2026-09-02T00:00:01.000Z")} />);
    expect(screen.getByTestId(`developer-test-health-entry-${ENTRY.id}`)).toHaveTextContent(/expired/i);
  });
});
