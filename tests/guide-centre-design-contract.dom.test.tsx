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

/**
 * Inside the dock the tour action is an ADDON, and every dock addon in this repo
 * is an outlined translucent pill — `Patient details`
 * (`patient-details-fab__button`) and Compare's quiet state. A filled primary
 * control there puts back a smaller version of the opaque cover the dock
 * conversion removed, because the band behind it is deliberately transparent.
 * From `sm` the footer is a real band and the primary treatment is correct.
 */
it("renders the Guide tour action as a dock addon pill on phones only", () => {
  render(<GuideDialog open onClose={vi.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Clinical KB guide" });
  const row = dialog.querySelector<HTMLElement>("[data-guide-tour-action-row]");
  expect(row).not.toBeNull();

  const action = row?.querySelector<HTMLElement>("button:last-of-type");
  expect(action).not.toBeNull();

  // Addon framing, phone-scoped.
  expect(action).toHaveClass(
    "max-sm:rounded-full",
    "max-sm:border",
    "max-sm:border-[color:var(--border-strong)]",
    "max-sm:bg-[color-mix(in_srgb,var(--surface)_92%,transparent)]",
    "max-sm:shadow-[var(--e3)]",
  );

  // The sm+ primary treatment is still the base, not replaced.
  expect(action).toHaveClass("bg-[color:var(--command)]", "text-[color:var(--command-contrast)]");
});
