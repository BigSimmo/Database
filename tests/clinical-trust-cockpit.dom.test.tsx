/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClinicalTrustCockpit } from "@/components/developer-area/clinical-trust-cockpit";

const maturity = ["dictionary", "services", "forms", "therapies", "differentials", "specifiers"].map((area) => ({
  area,
  label: area,
  total: 1,
  implementation: { available: 1 },
  clinicalReview: { reviewed: 0, pending: null, overdue: null, unknown: 1 },
  sourceSupport: { supported: null, partial: null, unknown: 1 },
  sourceCurrency: { current: null, reviewDue: null, overdue: null, unknown: 1 },
  evidence: { state: "partial", asOf: "2026-06-01T00:00:00.000Z", source: `static:${area}` },
}));

const snapshot = {
  version: "1",
  generatedAt: "2026-08-23T00:00:00.000Z",
  state: "partial",
  qualityQueue: {
    evidence: { state: "complete", asOf: "2026-08-23T00:00:00.000Z", source: "feedback metadata" },
    items: [],
  },
  sourceImpact: { evidence: { state: "unknown", asOf: null, source: "source metadata" }, items: [] },
  contentMaturity: {
    evidence: { state: "partial", asOf: "2026-06-01T00:00:00.000Z", source: "static catalogues" },
    bands: maturity,
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("clinical trust cockpit", () => {
  it("renders all three views and names empty, unknown, partial, and stale states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 })),
    );
    render(<ClinicalTrustCockpit />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(await screen.findByRole("heading", { name: "Quality queue" })).toBeInTheDocument();
    expect(screen.getByText(/No quality signals are visible/)).toBeInTheDocument();
    expect(screen.getByText(/Source impact is unknown/)).toBeInTheDocument();
    expect(screen.getByText(/repository catalogue evidence is stale/i)).toBeInTheDocument();
    expect(screen.getAllByText("partial", { selector: "strong" }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_, element) => element?.tagName === "SPAN" && Boolean(element.textContent?.includes("1 unverified")),
      ).length,
    ).toBeGreaterThanOrEqual(18);
  });

  it("renders an explicit permission state without administrator access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 403 })),
    );
    render(<ClinicalTrustCockpit />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Administrator access is required/));
    expect(screen.queryByRole("button", { name: /save triage/i })).not.toBeInTheDocument();
  });
});
