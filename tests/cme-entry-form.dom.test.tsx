import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CmeEntryForm } from "@/components/cme/cme-entry-form";

describe("New entry", () => {
  it("will not save until the allocations add up to the stated hours", async () => {
    const onSubmit = vi.fn();
    render(<CmeEntryForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/what was it/i), "Peer review group — September");
    await user.click(screen.getByRole("button", { name: "1.5" }));
    await user.type(screen.getByLabelText(/reviewing performance/i), "1");
    expect(screen.getByTestId("cme-allocation-total")).toHaveTextContent("1.0 of 1.5 allocated");
    expect(screen.getByRole("button", { name: /save entry/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/measuring outcomes/i), "0.5");
    expect(screen.getByTestId("cme-allocation-total")).toHaveTextContent("1.5 of 1.5 allocated");
    expect(screen.getByRole("button", { name: /save entry/i })).toBeEnabled();
  });

  it("labels the reflection without asking a question", () => {
    render(<CmeEntryForm onSubmit={vi.fn()} />);
    const reflection = screen.getByLabelText(/reflection/i);
    expect(reflection).toBeInTheDocument();
    // The owner declined a guided prompt on 2026-09-20. The box is his.
    expect(screen.queryByText(/what will you do differently/i)).toBeNull();
  });

  it("takes an optional cost and marks it optional", () => {
    render(<CmeEntryForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/what it cost/i)).toBeInTheDocument();
    expect(screen.getByTestId("cme-cost-optional")).toHaveTextContent(/optional/i);
  });

  it("rejects exponent notation in the cost field instead of parsing it as a number", async () => {
    const user = userEvent.setup();
    render(<CmeEntryForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/what it cost/i), "1e10");
    expect(screen.getByText("Numbers only, like 45 or 45.50.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save entry/i })).toBeDisabled();
  });

  it("rejects exponent notation in an allocation field instead of counting it as hours", async () => {
    const user = userEvent.setup();
    render(<CmeEntryForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/reviewing performance/i), "1e10");
    expect(screen.getByTestId("cme-allocation-total")).toHaveTextContent("0.0 of 1.0 allocated");
  });
});
