/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallPlaybookSection } from "@/components/on-call/on-call-playbook-section";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

afterEach(cleanup);

const NOW = new Date("2026-09-04T00:00:00.000Z");

function playbook(overrides: Partial<OnCallEntry> & { id: string; slug: string; title: string }): OnCallEntry {
  return {
    section: "playbook",
    subtitle: null,
    body: null,
    details: { trigger: "Trigger", escalationSteps: [] },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: NOW.toISOString(),
    ...overrides,
  } as OnCallEntry;
}

const REFERRAL = playbook({
  id: "cccccccc-0000-0000-0000-000000000001",
  slug: "referral-for-examination",
  title: "Referral for examination",
  body: "Complete a Form 1A, then a Form 4A if transport is needed.",
});

const NO_FORM = playbook({
  id: "cccccccc-0000-0000-0000-000000000002",
  slug: "scenario-with-no-form",
  title: "Scenario with no form",
  body: "Ring the registrar on 9224 1234.",
});

describe("Playbook — forms referenced", () => {
  it("lists each referenced form by code and official title, linked to its page", () => {
    render(<OnCallPlaybookSection entries={[REFERRAL]} now={NOW} />);

    const block = screen.getByTestId(`on-call-playbook-forms-${REFERRAL.slug}`);
    expect(within(block).getByText("Forms referenced")).toBeInTheDocument();

    const first = within(block).getByTestId(`on-call-playbook-form-${REFERRAL.slug}-1a`);
    expect(first).toHaveAttribute("href", "/forms/form-1a");
    expect(first).toHaveTextContent("Form 1A");
    expect(first).toHaveTextContent("Referral for examination by a psychiatrist");

    const second = within(block).getByTestId(`on-call-playbook-form-${REFERRAL.slug}-4a`);
    // The legacy slug this form's page is actually served at.
    expect(second).toHaveAttribute("href", "/forms/transport-crisis-form");
    expect(second).toHaveTextContent("Transport order");
  });

  it("names the register, so the titles are not read as the owner's own words", () => {
    render(<OnCallPlaybookSection entries={[REFERRAL]} now={NOW} />);
    const block = screen.getByTestId(`on-call-playbook-forms-${REFERRAL.slug}`);
    expect(block.textContent).toContain("Mental Health Act 2014");
    expect(block.textContent?.toLowerCase()).toContain("register");
  });

  it("gives every form link a 48px tap target and never the flake-prone min-h-11", () => {
    render(<OnCallPlaybookSection entries={[REFERRAL]} now={NOW} />);
    const block = screen.getByTestId(`on-call-playbook-forms-${REFERRAL.slug}`);
    const links = within(block).getAllByRole("link");
    expect(links.length).toBe(2);
    for (const link of links) {
      expect(link.className).toContain("min-h-tap");
      expect(link.className).not.toContain("min-h-11");
    }
  });

  it("renders nothing at all when the scenario references no form", () => {
    render(<OnCallPlaybookSection entries={[NO_FORM]} now={NOW} />);
    expect(screen.queryByTestId(`on-call-playbook-forms-${NO_FORM.slug}`)).toBeNull();
    expect(screen.queryByText("Forms referenced")).toBeNull();
  });

  it("leaves the no-local-guideline state exactly where it was", () => {
    render(<OnCallPlaybookSection entries={[REFERRAL]} now={NOW} />);
    const card = screen.getByTestId(`on-call-playbook-card-${REFERRAL.slug}`);
    expect(within(card).getByTestId(`on-call-playbook-no-guideline-${REFERRAL.slug}`)).toBeInTheDocument();
    expect(within(card).getByText("No local guideline linked")).toBeInTheDocument();
  });
});
