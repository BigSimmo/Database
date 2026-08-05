import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PinnedPlusMenuMockupsPage } from "@/components/pinned-plus-menu-mockups";

describe("editable pin menu mockups", () => {
  it("shows three distinct directions, device treatments, and realistic states", async () => {
    const user = userEvent.setup();
    render(<PinnedPlusMenuMockupsPage />);

    expect(screen.getByRole("button", { name: /Unified plus menu/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog", { name: "Search and pinned shortcuts" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Menu open" }));
    expect(screen.getByRole("dialog", { name: "Search and pinned shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your pins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Search in" })).toBeInTheDocument();
    expect(screen.getByText("Ward essentials")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Ward essentials contains Documents, Medications, Pathology forms, Monitoring/,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Ward essentials" }));
    expect(screen.getByRole("dialog", { name: "Edit Ward essentials pin" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Monitoring" }));
    expect(screen.getByText("3 destinations selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await user.click(screen.getByRole("button", { name: "Phone preview" }));
    expect(screen.getByRole("region", { name: "Phone mockup preview" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Pinned icon rail/ }));
    expect(screen.getByRole("dialog", { name: "Pinned icon rail menu" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Search command palette/ }));
    expect(screen.getByRole("dialog", { name: "Search command palette" })).toBeInTheDocument();
  });
});
