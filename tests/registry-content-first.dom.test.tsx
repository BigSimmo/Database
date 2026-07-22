import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegistryRecordLoader } from "@/components/registry-record-loader";
import { serviceRecords, type ServiceRecord } from "@/lib/services";
import type { RegistryRecordResult } from "@/lib/use-registry-records";

// Mutable holder so each test can drive the mocked hook's returned state.
const hook = vi.hoisted(() => ({ state: null as unknown as RegistryRecordResult }));
vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecord: () => hook.state,
}));

const baseRecord = serviceRecords[0];

function serviceRecord(locallyVerified: boolean): ServiceRecord {
  return { ...baseRecord, verification: { ...baseRecord.verification, locallyVerified } };
}

function loaderState(overrides: Partial<RegistryRecordResult>): RegistryRecordResult {
  return {
    status: "loading",
    record: null,
    linkedDocuments: [],
    demoMode: false,
    governance: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

// Render-prop that surfaces the verified flag + title the loader hands down, so
// the tests can assert exactly what content-first rendered.
function child(record: ServiceRecord) {
  return (
    <div data-testid="child">
      lv:{String(record.verification?.locallyVerified)}|{record.title}
    </div>
  );
}

describe("RegistryRecordLoader content-first fallback", () => {
  it("paints the public fixture immediately during loading instead of a spinner", () => {
    hook.state = loaderState({ status: "loading" });
    render(
      <RegistryRecordLoader kind="service" slug="example" fallbackRecord={serviceRecord(false)}>
        {child}
      </RegistryRecordLoader>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent(baseRecord.title);
    expect(screen.queryByText(/Loading service record/i)).not.toBeInTheDocument();
  });

  it("neutralizes a stale 'locally verified' flag during the provisional paint", () => {
    hook.state = loaderState({ status: "loading" });
    render(
      <RegistryRecordLoader kind="service" slug="example" fallbackRecord={serviceRecord(true)}>
        {child}
      </RegistryRecordLoader>,
    );
    // Fixture claims verified=true, but the pre-reconciliation paint must show false
    // so a stale authoritative-looking badge can't flash in.
    expect(screen.getByTestId("child")).toHaveTextContent("lv:false");
  });

  it("reconciles the verified flag from authoritative governance when ready", () => {
    hook.state = loaderState({
      status: "ready",
      record: serviceRecord(true),
      governance: { sourceStatus: "current", validationStatus: "unverified" },
    });
    const { rerender } = render(
      <RegistryRecordLoader kind="service" slug="example">
        {child}
      </RegistryRecordLoader>,
    );
    // Fixture verified=true, but authoritative governance says unverified -> false.
    expect(screen.getByTestId("child")).toHaveTextContent("lv:false");

    hook.state = loaderState({
      status: "ready",
      record: serviceRecord(false),
      governance: { sourceStatus: "current", validationStatus: "locally_reviewed" },
    });
    rerender(
      <RegistryRecordLoader kind="service" slug="example">
        {child}
      </RegistryRecordLoader>,
    );
    // Authoritative governance says reviewed -> true (reconciled up).
    expect(screen.getByTestId("child")).toHaveTextContent("lv:true");
  });

  it("keeps the spinner for owner-only slugs with no fixture fallback", () => {
    hook.state = loaderState({ status: "loading" });
    render(
      <RegistryRecordLoader kind="service" slug="owner-only">
        {child}
      </RegistryRecordLoader>,
    );
    expect(screen.getByText(/Loading service record/i)).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });
});
