import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { Sheet } from "@/components/ui/sheet";

it("releases Sheet-owned phone safe-area utilities while the header is hidden", () => {
  const onClose = vi.fn();
  const visible = (
    <Sheet
      open
      onClose={onClose}
      title="Fullscreen sheet"
      mobilePlacement="fullscreen"
      portal={false}
      headerBottom={<nav aria-label="Sheet views">Views</nav>}
    >
      <p>Body</p>
    </Sheet>
  );
  const { rerender } = render(visible);

  const dialog = screen.getByRole("dialog");
  let header = dialog.querySelector<HTMLElement>('[data-sheet-header="true"]');
  expect(header).not.toBeNull();
  expect(header).toHaveClass("pt-[max(1rem,var(--safe-area-top))]");
  expect(header).toHaveAttribute("aria-hidden", "false");
  expect(header).not.toHaveAttribute("inert");

  rerender(
    <Sheet
      open
      onClose={onClose}
      title="Fullscreen sheet"
      mobilePlacement="fullscreen"
      portal={false}
      headerHidden
      headerBottom={<nav aria-label="Sheet views">Views</nav>}
    >
      <p>Body</p>
    </Sheet>,
  );

  header = dialog.querySelector<HTMLElement>('[data-sheet-header="true"]');
  expect(header).not.toBeNull();
  expect(header).not.toHaveClass("pt-[max(1rem,var(--safe-area-top))]");
  expect(header).toHaveAttribute("aria-hidden", "true");
  expect(header).toHaveAttribute("inert", "");
});
