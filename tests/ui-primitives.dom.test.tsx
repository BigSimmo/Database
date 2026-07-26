import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";

import { AsyncButton, EmptyState, InlineNotice } from "@/components/ui-primitives";
import { expectToAnnounce } from "./setup/jsdom.setup";

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
    expectToAnnounce("Answer unavailable");
  });
});

describe("InlineNotice", () => {
  it("announces politely for success tone", () => {
    render(<InlineNotice tone="success">Document imported successfully</InlineNotice>);
    expectToAnnounce("Document imported successfully");
  });

  it("announces assertively for danger tone", () => {
    render(<InlineNotice tone="danger">Failed to parse document</InlineNotice>);
    expectToAnnounce("Failed to parse document");
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
});
