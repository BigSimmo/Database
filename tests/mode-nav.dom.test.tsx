import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Columns3, FileText, House, Search, Sparkles, Timer, Waypoints } from "lucide-react";
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

// Therapy's seven destinations. Only the first four ever occupy a slot — the
// bands cap at five, so `home`, `brief` and `sheets` live permanently in the
// overflow, which is exactly the case that makes the More slot's width matter.
const sevenItems: ModeNavItem[] = [
  ...items,
  { id: "home", label: "Home", href: "/therapy-compass", icon: House },
  { id: "brief", label: "Brief Intervention", href: "/therapy-compass/act/brief", icon: Timer },
  { id: "sheets", label: "Patient Sheets", href: "/therapy-compass/act/sheet", icon: FileText },
];

function moreSlotButton() {
  const button = window.document.querySelector<HTMLButtonElement>(".mode-nav__bar li[data-until] button");
  expect(button).not.toBeNull();
  return button!;
}

const moreSlot = () => window.document.querySelector<HTMLElement>(".mode-nav__bar li.mode-nav__more");

describe("ModeNav — active page held in the overflow", () => {
  it("keeps More's visible word while carrying the folded page's rule and name", () => {
    render(<ModeNav items={sevenItems} label="Therapy pages" activeId="brief" />);

    const more = moreSlotButton();
    // The visible word is what has a width, and at the 22rem band the slot
    // cannot pay for "Brief Intervention". The off-screen name is free, and
    // "More" stays its prefix per WCAG 2.5.3. `none` means the page never gets
    // a slot at any band, so CSS keeps both the rule and the name on.
    expect(more.querySelector("span.truncate")?.textContent).toBe("More");
    expect(more.querySelector(".mode-nav__more-name")?.textContent).toBe(", current page: Brief Intervention");
    expect(moreSlot()?.getAttribute("data-active-from")).toBe("none");

    // No *rendered* slot claims to be the current page. The folded item still
    // carries `aria-current` on its own link, but that slot has no band and is
    // `display: none`, so it is out of the accessibility tree — which is why
    // More has to carry the name instead.
    for (const slot of window.document.querySelectorAll('.mode-nav__bar li[data-band]:not([data-band="none"])')) {
      expect(slot.querySelector("[aria-current]")).toBeNull();
    }
    expect(window.document.querySelector('.mode-nav__bar li[data-band="none"] a[aria-current="page"]')).not.toBeNull();
    // The collapsed control is the state with room, so it still names the page.
    const collapsed = window.document.querySelector(".mode-nav__control button");
    expect(collapsed?.textContent).toContain("Brief Intervention");
  });

  it("marks nothing active on a record route, and leaves More plain", () => {
    // `detail` and `review` are screen names with no item. ModeNav must not
    // fall back to its own path matching there, or Home — whose href is the
    // mode base every route starts with — would claim every record page.
    render(<ModeNav items={sevenItems} label="Therapy pages" activeId="detail" />);

    expect(moreSlotButton().textContent).toBe("More");
    expect(moreSlot()?.hasAttribute("data-active-from")).toBe(false);
    expect(window.document.querySelector(".mode-nav__more-name")).toBeNull();
    expect(window.document.querySelector('[aria-current="page"]')).toBeNull();
    expect(window.document.querySelector(".mode-nav__control button")?.textContent).toContain("Therapy pages");
  });

  it("publishes the band that reveals the current page, so CSS can decide", () => {
    // Only the container query knows the width. The component's job is to say
    // which band would show the page its own tab; `3` means every band, so More
    // never carries it, and `5` means only the widest.
    for (const [activeId, band, href] of [
      ["compare", "3", "/therapy-compass/compare"],
      ["recommend", "4", "/therapy-compass/recommend"],
      ["pathways", "5", "/therapy-compass/pathways"],
    ] as const) {
      const { unmount } = render(<ModeNav items={sevenItems} label="Therapy pages" activeId={activeId} />);
      expect(moreSlot()?.getAttribute("data-active-from"), activeId).toBe(band);
      // The page's own slot always carries `aria-current`; CSS decides which of
      // the two is on screen at a given width.
      expect(
        window.document.querySelector(`.mode-nav__bar a[aria-current="page"]`)?.getAttribute("href"),
        activeId,
      ).toBe(href);
      unmount();
    }
  });
});
