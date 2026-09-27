/** @vitest-environment jsdom */
// "About this mode" sits in the ••• menu of every First Nations page, so the primer it opens must be
// mounted by the mode's layout, not only by Bedside; otherwise the row is a button that does nothing.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FirstNationsLayout from "@/app/(search-app)/first-nations/layout";
import { FirstNationsMenuActions } from "@/components/first-nations/page-menu";
import { resetAfterEach } from "./fixtures/first-nations-models";

vi.mock("next/font/local", () => ({ default: () => ({ variable: "fn-serif" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/first-nations/talking", useRouter: () => ({}) }));
resetAfterEach();

describe("About this mode on an inner page", () => {
  it("opens the primer from the layout after it was dismissed", () => {
    window.localStorage.setItem("first-nations-primer-dismissed", "1");
    render(
      <FirstNationsLayout>
        <FirstNationsMenuActions pageTitle="Talking" href="/first-nations/talking" reportHref={null} training={null} />
      </FirstNationsLayout>,
    );
    expect(screen.queryByRole("dialog", { name: "About First Nations" })).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "About this mode" }));
    });
    expect(screen.getByRole("dialog", { name: "About First Nations" })).toBeTruthy();
    window.localStorage.removeItem("first-nations-primer-dismissed");
  });
});
