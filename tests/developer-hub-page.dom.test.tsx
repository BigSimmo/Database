import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeveloperHubPage from "@/app/mockups/development/page";
import { loadLedgerSnapshot } from "@/lib/developer-area/ledger-snapshot";

/**
 * The hub page's own contracts, kept out of
 * `tests/in-page-nav-route-sections.dom.test.tsx` on purpose: that file exists to
 * prove every *declared navigation section* resolves to a rendered anchor, for
 * fourteen routes at once. The three things guarded here — a clinical-safety
 * warning, a band that must not be able to go stale, and an empty group — are
 * page content rather than navigation, and two of them need this page's data
 * source mocked. Loading that into the shared file would make a cross-route
 * contract carry one route's fixtures.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/development",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    isAuthenticated: true,
    setFavourite: vi.fn(async () => true),
  }),
}));

/**
 * Only `counts.p1` is overridden, and only on top of the *real* committed
 * snapshot — so the band is exercised against the shape the route actually
 * loads rather than a hand-built fixture that could drift from it. `null` means
 * "do not override", which is also how the assertions below read the true
 * count. The committed snapshot has `p1 === 2`, so without this the singular
 * and zero branches are never reached at all.
 */
const p1 = vi.hoisted(() => ({ value: null as number | null }));

vi.mock("@/lib/developer-area/ledger-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/ledger-snapshot")>();
  return {
    ...actual,
    loadLedgerSnapshot: () => {
      const snapshot = actual.loadLedgerSnapshot();
      if (p1.value === null) return snapshot;
      return { ...snapshot, counts: { ...snapshot.counts, p1: p1.value } };
    },
  };
});

/** Empties one real group, so the empty-group branch can be reached by name. */
const emptyGroups = vi.hoisted(() => ({ value: new Set<string>() }));

vi.mock("@/lib/developer-area/hub-panels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/hub-panels")>();
  return {
    ...actual,
    panelsInGroup: (group: Parameters<typeof actual.panelsInGroup>[0]) =>
      emptyGroups.value.has(group) ? [] : actual.panelsInGroup(group),
  };
});

afterEach(() => {
  cleanup();
  p1.value = null;
  emptyGroups.value = new Set();
});

describe("developer hub page — synthetic-data warning", () => {
  /**
   * The warning is a clinical-safety statement on a page that links to synthetic
   * patient prototypes. It survived the hub rewrite only because a reviewer
   * caught its omission from the plan; before this test the sole thing holding
   * it in place was a source comment, so the next layout rewrite could drop it
   * with every gate still green. That is what these pin.
   */
  it("states that the data is synthetic and that nothing here is validated decision support", () => {
    const { container } = render(<DeveloperHubPage />);
    const warning = container.querySelector("svg.lucide-shield-alert")?.closest("p");

    expect(warning, "no paragraph carries the ShieldAlert warning icon").not.toBeNull();
    expect(warning).toHaveTextContent("Synthetic data only.");
    // The whole claim, not just its heading: "synthetic data" alone would not
    // tell a reader that the surfaces are also unvalidated.
    expect(warning).toHaveTextContent(/No patient, message, schedule or team record on these surfaces is real/);
    expect(warning).toHaveTextContent(/nothing here is validated clinical decision support/);
  });

  it("keeps the warning above the blocking-work band, not buried below the panels", () => {
    p1.value = 3;
    const { container } = render(<DeveloperHubPage />);
    const warning = container.querySelector("svg.lucide-shield-alert")?.closest("p");
    const band = screen.getByTestId("developer-hub-needs-you-now");

    expect(warning).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: the band comes after the warning in the DOM.
    expect(warning!.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks the warning icon decorative so its sentence is not announced twice", () => {
    const { container } = render(<DeveloperHubPage />);
    expect(container.querySelector("svg.lucide-shield-alert")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("developer hub page — needs-you-now band", () => {
  it("reports the snapshot's own P1 count", () => {
    // No override, so this is the real committed snapshot: the band must agree
    // with the data the route actually loads, not merely with itself.
    const { counts } = loadLedgerSnapshot();
    expect(counts.p1).toBeGreaterThan(0);

    render(<DeveloperHubPage />);
    expect(screen.getByTestId("developer-hub-needs-you-now")).toHaveTextContent(String(counts.p1));
  });

  it("carries no text beyond the computed count", () => {
    // Spec 8.1, and the whole reason the band exists: a literal such as "red for
    // 26 days" cannot age, so static prose here is the same defect class as a
    // stale snapshot. Asserting the exact string is what makes that unfakeable
    // — any added claim changes it.
    p1.value = 7;
    render(<DeveloperHubPage />);
    const band = screen.getByTestId("developer-hub-needs-you-now");

    expect(band.textContent).toBe("7 blocking items in the task ledger.");
    // Belt and braces: 7 is the only number on the band, so no second figure was
    // hardcoded beside the computed one.
    expect(band.textContent?.match(/\d+/g)).toEqual(["7"]);
  });

  it("says 'item' for one and 'items' for more than one", () => {
    p1.value = 1;
    render(<DeveloperHubPage />);
    expect(screen.getByTestId("developer-hub-needs-you-now").textContent).toBe("1 blocking item in the task ledger.");
    cleanup();

    p1.value = 2;
    render(<DeveloperHubPage />);
    expect(screen.getByTestId("developer-hub-needs-you-now").textContent).toBe("2 blocking items in the task ledger.");
  });

  it("renders nothing rather than a reassuring all-clear when there are no blockers", () => {
    // The committed snapshot has p1 = 2, so this branch is otherwise never
    // exercised. A band reading "0 blocking items" would be a settled-looking
    // statement about work the page cannot see.
    p1.value = 0;
    render(<DeveloperHubPage />);

    expect(screen.queryByTestId("developer-hub-needs-you-now")).toBeNull();
    // The page still rendered: this is a dropped band, not a dead page.
    expect(screen.getByTestId("development-index")).toBeInTheDocument();
  });
});

describe("developer hub page — group sections", () => {
  it("renders an anchor and a heading for a group that has panels", () => {
    const { container } = render(<DeveloperHubPage />);
    expect(container.querySelector("#developer-hub-clinical")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Clinical trust" })).toBeInTheDocument();
  });

  it("omits the anchor entirely for an empty group", () => {
    // `useResolvedPageSections` drops a declared section whose anchor is not
    // rendered — that is what lets phases 2-4 add panels without touching the
    // navigation. Rendering the section unconditionally would make that
    // mechanism inert here and leave a jump to a bare heading above an empty
    // grid.
    emptyGroups.value = new Set(["clinical"]);
    const { container } = render(<DeveloperHubPage />);

    expect(container.querySelector("#developer-hub-clinical")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Clinical trust" })).toBeNull();
    // The other groups are unaffected, so this is one omitted section rather
    // than a page that failed to render.
    expect(container.querySelector("#developer-hub-work")).not.toBeNull();
    expect(container.querySelector("#developer-hub-reference")).not.toBeNull();
  });
});
