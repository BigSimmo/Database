// tests/caring-contacts-plan-status-toggle.dom.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanStatusToggle } from "@/components/caring-contacts/workspace/plan-status-toggle";

describe("Task 6 #99W2X1: Inactive contact plan status toggle confirmation modal barrier", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders active toggle switch when currentStatus is active", () => {
    const onStatusChange = vi.fn();
    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
      />,
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires confirmation modal barrier when transitioning active plan to inactive", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
      />,
    );

    // Click toggle while active
    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    // Must NOT transition immediately
    expect(onStatusChange).not.toHaveBeenCalled();

    // Confirmation dialog barrier MUST be visible
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Confirm Plan Deactivation")).toBeInTheDocument();
    expect(
      screen.getByText(/All scheduled suicide-prevention outreach and automated messages will be suspended/),
    ).toBeInTheDocument();

    // Cancel deactivation
    const cancelButton = screen.getByTestId("cancel-inactivation-button");
    await user.click(cancelButton);

    // Dialog closes without transitioning
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("proceeds with deactivation when clinician confirms in modal barrier", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("switch"));

    // Enter clinical reason
    const reasonInput = screen.getByLabelText(/Clinical Reason/i);
    await user.type(reasonInput, "Patient readmitted to acute inpatient");

    // Click confirm
    const confirmButton = screen.getByTestId("confirm-inactivation-button");
    await user.click(confirmButton);

    expect(onStatusChange).toHaveBeenCalledWith("inactive", "Patient readmitted to acute inpatient");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("transitions directly to active when currently inactive without modal barrier", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    render(
      <PlanStatusToggle
        planId="PLAN-002"
        patientName="Alex Chen"
        currentStatus="inactive"
        onStatusChange={onStatusChange}
      />,
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    // No modal required for reactivation
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onStatusChange).toHaveBeenCalledWith("active");
  });

  it("dismisses confirmation dialog on Escape key and clears entered reason", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
      />,
    );

    const toggle = screen.getByRole("switch");
    await user.click(toggle);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const input = screen.getByLabelText(/Clinical Reason/i);
    await user.type(input, "Temporary pause note");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onStatusChange).not.toHaveBeenCalled();

    // Reopen dialog: draft reason should be cleared, not stale
    await user.click(toggle);
    expect(screen.getByLabelText(/Clinical Reason/i)).toHaveValue("");
  });

  it("confirms deactivation when pressing Enter inside the reason input", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("switch"));

    const input = screen.getByLabelText(/Clinical Reason/i);
    await user.type(input, "Clinician pressed Enter{Enter}");

    expect(onStatusChange).toHaveBeenCalledWith("inactive", "Clinician pressed Enter");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("manages focus safely: Cancel is focused initially, and focus restores to toggle on close", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
      />,
    );

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    // Initial focus MUST be on Cancel button for clinician safety (never default to destructive confirmation)
    const cancelButton = screen.getByTestId("cancel-inactivation-button");
    expect(document.activeElement).toBe(cancelButton);

    // Cancel and verify focus returns to toggle switch
    await user.click(cancelButton);
    expect(document.activeElement).toBe(toggle);
  });

  it("does not trigger when disabled", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <PlanStatusToggle
        planId="PLAN-001"
        patientName="Jordan Nguyen"
        currentStatus="active"
        onStatusChange={onStatusChange}
        disabled={true}
      />,
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    await user.click(toggle);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
