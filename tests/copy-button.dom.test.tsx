import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CopyButton } from "@/components/ui/copy-button";

describe("CopyButton", () => {
  it("uses the idle label as the accessible name", () => {
    render(<CopyButton label="Copy exact quotes" copied={false} onClick={() => {}} />);

    const button = screen.getByRole("button", { name: "Copy exact quotes" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveTextContent("Copy exact quotes");
  });

  it("swaps the visible label when copied without changing the accessible name", () => {
    render(<CopyButton label="Copy exact quotes" copied onClick={() => {}} />);

    const button = screen.getByRole("button", { name: "Copy exact quotes" });
    expect(button).toHaveTextContent("Copied");
  });

  it("fires the injected onClick (clipboard stays with the caller)", async () => {
    const onClick = vi.fn();
    render(<CopyButton label="Copy" copied={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("puts outline focus on the Button, not a raw control recipe", () => {
    render(<CopyButton label="Copy" copied={false} onClick={() => {}} />);

    const button = screen.getByRole("button", { name: "Copy" });
    expect(button.className).toContain("focus-visible:outline-2");
    expect(button.className).toContain("focus-visible:outline-offset-2");
    expect(button.className).toContain("outline-[color:var(--focus)]");
    expect(button.className).not.toMatch(/focus(?:-visible)?:ring-/);
    // Button’s controlBase, not a hand-rolled floatingControl <button>.
    expect(button.className).toContain("active:translate-y-px");
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("size-icon-md");
  });
});
