import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/therapy-compass/ui";

describe("Therapy Compass shared state delegates", () => {
  it("preserves the neutral surface, clinical icon treatment, and compact action spacing", () => {
    const Icon = ({ size }: { size?: number }) => <span data-testid="therapy-empty-icon" data-size={size} />;

    render(
      <EmptyState
        icon={Icon}
        title="No therapy matches"
        body="Try a broader term."
        action={<button type="button">Clear filters</button>}
      />,
    );

    const state = screen.getByRole("status");
    expect(state).toHaveClass("bg-[color:var(--surface)]");
    expect(state).not.toHaveClass("bg-[color:var(--info-soft)]");
    const icon = screen.getByTestId("therapy-empty-icon");
    expect(icon).toHaveAttribute("data-size", "26");
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
