/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnCallPageMenu } from "@/components/on-call/on-call-page-menu";
import { universalHeaderTrailingSlotId } from "@/lib/mode-home-composer";
import { type OnCallEntry } from "@/lib/on-call/entry-model";
import { type OnCallNotification } from "@/lib/on-call/notifications";

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * The notification list lives inside the page menu's existing sheet, behind the
 * existing ellipsis, because `UniversalHeaderTrailingPortal` documents its
 * region as holding exactly one control. That decision is only safe while two
 * things stay true, and this file holds them:
 *
 * 1. The count reaches the reader — a badge for sighted readers, and the same
 *    number in the accessible name for everyone else.
 * 2. Nothing the sheet already carried was displaced. "Add an entry" is the
 *    only way to fill an empty hub, so a notification list that pushed it out
 *    would leave a reader with a list of problems and no way to act.
 */

function entry(overrides: Partial<OnCallEntry> & { id: string }): OnCallEntry {
  return {
    slug: overrides.id,
    section: "contacts",
    title: "Row",
    subtitle: null,
    body: null,
    details: {},
    tags: [],
    isPersonal: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  } as unknown as OnCallEntry;
}

/** A compliance requirement: stored under `logistics`, shown under Compliance. */
const COMPLIANCE_ENTRY = entry({
  id: "bls",
  title: "Basic life support",
  section: "logistics",
  details: { kind: "compliance", expiresOn: "2026-01-01" },
});

const NOTIFICATION: OnCallNotification = {
  id: "bls:compliance-date-passed",
  kind: "compliance-date-passed",
  title: "Basic life support",
  detail: "The date recorded for this was 2026-01-01, which has passed.",
  entry: COMPLIANCE_ENTRY,
};

function notification(index: number): OnCallNotification {
  return { ...NOTIFICATION, id: `n${index}`, title: `Entry ${index}` };
}

beforeEach(() => {
  // The menu's trigger is portalled into the universal header's trailing slot,
  // and that portal renders nothing at all when the host element is absent.
  const slot = document.createElement("div");
  slot.id = universalHeaderTrailingSlotId;
  document.body.append(slot);
});

afterEach(() => {
  cleanup();
  document.getElementById(universalHeaderTrailingSlotId)?.remove();
  vi.clearAllMocks();
});

describe("On Call page menu: notifications", () => {
  it("shows no badge and no panel on a page that passes none", () => {
    // The section pages render the same menu without notifications. They must
    // not grow an empty "Needs attention" heading for it.
    render(<OnCallPageMenu view="contacts" entryCount={3} />);

    expect(screen.queryByTestId("on-call-page-menu-notification-count")).toBeNull();
    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));
    expect(screen.queryByTestId("on-call-notifications-list")).toBeNull();
    expect(screen.queryByTestId("on-call-notifications-empty")).toBeNull();
  });

  it("says nothing is outstanding rather than hiding the section, when the list is empty", () => {
    render(<OnCallPageMenu view="home" notifications={[]} onAdd={vi.fn()} />);

    // No badge: an empty list is not something to interrupt anyone about.
    expect(screen.queryByTestId("on-call-page-menu-notification-count")).toBeNull();

    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));
    expect(screen.getByTestId("on-call-notifications-empty")).toBeTruthy();
  });

  it("carries the count in the badge and in the accessible name", () => {
    render(<OnCallPageMenu view="home" notifications={[NOTIFICATION]} />);

    expect(screen.getByTestId("on-call-page-menu-notification-count").textContent).toBe("1");
    // Singular: "1 items need attention" would be the first thing a screen
    // reader user hears about this hub.
    expect(screen.getByTestId("on-call-page-menu-trigger").getAttribute("aria-label")).toBe(
      "Open On Call actions. 1 item needs attention.",
    );
  });

  it("caps the badge at 9+ but keeps the true count in the accessible name", () => {
    const many = Array.from({ length: 12 }, (_, index) => notification(index));
    render(<OnCallPageMenu view="home" notifications={many} />);

    expect(screen.getByTestId("on-call-page-menu-notification-count").textContent).toBe("9+");
    expect(screen.getByTestId("on-call-page-menu-trigger").getAttribute("aria-label")).toContain("12 items need");
  });

  it("lists each notification, pointing a compliance item at the Compliance view", () => {
    render(<OnCallPageMenu view="home" notifications={[NOTIFICATION]} />);
    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));

    const row = screen.getByTestId("on-call-notification-compliance-date-passed");
    expect(row.textContent).toContain("Basic life support");
    // Compliance is a VIEW over the logistics section, so a notification about
    // a requirement must not land on the Logistics list it is filed under.
    expect(row.getAttribute("href")).toMatch(/^\/on-call\/compliance#on-call-entry-/);
  });

  it("sends a plain section entry to its own section", () => {
    const contact = entry({ id: "switch", title: "Switchboard" });
    render(
      <OnCallPageMenu view="home" notifications={[{ ...NOTIFICATION, kind: "never-verified", entry: contact }]} />,
    );
    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));

    expect(screen.getByTestId("on-call-notification-never-verified").getAttribute("href")).toMatch(
      /^\/on-call\/contacts#on-call-entry-/,
    );
  });

  it("sends an UNCONFIRMED compliance requirement to Compliance, not to the Admin page it is filed under", () => {
    // The regression this file exists for (Codex, 2026-09-22). The first
    // version keyed the destination on the notification's KIND: compliance
    // items to the Compliance view, everything else to the stored section. A
    // requirement whose recorded date is still ahead but which nobody has
    // confirmed in a year is raised as `never-verified`, so it fell through to
    // `logistics` and linked to Admin — a page that filters compliance rows
    // out. The reader would have landed somewhere not showing the row they
    // were just told about.
    const unconfirmed = entry({
      id: "mand",
      title: "Mandatory training",
      section: "logistics",
      details: { kind: "compliance", expiresOn: "2099-01-01" },
    });
    render(
      <OnCallPageMenu view="home" notifications={[{ ...NOTIFICATION, kind: "never-verified", entry: unconfirmed }]} />,
    );
    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));

    expect(screen.getByTestId("on-call-notification-never-verified").getAttribute("href")).toMatch(
      /^\/on-call\/compliance#on-call-entry-/,
    );
  });

  it("keeps Add an entry in the same sheet", () => {
    // The reason this is a panel and not a replacement for the ellipsis. On an
    // empty hub, the add row is the only way to put anything in.
    render(<OnCallPageMenu view="home" notifications={[NOTIFICATION]} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));

    expect(screen.getByTestId("on-call-page-menu-add")).toBeTruthy();
    expect(screen.getByTestId("on-call-page-menu-card")).toBeTruthy();
  });

  it("closes the sheet when a notification is tapped", () => {
    // Otherwise the sheet stays open over the page it just navigated to, and
    // the reader has to dismiss a menu to see what they asked for.
    render(<OnCallPageMenu view="home" notifications={[NOTIFICATION]} />);
    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));
    expect(screen.getByTestId("on-call-page-menu-sheet")).toBeTruthy();

    fireEvent.click(screen.getByTestId("on-call-notification-compliance-date-passed"));
    expect(screen.queryByTestId("on-call-page-menu-sheet")).toBeNull();
  });
});
