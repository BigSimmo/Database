/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnCallComplianceSection } from "@/components/on-call/on-call-compliance-section";
import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";
import { universalHeaderTrailingSlotId } from "@/lib/mode-home-composer";
import {
  COMPLIANCE_KIND,
  complianceConsequence,
  complianceExpiresOn,
  partitionLogisticsEntries,
} from "@/lib/on-call/compliance";
import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";
import {
  ON_CALL_COMPLIANCE_CONSEQUENCES,
  onCallDetailsSchemaFor,
  onCallEntryFreshness,
  type OnCallEntry,
} from "@/lib/on-call/entry-model";
import { onCallTeachingDateParts } from "@/lib/on-call/teaching-schedule";

/**
 * The Compliance page's own behaviours, as rendered.
 *
 * `tests/on-call-compliance.test.ts` owns the data layer — the partition, the
 * order, the date semantics and the no-verdict vocabulary scan. This file owns
 * the five decisions that only exist on screen, each of which was added in
 * response to a review finding and none of which any other test could see:
 *
 *  1. No bulk "mark all as still correct" here, although every other view
 *     offers one.
 *  2. The page-level privacy sentence, and the per-row pills it replaces —
 *     which come back the moment the page holds a row it is not true of.
 *  3. An unranked row explaining its own position rather than looking demoted.
 *  4. A row whose details cannot be read saying so, WITHOUT withholding the
 *     recorded date or the qualifier that makes the date sayable.
 *  5. The unranked prompt suppressed where the unreadable line already asks
 *     the reader to do the same thing.
 *
 * A separate file from `tests/on-call-sections.dom.test.tsx` for one concrete
 * reason: case 1 renders `OnCallSectionPage`, which needs the store, the
 * account provider, the router and the linked-documents hook mocked at module
 * scope. That file renders list components with no mocks at all, and hoisted
 * `vi.mock` calls apply to the whole file — so adding them there would change
 * the module graph under five sections' worth of passing tests to cover one.
 *
 * NOTHING HERE NAMES A SLUG, A CATEGORY OR A BAND FROM THE DEMO CORPUS.
 * Which rows are requirements comes from `partitionLogisticsEntries`, which are
 * ranked from `complianceConsequence`, and which bands exist from
 * `ON_CALL_COMPLIANCE_CONSEQUENCES`. A test that restated the corpus would go
 * on passing on the day the corpus and the page are wrong together.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/compliance",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated: true, isSaved: () => false, setFavourite: vi.fn(async () => true) }),
}));

vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({ AccountSetupDialog: () => null }));
vi.mock("@/lib/on-call/linked-documents", () => ({ useOnCallLinkedDocuments: () => ({}) }));

const storeState = vi.hoisted(() => ({
  entries: [] as OnCallEntry[],
  loading: false,
  isOffline: false,
  signedOut: false,
  cachedAt: null as string | null,
}));

vi.mock("@/lib/on-call/entry-store", () => ({
  useOnCallEntries: () => storeState,
  cacheOnCallEntries: vi.fn(),
}));

/** Injected everywhere, so nothing here depends on the day the suite runs. */
const NOW = new Date("2026-09-04T00:00:00.000Z");

/** Never verified, which is stale on any clock — see `onCallEntryFreshness`. */
const NEVER_VERIFIED = null;

/** `00000000-0000-4000-8000-00000000000N`, so ids read as ids in a failure. */
function id(suffix: string): string {
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

function logisticsEntry(
  overrides: Partial<OnCallEntry> & { id: string; slug: string; title: string; details: unknown },
): OnCallEntry {
  return {
    section: "logistics",
    subtitle: null,
    body: null,
    linkedDocumentIds: [],
    tags: [],
    // Private, because every compliance row the app writes is — see the
    // Compliance block of `demo-entries.ts`. The mixed-page case below unsets
    // it deliberately.
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: NEVER_VERIFIED,
    ...overrides,
  };
}

/**
 * A `logistics` row carrying the compliance discriminator.
 *
 * `category` is NOT seeded here, although the schema requires it: three
 * fixtures below are the row whose details the page cannot read, and they are
 * that row precisely because the required key is absent.
 */
function requirement(
  entryId: string,
  slug: string,
  title: string,
  details: Record<string, unknown>,
  overrides: Partial<OnCallEntry> = {},
): OnCallEntry {
  return logisticsEntry({
    id: entryId,
    slug,
    title,
    ...overrides,
    details: { kind: COMPLIANCE_KIND, ...details },
  });
}

/** The worst band, read from the enum whose order is the page's sort key. */
const WORST_BAND = ON_CALL_COMPLIANCE_CONSEQUENCES[0];

/** The requirements the shipped corpus actually puts on the page. */
const DEMO_REQUIREMENTS = partitionLogisticsEntries(DEMO_ON_CALL_ENTRIES).compliance;

function isStale(entry: OnCallEntry): boolean {
  return onCallEntryFreshness(entry).state === "stale";
}

// ---------------------------------------------------------------------------
// 1. No bulk "mark all as still correct" on Compliance
// ---------------------------------------------------------------------------

/**
 * One overdue row on each half of the shared `logistics` section.
 *
 * Both are never-verified rather than merely old, so "overdue" is true on any
 * clock and the Admin control this case relies on cannot quietly stop being
 * offered as the fixture dates age.
 */
const OVERDUE_ADMIN = logisticsEntry({
  id: id("a1"),
  slug: "overdue-admin-entry",
  title: "Overdue admin entry",
  details: { category: "Parking" },
  isPersonal: false,
});

const OVERDUE_REQUIREMENT = requirement(id("a2"), "overdue-requirement", "Overdue requirement", {
  category: "Registration",
  consequence: WORST_BAND,
  expiresOn: "2027-03-12",
  provenance: "typed",
});

const ONE_STORED_SECTION = [OVERDUE_ADMIN, OVERDUE_REQUIREMENT];

beforeEach(() => {
  // The page menu portals into the universal header's trailing slot and renders
  // nothing at all when that host is absent, so a standalone render cannot open
  // it until the slot exists.
  const slot = document.createElement("div");
  slot.id = universalHeaderTrailingSlotId;
  document.body.append(slot);
});

afterEach(() => {
  cleanup();
  document.getElementById(universalHeaderTrailingSlotId)?.remove();
  Object.assign(storeState, { entries: [], loading: false, isOffline: false, signedOut: false, cachedAt: null });
});

describe("Compliance offers no bulk freshness stamp", () => {
  // Withheld by `offersBulkVerify` in `on-call-section-page.tsx`, and that is a
  // clinical-governance decision rather than a layout one. Everywhere else the
  // stamp and the content are the same question — "is this ward number still
  // right?" is answerable from where the reader is sitting. On Compliance they
  // come apart: one tap, with no confirmation, would clear the "Never checked"
  // warning off every regulatory record on the page for twelve months without
  // the reader having read any of them, and nothing on the page has been
  // checked with the body that issues it.

  it("has an overdue row on both halves of the stored section, so neither case below is vacuous", () => {
    const { admin, compliance } = partitionLogisticsEntries(ONE_STORED_SECTION);
    expect(admin.filter(isStale).map((entry) => entry.slug)).toHaveLength(1);
    expect(compliance.filter(isStale).map((entry) => entry.slug)).toHaveLength(1);
  });

  it("offers the bulk stamp on Admin, which shares Compliance's stored section", () => {
    // The positive control, and the reason it is the FIRST case here: an
    // assertion that a control is missing passes just as well when the menu
    // never rendered.
    storeState.entries = [...ONE_STORED_SECTION];
    render(<OnCallSectionPage view="logistics" />);

    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));
    expect(screen.getByTestId("on-call-page-menu-verify-all")).toBeInTheDocument();
  });

  it("withholds the bulk stamp on Compliance, from a menu that otherwise rendered in full", () => {
    storeState.entries = [...ONE_STORED_SECTION];
    render(<OnCallSectionPage view="compliance" />);

    fireEvent.click(screen.getByTestId("on-call-page-menu-trigger"));

    // The menu really is open: its other rows are all here.
    expect(screen.getByTestId("on-call-page-menu-add")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-page-menu-card")).toBeInTheDocument();
    expect(screen.getByTestId("on-call-page-menu-privacy")).toBeInTheDocument();

    expect(screen.queryByTestId("on-call-page-menu-verify-all")).toBeNull();
  });

  it("keeps the per-row stamp, which is the same act with its own subject in front of the reader", () => {
    // Withholding the bulk control is only defensible because this one stays.
    storeState.entries = [...ONE_STORED_SECTION];
    render(<OnCallSectionPage view="compliance" />);

    const row = screen.getByTestId(`on-call-compliance-row-${OVERDUE_REQUIREMENT.slug}`);
    expect(within(row).getByTestId(`on-call-verify-${OVERDUE_REQUIREMENT.slug}`)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. One privacy sentence for the page, or a pill per row — never both, never
//    neither
// ---------------------------------------------------------------------------

/**
 * The page-level privacy claim, matched on its substance.
 *
 * WHY THE SENTENCE EXISTS, so nobody deletes it as duplication of the pills it
 * replaced: a named doctor's registration, indemnity, credentialing and
 * clearances are an identity record, not the ward numbers the shared read was
 * opened up for. Every compliance row is therefore written private, and eight
 * identical "Private" pills say one fact eight times. The sentence says it
 * once — but only where it is true of every row, because a blanket claim over
 * a page holding one shared row is false in the most dangerous direction.
 *
 * Matched as "does the note talk about privacy at all", plus the two things
 * being private actually means, rather than word for word. The first sentence
 * of the note contains none of these, so the polarity is unambiguous.
 */
const NOTE_CLAIMS_PRIVACY = /\bprivate\b/i;
const CLAIM_IS_ABOUT_THE_PAGE = /\b(this page|every requirement)\b/i;
const WITHHELD_FROM_OTHER_READERS = /other people read/i;
const WITHHELD_FROM_THE_CARD = /printed card/i;

describe("the privacy claim is made once for the page, or once per row", () => {
  it("states it for the page, and hangs no pills, when every row really is private", () => {
    expect(DEMO_REQUIREMENTS.length, "the corpus has no requirements to render").toBeGreaterThan(1);
    expect(
      DEMO_REQUIREMENTS.every((entry) => entry.isPersonal),
      "the corpus stopped writing requirements private, so this case no longer tests the all-private page",
    ).toBe(true);

    render(<OnCallComplianceSection entries={DEMO_REQUIREMENTS} now={NOW} />);

    const note = screen.getByTestId("on-call-compliance-scope-note");
    expect(note).toHaveTextContent(NOTE_CLAIMS_PRIVACY);
    expect(note).toHaveTextContent(CLAIM_IS_ABOUT_THE_PAGE);
    expect(note).toHaveTextContent(WITHHELD_FROM_OTHER_READERS);
    expect(note).toHaveTextContent(WITHHELD_FROM_THE_CARD);

    expect(screen.queryAllByTestId("on-call-private-flag")).toHaveLength(0);
  });

  it("drops the page-level claim and brings the pills back the moment one row is shared", () => {
    // One row unshared is enough. The sentence is a statement about the whole
    // page, so it is false here — and false about the one thing this page must
    // never get wrong.
    const [firstRow, ...rest] = DEMO_REQUIREMENTS;
    expect(firstRow, "the corpus has no requirement to share").toBeDefined();
    const mixed = [{ ...firstRow!, isPersonal: false }, ...rest];
    const stillPrivate = mixed.filter((entry) => entry.isPersonal);
    expect(stillPrivate.length, "every row ended up shared, so this is not a mixed page").toBeGreaterThan(0);

    render(<OnCallComplianceSection entries={mixed} now={NOW} />);

    const note = screen.getByTestId("on-call-compliance-scope-note");
    expect(note).not.toHaveTextContent(NOTE_CLAIMS_PRIVACY);
    // The rest of the note is untouched — only the second sentence is at issue.
    expect(note).toHaveTextContent(/nothing here is checked/i);

    expect(screen.getAllByTestId("on-call-private-flag")).toHaveLength(stillPrivate.length);
    const sharedRow = screen.getByTestId(`on-call-compliance-row-${mixed[0]!.slug}`);
    expect(within(sharedRow).queryByTestId("on-call-private-flag")).toBeNull();
    for (const entry of stillPrivate) {
      const row = screen.getByTestId(`on-call-compliance-row-${entry.slug}`);
      expect(
        within(row).queryByTestId("on-call-private-flag"),
        `${entry.title} is private and carries no pill on a mixed page`,
      ).not.toBeNull();
    }
  });

  it("claims nothing either way on an empty page, where there are no rows to claim it of", () => {
    render(<OnCallComplianceSection entries={[]} now={NOW} />);

    const note = screen.getByTestId("on-call-compliance-scope-note");
    // The note is still there — a reader who has just arrived is exactly the
    // one who has not yet been told what this page does not know.
    expect(note).toHaveTextContent(/nothing here is checked/i);
    expect(note).not.toHaveTextContent(NOTE_CLAIMS_PRIVACY);
    expect(screen.queryAllByTestId("on-call-private-flag")).toHaveLength(0);
    expect(screen.getByTestId("on-call-compliance-empty")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. An unranked row explains its own position
// ---------------------------------------------------------------------------

/**
 * Vocabulary the prompt may not fall into.
 *
 * "Not recorded" is a legitimate answer — `consequence` is optional in the
 * editor and always has been — so the line asks the reader a question about
 * the REQUIREMENT and explains where the row sits. It is not a validation
 * error, and it is never a statement that the holder is behind on anything:
 * this page may not say that about a person.
 */
const READS_AS_A_VALIDATION_ERROR = /\b(error|invalid|required|must|fix|incomplete|problem|wrong|overdue)\b/i;

describe("a row nobody has ranked says why it is last", () => {
  const unranked = DEMO_REQUIREMENTS.filter((entry) => complianceConsequence(entry) === undefined);
  const ranked = DEMO_REQUIREMENTS.filter((entry) => complianceConsequence(entry) !== undefined);

  it("has both kinds of row in the corpus to tell apart", () => {
    expect(unranked.length, "no requirement lands in the unranked band, so this block proves nothing").toBeGreaterThan(
      0,
    );
    expect(ranked.length, "every requirement is unranked, so the negative case proves nothing").toBeGreaterThan(0);
  });

  it("explains the position on the row whose consequence nobody recorded", () => {
    // The hazard the line closes: the corpus's unranked row is a national
    // police clearance, which in WA can genuinely stop somebody working, and
    // the sort puts it below three training modules whose own band says
    // somebody will email. The band's prose is honest; its POSITION is a
    // ranking, and without this line the reader cannot see that the ranking is
    // an absence rather than a judgement.
    render(<OnCallComplianceSection entries={DEMO_REQUIREMENTS} now={NOW} />);

    for (const entry of unranked) {
      const row = screen.getByTestId(`on-call-compliance-row-${entry.slug}`);
      const prompt = within(row).getByTestId(`on-call-compliance-unranked-${entry.slug}`);
      // A question about the requirement, and an explanation of the position.
      expect(prompt).toHaveTextContent(/what happens if/i);
      expect(prompt).toHaveTextContent(/lapse/i);
      expect(prompt).toHaveTextContent(/last/i);
      expect(prompt.textContent ?? "").not.toMatch(READS_AS_A_VALIDATION_ERROR);
    }
  });

  it("says nothing of the kind on a row that carries a recorded consequence", () => {
    render(<OnCallComplianceSection entries={DEMO_REQUIREMENTS} now={NOW} />);

    for (const entry of ranked) {
      const row = screen.getByTestId(`on-call-compliance-row-${entry.slug}`);
      expect(
        within(row).queryByTestId(`on-call-compliance-unranked-${entry.slug}`),
        `${entry.title} has a recorded consequence and is being asked for one`,
      ).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 4 and 5. A row whose details cannot be read
// ---------------------------------------------------------------------------

/**
 * Three rows that differ in one field each, so every assertion below is a
 * comparison rather than a string copied out of the component.
 *
 * `logisticsDetails` is `.strict()` with `category` required, so dropping that
 * one key invalidates the whole object — which is the measured failure the
 * unreadable line exists for: the issuing body, the lead-time pill and the
 * evidence link all vanished at once while the category pill printed an
 * invented "General", and nothing on the row said anything was wrong.
 *
 * Neither fixture carries a body or an issuing body, so the only untagged
 * paragraph on each rendered row is the date line — which is what `dateLine`
 * below relies on.
 */
const EXPIRES_ON = "2027-03-12";
const PROVENANCE = "typed";
const READABLE_CATEGORY = "Registration";

const READABLE = requirement(id("b1"), "readable-requirement", "Requirement the page can read", {
  category: READABLE_CATEGORY,
  consequence: WORST_BAND,
  expiresOn: EXPIRES_ON,
  provenance: PROVENANCE,
});

/** The same row with no provenance, used to prove the qualifier is rendered. */
const READABLE_UNQUALIFIED = requirement(
  id("b2"),
  "readable-unqualified-requirement",
  "Requirement recorded on nobody's word",
  { category: READABLE_CATEGORY, consequence: WORST_BAND, expiresOn: EXPIRES_ON },
);

/** The same row again, with the required `category` gone. */
const UNREADABLE = requirement(id("b3"), "unreadable-requirement", "Requirement with one unreadable field", {
  consequence: WORST_BAND,
  expiresOn: EXPIRES_ON,
  provenance: PROVENANCE,
});

/** Unreadable AND unranked: no category, and no consequence either. */
const UNREADABLE_AND_UNRANKED = requirement(
  id("b4"),
  "unreadable-and-unranked-requirement",
  "Requirement with neither a consequence nor a readable field",
  { expiresOn: EXPIRES_ON, provenance: PROVENANCE },
);

/** Readable, but with no consequence — the positive control for case 5. */
const READABLE_AND_UNRANKED = requirement(
  id("b5"),
  "readable-and-unranked-requirement",
  "Requirement with no consequence recorded",
  { category: READABLE_CATEGORY, expiresOn: EXPIRES_ON, provenance: PROVENANCE },
);

/**
 * The line carrying the recorded date and its provenance qualifier.
 *
 * Found structurally rather than by its wording: the unreadable notice and the
 * unranked prompt both carry test ids, and no fixture here sets a body or an
 * issuing body, so exactly one untagged paragraph is left. The count is
 * asserted so a change to the row's shape fails here loudly instead of
 * silently reading the wrong element.
 */
function dateLine(row: HTMLElement): string {
  const untagged = Array.from(row.querySelectorAll("p")).filter((node) => !node.hasAttribute("data-testid"));
  expect(untagged, "the row no longer has exactly one untagged paragraph").toHaveLength(1);
  return (untagged[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function complianceRow(entry: OnCallEntry): HTMLElement {
  return screen.getByTestId(`on-call-compliance-row-${entry.slug}`);
}

/**
 * How many metadata pills a row wears.
 *
 * Counted rather than named, so the case below needs no list of the words a
 * page might invent. Every pill on this row — category, lead time, privacy,
 * freshness — is a `rounded-full` span from the shared metadata recipe.
 */
function pillCount(row: HTMLElement): number {
  return row.querySelectorAll("span.rounded-full").length;
}

describe("a row whose details cannot be read", () => {
  it("is malformed in exactly the way the page is meant to survive", () => {
    // Fail closed. If the schema ever accepted this object the row would be
    // ordinary, and every case below would pass by testing nothing.
    const schema = onCallDetailsSchemaFor("logistics");
    expect(schema.safeParse(READABLE.details).success).toBe(true);
    expect(schema.safeParse(UNREADABLE.details).success).toBe(false);
    expect(schema.safeParse(UNREADABLE_AND_UNRANKED.details).success).toBe(false);

    // The two fields the page reads per field, and so can still print.
    expect(complianceExpiresOn(UNREADABLE)).toBe(EXPIRES_ON);
    expect(complianceConsequence(UNREADABLE)).toBe(WORST_BAND);
    expect(complianceConsequence(UNREADABLE_AND_UNRANKED)).toBeUndefined();

    // Still a requirement, so the page really does have to render it.
    expect(partitionLogisticsEntries([UNREADABLE]).compliance).toHaveLength(1);
  });

  it("says so on the row, and says nothing of the kind on the row beside it", () => {
    render(<OnCallComplianceSection entries={[READABLE, UNREADABLE]} now={NOW} />);

    const notice = within(complianceRow(UNREADABLE)).getByTestId(`on-call-compliance-unreadable-${UNREADABLE.slug}`);
    expect(notice).toHaveTextContent(/could not be read/i);
    // It names the repair, which is the only thing the reader can do about it.
    expect(notice).toHaveTextContent(/open it/i);

    expect(within(complianceRow(READABLE)).queryByTestId(`on-call-compliance-unreadable-${READABLE.slug}`)).toBeNull();
  });

  it("still prints the recorded date and the qualifier that makes it sayable", () => {
    // THE POINT OF THIS CASE. Withholding a recorded registration expiry
    // because an unrelated key is malformed would make the reader late, not
    // safer — and this mode already calls that its own worst failure ("a
    // manual withheld because of a missing field"). The date and the
    // provenance each validate themselves, so neither depends on the other
    // eleven keys parsing.
    //
    // Nothing below retypes what the page prints. The row that CAN be read
    // supplies the expected line, and a third row identical but for its
    // provenance proves that the qualifier is a real part of it.
    render(<OnCallComplianceSection entries={[READABLE, READABLE_UNQUALIFIED, UNREADABLE]} now={NOW} />);

    const readable = dateLine(complianceRow(READABLE));
    const unqualified = dateLine(complianceRow(READABLE_UNQUALIFIED));
    const unreadable = dateLine(complianceRow(UNREADABLE));

    // The qualifier is rendered at all: the same row without a provenance
    // prints a strictly shorter line.
    expect(readable.startsWith(unqualified)).toBe(true);
    expect(readable).not.toBe(unqualified);

    // And the malformed row prints the whole thing — date and qualifier.
    expect(unreadable).toBe(readable);

    // The date itself, formatted by the same helper the page formats with.
    const { day, month, year } = onCallTeachingDateParts(EXPIRES_ON);
    expect(unreadable).toContain(`${day} ${month} ${year}`);
  });

  it("invents no category for a filing it could not read", () => {
    // The pill used to fall back to "General" here, which is a filing the app
    // had not read, indistinguishable on the row from one the owner typed.
    //
    // Matched element by element, NOT against the row's `textContent`. That
    // string runs adjacent pills together — "…as you entered itGeneralNever
    // checked" — so a word-boundary search of it silently finds nothing and
    // the case passes with the invented pill on screen. Measured: this exact
    // test passed against a restored "General" fallback until it was rewritten
    // this way.
    render(<OnCallComplianceSection entries={[READABLE, UNREADABLE]} now={NOW} />);

    const readable = complianceRow(READABLE);
    const unreadable = complianceRow(UNREADABLE);

    // The readable row proves a category pill is rendered at all …
    expect(within(readable).getByText(READABLE_CATEGORY)).toBeInTheDocument();
    // … and the malformed row carries neither the category it does not have
    // nor the one the page used to make up for it.
    expect(within(unreadable).queryByText(READABLE_CATEGORY)).toBeNull();
    expect(within(unreadable).queryByText(/^general$/i)).toBeNull();

    // And no substitute pill under any other wording: the two rows differ by
    // exactly the one pill the readable row's category earns it.
    expect(pillCount(unreadable)).toBe(pillCount(readable) - 1);
  });

  it("does not also ask an unreadable row for its consequence", () => {
    // Two prompts to do one thing is how a row starts nagging: the unreadable
    // line already asks the reader to open the entry, which is where the
    // consequence would be recorded anyway.
    render(<OnCallComplianceSection entries={[READABLE_AND_UNRANKED, UNREADABLE_AND_UNRANKED]} now={NOW} />);

    // The positive control, in the same render: a readable row with no
    // consequence still gets the prompt.
    expect(
      within(complianceRow(READABLE_AND_UNRANKED)).getByTestId(
        `on-call-compliance-unranked-${READABLE_AND_UNRANKED.slug}`,
      ),
    ).toBeInTheDocument();

    const both = complianceRow(UNREADABLE_AND_UNRANKED);
    expect(
      within(both).getByTestId(`on-call-compliance-unreadable-${UNREADABLE_AND_UNRANKED.slug}`),
    ).toBeInTheDocument();
    expect(within(both).queryByTestId(`on-call-compliance-unranked-${UNREADABLE_AND_UNRANKED.slug}`)).toBeNull();
  });
});
