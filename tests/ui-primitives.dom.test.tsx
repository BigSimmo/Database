import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/ui-primitives";

describe("EmptyState", () => {
  it("keeps recovery actions inside an announced state surface", () => {
    render(
      <EmptyState
        icon={Search}
        title="No matching sources"
        body="Try a more specific question."
        live="polite"
        testId="recovery-state"
        actions={<button type="button">Rephrase question</button>}
      />,
    );

    const state = screen.getByTestId("recovery-state");
    expect(state).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "Rephrase question" })).toBeVisible();
  });

  it("uses an assertive announcement for a dynamic failure", () => {
    render(<EmptyState title="Answer unavailable" body="Please try again." live="assertive" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Answer unavailable");
  });
});
