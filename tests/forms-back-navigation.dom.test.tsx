import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { formRecords } from "@/lib/forms";

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

describe("Form detail back navigation", () => {
  it("leaves the single back action to the shared information-page header", () => {
    render(<FormDetailPage form={formRecords[0]} />);

    expect(screen.queryByRole("button", { name: "Back to forms" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Form breadcrumbs" })).toBeInTheDocument();
  });
});
