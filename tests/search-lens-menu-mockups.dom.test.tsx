import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SearchLensMenuMockupsPage } from "@/components/search-lens-menu-mockups";

describe("search plus menu mockups", () => {
  it("keeps editable pins separate from explicit search choices across all directions", async () => {
    const user = userEvent.setup();
    render(<SearchLensMenuMockupsPage />);

    const foldOut = screen.getByRole("button", { name: /Attached pin fold-out/ });
    const commandDeck = screen.getByRole("button", { name: /Pins and search command deck/ });
    const inlineBuilder = screen.getByRole("button", { name: /Inline pin bar/ });

    expect(foldOut).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("dialog", { name: "Pins and search" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Your pins" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Search in" })).toHaveLength(2);
    expect(screen.getAllByText("Search Documents").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Search all clinical areas").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", {
        name: /Ward essentials contains app destinations: Documents, Medications, Forms/,
      }).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Edit Ward essentials" })[0]);
    expect(screen.getByRole("dialog", { name: "Edit Ward essentials pin" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Forms" }));
    expect(screen.getByText("2 destinations selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save pin" }));

    await user.click(screen.getAllByRole("button", { name: "New pin" })[0]);
    const pinName = screen.getByRole("textbox", { name: "Pin name" });
    await user.clear(pinName);
    await user.type(pinName, "Night shift");
    await user.click(screen.getByRole("button", { name: "Create pin" }));
    expect(screen.getByText("Night shift")).toBeInTheDocument();

    await user.click(commandDeck);
    expect(commandDeck).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("dialog", { name: "Pins and search command deck" })).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Pins and search command deck" })).not.toBeInTheDocument();

    await user.click(inlineBuilder);
    expect(inlineBuilder).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("dialog", { name: "Edit pin destinations" })).toHaveLength(2);
    expect(screen.getByTestId("phone-inline-builder-layer")).toHaveClass("bottom-[108px]");
  });
});
