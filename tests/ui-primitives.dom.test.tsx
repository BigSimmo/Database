import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { AsyncButton, EmptyState, ToggleSwitch } from "@/components/ui-primitives";

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

describe("AsyncButton", () => {
  it("announces pending work and blocks duplicate activation", () => {
    render(
      <AsyncButton busy busyLabel="Saving changes">
        Save
      </AsyncButton>,
    );

    const button = screen.getByRole("button", { name: "Saving changes" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("keeps its normal label and enabled state when idle", () => {
    render(
      <AsyncButton busy={false} busyLabel="Saving changes">
        Save
      </AsyncButton>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("defaults to type=button after the props spread", () => {
    render(
      <AsyncButton busy={false} busyLabel="Saving">
        Save
      </AsyncButton>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("preserves an explicit type=submit for form actions", () => {
    render(
      <AsyncButton type="submit" busy={false} busyLabel="Saving">
        Save
      </AsyncButton>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});

describe("ToggleSwitch", () => {
  it("requires a name when operable", async () => {
    const onToggle = vi.fn();
    render(<ToggleSwitch enabled={false} onToggle={onToggle} aria-label="Pregnancy" />);
    await userEvent.click(screen.getByRole("switch", { name: "Pregnancy" }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders a non-interactive indicator without onToggle", () => {
    render(<ToggleSwitch enabled aria-label="Available" />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Available: on" })).toBeInTheDocument();
  });
});
