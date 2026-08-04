import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegistryRecordLoader } from "@/components/registry-record-loader";
import type { ServiceRecord } from "@/lib/services";

// Controllable hook mock: each test drives one state so we can exercise the full
// content-first state machine (loading fallback paint, live swap-in, empty
// states) without a real fetch. The sibling registry-retry.dom.test.tsx covers
// the error → Retry affordance; this file covers everything else.
const { useRegistryRecord } = vi.hoisted(() => ({ useRegistryRecord: vi.fn() }));
vi.mock("@/lib/use-registry-records", () => ({ useRegistryRecord }));

function mockHook(state: Record<string, unknown>) {
  useRegistryRecord.mockReturnValue({
    status: "loading",
    record: null,
    linkedDocuments: [],
    demoMode: false,
    governance: null,
    refetch: vi.fn(),
    ...state,
  });
}

const verified: ServiceRecord = {
  slug: "cmhs",
  title: "Community Mental Health Service",
  verification: { locallyVerified: true },
};
const unverified: ServiceRecord = {
  slug: "cmhs",
  title: "Community Mental Health Service",
  verification: { locallyVerified: false },
};

// The render-prop receives the reconciled record, so we assert exactly which
// verification flag the loader hands downstream (the badge input) per state.
const body = (record: ServiceRecord) => (
  <div>
    <span data-testid="title">{record.title}</span>
    <span data-testid="verified">{String(record.verification?.locallyVerified)}</span>
  </div>
);

describe("RegistryRecordLoader content-first states", () => {
  it("paints the public fallback record immediately during loading instead of a spinner", () => {
    mockHook({ status: "loading", record: null });
    render(
      <RegistryRecordLoader kind="service" slug="cmhs" fallbackRecord={verified}>
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByTestId("title")).toHaveTextContent("Community Mental Health Service");
    expect(screen.queryByText(/Loading service record/i)).not.toBeInTheDocument();
  });

  it("neutralizes a fixture 'locally verified' flag on the provisional paint (no authoritative badge before governance reconciles)", () => {
    mockHook({ status: "loading", record: null });
    render(
      <RegistryRecordLoader kind="service" slug="cmhs" fallbackRecord={verified}>
        {body}
      </RegistryRecordLoader>,
    );
    // The fixture is verified, but the loading paint must not assert it before
    // live governance reconciles — the flag is neutralized to false so a stale
    // "verified" badge cannot flash in.
    expect(screen.getByTestId("verified")).toHaveTextContent("false");
  });

  it("shows a spinner (not content) when loading with no fallback record", () => {
    mockHook({ status: "loading", record: null });
    const { container } = render(
      <RegistryRecordLoader kind="service" slug="owner-only">
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByText(/Loading service record/i)).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId("title")).not.toBeInTheDocument();
  });

  it("live swap-in reconciles the verified flag ON when governance is approved", () => {
    mockHook({
      status: "ready",
      record: unverified,
      governance: { sourceStatus: "current", validationStatus: "approved" },
    });
    render(
      <RegistryRecordLoader kind="service" slug="cmhs" fallbackRecord={verified}>
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByTestId("verified")).toHaveTextContent("true");
  });

  it("live swap-in downgrades a stale fixture flag when governance is unverified", () => {
    mockHook({
      status: "ready",
      record: verified,
      governance: { sourceStatus: "current", validationStatus: "unverified" },
    });
    render(
      <RegistryRecordLoader kind="service" slug="cmhs" fallbackRecord={verified}>
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByTestId("verified")).toHaveTextContent("false");
  });

  it("passes the record through unchanged when governance is absent", () => {
    mockHook({ status: "ready", record: verified, governance: null });
    render(
      <RegistryRecordLoader kind="service" slug="cmhs">
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByTestId("verified")).toHaveTextContent("true");
  });

  it("renders a not-found empty state, not the record body", () => {
    mockHook({ status: "not_found", record: null });
    render(
      <RegistryRecordLoader kind="form" slug="missing">
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByText(/No form record found/i)).toBeInTheDocument();
    expect(screen.queryByTestId("title")).not.toBeInTheDocument();
  });

  it("renders the session-expired panel when unauthorized", () => {
    mockHook({ status: "unauthorized", record: null });
    render(
      <RegistryRecordLoader kind="service" slug="cmhs">
        {body}
      </RegistryRecordLoader>,
    );
    expect(screen.getByText("Session expired")).toBeInTheDocument();
  });
});
