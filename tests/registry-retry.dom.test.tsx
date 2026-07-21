import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegistryRecordLoader } from "@/components/registry-record-loader";

// vi.hoisted so the spy exists when the hoisted vi.mock factory runs.
const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecord: () => ({
    status: "error",
    record: null,
    linkedDocuments: [],
    demoMode: false,
    governance: null,
    refetch,
  }),
}));

describe("RegistryRecordLoader error recovery", () => {
  it("offers a Retry that calls refetch, keeping the home link as a secondary escape", async () => {
    const user = userEvent.setup();
    render(
      <RegistryRecordLoader kind="service" slug="example">
        {() => <div>record body should not render in the error state</div>}
      </RegistryRecordLoader>,
    );

    expect(screen.getByText("Could not load the record")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link", { name: "Back to services" })).toBeInTheDocument();
  });
});
