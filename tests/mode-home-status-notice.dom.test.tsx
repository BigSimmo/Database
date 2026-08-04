import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShieldAlert } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { ModeHomeStatusNotice } from "@/components/mode-home-template";

describe("ModeHomeStatusNotice", () => {
  it("renders a Retry button that calls onAction, with no navigation link", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Could not load services"
        body="The services registry could not be loaded."
        actionLabel="Try again"
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders a navigation link (not a button) when given actionHref", () => {
    render(
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Session expired"
        body="Sign in again to open private records."
        actionHref="/"
        actionLabel="Open account setup"
      />,
    );

    expect(screen.getByRole("link", { name: "Open account setup" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
