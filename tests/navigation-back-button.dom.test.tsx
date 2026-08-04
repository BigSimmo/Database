import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationBackButton } from "@/components/navigation-back-button";
import { PrivacyPageBackButton } from "@/components/privacy-page-back-button";
import ColourCodingReferencePage from "@/app/reference/colour-coding/page";
import { appModeHomeHref } from "@/lib/app-modes";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));
const currentSearchParams = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams.value,
}));

beforeEach(() => {
  router.back.mockReset();
  router.push.mockReset();
  currentSearchParams.value = new URLSearchParams();
});

describe("NavigationBackButton", () => {
  it("uses the explicit in-app fallback even when browser history has prior entries", () => {
    window.history.pushState({}, "", "/unrelated-route");
    window.history.pushState({}, "", "/privacy");
    expect(window.history.length).toBeGreaterThan(1);

    render(<NavigationBackButton fallbackHref="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("cancels navigation when onBeforeNavigate returns false", () => {
    const onBeforeNavigate = vi.fn(() => false);

    render(<NavigationBackButton fallbackHref="/" onBeforeNavigate={onBeforeNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(onBeforeNavigate).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("returns the colour-coding reference to the canonical Tools home", () => {
    render(<ColourCodingReferencePage />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith(appModeHomeHref("tools"));
  });

  it("returns privacy readers to their allowlisted source mode", () => {
    currentSearchParams.value = new URLSearchParams("from=documents");

    render(<PrivacyPageBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith(appModeHomeHref("documents"));
  });

  it("fails closed to the default home for an invalid privacy source", () => {
    currentSearchParams.value = new URLSearchParams("from=https://example.com");

    render(<PrivacyPageBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/");
  });
});
