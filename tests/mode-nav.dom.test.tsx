import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Columns3, Search, Sparkles, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// ModeNav has two triggers for one Sheet, and CSS decides which one exists:
// below a 16rem container only the collapsed control is displayed, at 16rem and
// up only the More slot is (`@container mode-nav` in globals.css). Both stay in
// the DOM either way, so the Sheet's `returnFocusRef` must follow the button the
// user actually pressed — a ref pinned to one of them hands the Sheet a
// `display: none` element half the time, the browser declines to focus it, and
// the keyboard user is dropped on <body>. The collapsed state is not an edge
// case: it is what a phone reaches at 200% text zoom, the reflow path this bar
// was designed around.
//
// jsdom loads no stylesheet and will happily focus a hidden element, so these
// tests pin the restore TARGET — which opener the Sheet was told to return to —
// rather than the browser's focusability rule, which jsdom cannot model.

vi.mock("next/navigation", () => ({
  usePathname: () => "/therapy-compass/search",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ModeNav, type ModeNavItem } from "@/components/mode-nav/mode-nav";

const items: ModeNavItem[] = [
  { id: "search", label: "Search", href: "/therapy-compass/search", icon: Search },
  { id: "compare", label: "Compare", href: "/therapy-compass/compare", icon: Columns3, count: "0/4" },
  { id: "recommend", label: "Recommend", href: "/therapy-compass/recommend", icon: Sparkles },
  { id: "pathways", label: "Pathways", href: "/therapy-compass/pathways", icon: Waypoints },
];

/** Apply what the `@container mode-nav (min-width: 16rem)` band does at runtime. */
function renderNav(band: "collapsed" | "bar") {
  render(<ModeNav items={items} label="Therapy pages" />);
  const bar = window.document.querySelector<HTMLElement>(".mode-nav__bar");
  const control = window.document.querySelector<HTMLElement>(".mode-nav__control");
  expect(bar).not.toBeNull();
  expect(control).not.toBeNull();
  bar!.style.display = band === "bar" ? "grid" : "none";
  control!.style.display = band === "bar" ? "none" : "flex";

  const collapsedTrigger = control!.querySelector<HTMLButtonElement>("button");
  const moreTrigger = bar!.querySelector<HTMLButtonElement>("li[data-until] button");
  expect(collapsedTrigger).not.toBeNull();
  expect(moreTrigger).not.toBeNull();
  return { collapsedTrigger: collapsedTrigger!, moreTrigger: moreTrigger! };
}

async function openThenClose(opener: HTMLButtonElement) {
  // Deliberately NOT focusing the opener first. jsdom leaves focus on <body>
  // through a synthetic click, so the Sheet's `previousActiveElement` fallback
  // is <body> and the only thing that can move focus off it is the explicit
  // `returnFocusRef` restore — which makes the wait below a real wait rather
  // than a poll that succeeds on the pre-existing focus.
  expect(window.document.activeElement).toBe(window.document.body);
  fireEvent.click(opener);
  expect(await screen.findByTestId("mode-nav-sheet")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByTestId("mode-nav-sheet")).toBeNull());
}

describe("ModeNav — sheet focus restore follows the opener", () => {
  it("returns focus to the collapsed control below the bar band", async () => {
    const { collapsedTrigger, moreTrigger } = renderNav("collapsed");

    await openThenClose(collapsedTrigger);

    // Wait for the Sheet's deferred restore to land on *something* before
    // asserting which, so this cannot pass on a poll that ran too early.
    await waitFor(() => expect(window.document.activeElement).not.toBe(window.document.body));
    expect(window.document.activeElement).toBe(collapsedTrigger);
    expect(window.document.activeElement).not.toBe(moreTrigger);
  });

  it("returns focus to the More slot inside the bar band", async () => {
    const { collapsedTrigger, moreTrigger } = renderNav("bar");

    await openThenClose(moreTrigger);

    await waitFor(() => expect(window.document.activeElement).not.toBe(window.document.body));
    expect(window.document.activeElement).toBe(moreTrigger);
    expect(window.document.activeElement).not.toBe(collapsedTrigger);
  });
});
