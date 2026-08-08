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

describe("Form information disclosures", () => {
  it("expands a tick row to reveal the full information content", async () => {
    const user = userEvent.setup();
    const form = getFormRecord("form-1a");
    expect(form).toBeTruthy();
    if (!form) return;

    const doesNotAuthorise = form.referralInfo?.find((row) => row.label === "Does not authorise");
    expect(doesNotAuthorise?.value).toBeTruthy();
    const fullText = doesNotAuthorise!.value;

    render(<FormDetailPage form={form} />);

    const section = screen.getByRole("region", { name: "Form information" });
    const trigger = within(section).getByRole("button", { name: /Does not authorise/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).toBeTruthy();
    expect(panel).toHaveAttribute("hidden");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("hidden");
    expect(within(panel!).getByText(fullText)).toBeVisible();
  });
});
