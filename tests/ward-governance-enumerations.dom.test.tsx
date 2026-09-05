import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `ReferralIntakeForm` reads the URL through `next/navigation`'s `useSearchParams`, which returns
// null without an App Router context — the same mock `ward-ed-psychiatry-hub.dom.test.tsx` uses for
// the same component.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * GOVERNANCE PARAGRAPHS THAT ENUMERATE WHAT A SCREEN DOES MUST NAME EVERYTHING IT DOES.
 *
 * ⚠️ THE CLASS. Three screens told a clinician what they record or show, the code later gained a
 * category, and the sentence was never touched:
 *
 *   patient-search    named people and open movements; also renders QUEUED REFERRALS, first
 *   referral-intake   named five facts and the request; the payload also writes `patientId`
 *   officer-screen    said "every transport job not yet arrived"; the filter also drops CLOSED ones
 *
 * ⚠️ AND THE DIRECTION IS THE OPPOSITE OF THE USUAL FAILURE HERE. The defect this project keeps
 * finding is a change propagated into the comments that stops before the rendered page. These are
 * changes that reached the CODE and never touched the sentence at all. Same missing step, other
 * way round — which is why neither a comment audit nor a code audit alone would have found them.
 *
 * ⚠️ EACH REPAIR GETS TWO INDEPENDENT ASSERTIONS: one that the BEHAVIOUR is what we think, and one
 * that the SENTENCE says so. A wording pin alone is worthless — it goes green the moment somebody
 * rephrases and red the moment somebody improves. Paired with a driven behaviour assertion, a
 * mutation to either half turns exactly one of them red, and the pair tells you which half moved.
 */

afterEach(cleanup);

function renderIn(node: ReactNode) {
  render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

describe("the officer screen's sentence and its filter agree", () => {
  /** A job that has not arrived, on a movement that has closed — the only shape that discriminates. */
  const withTransport = wardMovements.find((movement) => movement.transport !== undefined);
  /**
   * A REAL closure, lifted from the fixture rather than written here. A hand-built one would encode
   * my belief about `MovementClosure`'s shape, and a test that carries its own idea of a type is a
   * mirror — it keeps passing after the type moves underneath it.
   */
  const realClosure = wardMovements.find((movement) => movement.closure !== undefined)?.closure;

  it("has a seeded movement carrying a transport job, and a real closure to borrow", () => {
    expect(withTransport, "no seeded movement has transport, so nothing below discriminates").toBeDefined();
    expect(realClosure, "no seeded movement is closed, so the closed half cannot be built honestly").toBeDefined();
  });

  it("BEHAVIOUR: drops a not-yet-arrived job once its movement closes", () => {
    const source = withTransport as Movement;
    const open: Movement = {
      ...source,
      closure: undefined,
      transport: { ...source.transport!, arrivedAt: undefined },
    };
    const closed: Movement = { ...open, closure: realClosure };

    expect(isOfficerJob(open), "an open movement with an unarrived job is exactly what this screen is for").toBe(true);
    expect(
      isOfficerJob(closed),
      "the same unarrived job on a closed movement is excluded — which is correct, and is the thing " +
        "the sentence has to admit to",
    ).toBe(false);
  });

  it("SENTENCE: says the list is scoped to open movements", () => {
    renderIn(<OfficerScreen />);
    const banner = screen.getByTestId("ward-officer-governance").textContent ?? "";
    expect(
      banner,
      'the word "every" is bold in this paragraph, so the scope it is every-of must be stated or the ' +
        "emphasis makes the claim wider than the filter",
    ).toContain("open movement");
  });
});

describe("the patient search names every list it renders", () => {
  it("BEHAVIOUR: renders a referral list as well as people and movements", () => {
    renderIn(<PatientSearchPage />);
    // The three result surfaces the page can show. Referrals are rendered FIRST by deliberate
    // decision (the component's own comment: "a referral is somebody still waiting for a decision").
    expect(screen.getByTestId("ward-patient-search-people")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-referrals"), "the omitted category").toBeInTheDocument();
  });

  it("SENTENCE: enumerates referrals alongside people and movements", () => {
    renderIn(<PatientSearchPage />);
    const banner = screen.getByTestId("ward-patient-search-governance").textContent?.toLowerCase() ?? "";
    expect(banner).toContain("people");
    expect(banner).toContain("movements");
    expect(
      banner,
      "referrals are the first list on the page and the most urgent — somebody still waiting for a " +
        "decision. A clinician told the box finds people and movements may go elsewhere to look for them",
    ).toContain("referral");
  });
});

describe("the referral intake names the patient pointer it writes", () => {
  it("SENTENCE: says a pointer to the person's record is recorded, and keeps all three denials", () => {
    renderIn(<ReferralIntakeForm />);
    const banner = screen.getByTestId("ward-referral-intake-governance").textContent?.toLowerCase() ?? "";

    expect(
      banner,
      "`RECEIVE_REFERRAL` carries `patientId` (ward-flow-events.ts), and this form writes it. A " +
        "privacy assurance that omits the one field linking a referral to a person is the wrong " +
        "assurance, however true its other clauses are",
    ).toContain("pointer");

    /*
     * ⚠️ "never free text" LEFT THIS LIST ON 2026-09-05, AND ITS REMOVAL IS THE POINT.
     *
     * The owner asked for a written patient history, so the form gained free-text history fields
     * (three of them, at the time this comment was written) and the banner can no longer deny free
     * text. **This assertion had become a guard demanding that the screen keep telling a clinician
     * something untrue** — the rare case where deleting an assertion is the honest repair rather
     * than the suspicious one.
     *
     * The three textareas were themselves collapsed to ONE optional `history` field by the same
     * day's later owner ruling (2026-09-05) — see `ward-model.ts`'s own doc comment on `Referral`.
     * That later change does not revive the deleted "never free text" denial: the form still writes
     * free text into the model, one field's worth instead of three, so the assertions below (which
     * check the DISTINCTION rather than a box count) still hold.
     *
     * 🔴 AND IT DID NOT CATCH THE LIE. The banner still said "never free text" for the whole build,
     * with this test green throughout, because "contains the denial" is satisfied just as well by
     * a denial that has become false. The paragraph was fixed after somebody opened the page.
     * A presence check over a promise cannot tell a true promise from a broken one.
     *
     * So the replacement below does not check for a phrase; it checks the DISTINCTION the sentence
     * now has to draw, in both directions — that free text is admitted AND scoped to the history,
     * so the banner cannot go back to a flat denial and cannot quietly widen either.
     */
    // ⚠️ THE LITERAL "never a name" IS GONE TOO, AND FOR A DIFFERENT REASON FROM "never free text".
    // That claim is still TRUE of the structured questions and is still made — as "the structured
    // questions cannot hold a name", asserted below. What was dropped is a pin on the WORDING,
    // which is the weakest thing a guard over a sentence can hold: it goes green on any rephrasing
    // and red on an honest one. The scoped version is checked instead.
    expect(banner).toContain("mental health act");
    expect(
      banner,
      "the form has one free-text history box (three until the owner's 2026-09-05 ruling " +
        "collapsed them); a banner that does not admit free text is telling a clinician the " +
        "opposite of what the software does",
    ).toContain("free text");
    expect(
      banner,
      "admitting free text is not enough — the sentence has to say WHICH half is enforced, or a " +
        "reader carries the old structural guarantee across to a field that cannot give it",
    ).toMatch(/structured questions cannot hold a name/u);
    expect(banner, "and it must not go back to denying free text outright while also admitting it").not.toContain(
      "never free text",
    );
  });
});
