import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GuideDialog } from "@/components/clinical-dashboard/guide-dialog";

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 60));
  });
});

it("keeps Guide chrome on approved elevation and non-layout transitions", () => {
  render(<GuideDialog open onClose={vi.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Clinical KB guide" });
  const header = dialog.querySelector<HTMLElement>(".guide-centre-header");
  const footer = dialog.querySelector<HTMLElement>("[data-guide-mobile-footer]")?.parentElement;

  expect(header).not.toBeNull();
  expect(footer).not.toBeNull();
  expect(header).toHaveClass("transition-[border-color,opacity]");
  expect(header).not.toHaveClass("transition-[max-height,padding,border-color,opacity]");
  expect(footer).not.toHaveClass("shadow-[var(--shadow-elevated)]");
  expect(footer).toHaveClass("transition-[transform,opacity]");
});

/**
 * The phone footer is the SHARED edge-to-edge composer dock, not a Sheet footer
 * band. Its own surface/border/elevation are sm+ only: on phones they painted an
 * opaque `--surface-raised` slab across the content behind the search pill, which
 * is exactly the "big cover" every other phone composer avoids by staying
 * transparent behind a localized `.answer-footer-search-backdrop` scrim.
 */
it("gives the Guide footer the shared phone composer dock chrome", () => {
  render(<GuideDialog open onClose={vi.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Clinical KB guide" });
  const footer = dialog.querySelector<HTMLElement>("[data-guide-mobile-footer]")?.parentElement;

  expect(footer).not.toBeNull();
  expect(footer).toHaveClass("answer-footer-search-dock");
  expect(footer).toHaveClass("answer-footer-search-edge");

  // Phone band chrome is off; the sm+ Sheet footer keeps it.
  expect(footer).toHaveClass("border-t-0", "bg-transparent", "shadow-none", "p-0");
  expect(footer).toHaveClass("sm:border-t", "sm:bg-[color:var(--surface-raised)]", "sm:p-4");
  expect(footer).not.toHaveClass("border-t", "bg-[color:var(--surface-raised)]");

  // The scrim the dock geometry tints with, hidden once the footer is a real band.
  const backdrop = footer?.querySelector(".answer-footer-search-backdrop");
  expect(backdrop).not.toBeNull();
  expect(backdrop).toHaveClass("sm:hidden");
});
