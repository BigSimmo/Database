/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmergencyThumbArc } from "@/components/on-call/now/emergency-thumb-arc";

describe("EmergencyThumbArc", () => {
  it("renders the floating trigger button", () => {
    render(<EmergencyThumbArc />);
    const trigger = screen.getByTestId("on-call-emergency-thumb-arc-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands the emergency contacts tray on click and triggers haptics", () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrateMock, configurable: true });

    render(<EmergencyThumbArc switchboardNumber="08 9224 2244" />);
    const trigger = screen.getByTestId("on-call-emergency-thumb-arc-trigger");

    fireEvent.click(trigger);
    expect(vibrateMock).toHaveBeenCalledWith(15);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const tray = screen.getByTestId("on-call-emergency-thumb-arc-tray");
    expect(tray).toBeTruthy();

    const switchboard = screen.getByTestId("on-call-emergency-thumb-arc-action-switchboard");
    expect(switchboard).toBeTruthy();
    expect(switchboard.getAttribute("href")).toBe("tel:0892242244");
  });

  it("closes when the backdrop is clicked", () => {
    render(<EmergencyThumbArc />);
    fireEvent.click(screen.getByTestId("on-call-emergency-thumb-arc-trigger"));
    expect(screen.getByTestId("on-call-emergency-thumb-arc-tray")).toBeTruthy();

    fireEvent.click(screen.getByTestId("on-call-emergency-thumb-arc-backdrop"));
    expect(screen.queryByTestId("on-call-emergency-thumb-arc-tray")).toBeNull();
  });

  it("closes when the Escape key is pressed", () => {
    render(<EmergencyThumbArc />);
    fireEvent.click(screen.getByTestId("on-call-emergency-thumb-arc-trigger"));
    expect(screen.getByTestId("on-call-emergency-thumb-arc-tray")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("on-call-emergency-thumb-arc-tray")).toBeNull();
  });
});
