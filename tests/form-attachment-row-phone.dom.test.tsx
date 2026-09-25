import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/forms/extension-transport-order",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { formRecords } from "@/lib/forms";

/**
 * #47Y8XH: at 320-390px the attachment row put the phone badges beside the text
 * column, which collapsed to ~55px and rendered the title as "Ext...". jsdom has
 * no layout, so this pins the layout contract the browser check relied on: a
 * single column on phones, a wrapping badge row, and a title that wraps there.
 */
describe("form attachment row on a phone", () => {
  const form = formRecords.find((record) => record.slug === "extension-transport-order") ?? formRecords[0];

  it("stacks the badges under the title instead of squeezing the title column", () => {
    render(<FormDetailPage form={form} />);
    const row = screen.getByTestId("form-attachment-row");
    const classes = row.className.split(/\s+/);

    expect(classes).toContain("grid-cols-1");
    expect(classes).not.toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(classes).toContain("sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]");

    const badges = within(row).getByTestId("form-attachment-phone-badges");
    expect(badges.className.split(/\s+/)).toEqual(expect.arrayContaining(["flex-wrap", "sm:hidden"]));

    const title = within(row).getByRole("heading", { level: 2 });
    const titleClasses = title.className.split(/\s+/);
    expect(titleClasses).not.toContain("truncate");
    expect(titleClasses).toContain("sm:truncate");
  });
});
