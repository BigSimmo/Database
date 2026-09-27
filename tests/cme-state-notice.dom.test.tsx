import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({ AccountSetupDialog: () => null }));

import { CmeStateNotice } from "@/components/cme/cme-state-notice";

describe("CPD states", () => {
  it("says offline plainly, with an outlined 48 px Try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<CmeStateNotice state="offline" year={2026} onRetry={onRetry} />);
    expect(screen.getByTestId("cme-offline")).toHaveTextContent(
      "Your CPD record isn’t kept on this phone. It opens again as soon as you’re back online.",
    );
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry.className).toMatch(/\bmin-h-tap\b/);
    expect(retry.className).not.toContain("bg-[color:var(--command)]");
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(["error", "unavailable"] as const)("shows %s as the error state, which changed nothing", async (state) => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<CmeStateNotice state={state} year={2026} onRetry={onRetry} />);
    expect(screen.getByTestId("cme-error")).toHaveTextContent(
      "Nothing was changed. Try again, or come back in a few minutes.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("tells a signed-out doctor the record is theirs alone", () => {
    render(<CmeStateNotice state="signed-out" year={2026} />);
    expect(screen.getByTestId("cme-signed-out")).toHaveTextContent(
      "It is linked to your account only, and it is not shared with your health service.",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows a year not yet set up as the empty state: one line and where to start, with no dark button", () => {
    const { container } = render(<CmeStateNotice state="unconfigured" year={2026} />);
    expect(screen.getByTestId("cme-unconfigured")).toHaveTextContent("Choose your CPD home in Set up, then tap + Log.");
    expect(screen.getByRole("link", { name: "Open Set up" })).toHaveAttribute("href", "/cme/setup?year=2026");
    expect(container.innerHTML).not.toContain("bg-[color:var(--command)]");
  });

  it("keeps the page's own heading above the state", () => {
    render(<CmeStateNotice state="offline" year={2026} heading="Log" onRetry={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Log" })).toBeInTheDocument();
  });
});
