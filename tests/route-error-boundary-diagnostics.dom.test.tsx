/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

describe("RouteErrorBoundary Copy Diagnostics privacy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts clinical query text from the clipboard payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "https://psychiatry.tools/dsm?q=clozapine%20ANC%20threshold",
      },
    });

    const user = userEvent.setup();
    render(<RouteErrorBoundary error={new Error("boom at /users/patient/source.pdf")} reset={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /Copy Diagnostics/i }));

    expect(writeText).toHaveBeenCalled();
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).not.toContain("clozapine");
    expect(copied).not.toContain("/users/patient/source.pdf");
    expect(copied).toContain("[url]");
    expect(copied).toContain("[path]");
  });
});
