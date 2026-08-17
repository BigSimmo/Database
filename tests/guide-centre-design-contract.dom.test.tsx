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
  expect(footer).toHaveClass("shadow-[var(--e4)]");
  expect(footer).not.toHaveClass("shadow-[var(--shadow-elevated)]");
  expect(footer).toHaveClass("transition-[transform,opacity]");
});
