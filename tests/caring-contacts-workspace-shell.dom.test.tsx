import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaringContactsShell } from "@/components/caring-contacts/workspace/shell";
import { FICTIONAL_DATA_MARKER } from "@/components/caring-contacts/workspace/synthetic-marker";
import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { teamId } from "@/lib/caring-contacts/ids";
import { runningService } from "@/lib/caring-contacts/service-state";

/**
 * Ruling 52: the workspace navigation renders its whole destination set now, and
 * every destination that has no page yet is an *unavailable control with a stated
 * reason* — never a link to a route that would 404.
 *
 * The kind of each destination is derived from the DOM itself rather than read
 * off a marker attribute the shell controls, so the shell cannot satisfy this
 * test by relabelling a dead link.
 */
type DestinationKind = "link" | "in-page" | "unavailable" | "live-action" | "unknown";

function destinationKind(element: Element): DestinationKind {
  if (element.tagName === "A") {
    const href = element.getAttribute("href") ?? "";
    if (href.startsWith("#")) return "in-page";
    return href ? "link" : "unknown";
  }
  if (element.tagName === "BUTTON") {
    return element.getAttribute("aria-disabled") === "true" ? "unavailable" : "live-action";
  }
  return "unknown";
}

/** Every destination in one navigation, in DOM order, as { label, kind }. */
function destinationsOf(navigation: HTMLElement) {
  return [...navigation.querySelectorAll("a, button")].map((element) => ({
    label: element.textContent,
    kind: destinationKind(element),
  }));
}

/**
 * The Tailwind min-width variants this shell uses, and the width each one starts at.
 *
 * A closed map rather than a pattern, and `rendersAt` THROWS on a variant that is not in it. The
 * whole point of this helper is that it must not guess: a silent "assume visible" would turn every
 * reachability assertion below into an assertion about nothing, which is the exact failure mode the
 * orphan-route gate already has and that these tests exist to close.
 */
const VARIANT_MIN_WIDTH: Readonly<Record<string, number>> = {
  "": 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  "min-[1440px]": 1440,
};

const DISPLAY_UTILITIES = new Set([
  "hidden",
  "block",
  "flex",
  "grid",
  "inline-flex",
  "inline-block",
  "contents",
  "flow-root",
  "table",
  "list-item",
]);

/**
 * Whether `element` is displayed at `width`, from its own classes and every ancestor's.
 *
 * WHY THIS EXISTS. `tests/route-reachability.test.ts` reads `shell.tsx` as TEXT and regex-matches
 * `href…CARING_CONTACTS_ROUTES.<key>`. It has no notion of which array the match sits in, whether
 * that array is filtered, or what CSS governs the element rendering it -- so it proves a route is
 * REFERENCED IN SOURCE and passes whether or not any viewport can reach it. Templates was
 * unreachable below 768px for the whole of Phase 2B Task 15 with that gate green.
 *
 * This walks the REAL rendered ancestor chain and resolves the display utility that wins at the
 * given width, so an element moved into a `hidden md:flex` container fails here.
 */
function rendersAt(element: Element, width: number): boolean {
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    let winner: string | null = null;
    let winningWidth = -1;
    for (const token of node.classList) {
      const cut = token.lastIndexOf(":");
      const variant = cut === -1 ? "" : token.slice(0, cut);
      const utility = cut === -1 ? token : token.slice(cut + 1);
      if (!DISPLAY_UTILITIES.has(utility)) continue;
      const from = VARIANT_MIN_WIDTH[variant];
      if (from === undefined) {
        throw new Error(
          `rendersAt: unrecognised display variant "${token}" — teach this helper rather than let it guess`,
        );
      }
      // Tailwind emits min-width variants in ascending order, so the widest breakpoint that has
      // been reached is the one in force.
      if (from <= width && from >= winningWidth) {
        winningWidth = from;
        winner = utility;
      }
    }
    if (winner === "hidden") return false;
  }
  return true;
}

/** The full unavailable-control convention from docs/wiring-conventions.md. */
function expectStatesItsReason(control: Element) {
  expect(control.tagName, `${control.textContent} should be a button, not an anchor`).toBe("BUTTON");
  expect(control).toHaveAttribute("aria-disabled", "true");
  expect(control).toHaveAttribute("type", "button");
  expect(control).toHaveAttribute("title", expect.stringContaining("coming soon"));
  // Native `disabled` would remove the tab stop, so the stated reason could never
  // be reached by keyboard. The two attributes are never used together.
  expect(control).not.toHaveAttribute("disabled");
  const describedBy = control.getAttribute("aria-describedby");
  expect(describedBy, `${control.textContent} states no reason`).toBeTruthy();
  expect(document.getElementById(describedBy!)?.textContent ?? "").not.toBe("");
}

function renderShell() {
  // `serviceState` became required in Task 16 (Ruling 56), so this call site gains
  // an argument. A running service renders no banner, so every expectation below --
  // including the exact count of unavailable controls -- is unchanged.
  return render(
    <CaringContactsShell title="Today" serviceState={runningService(teamId("shell-test-team"))}>
      content
    </CaringContactsShell>,
  );
}

describe("caring-contacts workspace shell", () => {
  it("renders exactly one h1 and marks the workspace synthetic", () => {
    renderShell();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("caring-contacts-synthetic-marker")).toBeInTheDocument();
  });

  it("says in so many words that the data is invented", () => {
    renderShell();
    // Presence by test id is not enough. Without this, the wording could be
    // changed to anything at all — including something that no longer says the
    // data is invented — and every gate on this branch would still pass. This is
    // the safeguard that makes listing a workspace of invented patients in the
    // live tools catalogue defensible, so its text is pinned, exactly as the
    // prototype's copy is pinned by caring-contact-product-redesign.dom.test.tsx.
    expect(FICTIONAL_DATA_MARKER).toBe("Synthetic prototype — fictional data only");
    expect(screen.getByTestId("caring-contacts-synthetic-marker")).toHaveTextContent(
      "Synthetic prototype — fictional data only",
    );
  });

  it("keeps the frozen rail destination set, in order, with only the built screens navigable", () => {
    renderShell();
    expect(destinationsOf(screen.getByRole("navigation", { name: "Workspace" }))).toEqual([
      { label: "Today", kind: "link" },
      // Patients became a link in Phase 2B Task 5, in the same change as its page (Ruling 89).
      { label: "Patients", kind: "link" },
      { label: "Schedule", kind: "unavailable" },
      // Templates became a link in Phase 2B Task 15, in the same change as its page (Ruling 89).
      { label: "Templates", kind: "link" },
    ]);
  });

  it("keeps the frozen phone destination set, in order, with More reaching the in-page panel", () => {
    renderShell();
    expect(destinationsOf(screen.getByRole("navigation", { name: "Phone workspace" }))).toEqual([
      { label: "Today", kind: "link" },
      { label: "Patients", kind: "link" },
      { label: "Schedule", kind: "unavailable" },
      { label: "More", kind: "in-page" },
    ]);
  });

  it("navigates internally with Link, never a raw anchor to an internal route", () => {
    const { container } = renderShell();
    for (const anchor of container.querySelectorAll("a[href^='/']")) {
      expect(anchor.getAttribute("data-internal-link")).toBe("true");
    }
  });

  it("links only to routes that exist, so no destination can reach a 404", () => {
    const { container } = renderShell();
    const internalHrefs = [...container.querySelectorAll("a[href^='/']")].map((anchor) => anchor.getAttribute("href"));
    expect(internalHrefs.length).toBeGreaterThan(0);
    // These are the Caring Contacts routes with a page. Every other declared destination is an
    // unavailable control until Plan 2B builds its page.
    expect(new Set(internalHrefs)).toEqual(
      new Set([
        CARING_CONTACTS_ROUTES.today,
        CARING_CONTACTS_ROUTES.patients,
        CARING_CONTACTS_ROUTES.newPlan,
        CARING_CONTACTS_ROUTES.templates,
        CARING_CONTACTS_ROUTES.guidance,
        CARING_CONTACTS_ROUTES.reports,
      ]),
    );
  });

  it("keeps the More panel's destination set, in order, with only the built screens navigable", () => {
    renderShell();
    // Templates leads the panel and is a LINK: it is a primary destination the phone bar has no
    // room for, so the panel carries it below 768px where the rail does not exist. Guidance and
    // Reports became links in Phase 2B Task 19, in the same change as their pages (Ruling 89).
    expect(destinationsOf(screen.getByRole("region", { name: "More destinations" }))).toEqual([
      { label: "Templates", kind: "link" },
      { label: "Team", kind: "unavailable" },
      { label: "Guidance", kind: "link" },
      { label: "Reports", kind: "link" },
      ...["Service stop", "Access trail", "Workload", "Reconciliation", "Notifications", "Training", "Coverage"].map(
        (label) => ({ label, kind: "unavailable" }),
      ),
    ]);
  });

  it("makes the workspace's primary control a real link, now that the screen behind it exists", () => {
    // It was an unavailable control until Phase 2B Task 7 built `/caring-contacts/plans/new`.
    // Ruling 89 requires the two to move together in BOTH directions: a control lit up early points
    // at a page that says nothing useful, and a control left unavailable late claims a screen is
    // not built when it is.
    const { container } = renderShell();
    const primary = screen.getByTestId("caring-contacts-primary-control").closest("a");
    expect(primary, "the primary control is not a link").not.toBeNull();
    expect(primary!.textContent).toBe("New plan");
    expect(destinationKind(primary!)).toBe("link");
    expect(primary).toHaveAttribute("href", CARING_CONTACTS_ROUTES.newPlan);
    expect(primary).toHaveAttribute("data-internal-link", "true");
    // 1 unbuilt rail destination + 1 on the phone bar + 8 in the More panel. Templates left the
    // rail's unbuilt set in Phase 2B Task 15; Schedule is what remains there. Guidance and Reports
    // left the More panel's unbuilt set in Task 19, and the panel also carries Templates, which is
    // a link rather than an unavailable control and so is not counted here.
    expect([...container.querySelectorAll("button")].filter((c) => destinationKind(c) === "unavailable")).toHaveLength(
      10,
    );
  });

  it("states a reason on every destination that is not built yet", () => {
    const { container } = renderShell();
    const unavailable = [...container.querySelectorAll("button")].filter(
      (control) => destinationKind(control) === "unavailable",
    );
    // One unbuilt rail destination, one more on the phone bar, plus the More panel.
    // The floor stays at 5: it was written as a floor rather than a count, the exact count is
    // asserted above, and lowering a floor a change did not breach is loosening for its own sake.
    expect(unavailable.length).toBeGreaterThanOrEqual(5);
    for (const control of unavailable) expectStatesItsReason(control);
  });

  it("resolves what the rail and the phone dock are displayed at, which is what makes the next test real", () => {
    // THE POSITIVE CONTROL FOR `rendersAt`. Every reachability assertion below is of the form
    // "some link renders at this width"; if the helper answered `true` for everything, they would
    // all pass over a workspace no phone could navigate. The rail and the dock are the two
    // elements whose visibility is opposite by construction, so they pin both directions.
    renderShell();
    const rail = screen.getByTestId("caring-contacts-rail");
    const dock = screen.getByTestId("caring-contacts-phone-dock");

    expect(rendersAt(rail, 375), "the rail is not supposed to exist on a phone").toBe(false);
    expect(rendersAt(rail, 900), "the rail is supposed to exist at rail width").toBe(true);
    expect(rendersAt(dock, 375), "the phone dock is supposed to exist on a phone").toBe(true);
    expect(rendersAt(dock, 900), "the phone dock is not supposed to exist at rail width").toBe(false);
  });

  it("gives every built route a link that a phone can reach, and one that a rail-width viewport can", () => {
    // THE DEFECT THIS CLOSES. Templates shipped a production page, an `href` in the rail, and a
    // green orphan-route gate -- while being unreachable below 768px, because the rail is
    // `hidden … md:flex` and the phone bar filtered Templates out by name. The gate reads
    // `shell.tsx` as text and cannot see either fact. This walks the rendered DOM instead.
    const { container } = renderShell();
    const built = [
      CARING_CONTACTS_ROUTES.today,
      CARING_CONTACTS_ROUTES.patients,
      CARING_CONTACTS_ROUTES.newPlan,
      CARING_CONTACTS_ROUTES.templates,
      CARING_CONTACTS_ROUTES.guidance,
      CARING_CONTACTS_ROUTES.reports,
    ];

    for (const href of built) {
      const links = [...container.querySelectorAll(`a[href="${href}"]`)];
      expect(links.length, `${href} is not linked from the shell at all`).toBeGreaterThan(0);
      expect(
        links.some((link) => rendersAt(link, 375)),
        `${href} has no link a phone can reach — it is an orphan below 768px`,
      ).toBe(true);
      expect(
        links.some((link) => rendersAt(link, 900)),
        `${href} has no link a rail-width viewport can reach`,
      ).toBe(true);
    }
  });

  it("exposes the frozen width state so the media-class layout is observable", () => {
    const { container } = renderShell();
    expect(
      [...container.querySelectorAll("[data-workspace-width-state]")].map((node) =>
        node.getAttribute("data-workspace-width-state"),
      ),
    ).toEqual(["compact", "rail", "split", "wide"]);
  });
});
