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

  it("leaves #main-content to the shell for nested boundaries and owns it only as the root landmark", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shell = document.createElement("main");
    shell.id = "main-content";
    document.body.append(shell);
    try {
      const nested = render(<RouteErrorBoundary error={new Error("boom")} reset={() => undefined} />, {
        container: shell.appendChild(document.createElement("div")),
      });
      expect(document.querySelectorAll("#main-content")).toHaveLength(1);
      nested.unmount();
    } finally {
      shell.remove();
    }
    render(<RouteErrorBoundary error={new Error("boom")} reset={() => undefined} landmark />);
    expect(document.querySelectorAll("main#main-content")).toHaveLength(1);
  });
});
