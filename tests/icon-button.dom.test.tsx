import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { X } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "@/components/ui-primitives";

describe("IconButton", () => {
  it("uses the required label as the accessible name and hides the icon glyph", () => {
    render(<IconButton icon={X} label="Dismiss notification" />);

    const button = screen.getByRole("button", { name: "Dismiss notification" });
    expect(button).toHaveAttribute("type", "button");
    // The glyph is decorative: the accessible name must come only from the label,
    // so the icon carries aria-hidden and contributes nothing to the name.
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("fires onClick when enabled and never when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon={X} label="Close" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<IconButton icon={X} label="Close" onClick={onClick} disabled />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the tap-target base while merging a chrome recipe from className", () => {
    render(<IconButton icon={X} label="Zoom in" className="border" />);

    const button = screen.getByRole("button", { name: "Zoom in" });
    expect(button.className).toContain("size-tap");
    expect(button.className).toContain("border");
  });
});
