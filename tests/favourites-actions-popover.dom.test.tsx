/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { RowActionsMenu, type FavouriteItem } from "@/components/clinical-dashboard/favourites-command-library-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));

const item: FavouriteItem = {
  id: "service:adult-community-mental-health",
  title: "Adult community mental health",
  description: "Service details",
  type: "Service",
  tabId: "services",
  set: "Unsorted",
  evidence: "Source-backed",
  lastUsed: "Never",
  action: "Open",
  href: "/services/adult-community-mental-health",
  icon: FileText,
  contentType: "service",
  contentKey: "adult-community-mental-health",
  setId: null,
  sortOrder: 10,
};

describe("favourite row actions popover", () => {
  it("uses dialog semantics and reaches Move in the natural tab sequence", async () => {
    const user = userEvent.setup();
    render(
      <RowActionsMenu
        item={item}
        sets={[
          {
            id: "4f8a3d2e-c1b0-4a9e-8d7c-6b5a4f3e2d1c",
            name: "Ward round",
            sortOrder: 0,
            createdAt: "2026-08-23T00:00:00.000Z",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        ]}
        onMove={vi.fn(async () => true)}
        onRemove={vi.fn(async () => true)}
        onOpen={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /More actions/ }));
    const dialog = screen.getByRole("dialog", { name: /Actions for/ });
    expect(within(dialog).queryByRole("menu")).toBeNull();
    expect(within(dialog).getByRole("combobox", { name: /Move .* to set/ })).toBeVisible();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Copy citation" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("combobox", { name: /Move .* to set/ })).toHaveFocus();
  });
});
