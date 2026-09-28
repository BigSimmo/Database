/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { RouteErrorBoundary } from "@/components/route-error-boundary";

describe("RouteErrorBoundary recovery actions", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("calls router.refresh() and reset() when 'Try again' is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<RouteErrorBoundary error={new Error("network failure")} reset={reset} />);

    const tryAgainButton = screen.getByRole("button", { name: "Try again" });
    expect(tryAgainButton).toBeInTheDocument();

    await user.click(tryAgainButton);

    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });
});
