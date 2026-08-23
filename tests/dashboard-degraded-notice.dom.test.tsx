import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DegradedNoticeFrame } from "@/components/clinical-dashboard/dashboard-notices";

describe("DegradedNoticeFrame", () => {
  it("is mounted unconditionally before the dashboard hero surface", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
    const frameIndex = dashboardSource.indexOf(
      "<DegradedNoticeFrame visible={showDegradedNotice} isOnline={isOnline} />",
    );
    const heroIndex = dashboardSource.indexOf("<section", frameIndex);

    expect(frameIndex).toBeGreaterThanOrEqual(0);
    expect(heroIndex).toBeGreaterThan(frameIndex);
    expect(dashboardSource).not.toContain("showDegradedNotice && <DegradedNoticeFrame");
  });

  it("keeps one stable flow frame while exposing alert semantics only for degraded content", () => {
    const { rerender } = render(<DegradedNoticeFrame visible={false} isOnline />);
    const frame = screen.getByTestId("dashboard-degraded-notice-frame");

    expect(frame).toHaveClass("min-h-14");
    expect(frame).toHaveAttribute("data-visible", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(frame).toBeEmptyDOMElement();

    rerender(<DegradedNoticeFrame visible isOnline={false} />);

    expect(screen.getByTestId("dashboard-degraded-notice-frame")).toBe(frame);
    expect(frame).toHaveClass("min-h-14");
    expect(frame).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");

    rerender(<DegradedNoticeFrame visible isOnline />);

    expect(screen.getByTestId("dashboard-degraded-notice-frame")).toBe(frame);
    expect(frame).toHaveClass("min-h-14");
    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");

    rerender(<DegradedNoticeFrame visible={false} isOnline />);

    expect(screen.getByTestId("dashboard-degraded-notice-frame")).toBe(frame);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(frame).toBeEmptyDOMElement();
  });
});
