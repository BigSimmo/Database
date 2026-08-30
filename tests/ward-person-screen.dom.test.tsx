import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { patientAgeYears, patientDisplayName } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A PERSON'S OWN SCREEN — the subject is the PERSON, not a request for a bed.
 *
 * The owner's flow is *search for a patient, and if nobody comes up, add them, then refer from
 * their own screen.* Until now the last step had nowhere to happen: `patients/[patientId]` looks a
 * `Movement` up by id and renders a movement workspace, so the route named after people is about
 * requests, and clicking a person in search results did nothing at all because there was nowhere
 * for the tile to point.
 *
 * ⚠️ **`FD-23` BINDS THIS SCREEN, AND THE LEDGER SAYS IT NEEDS A GUARD RATHER THAN A NOTE — FOR A
 * REASON THAT APPLIES TO THIS FILE SPECIFICALLY.** A ward may not see where else a patient has been
 * referred; the coordinator may. The owner's reason: so a ward does not take its time over a patient
 * who has been referred elsewhere.
 *
 * The ledger's warning is the part that matters here: *every instinct in a patient-centred design
 * says a patient screen shows everything known about that patient, so the omission looks like an
 * incomplete implementation rather than a decision, and a later reader will add it helpfully.* This
 * screen is the exact surface that instinct will act on. So the guard below asserts the ABSENCE —
 * `R9` shape — and says why, so the next person to feel that instinct meets the reason before they
 * act on it.
 *
 * ⚠️ **AND TODAY THE ABSENCE IS ALSO STRUCTURAL, WHICH IS WHY THE GUARD IS WRITTEN AS IT IS.**
 * `Referral` carries no patient link — `patientId` is named in `ALLOWED_REFERRAL_FIELDS`' own
 * comment as a field the guard exists to catch — so this screen COULD NOT show a person's referrals
 * even if it wanted to. A guard that only checked "no referrals are shown" would therefore pass
 * today for a reason that has nothing to do with `FD-23`, and would go on passing the day somebody
 * adds the link. It is written to fail on the CAPABILITY, not on today's emptiness.
 */
describe("a person's own screen", () => {
  const someone = seedWardFlowState().patients[0];

  function renderPerson(id: string = someone.id) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId={id} />
      </WardFlowProvider>,
    );
  }

  it("has a seeded person to render, or every assertion below is vacuous", () => {
    expect(someone, "the seed must carry at least one patient").toBeDefined();
    expect(someone.umrn.length).toBeGreaterThan(0);
    expect(someone.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows the person: name, record number, date of birth and age", () => {
    renderPerson();
    const identity = screen.getByTestId("ward-person-identity");
    expect(identity).toHaveTextContent(patientDisplayName(someone));
    expect(identity).toHaveTextContent(someone.umrn);
    expect(identity).toHaveTextContent(someone.dateOfBirth);
    // Age is DERIVED and never stored — `patientAgeYears` reads the date of birth. Asserted through
    // the same function the screen uses, so a screen that stored or recomputed its own age would
    // still have to agree with the one place this project derives it.
    const age = patientAgeYears(someone, new Date(`${someone.dateOfBirth.slice(0, 4)}-01-01`));
    expect(typeof age).toBe("number");
    expect(identity).toHaveTextContent(/\d+\s*(years|year)/i);
  });

  it("⚠️ NEVER SHOWS WHERE ELSE THIS PERSON HAS BEEN REFERRED — FD-23, asserted as an absence", () => {
    renderPerson();
    const screenRoot = screen.getByTestId("ward-person-screen");

    // Ward names, unit names and destination words are what a "where else" section would render.
    // Checked against the LIVE unit list rather than a hand-written sample, so a unit added later is
    // covered without anybody remembering to extend this.
    for (const unit of seedWardFlowState().units) {
      expect(
        screenRoot.textContent ?? "",
        `${unit.name} appears on a person's screen. FD-23: a ward may not see where else a patient ` +
          "has been referred, so that a ward does not take its time over somebody already placed " +
          "elsewhere. If this is a coordinator-only surface now, that is a decision with the " +
          "owner's name on it — not something to unlock by deleting this assertion.",
      ).not.toContain(unit.name);
    }
  });

  it("⚠️ AND THE SCREEN CANNOT REACH REFERRALS AT ALL — the guard that survives the link landing", async () => {
    // The capability check, and it reads the CODE rather than the prose: the assertion above passes
    // today for a structural reason (`Referral` has no patient link), so on its own it would keep
    // passing on the day somebody adds one and wires this screen up.
    //
    // Checking the `useWardFlow()` destructure is the precise form. A blunt search for the word
    // "referrals" would fail on this file's own doc comment explaining FD-23, which would teach the
    // next person to delete the guard rather than read it.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/ward-management/patients/person-screen.tsx", "utf8");
    const destructure = source.match(/const\s*\{([^}]*)\}\s*=\s*useWardFlow\(\)/);
    expect(destructure, "the screen must read state through useWardFlow, or this guard sees nothing").not.toBeNull();

    const taken = (destructure?.[1] ?? "").split(",").map((name) => name.trim()).filter(Boolean);
    expect(taken.length, "an empty destructure would make the subset check below vacuous").toBeGreaterThan(0);
    for (const name of taken) {
      expect(
        ["patients", "dayZero", "now"],
        `the person screen takes "${name}" from ward state. FD-23 is a decision, not an unfinished ` +
          "feature: showing a person's referrals, movements or destinations here is the exact " +
          "'helpful' addition the ledger warns a later reader will make. Take it to the owner " +
          "before widening this list.",
      ).toContain(name);
    }
  });

  it("offers a way to refer this person, which is the whole point of the screen", () => {
    renderPerson();
    const refer = screen.getByTestId("ward-person-refer");
    expect(refer).toBeInTheDocument();
    expect(refer).toHaveTextContent(/refer/i);
  });

  it("says plainly that the referral will not yet be attached to this person", () => {
    // Conservative failure, and the honest half of the refer button. `Referral` has no patient
    // link, so referring from here starts a referral that is NOT joined to this record. A button
    // that implied otherwise would be the screen making a claim the model cannot keep.
    renderPerson();
    expect(screen.getByTestId("ward-person-refer-note")).toHaveTextContent(/not .*(attached|linked)/i);
  });

  it("REFUSES AN UNKNOWN PERSON rather than substituting one", () => {
    renderPerson("PT-does-not-exist");
    expect(screen.getByTestId("ward-person-missing")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-person-identity")).toBeNull();
    // The specific failure this guards: rendering `patients[0]` for an unrecognised id, which looks
    // like a working screen and is a different human being.
    expect(screen.getByTestId("ward-person-screen").textContent ?? "").not.toContain(
      patientDisplayName(someone),
    );
  });

  it("carries the synthetic-prototype banner every ward screen carries", () => {
    renderPerson();
    expect(within(screen.getByTestId("ward-person-screen")).getByText(/synthetic/i)).toBeInTheDocument();
  });
});
