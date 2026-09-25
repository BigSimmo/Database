/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeSetupPage } from "@/components/cme/cme-setup-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";

afterEach(cleanup);

describe("CME requirement confirmation", () => {
  it("labels the versioned preset as a starting draft rather than full CPD-home compliance", () => {
    render(<CmeSetupPage year={2026} set={null} />);
    expect(screen.getByText(/Australian baseline \+ psychiatry peer-review preset/i)).toBeInTheDocument();
    expect(screen.getByText(/not a claim of full RANZCP CPD-home compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/check your CPD-home programme structure/i)).toBeInTheDocument();
  });

  it("submits the edited source and complete requirement set", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CmeSetupPage year={2026} set={DEMO_CME_YEAR} onConfirm={onConfirm} />);

    const source = screen.getByLabelText(/source you checked/i);
    await user.clear(source);
    await user.type(source, "My CPD home guide, 2026 edition");
    await user.click(screen.getByRole("button", { name: /add college extra/i }));
    await user.click(screen.getByRole("button", { name: /re-confirm requirements/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      year: 2026,
      confirmedSource: "My CPD home guide, 2026 edition",
    });
    expect(onConfirm.mock.calls[0][0].requirements.some((item: { source: string }) => item.source === "college")).toBe(
      true,
    );
  });

  it("records a task completion date without claiming the app completed it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CmeSetupPage year={2026} set={DEMO_CME_YEAR} onConfirm={onConfirm} />);
    const taskDate = screen.getAllByLabelText(/completion date/i)[0];
    await user.clear(taskDate);
    await user.type(taskDate, "2026-03-01");
    await user.click(screen.getByRole("button", { name: /re-confirm requirements/i }));
    expect(
      onConfirm.mock.calls[0][0].requirements.some(
        (item: { completedOn: string | null }) => item.completedOn === "2026-03-01",
      ),
    ).toBe(true);
  });

  it("keeps demo confirmation visibly read-only", () => {
    render(<CmeSetupPage year={2026} set={DEMO_CME_YEAR} demoMode />);
    expect(screen.getByText(/demo mode is read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-confirm requirements/i })).toBeNull();
  });
});
