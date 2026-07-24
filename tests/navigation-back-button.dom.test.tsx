import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationBackButton } from "@/components/navigation-back-button";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

beforeEach(() => {
  router.back.mockReset();
  router.push.mockReset();
});

describe("NavigationBackButton", () => {
  it("uses the explicit in-app fallback even when browser history has prior entries", () => {
    window.history.pushState({}, "", "/external-entry");
    window.history.pushState({}, "", "/privacy");
    expect(window.history.length).toBeGreaterThan(1);

    render(<NavigationBackButton fallbackHref="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });
});
