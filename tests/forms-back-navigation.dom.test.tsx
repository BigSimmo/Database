import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { formRecords } from "@/lib/forms";

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

describe("Form detail back navigation", () => {
  it("uses the canonical Forms route even when browser history has prior entries", () => {
    window.history.pushState({}, "", "/unrelated-route");
    window.history.pushState({}, "", "/forms/transport-crisis-form");
    expect(window.history.length).toBeGreaterThan(1);

    render(<FormDetailPage form={formRecords[0]} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to forms" }));

    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/forms?focus=1");
    expect(router.back).not.toHaveBeenCalled();
  });
});
