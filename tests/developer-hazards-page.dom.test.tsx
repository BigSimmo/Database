import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeveloperHazardsPage from "@/app/mockups/development/hazards/page";
import { loadHazardSnapshot, unmitigatedHazards } from "@/lib/developer-area/hazard-register";

// PanelPageShell's back control is a ContextualBackLink, which calls
// next/navigation's useRouter for its history-aware click handler. Outside an
// app-router tree that throws, so every render here needs the router mocked.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/development/hazards",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(cleanup);

/**
 * Rendered against the *real* committed snapshot, following the other panel
 * page tests: the failures worth catching here are about what the page says
 * concerning live clinical records, and a hand-built fixture cannot go wrong in
 * the way that matters.
 */
describe("developer hazard register page", () => {
  it("leads with what is NOT controlled, not with a reassuring total", () => {
    const snapshot = loadHazardSnapshot();
    render(<DeveloperHazardsPage />);

    const tile = screen.getByTestId("developer-hazards-count-unmitigated");
    expect(within(tile).getByTestId("developer-hazards-count-unmitigated-value")).toHaveTextContent(
      String(snapshot.counts.unmitigated),
    );
    expect(tile).toHaveTextContent("hazards with no control");

    // The uncontrolled section exists and names every one of them. A row that
    // rendered only inside its own register's long list would be the page
    // under-reporting exactly what it is for.
    const blockers = screen.getByTestId("developer-hazards-unmitigated");
    for (const { hazard } of unmitigatedHazards(snapshot)) {
      // Exact, not substring: "H1" appears inside "H-C01" and inside prose, so
      // a loose match would pass on text that is not the id at all.
      expect(within(blockers).getAllByText(hazard.id, { exact: true }).length).toBeGreaterThan(0);
    }
  });

  it("states Ward Flow's missing register as a finding rather than an empty section", () => {
    render(<DeveloperHazardsPage />);

    const section = screen.getByTestId("developer-hazards-missing-ward-flow");
    expect(section).toHaveTextContent(/no register exists/i);
    expect(section).toHaveTextContent(/No hazard register has been written/i);
    // The ledger rows beside it are explicitly disclaimed, so nobody reads them
    // as the register.
    expect(section).toHaveTextContent(/not a register/i);
  });

  it("keeps each register's own authority sentence instead of one shared reassurance", () => {
    render(<DeveloperHazardsPage />);

    const psychsift = screen.getByTestId("developer-hazards-register-psychsift-answer-pipeline");
    expect(psychsift).toHaveTextContent(/Static evidence register only/i);

    const caringContacts = screen.getByTestId("developer-hazards-register-caring-contacts");
    expect(caringContacts).toHaveTextContent(/DRAFT, unsigned/i);
    expect(caringContacts).toHaveTextContent(/Not signed off by a clinician/i);
  });

  it("renders every recorded hazard, so no row can be silently dropped from a register", () => {
    const snapshot = loadHazardSnapshot();
    render(<DeveloperHazardsPage />);

    for (const register of snapshot.registers.filter((entry) => entry.exists)) {
      const section = screen.getByTestId(`developer-hazards-register-${register.id}`);
      for (const hazard of register.hazards) {
        expect(within(section).getAllByText(hazard.id, { exact: true }).length).toBeGreaterThan(0);
      }
    }
  });

  it("does not claim the page covers every clinical risk", () => {
    render(<DeveloperHazardsPage />);
    const page = screen.getByTestId("developer-hazards");

    expect(page).toHaveTextContent(/Nothing here is clinical assurance/i);
    expect(page).not.toHaveTextContent(/every clinical risk/i);
  });
});
