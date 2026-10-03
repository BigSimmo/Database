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

  it("omits contacts without verified numbers and does not dial fabricated placeholders", () => {
    render(<EmergencyThumbArc switchboardNumber="08 9224 2244" />);
    const trigger = screen.getByTestId("on-call-emergency-thumb-arc-trigger");
    fireEvent.click(trigger);

    expect(screen.queryByTestId("on-call-emergency-thumb-arc-action-on-call-consultant")).toBeNull();
    expect(screen.queryByTestId("on-call-emergency-thumb-arc-action-med-reg")).toBeNull();
  });

  it("offers no emergency row without a reviewed pin and never dials an invented 55", () => {
    render(<EmergencyThumbArc switchboardNumber="08 9224 2244" />);
    fireEvent.click(screen.getByTestId("on-call-emergency-thumb-arc-trigger"));
    expect(screen.queryByTestId("on-call-emergency-thumb-arc-action-emergency-code-black")).toBeNull();
    expect(document.querySelector('a[href="tel:55"]')).toBeNull();
  });

  it("shows a hospital-only extension as text with no dial link", () => {
    const pin = { mobileDial: null, dial: { kind: "extension", display: "55", tel: null } } as never;
    render(<EmergencyThumbArc pins={[pin]} />);
    fireEvent.click(screen.getByTestId("on-call-emergency-thumb-arc-trigger"));
    const row = screen.getByTestId("on-call-emergency-thumb-arc-action-emergency-code-black");
    expect(row.getAttribute("href")).toBeNull();
    expect(row.textContent).toContain("From a hospital phone");
  });
});
