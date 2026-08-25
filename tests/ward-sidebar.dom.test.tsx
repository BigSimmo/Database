import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors and this suite
// reads hrefs rather than actually navigating, so a plain <a> avoids an App Router context jsdom
// cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";
import { WARD_SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/components/ward-management/use-ward-sidebar-collapsed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderRail() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ClinicalRail activeMode="queue" />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  window.localStorage.removeItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY);
});

afterEach(() => {
  window.localStorage.removeItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY);
});

/**
 * The phone drawer.
 *
 * Ward Flow had no phone treatment of any kind before this: `ward-management.module.css` held
 * four media queries, of which two were `prefers-reduced-motion` and `forced-colors` and two
 * named `.workspaceGrid` and `.patientWorkspace`. Not one touched the rail, so a 390px phone
 * rendered the full 4.5rem desktop icon column. Nothing in the test suite could notice, because
 * nothing was structurally wrong — which is why the checks below assert the drawer exists and
 * works, and why `tests/ward-sidebar-phone-contract.test.ts` separately asserts the stylesheet
 * rules that make it reachable.
 */
describe("Ward Flow phone drawer", () => {
  it("opens from the phone bar's menu button and closes again", () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: "Open Ward Flow menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Ward Flow")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close Ward Flow menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists every destination by name, which the icon rail can only do in an aria-label", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");

    for (const view of WARD_VIEWS) {
      const link = within(drawer).getByRole("link", { name: new RegExp(`^${view.label}$`) });
      expect(link, `${view.label} is missing from the drawer`).toHaveAttribute("href", view.href);
    }
    // Matched on href rather than on accessible name: two of these labels carry an "example" tag
    // inside the link (D10), so the name is the label plus that word.
    const drawerHrefs = within(drawer)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    for (const item of WARD_NAV) {
      expect(drawerHrefs, `${item.label} is missing from the drawer`).toContain(item.href);
    }
    // The two entries that name one arbitrary synthetic instance rather than a section of the app
    // say so in words here. The icon rail can only say it in an aria-label nobody reads.
    expect(within(drawer).getAllByText("example")).toHaveLength(2);
    // The one legitimate way out of the sandbox.
    expect(within(drawer).getByRole("link", { name: "Back to the developer hub" })).toHaveAttribute(
      "href",
      "/mockups/development",
    );
  });

  it("closes when a destination is chosen, so the drawer never covers the page it opened", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");
    fireEvent.click(within(drawer).getByRole("link", { name: "Capacity" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks the active view current in the drawer as well as in the rail", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("link", { name: "Priority queue" })).toHaveAttribute("aria-current", "page");
    expect(within(drawer).getByRole("link", { name: "Capacity" })).not.toHaveAttribute("aria-current");
  });
});

/**
 * The desktop expand/collapse pair, mirroring `useSidebarCollapsed` in the clinical application:
 * collapsed on a first visit, remembered per browser afterwards.
 */
describe("Ward Flow desktop sidebar collapse", () => {
  it("starts collapsed, with the icon rail and no labelled panel", () => {
    renderRail();
    expect(screen.getByRole("complementary", { name: "Ward Flow" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Ward Flow sidebar" })).toBeNull();
  });

  it("expands into the labelled panel and remembers the choice", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    const panel = screen.getByRole("complementary", { name: "Ward Flow sidebar" });
    expect(within(panel).getByRole("link", { name: "Priority queue" })).toHaveAttribute("aria-current", "page");
    expect(window.localStorage.getItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("0");

    fireEvent.click(within(panel).getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByRole("complementary", { name: "Ward Flow sidebar" })).toBeNull();
    expect(window.localStorage.getItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("1");
  });

  it("restores a remembered expanded preference on the next visit", () => {
    window.localStorage.setItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY, "0");
    renderRail();
    expect(screen.getByRole("complementary", { name: "Ward Flow sidebar" })).toBeTruthy();
  });
});
