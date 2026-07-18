import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

describe("RouteErrorBoundary focus management", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves focus to the recovery heading when an error replaces route content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<RouteErrorBoundary error={new Error("boom")} reset={() => undefined} />);

    const heading = screen.getByRole("heading", { name: "Something went wrong" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByRole("alert")).toHaveTextContent("An unexpected error occurred");
  });
});
