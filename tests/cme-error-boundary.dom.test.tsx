import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({ AccountSetupDialog: () => null }));

import CmeError from "@/app/(search-app)/cme/error";

describe("CPD segment error boundary", () => {
  // The boundary logs every error for support; keep the test output quiet and assert the log where it matters.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs the error for support, and never shows it", () => {
    const error = new Error("row 7 violates a constraint");
    render(<CmeError error={error} retry={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith("Unhandled runtime error captured in CPD segment:", error);
    expect(screen.queryByText(/row 7/)).toBeNull();
  });

  it("shows the offline state for a lost connection and retries the segment", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<CmeError error={new TypeError("Failed to fetch")} retry={retry} />);
    expect(screen.getByTestId("cme-offline")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the error state for anything else and never prints the error", () => {
    render(<CmeError error={new Error("row 7 violates a constraint")} retry={vi.fn()} />);
    expect(screen.getByTestId("cme-error")).toBeInTheDocument();
    expect(screen.queryByText(/row 7/)).toBeNull();
  });
});
