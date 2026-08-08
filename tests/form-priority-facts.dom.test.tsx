import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { getFormRecord } from "@/lib/forms";

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

describe("Form 1A priority facts", () => {
  it("opens condensed fact detail and per-section Act detail sheets", async () => {
    const user = userEvent.setup();
    const form = getFormRecord("form-1a");
    if (!form) throw new Error("Expected Form 1A");

    render(<FormDetailPage form={form} />);

    const priorityFacts = screen.getByLabelText("Priority facts");
    expect(within(priorityFacts).getByText("Usually 72 hours")).toBeInTheDocument();
    expect(within(priorityFacts).queryByText("Source status")).not.toBeInTheDocument();
    expect(within(priorityFacts).getByText("Act sections")).toBeInTheDocument();

    await user.click(within(priorityFacts).getByRole("button", { name: /Clock \/ review.*Open detail/i }));
    const factSheet = await screen.findByTestId("form-priority-fact-sheet");
    expect(factSheet).toHaveTextContent(/72 hours from referral/i);

    await user.click(within(factSheet).getByRole("button", { name: /close/i }));

    await user.click(within(priorityFacts).getByRole("button", { name: /Section 26:/i }));
    const sectionSheet = await screen.findByTestId("form-act-section-sheet");
    expect(sectionSheet).toHaveTextContent(/Referral for examination at authorised hospital or other place/i);
    expect(sectionSheet).toHaveTextContent(/reasonably suspect/i);
  });
});
