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

    expect(dashboardSource).toContain("showDegradedNotice || centeredModeHome ? (");
    expect(dashboardSource).toContain("reserveSpace={centeredModeHome}");
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
    const frame = screen.getByTestId("dashboard-degraded-notice-frame");

    expect(frame).toHaveClass("h-0");
    expect(frame).toHaveAttribute("data-visible", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(frame).toBeEmptyDOMElement();

    rerender(<DegradedNoticeFrame visible isOnline={false} />);

    expect(screen.getByTestId("dashboard-degraded-notice-frame")).toBe(frame);
    expect(frame).toHaveClass("h-0");
    expect(frame).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");

    rerender(<DegradedNoticeFrame visible isOnline />);

    expect(screen.getByTestId("dashboard-degraded-notice-frame")).toBe(frame);
    expect(frame).toHaveClass("min-h-[3.875rem]");
    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");

    rerender(<DegradedNoticeFrame visible={false} isOnline />);

    expect(screen.getByTestId("dashboard-degraded-notice-frame")).toBe(frame);
    expect(frame).toHaveClass("h-0");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(frame).toBeEmptyDOMElement();
  });
});
