/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallStaleStrip } from "@/components/on-call/on-call-stale-strip";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { summariseOnCallFreshness } from "@/lib/on-call/freshness-summary";

/**
 * The strip is the only place the home admits that something has gone out of
 * date, so the two ways it could fail quietly are pinned here: appearing when
 * nothing is wrong, and saying "1 entries".
 */

afterEach(cleanup);

const NOW = new Date("2026-09-16T00:00:00.000Z");

let seq = 0;
function entry(section: OnCallSection, lastVerifiedAt: string | null): OnCallEntry {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${`${seq}`.padStart(12, "0")}`,
    slug: `entry-${seq}`,
    section,
    title: `Entry ${seq}`,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt,
  };
}

const stale = (section: OnCallSection) => entry(section, null);
const fresh = (section: OnCallSection) => entry(section, NOW.toISOString());

function strip(entries: readonly OnCallEntry[]) {
  return render(<OnCallStaleStrip summary={summariseOnCallFreshness(entries, NOW)} />);
}

describe("OnCallStaleStrip", () => {
  it("renders nothing when nothing is stale", () => {
    // A permanent "0 to check" row is furniture on the screen that is read at
    // 3am, and furniture is what makes a warning strip stop being read.
    const { container } = strip([fresh("contacts"), fresh("playbook")]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty knowledge base", () => {
    const { container } = strip([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("says '1 entry needs checking' for one", () => {
    strip([stale("contacts"), fresh("playbook")]);
    expect(screen.getByTestId("on-call-home-stale-count")).toHaveTextContent("1 entry needs checking");
  });

  it("says 'entries need checking' for more than one", () => {
    strip([stale("contacts"), stale("contacts"), stale("playbook"), stale("referrals"), stale("logistics")]);
    expect(screen.getByTestId("on-call-home-stale-count")).toHaveTextContent("5 entries need checking");
  });

  it("links each affected section to its own page, under its display title", () => {
    strip([stale("contacts"), stale("education")]);
    const contacts = screen.getByTestId("on-call-home-stale-section-contacts");
    expect(contacts).toHaveAttribute("href", "/on-call/contacts");
    expect(contacts).toHaveTextContent("Contacts");
    // `education` is "Teaching" everywhere a reader sees it.
    expect(screen.getByTestId("on-call-home-stale-section-education")).toHaveTextContent("Teaching");
    expect(screen.queryByTestId("on-call-home-stale-section-playbook")).toBeNull();
  });

  it("caps the section links and summarises the rest in words", () => {
    strip([
      stale("contacts"),
      stale("contacts"),
      stale("playbook"),
      stale("referrals"),
      stale("orientation"),
      stale("education"),
      stale("logistics"),
    ]);
    const links = screen.getAllByTestId(/^on-call-home-stale-section-/);
    expect(links).toHaveLength(3);
    expect(screen.getByTestId("on-call-home-stale-more")).toHaveTextContent("3 more sections");
  });

  it("uses the singular for a single remaining section", () => {
    strip([stale("contacts"), stale("contacts"), stale("playbook"), stale("referrals"), stale("logistics")]);
    expect(screen.getByTestId("on-call-home-stale-more")).toHaveTextContent("1 more section");
  });

  it("signals the state with an icon and words, never colour alone", () => {
    const { container } = strip([stale("contacts")]);
    const root = screen.getByTestId("on-call-home-stale");
    // Words first: the state is legible with every colour class deleted.
    expect(root).toHaveTextContent(/needs checking/i);
    // And a shape, marked decorative so it is not read out twice.
    const icons = container.querySelectorAll("svg[aria-hidden]");
    expect(icons.length).toBeGreaterThan(0);
  });

  it("gives every link the production 48px tap target, not min-h-11", () => {
    const { container } = strip([stale("contacts"), stale("playbook")]);
    for (const link of screen.getAllByTestId(/^on-call-home-stale-section-/)) {
      expect(link.className).toContain("min-h-tap");
    }
    expect(container.innerHTML).not.toContain("min-h-11");
  });

  it("names each section link with its own count, for a reader who cannot see the layout", () => {
    strip([stale("contacts"), stale("contacts")]);
    expect(screen.getByTestId("on-call-home-stale-section-contacts")).toHaveAttribute(
      "aria-label",
      "Contacts, 2 entries need checking",
    );
  });
});
