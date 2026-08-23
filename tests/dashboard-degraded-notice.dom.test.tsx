import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DegradedNoticeFrame } from "@/components/clinical-dashboard/dashboard-notices";

describe("DegradedNoticeFrame", () => {
  it("reserves the notice frame only for the centred home surface", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
    const frameIndex = dashboardSource.indexOf("<DegradedNoticeFrame");
    const heroIndex = dashboardSource.indexOf("<section", frameIndex);

    expect(dashboardSource).toContain(
      "<DegradedNoticeFrame visible={showDegradedNotice} isOnline={isOnline} reserveSpace={centeredModeHome} />",
    );
    expect(dashboardSource).not.toContain("showDegradedNotice || centeredModeHome ? (");
    expect(frameIndex).toBeGreaterThanOrEqual(0);
    expect(heroIndex).toBeGreaterThan(frameIndex);
  });

  it("keeps a stable frame while exposing alert semantics only for degraded content", () => {
    const drawerSource = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/dashboard-shell.tsx"),
      "utf8",
    );
    const primitivesSource = readFileSync(resolve(process.cwd(), "src/components/ui-primitives.tsx"), "utf8");
    expect(drawerSource).toContain('"flex min-h-[56px]');
    expect(drawerSource).toContain("rounded-lg px-4 py-3 text-left");
    expect(primitivesSource).toMatch(/iconTilePremium\s*=\s*\n\s*"[^"]*h-9 w-9/);
    expect(primitivesSource).toMatch(/panelSubtle\s*=\s*\n\s*"[^"]*border border-/);

    // Mobile: max(56px minimum, 36px icon + 24px block padding) = 60px.
    // Desktop: the bordered details panel adds 2px, so 62px is the stable max.
    const collapsedDrawerMaximumPx = Math.max(56, 36 + 2 * 12) + 2;
    expect(collapsedDrawerMaximumPx).toBe(62);

    const { rerender } = render(<DegradedNoticeFrame visible={false} isOnline reserveSpace />);

    const reservedEmpty = screen.getByTestId("dashboard-degraded-notice-frame");
    expect(reservedEmpty).toHaveClass("min-h-[3.875rem]");
    expect(reservedEmpty).toHaveAttribute("data-visible", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<DegradedNoticeFrame visible isOnline={false} />);

    const overlayFrame = screen.getByTestId("dashboard-degraded-notice-frame");
    expect(overlayFrame).toHaveClass("h-0", "!mt-0");
    expect(overlayFrame).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");

    rerender(<DegradedNoticeFrame visible isOnline reserveSpace />);

    const reservedFrame = screen.getByTestId("dashboard-degraded-notice-frame");
    expect(reservedFrame).toHaveClass("min-h-[3.875rem]");
    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");

    rerender(<DegradedNoticeFrame visible={false} isOnline />);

    expect(screen.queryByTestId("dashboard-degraded-notice-frame")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
