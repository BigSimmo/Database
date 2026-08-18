import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/therapy-compass/ui";

describe("Therapy Compass shared state delegates", () => {
  it("preserves the neutral surface, clinical icon treatment, and compact action spacing", () => {
    render(
      <EmptyState
        icon={Search}
        title="No therapy matches"
        body="Try a broader term."
        action={<button type="button">Clear filters</button>}
      />,
    );

    const state = screen.getByRole("status");
    expect(state).toHaveClass("bg-[color:var(--surface)]");
    expect(state).not.toHaveClass("bg-[color:var(--info-soft)]");
    // The icon is now a real lucide glyph, so the size contract is read off the
    // rendered <svg> rather than a stub's data attribute.
    const icon = state.querySelector("svg");
    if (!icon) throw new Error("expected the empty-state glyph to render");
    expect(icon).toHaveAttribute("width", "26");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon.parentElement).toHaveClass(
      "h-13",
      "w-13",
      "inline-flex",
      "items-center",
      "justify-center",
      "bg-[color:var(--clinical-accent-soft)]",
      "text-[color:var(--clinical-accent)]",
    );
    expect(icon.parentElement).not.toHaveClass("bg-[color:var(--surface)]", "text-[color:var(--text-muted)]");
    expect(screen.getByRole("button", { name: "Clear filters" }).parentElement).toHaveClass("mt-2");
    expect(screen.getByRole("button", { name: "Clear filters" }).parentElement).not.toHaveClass("mt-3");
  });
});
