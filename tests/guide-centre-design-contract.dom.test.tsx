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
 * The phone footer is the SHARED edge-to-edge dock, not a Sheet footer band. Its
 * own surface/border/elevation are sm+ only: on phones they painted an opaque
 * `--surface-raised` slab across the content behind the action, which is exactly
 * the "big cover" every other phone composer avoids by staying transparent behind
 * a localized `.answer-footer-search-backdrop` scrim.
 *
 * It carries the COMPACT scrim variant. The default 10rem height was sized for a
 * search composer plus an action row; the dock now holds a single control, so the
 * taller scrim would tint far more page than the control it seats.
 */
it("gives the Guide footer the shared phone dock chrome at the compact scrim height", () => {
  render(<GuideDialog open onClose={vi.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Clinical KB guide" });
  const footer = dialog.querySelector<HTMLElement>("[data-guide-mobile-footer]")?.parentElement;

  expect(footer).not.toBeNull();
  expect(footer).toHaveClass("answer-footer-search-dock");
  expect(footer).toHaveClass("answer-footer-search-edge");
  expect(footer).toHaveAttribute("data-footer-variant", "compact");

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
 * The tour action is the dock's ONLY control, so it takes the filled primary
 * treatment — the role `differentials-mobile-compare-fab__button` fills on its own
 * surface — not the quiet outlined framing reserved for dock addons.
 *
 * This inverted on 2026-08-19. While a search composer shared the dock the action
 * was an addon and a filled slab beside the pill put back a smaller version of the
 * opaque cover the dock conversion removed. With the composer gone there is
 * nothing to compete with and nothing left to cover, so the phone-scoped
 * translucent override must NOT come back — only the pill radius and elevation
 * stay phone-scoped.
 */
it("renders the Guide tour action as the dock's single filled primary pill", () => {
  render(<GuideDialog open onClose={vi.fn()} />);

  const dialog = screen.getByRole("dialog", { name: "Clinical KB guide" });
  const row = dialog.querySelector<HTMLElement>("[data-guide-tour-action-row]");
  expect(row).not.toBeNull();

  // One control in the dock at rest — no composer, no secondary duplicates of the tabs.
  expect(row?.querySelectorAll("button")).toHaveLength(1);

  const action = row?.querySelector<HTMLElement>("button");
  expect(action).not.toBeNull();

  // Filled primary at every breakpoint; only the floating pill framing is phone-scoped.
  expect(action).toHaveClass("bg-[color:var(--command)]", "text-[color:var(--command-contrast)]");
  expect(action).toHaveClass("max-sm:rounded-full", "max-sm:shadow-[var(--e3)]");

  // The retired addon framing must not return.
  expect(action).not.toHaveClass("max-sm:bg-[color-mix(in_srgb,var(--surface)_92%,transparent)]");
  expect(action).not.toHaveClass("max-sm:border-[color:var(--border-strong)]");
});
