import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  RATIFIED_SERVICE_ALIASES,
  ratifiedAliasesAwaitingOwnerReview,
} from "@/components/ward-management/community/community-ratified-aliases";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **A PAGE MAY NOT SAY A PERSON RULED SOMETHING NO PERSON RULED.**
 *
 * The community team page carries the only sentence in Ward Flow that attributes a clinical
 * judgement to a named human. Until 2026-09-06 every row in `RATIFIED_SERVICE_ALIASES` was the
 * owner's, so the block hard-coded *"A person has ruled…"* and *"after being shown each spelling
 * and the suburbs it routes"* — and both were true, so nothing guarded them.
 *
 * ⚠️ **THE FIRST AGENT-DECIDED ROW MADE BOTH SENTENCES FALSE WITHOUT TOUCHING THE COMPONENT.** Two
 * rows added to a data table, and a screen that had not changed a character began telling a
 * clinician that a person had signed a merge nobody had seen. **That is the shape this repository
 * keeps finding: both halves individually correct, the combination silently false.**
 *
 * What is guarded here is the SEPARATION, not the wording. Reword either sentence freely; what may
 * never happen is an agent-decided entry rendering the vocabulary of a signed human decision.
 */

afterEach(() => {
  cleanup();
});

/**
 * Words that assert a human decided. Deliberately short and specific: this is not a style rule, and
 * a guard that forbade every confident word would be reworded around or deleted.
 *
 * ⚠️ `"ruled"` and `"decided by"` are claims of authorship. `"judgement"` is NOT here — the block
 * legitimately says the merge is a judgement about a real clinic rather than a string observation,
 * which is true however it was reached.
 */
const HUMAN_AUTHORSHIP_CLAIMS = [/a person has ruled/iu, /\bdecided by\b/iu, /after being shown/iu] as const;

function pageIdFor(teamName: string): string | undefined {
  return COMMUNITY_TEAM_PAGES.find((team) => team.name === teamName)?.id;
}

function ruledTextFor(teamId: string): string {
  render(
    <WardFlowProvider>
      <CommunityScreen teamId={teamId} />
    </WardFlowProvider>,
  );
  return (screen.getByTestId("ward-community-ratified-alias").textContent ?? "").replace(/\s+/gu, " ");
}

describe("an agent-decided alias never renders as a person's signature", () => {
  /*
   * ⚠️ The floor is on the POPULATION WALKED, never on the number of agent rows. A floor on the
   * agent rows goes red the day the owner reviews them and they all become `person` — which is the
   * outcome this file wants, and a guard that punishes it is one somebody deletes.
   */
  it("walks both kinds, or the comparison below proves nothing", () => {
    const kinds = new Set(RATIFIED_SERVICE_ALIASES.map((entry) => entry.decidedByKind));
    expect(RATIFIED_SERVICE_ALIASES.length, "the alias table is empty").toBeGreaterThan(0);
    expect(
      kinds.size,
      "every entry has the same decidedByKind, so this file cannot tell the two renderings apart. " +
        "That is a legitimate state — say so and skip, rather than weakening the checks below.",
    ).toBeGreaterThan(0);
  });

  /**
   * 🔴 **THE HOLE MY OWN FIELD LEFT, FOUND BY MUTATING IT AND NOT BY READING IT.**
   *
   * Every other check here trusts `decidedByKind`. So flipping one agent row to `"person"` — one
   * word — made the page announce that a human had ruled on figures no human has seen, and all
   * seventeen tests stayed green. **The field I added to prevent a fabricated signature could
   * itself be used to fabricate one, silently.**
   *
   * Whether a person really decided is a fact about the world and no test can reach it. What IS
   * reachable is whether the entry's two provenance fields agree: `decidedByKind` and the
   * `decidedBy` NAME are written independently, so a one-word flip leaves them contradicting each
   * other and this fires. **Defeating it now takes rewriting the name too — which is no longer a
   * slip, it is signing a clinical decision in someone else's hand.** A guard cannot stop that; it
   * can make sure it is never an accident.
   *
   * ⚠️ Deliberately NOT a list of allowed human names — that would go red the day a second person
   * rules on something, which is the outcome this table wants.
   */
  it("never labels an entry a person's decision while naming an agent as its decider", () => {
    const AGENT_MARKERS = [/\bagent\b/iu, /ward (builder|lead|verifier)/iu, /\bclaude\b/iu, /\bautomation\b/iu];
    let checked = 0;
    for (const entry of RATIFIED_SERVICE_ALIASES) {
      const namesAnAgent = AGENT_MARKERS.some((marker) => marker.test(entry.decidedBy));
      checked += 1;
      if (entry.decidedByKind === "person") {
        expect(
          namesAnAgent,
          `"${entry.members[0]}" is recorded as decided by a PERSON, but its decider is named "${entry.decidedBy}", which identifies an agent. The screen will tell a clinician a human ` +
            `signed this. If a person really did decide it, put their name here; if not, the kind is wrong.`,
        ).toBe(false);
      } else {
        expect(
          namesAnAgent,
          `"${entry.members[0]}" is recorded as agent-decided but its decider — "${entry.decidedBy}" — ` +
            `does not identify one, so a reader cannot tell who to ask about it.`,
        ).toBe(true);
      }
    }
    expect(checked, "no entry was examined, so this ran over nothing").toBeGreaterThan(0);
  });

  it("says no person ruled, and no person was shown the figures, on every agent-decided page", () => {
    const awaiting = ratifiedAliasesAwaitingOwnerReview();
    if (awaiting.length === 0) return;

    let checked = 0;
    for (const entry of awaiting) {
      for (const member of entry.members) {
        const id = pageIdFor(member);
        if (id === undefined) continue;
        const text = ruledTextFor(id);
        checked += 1;
        for (const claim of HUMAN_AUTHORSHIP_CLAIMS) {
          expect(
            text,
            `${member}'s page claims a person decided (${String(claim)}), but this entry was decided by ` +
              `"${entry.decidedBy}" and no person has seen its figures`,
          ).not.toMatch(claim);
        }
        // And it must not merely omit the claim — it has to say what it actually is.
        expect(text, `${member}'s page does not say the entry is unreviewed`).toMatch(/review/iu);
        expect(text, `${member}'s page does not name who recorded it`).toContain(entry.decidedBy);
        cleanup();
      }
    }
    expect(checked, "no agent-decided member page was reached, so this ran over nothing").toBeGreaterThan(0);
  });

  /**
   * The other direction, and it is the half that stops the fix being "delete the person wording".
   * An owner-signed row must still read as one — otherwise the safest way to pass the check above
   * is to make every page sound provisional, which would throw away the owner's actual signature.
   */
  it("still says a person ruled, on every owner-signed page", () => {
    const signed = RATIFIED_SERVICE_ALIASES.filter((entry) => entry.decidedByKind === "person");
    if (signed.length === 0) return;

    let checked = 0;
    for (const entry of signed) {
      for (const member of entry.members) {
        const id = pageIdFor(member);
        if (id === undefined) continue;
        const text = ruledTextFor(id);
        checked += 1;
        expect(text, `${member}'s page no longer says a person ruled`).toMatch(/a person has ruled/iu);
        expect(text, `${member}'s page no longer names its decider`).toContain(entry.decidedBy);
        cleanup();
      }
    }
    expect(checked, "no owner-signed member page was reached, so this ran over nothing").toBeGreaterThan(0);
  });

  /**
   * ⚠️ **THE DISCRIMINATOR.** Both checks above could pass on a page that says nothing at all. This
   * one requires the two kinds to actually differ, so a component that collapsed back to one
   * sentence for both — the exact regression — fails here even if that sentence avoided every
   * forbidden phrase.
   */
  it("renders the two kinds differently, so the distinction survives a rewording", () => {
    const firstOf = (kind: "person" | "agent") => {
      for (const entry of RATIFIED_SERVICE_ALIASES.filter((e) => e.decidedByKind === kind)) {
        for (const member of entry.members) {
          const id = pageIdFor(member);
          if (id !== undefined) return { id, entry };
        }
      }
      return undefined;
    };

    const person = firstOf("person");
    const agent = firstOf("agent");
    if (person === undefined || agent === undefined) return;

    const personText = ruledTextFor(person.id);
    cleanup();
    const agentText = ruledTextFor(agent.id);

    expect(
      agentText,
      "an agent-decided page renders the same sentence as an owner-signed one — the provenance " +
        "distinction exists in the data and not on the screen, which is where a reader needs it",
    ).not.toBe(personText);
  });
});
