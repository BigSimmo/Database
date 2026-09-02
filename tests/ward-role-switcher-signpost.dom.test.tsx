import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardRoleSwitcher } from "@/components/ward-management/ward-role-switcher";

/**
 * The route from a referral to the receiving ward existed and was unfindable — owner ruling
 * 2026-09-03, "resolve this".
 *
 * ⚠️ IT WAS NEVER AN ACCESSIBILITY GAP. The trigger already carried `aria-label` and `title`, both
 * reading "Switch role". That label is TRUE AND USELESS at the moment it matters: a coordinator who
 * has just referred a patient to a ward has no way to know that ward is behind this control,
 * because the label describes the CONTROL rather than what is currently in it.
 *
 * ⚠️ AND THE THIRD TEST IS NOT OPTIONAL. The trigger and the menu's empty state are separate
 * things and only one of them was touched. Without a test standing on the empty state, a later
 * change could make the trigger honest and quietly drop "No ward implied" — leaving a control that
 * says nothing when it has nothing, which is the shape this project has already been bitten by.
 */

const NOW_ANCHOR = Date.UTC(2026, 7, 26, 2, 0) / 60_000;

/** Focus a movement through the provider's own setter, never by reaching into state. */
function FocusHarness({ movementId }: { movementId: string | undefined }) {
  const { setFocusMovementId } = useWardFlow();
  useEffect(() => {
    setFocusMovementId(movementId);
  }, [movementId, setFocusMovementId]);
  return <WardRoleSwitcher />;
}

function renderSwitcher(movementId: string | undefined) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FocusHarness movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("ward role switcher — the route to the receiving ward is findable", () => {
  it("names the referred wards in the trigger's accessible name when a referred patient is focused", () => {
    // WF-002 carries exactly one live referral (`referredUnitIds: ["fsh-older-adult"]`) in the
    // committed fixture. Pinned by name rather than by `.find(m => m.referredUnitIds.length)`,
    // which would silently pass against a different movement if this one ever lost its referral.
    renderSwitcher("WF-002");

    const trigger = screen.getByRole("button", { name: /switch role/i });
    // ⚠️ The count must be in the ACCESSIBLE NAME, not only in a visual badge. The badge is
    // `aria-hidden` deliberately, so if this assertion is ever satisfied by the badge alone the
    // information has silently become sighted-only.
    expect(trigger, "the trigger must say WHAT is behind it, not only that it switches role").toHaveAccessibleName(
      /1 ward this patient was referred to/i,
    );
    expect(trigger).toHaveAttribute("title", expect.stringMatching(/1 ward this patient was referred to/i));

    // Singular, because there is one. A count that always says "wards" is a count nobody trusts.
    expect(trigger).not.toHaveAccessibleName(/1 wards/i);
  });

  it("says exactly 'Switch role' and shows no count when no patient is focused", () => {
    renderSwitcher(undefined);

    const trigger = screen.getByRole("button", { name: /switch role/i });
    // ⚠️ EXACT, not a substring. A regex would pass against "Switch role — 0 wards…", which is the
    // wrong answer said confidently: there is nothing behind the control, so it must claim nothing.
    expect(trigger).toHaveAccessibleName("Switch role");
    expect(screen.queryByTestId("ward-role-switcher-ward-count")).not.toBeInTheDocument();
  });

  it("still offers 'No ward implied' in the menu when nothing is selected", () => {
    renderSwitcher(undefined);

    fireEvent.click(screen.getByRole("button", { name: /switch role/i }));
    // ⚠️ The honest empty state, untouched by this change and asserted so it stays that way. A
    // control that offers nothing must SAY it offers nothing, rather than rendering an empty group
    // that reads as a control which failed to load.
    expect(screen.getByRole("menu", { name: /switch role/i })).toBeInTheDocument();
    expect(screen.getByText("No ward implied")).toBeInTheDocument();
  });
});
