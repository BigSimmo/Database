import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ColourCodingReferencePage from "@/app/reference/colour-coding/page";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { NavigationBackButton } from "@/components/navigation-back-button";
import { PrivacyPageBackButton } from "@/components/privacy-page-back-button";
import { appModeHomeHref } from "@/lib/app-modes";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));
const currentSearchParams = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams.value,
}));

function setCanGoBack(value: boolean | undefined) {
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: value === undefined ? undefined : { canGoBack: value },
  });
}

beforeEach(() => {
  router.back.mockReset();
  router.replace.mockReset();
  currentSearchParams.value = new URLSearchParams();
  setCanGoBack(false);
});

describe("contextual back navigation", () => {
  it("returns to the immediately preceding browser-history entry", async () => {
    const user = userEvent.setup();
    setCanGoBack(true);
    render(<NavigationBackButton fallbackHref="/" />);

    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("uses replace for a direct-entry fallback so it cannot create a back loop", async () => {
    const user = userEvent.setup();
    render(<NavigationBackButton fallbackHref="/forms" />);

    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.replace).toHaveBeenCalledOnce();
    expect(router.replace).toHaveBeenCalledWith("/forms");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("falls back to history.length when the Navigation API is unavailable", async () => {
    const user = userEvent.setup();
    setCanGoBack(undefined);
    window.history.pushState({}, "", "/answer");
    window.history.pushState({}, "", "/medications/lithium");
    render(<NavigationBackButton fallbackHref="/medications" />);

    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("cancels button navigation when onBeforeNavigate returns false", async () => {
    const user = userEvent.setup();
    const onBeforeNavigate = vi.fn(() => false);
    setCanGoBack(true);
    render(<NavigationBackButton fallbackHref="/" onBeforeNavigate={onBeforeNavigate} />);

    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("supports keyboard activation on the fallback link", async () => {
    const user = userEvent.setup();
    setCanGoBack(true);
    render(<ContextualBackLink fallbackHref="/services">Back to services</ContextualBackLink>);

    await user.tab();
    await user.keyboard("{Enter}");

    expect(router.back).toHaveBeenCalledOnce();
  });

  it("preserves fallback-link semantics for modified clicks", () => {
    render(<ContextualBackLink fallbackHref="/services">Back to services</ContextualBackLink>);
    const link = screen.getByRole("link", { name: "Back to services" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 });
    let preventedByComponent: boolean | undefined;
    window.addEventListener(
      "click",
      (clickEvent) => {
        preventedByComponent = clickEvent.defaultPrevented;
        clickEvent.preventDefault();
      },
      { once: true },
    );

    link.dispatchEvent(event);
    expect(preventedByComponent).toBe(false);
    expect(link).toHaveAttribute("href", "/services");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("runs the dirty-state gate before a modified-click fallback", () => {
    const onBeforeNavigate = vi.fn(() => false);
    render(
      <ContextualBackLink fallbackHref="/services" onBeforeNavigate={onBeforeNavigate}>
        Back to services
      </ContextualBackLink>,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 });

    expect(screen.getByRole("link").dispatchEvent(event)).toBe(false);
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
  });

  it("returns the colour-coding reference to the app home on direct entry", () => {
    render(<ColourCodingReferencePage />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("returns privacy readers to their allowlisted source mode on direct entry", () => {
    currentSearchParams.value = new URLSearchParams("from=documents");
    render(<PrivacyPageBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.replace).toHaveBeenCalledWith(appModeHomeHref("documents"));
  });

  it("fails closed to the default home for an invalid privacy source", () => {
    currentSearchParams.value = new URLSearchParams("from=https://example.com");
    render(<PrivacyPageBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
