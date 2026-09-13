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

/**
 * OWNER RULING 19 — "RECENTLY ANSWERED" HOLDS TEN.
 *
 * The section was uncapped, so "recently" decayed with use: on a busy department it would grow
 * without limit and the word in its own heading would stop being true. A clinician scanning it for
 * a mistake they made ten minutes ago would be reading a register, not a recent list.
 *
 * ⚠️ **THE PROVIDER IS MOCKED, AND IT HAS TO BE.** The whole seed contains exactly TWO
 * `psychiatric_review` emergency-department destinations — one at `rph-ed`, one at `fsh-ed`
 * (`ward-movements.ts:1479` and `:1629`). No seeded state and no reachable sequence of dispatches
 * puts eleven answered referrals in front of one department, so a fixture-driven test could never
 * reach the boundary this ruling is about and would pass forever without exercising it. This
 * follows `tests/ward-capacity-freshness-source.dom.test.tsx`, which mocks `useWardFlow` for the
 * same reason and says so in the same words.
 *
 * ⚠️ **AND THE ROWS ARE CLONED FROM A SEEDED REFERRAL, NOT INVENTED.** Hand-writing a `Referral`
 * means hand-choosing an `ageBand`, `homeRegion`, `suburb`, `source` and `urgency`, and a test that
 * invents those is a test that keeps compiling after the model tightens around them. Cloning
 * inherits every required field, so this file cannot drift from `ward-model.ts`.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return { ...actual, useWardFlow: () => mockContext };
});

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const ED_ID = "rph-ed";

/** More than the cap, and deliberately not a round number above it — a fixture of exactly eleven
 *  would prove the eleventh is dropped without proving the twelfth is, and a cap implemented as
 *  "drop the last one" would pass it. */
const ANSWERED_IN_FIXTURE = 13;
/** Ruling 19, pinned as a hand-written literal on purpose. Asserting against an imported constant
 *  would let this test move with the code: raise the cap to fifty and every assertion below still
 *  passes. The owner said ten, so ten is written here in full. */
const RULING_19_CAP = 10;

const seeded = seedWardFlowState();
const template = seeded.referrals[0]!;

/**
 * Thirteen answered referrals, newest first by `decidedAt`. `RF-CAP-00` is the most recent and
 * `RF-CAP-12` the oldest, so the ten that survive a correct cap are 00..09 and the three that must
 * NOT render are 10, 11 and 12 — named that way so a failure message says which end was kept.
 */
const answeredReferrals = Array.from({ length: ANSWERED_IN_FIXTURE }, (_, index) => ({
  ...template,
  id: `RF-CAP-${String(index).padStart(2, "0")}`,
  destinations: [
    {
      destination: { kind: "emergency_department" as const, edId: ED_ID, purpose: "psychiatric_review" as const },
      state: "declined" as const,
      decidedAt: NOW_ANCHOR - index,
      decidedBy: "Dr Synthetic",
      declineReason: "no_capacity" as const,
    },
  ],
}));

const mockContext = {
  ...seeded,
  referrals: answeredReferrals,
  now: NOW_ANCHOR,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

describe("recently answered holds ten — owner ruling 19", () => {
  it("has more answered referrals than the cap, or every assertion below is vacuous", () => {
    expect(ANSWERED_IN_FIXTURE).toBeGreaterThan(RULING_19_CAP);
    expect(answeredReferrals).toHaveLength(ANSWERED_IN_FIXTURE);
  });

  it("renders exactly ten rows, so the eleventh does not appear", () => {
    render(<EdScreen edId={ED_ID} />);
    const section = screen.getByTestId("ward-ed-answered");
    const rows = within(section).getAllByTestId(/^ward-ed-answered-row-/);
    expect(
      rows,
      "the section is titled 'Recently answered' and ruling 19 caps it at ten. Uncapped, 'recently' " +
        "decays with use: on a busy department this grows without limit and the word in its own " +
        "heading stops being true.",
    ).toHaveLength(RULING_19_CAP);
  });

  it("keeps the ten MOST RECENT, not the first ten it happened to find", () => {
    render(<EdScreen edId={ED_ID} />);
    const section = screen.getByTestId("ward-ed-answered");

    // The ten newest must be present...
    for (let index = 0; index < RULING_19_CAP; index += 1) {
      const id = `RF-CAP-${String(index).padStart(2, "0")}`;
      expect(
        within(section).queryByTestId(`ward-ed-answered-row-${id}`),
        `${id} is among the ten most recently decided and must be shown`,
      ).toBeInTheDocument();
    }

    // ...and the three oldest must not be. Asserted as an ABSENCE and by name: a cap that sliced
    // from the wrong end would still render exactly ten rows and pass the test above.
    for (let index = RULING_19_CAP; index < ANSWERED_IN_FIXTURE; index += 1) {
      const id = `RF-CAP-${String(index).padStart(2, "0")}`;
      expect(
        within(section).queryByTestId(`ward-ed-answered-row-${id}`),
        `${id} is older than the ten most recent, so the cap must have dropped it. Seeing it here ` +
          "means the list was cut from the wrong end — ten rows, the wrong ten.",
      ).not.toBeInTheDocument();
    }
  });

  it("still tells the clinician how many exist, not merely how many are shown", () => {
    render(<EdScreen edId={ED_ID} />);
    const heading = within(screen.getByTestId("ward-ed-answered")).getByRole("heading");

    // ⚠️ THE FAILURE THIS CATCHES IS THE QUIET ONE. The heading rendered `answered.length`. Capping
    // the array silently converts that from "how many have been answered" into "how many are
    // shown", and the two agree on every fixture smaller than the cap — so nothing would ever look
    // wrong until a real department passed ten, at which point the screen would state a false
    // total with complete confidence. The true count must survive the cap.
    expect(
      heading,
      "the heading must still name the true number answered; a capped list that also caps its own " +
        "count tells a clinician thirteen answered referrals are ten",
    ).toHaveTextContent(String(ANSWERED_IN_FIXTURE));
  });
});
