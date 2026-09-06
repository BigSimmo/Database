// src/components/ward-management/community/community-figures.tsx
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";

/**
 * One figure tile's already-computed content — never a referral, never anything derived here.
 *
 * ⚠️ **DELIBERATELY PRESENTATIONAL, AND THAT IS A PRIVACY BOUNDARY, NOT A STYLE CHOICE.** The build
 * plan (`docs/superpowers/plans/2026-09-04-ward-flow-screens-community-and-ed.md`, "What MAY be
 * shared, and the trap inside it") rules that a component reachable from BOTH the coordinator's
 * overview and the community team's own hub sits OUTSIDE the FD-23 guarded set by construction —
 * "a module both roles reach is shared infrastructure by construction" — so a shared component may
 * carry only already-projected primitives (strings, numbers) and must name no member of the full
 * referral vocabulary. This type is exactly that floor: a label, a value, an optional unit and
 * sub-line, and a flag. There is no field here a `Referral` could be smuggled through.
 */
export type CommunityFigureSpec = {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly sub?: string;
  readonly flagged?: boolean;
};

/**
 * The community hub's figure strip.
 *
 * ⚠️ Deliberately NOT `CommunityFigures({ scope })`, the plan's first-drafted interface. Deriving
 * figures from a `scope` would require this component to read ward-flow state itself — which means
 * importing coordinator- or community-scoped referral data, exactly the vocabulary a component
 * reachable from both roles must never carry (see `CommunityFigureSpec`'s doc comment above). Each
 * caller derives its own numbers from whichever projection it is entitled to
 * (`community-home.tsx` from `CoordinatorScopedReferral`, `community-team-hub.tsx` from
 * `CommunityScopedReferral`, never the other's) and hands over plain values; this component only
 * lays them out and enforces `WardFigureStrip`'s own at-most-two-flagged rule.
 *
 * No figure value is hardcoded here — every value comes from the `figures` prop.
 */
export function CommunityFigures({ figures }: { figures: readonly CommunityFigureSpec[] }) {
  return (
    <WardFigureStrip>
      {figures.map((figure) => (
        <WardFigure
          key={figure.label}
          label={figure.label}
          value={figure.value}
          unit={figure.unit}
          sub={figure.sub}
          flagged={figure.flagged}
        />
      ))}
    </WardFigureStrip>
  );
}
