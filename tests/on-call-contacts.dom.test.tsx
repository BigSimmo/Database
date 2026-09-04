/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallContactsSection } from "@/components/on-call/on-call-contacts-section";
import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

afterEach(cleanup);

const NOW = new Date("2026-09-04T00:00:00.000Z");

function contact(overrides: Partial<OnCallEntry> & { id: string; slug: string; title: string }): OnCallEntry {
  return {
    section: "contacts",
    subtitle: null,
    body: null,
    details: { role: overrides.title },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: NOW.toISOString(),
    ...overrides,
  };
}

const FRESH_ED_REGISTRAR = contact({
  id: "11111111-1111-1111-1111-111111111111",
  slug: "ed-registrar",
  title: "ED registrar",
  tags: ["Emergency Department"],
  details: { role: "ED registrar", phone: "0412 345 678", availability: "24/7" },
  lastVerifiedAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
});

const FRESH_WARD_NURSE = contact({
  id: "22222222-2222-2222-2222-222222222222",
  slug: "ward-4b-nic",
  title: "Ward 4B nurse in charge",
  tags: ["Ward 4B"],
  details: { role: "Ward 4B nurse in charge", extension: "5678", pager: "555" },
  lastVerifiedAt: new Date("2026-05-01T00:00:00.000Z").toISOString(),
});

const STALE_OVERDUE_ANAESTHETIST = contact({
  id: "33333333-3333-3333-3333-333333333333",
  slug: "on-call-anaesthetist",
  title: "On-call anaesthetist",
  tags: ["Theatre"],
  details: { role: "On-call anaesthetist", phone: "0400 000 000" },
  lastVerifiedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
});

const STALE_NEVER_VERIFIED_SOCIAL_WORK = contact({
  id: "44444444-4444-4444-4444-444444444444",
  slug: "after-hours-social-work",
  title: "After-hours social work",
  tags: ["Ward 4B"],
  details: { role: "After-hours social work", afterHoursPhone: "0455 111 222" },
  lastVerifiedAt: null,
});

describe("OnCallEntryRow", () => {
  it("renders the whole row as a single tap target of at least 48px, tall enough to tap one-handed", () => {
    render(
      <OnCallEntryRow title="ED registrar" href="tel:0412345678" testId="row">
        <span>0412 345 678</span>
      </OnCallEntryRow>,
    );
    const row = screen.getByTestId("row");
    expect(row.tagName).toBe("A");
    // min-h-tap is the repo's 48px tap-target utility; 44px (min-h-11) is
    // explicitly banned because it reintroduces a known browser-test flake.
    expect(row.className).toMatch(/\bmin-h-tap\b/);
    expect(row.className).not.toMatch(/\bmin-h-11\b/);
  });

  it("uses a tel: href so ringing the number is one tap, with no separate button to hunt for", () => {
    render(
      <OnCallEntryRow title="ED registrar" href="tel:0412345678" testId="row">
        content
      </OnCallEntryRow>,
    );
    expect(screen.getByTestId("row")).toHaveAttribute("href", "tel:0412345678");
  });

  it("renders as a static, non-interactive row when neither href nor onClick is supplied", () => {
    render(
      <OnCallEntryRow title="No number on file" testId="row">
        content
      </OnCallEntryRow>,
    );
    const row = screen.getByTestId("row");
    expect(row.tagName).not.toBe("A");
    expect(row.tagName).not.toBe("BUTTON");
  });
});

describe("OnCallFreshnessBadge", () => {
  it("carries the word 'checked' plus a date for a fresh entry, not colour alone", () => {
    render(
      <OnCallFreshnessBadge
        freshness={onCallEntryFreshness({ lastVerifiedAt: FRESH_ED_REGISTRAR.lastVerifiedAt }, NOW)}
      />,
    );
    const badge = screen.getByTestId("on-call-freshness-badge");
    expect(badge).toHaveTextContent(/checked/i);
    expect(badge).toHaveTextContent(/\d{2}\/\d{2}\/\d{4}/);
    // The icon is a real glyph, not decoration alone standing in for the words.
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("states plainly that a never-verified entry has not been checked, without inventing a date", () => {
    render(<OnCallFreshnessBadge freshness={onCallEntryFreshness({ lastVerifiedAt: null }, NOW)} />);
    const badge = screen.getByTestId("on-call-freshness-badge");
    expect(badge).toHaveTextContent(/never checked/i);
    expect(badge).not.toHaveTextContent(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("uses a different icon for fresh vs stale, so the distinction survives with no colour perception at all", () => {
    const { container: freshContainer } = render(
      <OnCallFreshnessBadge
        freshness={onCallEntryFreshness({ lastVerifiedAt: FRESH_ED_REGISTRAR.lastVerifiedAt }, NOW)}
      />,
    );
    const freshIcon = freshContainer.querySelector("svg")?.getAttribute("class");
    cleanup();
    const { container: staleContainer } = render(
      <OnCallFreshnessBadge freshness={onCallEntryFreshness({ lastVerifiedAt: null }, NOW)} />,
    );
    const staleIcon = staleContainer.querySelector("svg")?.getAttribute("class");
    expect(freshIcon).not.toEqual(staleIcon);
  });
});

describe("OnCallOfflineBanner", () => {
  it("names the date the saved copy was taken", () => {
    render(<OnCallOfflineBanner savedAt="2026-08-20T00:00:00.000Z" />);
    expect(screen.getByTestId("on-call-offline-banner")).toHaveTextContent(/20\/08\/2026/);
  });

  it("is not itself a live region — the visible banner carries no aria-live or status/alert role", () => {
    render(<OnCallOfflineBanner savedAt="2026-08-20T00:00:00.000Z" />);
    const banner = screen.getByTestId("on-call-offline-banner");
    expect(banner).not.toHaveAttribute("aria-live");
    expect(banner).not.toHaveAttribute("role");
  });

  it("announces through a separate sr-only live region instead", () => {
    render(<OnCallOfflineBanner savedAt="2026-08-20T00:00:00.000Z" />);
    const announcement = screen.getByTestId("on-call-offline-banner-announcement");
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(announcement.className).toMatch(/\bsr-only\b/);
    expect(announcement).toHaveTextContent(/20\/08\/2026/);
  });
});

describe("OnCallContactsSection", () => {
  it("renders a tel: link for the phone number so ringing the ED registrar is one tap", () => {
    render(<OnCallContactsSection entries={[FRESH_ED_REGISTRAR]} now={NOW} />);
    const row = screen.getByTestId("on-call-contact-row-ed-registrar");
    expect(row).toHaveAttribute("href", "tel:0412345678");
  });

  it("groups rows by area (tags) under their own headings", () => {
    render(<OnCallContactsSection entries={[FRESH_ED_REGISTRAR, FRESH_WARD_NURSE]} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Emergency Department" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ward 4B" })).toBeInTheDocument();
    const edGroup = screen.getByTestId("on-call-contacts-group-emergency-department");
    expect(within(edGroup).getByTestId("on-call-contact-row-ed-registrar")).toBeInTheDocument();
    const wardGroup = screen.getByTestId("on-call-contacts-group-ward-4b");
    expect(within(wardGroup).getByTestId("on-call-contact-row-ward-4b-nic")).toBeInTheDocument();
  });

  it("collects stale entries into a 'needs checking' group at the TOP of the page, not the bottom", () => {
    render(
      <OnCallContactsSection
        entries={[FRESH_ED_REGISTRAR, STALE_OVERDUE_ANAESTHETIST, STALE_NEVER_VERIFIED_SOCIAL_WORK]}
        now={NOW}
      />,
    );
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings[0]).toBe("Needs checking");
    expect(headings.indexOf("Needs checking")).toBeLessThan(headings.indexOf("Emergency Department"));

    const staleGroup = screen.getByTestId("on-call-contacts-group-needs-checking");
    expect(within(staleGroup).getByTestId("on-call-contact-row-on-call-anaesthetist")).toBeInTheDocument();
    expect(within(staleGroup).getByTestId("on-call-contact-row-after-hours-social-work")).toBeInTheDocument();

    // A stale entry is not double-counted in its area group as well.
    expect(screen.queryByTestId("on-call-contacts-group-theatre")).toBeNull();
  });

  it("renders a real empty state, and no groups at all, when there are no contact entries", () => {
    render(<OnCallContactsSection entries={[]} now={NOW} />);
    expect(screen.getByTestId("on-call-contacts-empty")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
