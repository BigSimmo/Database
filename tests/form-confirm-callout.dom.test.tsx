import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/forms/test-form",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { getFormRecord } from "@/lib/forms";

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

describe("Form confirm callouts", () => {
  it("renders Confirm rows as spaced reading callouts with soft cues", () => {
    const form = getFormRecord("form-1a");
    expect(form).toBeTruthy();
    render(<FormDetailPage form={form!} />);

    const mobile = screen.getByTestId("form-decision-context-mobile");
    const confirmHeading = Array.from(mobile.querySelectorAll("p")).find((p) => p.textContent === "Confirm");
    expect(confirmHeading).toBeTruthy();

    const stack = confirmHeading!.parentElement!.querySelector(":scope > .grid");
    expect(stack?.className).toContain("gap-2.5");

    const rows = Array.from(stack!.children) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      expect(row.className).toMatch(/font-normal/);
      expect(row.className).toMatch(/px-3/);
      expect(row.className).toMatch(/py-2\.5/);
      expect(row.className).toMatch(/rounded-lg/);
      expect(row.className).not.toMatch(/font-semibold/);
    }

    expect(mobile.textContent).toMatch(/Avoid:/);
    expect(Array.from(mobile.querySelectorAll("span.font-medium")).some((el) => el.textContent === "Before use:")).toBe(
      true,
    );
  });

  it("keeps a visible focus-visible outline on the keyboard-focusable tab panels", () => {
    const form = getFormRecord("form-1a");
    expect(form).toBeTruthy();
    render(<FormDetailPage form={form!} />);

    const panels = screen.getAllByRole("tabpanel");
    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) {
      expect(panel.tabIndex).toBe(0);
      expect(panel.className).toContain("focus-visible:outline");
      expect(panel.className).toContain("focus-visible:outline-2");
      expect(panel.className).not.toContain("focus-visible:outline-none");
    }
  });
});
