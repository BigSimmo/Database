/**
 * #3PW9TY — the "Also matches" cross-mode strip dropped a degraded group that happened to
 * match nothing, and told the reader there was nothing to find.
 *
 * `use-universal-search.ts` already exports `groupIsWorthShowing`, whose comment says in so
 * many words that an empty degraded group is a false absence and must be kept. The strip
 * re-implemented the wrong predicate (`items.length > 0`) inline, so the one case the helper
 * exists for was the one case it never covered. These assertions pin both halves: the group
 * survives, and the reader is told why it is empty.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { groupIsWorthShowing } from "@/components/clinical-dashboard/use-universal-search";
import { catalogueDegradedNotice } from "@/lib/site-content/catalogue-seed-fallback";

type Group = {
  kind: string;
  total: number;
  items: Array<{ title: string; href: string; subtitle?: string }>;
  latencyMs: number;
  degraded?: boolean;
  error?: boolean;
};

const search = vi.hoisted(() => ({ groups: [] as unknown[] }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ status: "signed_out", isConfigured: true }),
}));

vi.mock("@/components/clinical-dashboard/use-universal-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/clinical-dashboard/use-universal-search")>();
  return {
    ...actual,
    useUniversalSearch: () => ({
      groups: search.groups,
      loading: false,
      query: "clozapine",
      preferredDomains: ["medications", "documents"],
      domainOrder: (search.groups as Group[]).map((group) => group.kind),
    }),
  };
});

function renderStrip() {
  return render(<UniversalSearchAlsoMatches modeId="prescribing" query="clozapine" />);
}

afterEach(() => {
  search.groups = [];
  cleanup();
});

describe("the shared predicate is the one the strip must use", () => {
  it("keeps an empty degraded group and drops an empty healthy one", () => {
    const base = { kind: "services", total: 0, items: [], latencyMs: 1 };
    expect(groupIsWorthShowing({ ...base, degraded: true } as never)).toBe(true);
    expect(groupIsWorthShowing(base as never)).toBe(false);
  });
});

describe("the cross-mode strip reports a catalogue it could not read", () => {
  it("renders the tray at all, rather than vanishing, when the only group is degraded and empty", () => {
    search.groups = [{ kind: "services", total: 0, items: [], latencyMs: 1, degraded: true }];
    renderStrip();

    expect(screen.getByTestId("universal-also-matches")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(catalogueDegradedNotice, "i")).length).toBeGreaterThan(0);
  });

  it("never says 'no additional matches' without qualifying it for a degraded catalogue", () => {
    search.groups = [{ kind: "services", total: 0, items: [], latencyMs: 1, degraded: true }];
    renderStrip();

    expect(screen.queryByText("No additional matches in other modes.")).toBeNull();
  });

  it("says so on the collapsed header, which is all a reader sees before opening the tray", () => {
    search.groups = [
      { kind: "forms", total: 1, items: [{ title: "Form 1A", href: "/forms/1a" }], latencyMs: 1, degraded: true },
    ];
    renderStrip();

    // The disclosure is shut by default at every width, so a notice that lived only inside the
    // panel would never reach the reader who does not open it.
    const header = screen.getByRole("button", { name: /also matches/i });
    expect(header).toHaveTextContent(new RegExp(catalogueDegradedNotice, "i"));
  });

  it("still disappears entirely when every group is healthy and empty", () => {
    search.groups = [{ kind: "services", total: 0, items: [], latencyMs: 1 }];
    renderStrip();

    expect(screen.queryByTestId("universal-also-matches")).toBeNull();
  });

  it("says nothing about staleness when the groups came back healthy", () => {
    search.groups = [{ kind: "forms", total: 1, items: [{ title: "Form 1A", href: "/forms/1a" }], latencyMs: 1 }];
    renderStrip();

    expect(screen.getByTestId("universal-also-matches")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(catalogueDegradedNotice, "i"))).toBeNull();
  });

  it("drops a faulted group, which is an error to report elsewhere, not a stale list", () => {
    search.groups = [{ kind: "services", total: 0, items: [], latencyMs: 1, error: true, degraded: true }];
    renderStrip();

    expect(screen.queryByTestId("universal-also-matches")).toBeNull();
  });
});
