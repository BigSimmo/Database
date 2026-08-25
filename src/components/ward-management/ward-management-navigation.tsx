"use client";

import Link from "next/link";
import {
  Activity,
  Ambulance,
  BedSingle,
  Building2,
  CircleAlert,
  ClipboardList,
  FileCheck2,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  ListFilter,
  MessageSquarePlus,
  Pill,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  Waypoints,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";

import shellStyles from "./ward-management.module.css";
import modeStyles from "./ward-management-modes.module.css";
import { WardDemoControls } from "./ward-demo-controls";
import { WardRoleSwitcher } from "./ward-role-switcher";
import { WARD_NAV, type WardNavItem } from "./ward-nav";

/** Icon per `WARD_NAV` item id — kept out of `ward-nav.ts` so that single source of truth stays
 *  plain data, checkable by `tests/ward-nav.test.ts` without a JSX/React dependency. */
const WARD_NAV_ICONS: Record<string, LucideIcon> = {
  ward: Building2,
  officer: Ambulance,
  ed: Siren,
  handover: ClipboardList,
  escalation: TriangleAlert,
  search: Search,
};

function WardNavLink({ item }: { item: WardNavItem }) {
  const Icon = WARD_NAV_ICONS[item.id];
  return (
    <RailLink href={item.href} label={item.label}>
      <Icon aria-hidden="true" />
    </RailLink>
  );
}

export type WardMode =
  "command" | "network" | "queue" | "capacity" | "movements" | "exceptions" | "transport" | "governance";

function RailLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={active ? shellStyles.railLinkActive : shellStyles.railLink}
    >
      {children}
    </Link>
  );
}

/**
 * Task 9 (controller Ruling 4): the owner's own instruction — "you are your own application
 * inside of it... you are able to use the side bar to place all of your headings" — moved the
 * eight Ward Flow mode links out of the horizontal `WardModeNavigation` strip that used to sit
 * below the header on every route, and into this rail. `ClinicalRail` is defined in this file
 * (not the global app shell), so it is Ward Flow's own to extend rather than a shared surface
 * this task would be overreaching to touch.
 *
 * Task 7 (D8) ruling: `WardModeNavigation` now always renders, whether or not the caller passes
 * `activeMode`. It used to render only when `activeMode` was set, which every one-off detail
 * screen and board that had no natural eight-mode equivalent — the role detail screens
 * (`ed/[edId]`, `ward/[unitId]`, the officer screen) and three boards (`handover`, `escalation`,
 * `search`) plus the patient workspace — simply never passed, so those routes silently lost the
 * in-page navigation other boards kept. Nine of fifteen routes behaving one way and six (later,
 * after this file's own Task 9 rewrite, seven) behaving another is a defect a user feels: the
 * rail alone never says which board they are on. `tests/ward-nav.test.ts`'s "Every Ward Flow
 * route carries the 'Ward Flow views' in-page nav (D8)" suite enforces this for every route,
 * rendered straight from the filesystem enumeration — never a hand-written list. `activeMode`
 * stays optional: routes with no natural eight-mode equivalent still render the nav with no link
 * marked current, rather than forcing an arbitrary "active" choice.
 */
export function ClinicalRail({ activeMode }: { activeMode?: WardMode } = {}) {
  return (
    <aside className={shellStyles.clinicalRail} aria-label="Clinical KB">
      <Link href="/" className={shellStyles.railBrand} aria-label="Clinical KB home">
        <BrandMark className={shellStyles.brandGlyph} />
      </Link>
      <div className={shellStyles.railRule} aria-hidden="true" />
      {/* Task 4 (D11): this nav's aria-label used to claim every entry was a clinical
          application — wrong once Ward Flow moved into its own developer-gated sandbox
          (constraint 4: "not a medical device"). This nav is Ward Flow's own copy of the
          cross-app switcher, not a claim that everything it lists — including the synthetic
          prototype itself — belongs to the clinical toolset. Only this file used the old label
          (checked before renaming), so this is the only place it needed to change. */}
      <nav className={shellStyles.railNav} aria-label="Applications">
        <RailLink href="/?mode=answer" label="Clinical Answers">
          <MessageSquarePlus aria-hidden="true" />
        </RailLink>
        <RailLink href="/mockups/ward-flow" label="Ward Flow" active>
          <Activity aria-hidden="true" />
        </RailLink>
        <RailLink href="/documents" label="Documents">
          <FileCheck2 aria-hidden="true" />
        </RailLink>
        <RailLink href="/services" label="Services">
          <SlidersHorizontal aria-hidden="true" />
        </RailLink>
        <RailLink href="/medications" label="Medication">
          <Pill aria-hidden="true" />
        </RailLink>
        <RailLink href="/tools" label="Tools">
          <Wrench aria-hidden="true" />
        </RailLink>
        <RailLink href="/tools" label="All applications">
          <LayoutGrid aria-hidden="true" />
        </RailLink>
      </nav>
      <div className={shellStyles.railRule} aria-hidden="true" />
      <WardModeNavigation active={activeMode} />
      <div className={shellStyles.railBottom}>
        {/* Task 12: the role switcher — the one control the proof journey (spec §14) uses to
            move between all four roles without ever reloading the page. Placed first among the
            Ward-Flow-specific shortcuts below since, unlike the three static ones after it, its
            destination is dynamic (inferred from whichever patient the coordinator last
            selected — see `ward-role-switcher.tsx`'s own doc comment). */}
        <WardRoleSwitcher />
        <div className={shellStyles.railRule} aria-hidden="true" />
        {/*
         * Task 4 (D9/D10): every link from here down through the "Patient search" equivalent used
         * to be an individually hand-pasted block — 329 lines of them, accreted one per task, with
         * nothing checking the rail and the real route tree against each other. That is *why* three
         * boards (`/handover`, `/escalation`, `/search`) could ship with no rail entry and stay
         * that way unnoticed (D8). They now render from `WARD_NAV`
         * (`ward-nav.ts`), the single source `tests/ward-nav.test.ts` checks both ways: every href
         * here resolves to a real route, and every static Ward Flow route appears either here or
         * in `WARD_NAV_INTENTIONALLY_UNLISTED` with a stated reason.
         *
         * The old per-link comments about `RailLink` vs a raw `<Link>` (to stay visible to
         * `tests/route-reachability.test.ts`'s literal-href AST scan) no longer apply: that test's
         * `staticPageRoutes` excludes every `/mockups/**` route outright (Ward Flow's sandbox move
         * — see that test's header comment), so nothing under `/mockups/ward-flow/**` needs a
         * literal string href for that scanner to find it any more. Re-run `route-reachability` on
         * any future change here to confirm that is still true rather than assuming it.
         *
         * "Ward Flow role screens" holds the one non-arbitrary role entry point (Officer); the
         * nested group holds the two that name one arbitrary synthetic instance rather than a
         * section of the app (D10) and says so in its own aria-label. Coordinator is deliberately
         * absent from both — see `WARD_NAV_INTENTIONALLY_UNLISTED`'s entry for `/mockups/ward-flow`.
         */}
        <div className={shellStyles.railGroup} role="group" aria-label="Ward Flow role screens">
          {WARD_NAV.filter((item) => item.group === "role" && !item.exampleOnly).map((item) => (
            <WardNavLink key={item.id} item={item} />
          ))}
          <div
            className={shellStyles.railGroup}
            role="group"
            aria-label="Example ward and emergency department — one arbitrary synthetic instance each, not a section of the app"
          >
            {WARD_NAV.filter((item) => item.group === "role" && item.exampleOnly).map((item) => (
              <WardNavLink key={item.id} item={item} />
            ))}
          </div>
        </div>
        <div className={shellStyles.railRule} aria-hidden="true" />
        <div className={shellStyles.railGroup} role="group" aria-label="Ward Flow specialist boards">
          {WARD_NAV.filter((item) => item.group === "board").map((item) => (
            <WardNavLink key={item.id} item={item} />
          ))}
        </div>
        <RailLink href="/?mode=answer" label="Favourites">
          <HeartPulse aria-hidden="true" />
        </RailLink>
        <RailLink href="/tools" label="Settings">
          <Settings aria-hidden="true" />
        </RailLink>
        <div className={shellStyles.railRule} aria-hidden="true" />
        {/* Whole-branch review I3: the demo jump-forward clock (spec §2 decision 5, §5) and
            scenario reset, mounted once here so every `/mockups/ward-flow/*` route gets them
            without per-screen wiring — the clock is shared provider state, not a per-screen
            concern. Placed last, after a rule and visually separated from every real navigation
            link above, and given its own warning-toned trigger (`ward-demo-controls.module.css`)
            rather than the rail's usual link styling — this is deliberately NOT another
            destination in the list, it never navigates anywhere, and it must never be mistaken
            for one. See `ward-demo-controls.tsx`'s own doc comment for the full reasoning. */}
        <WardDemoControls />
        <span className={shellStyles.avatar} aria-label="Guest workspace">
          G
        </span>
      </div>
    </aside>
  );
}

/**
 * The mode strip renders one literal `<Link href="...">` per view (never built from an array)
 * so `tests/route-reachability.test.ts` can find every href by static AST scan, and
 * `tests/ward-management.test.ts`'s `wardModeHrefs()` can read them back by scanning this
 * function's own source text — see that test's comment. Rendered icon-only inside `ClinicalRail`
 * now (Task 9 Ruling 4); each link still carries its own accessible name via `aria-label` since
 * its only visible content is an icon.
 *
 * `active` is optional (Task 7, D8): `ClinicalRail` now renders this nav unconditionally, and a
 * route with no natural eight-mode equivalent (a role detail screen, a board, the patient
 * workspace) passes no `activeMode` through — every `aria-current` comparison below is simply
 * false for all eight links in that case, which is correct: the nav still orients the user
 * without falsely claiming one of the eight views is the current page.
 */
export function WardModeNavigation({ active }: { active?: WardMode }) {
  return (
    <nav className={modeStyles.modeNavigation} aria-label="Ward Flow views">
      <Link
        href="/mockups/ward-flow"
        aria-label="Command"
        title="Command"
        aria-current={active === "command" ? "page" : undefined}
        className={active === "command" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <LayoutDashboard aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/network"
        aria-label="Network"
        title="Network"
        aria-current={active === "network" ? "page" : undefined}
        className={active === "network" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <Waypoints aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/queue"
        aria-label="Priority queue"
        title="Priority queue"
        aria-current={active === "queue" ? "page" : undefined}
        className={active === "queue" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <ListFilter aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/capacity"
        aria-label="Capacity"
        title="Capacity"
        aria-current={active === "capacity" ? "page" : undefined}
        className={active === "capacity" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <BedSingle aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/movements"
        aria-label="Movements"
        title="Movements"
        aria-current={active === "movements" ? "page" : undefined}
        className={active === "movements" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <Route aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/exceptions"
        aria-label="Exceptions"
        title="Exceptions"
        aria-current={active === "exceptions" ? "page" : undefined}
        className={active === "exceptions" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <CircleAlert aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/transport"
        aria-label="Transport"
        title="Transport"
        aria-current={active === "transport" ? "page" : undefined}
        className={active === "transport" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <Truck aria-hidden="true" />
      </Link>
      <Link
        href="/mockups/ward-flow/governance"
        aria-label="Governance"
        title="Governance"
        aria-current={active === "governance" ? "page" : undefined}
        className={active === "governance" ? shellStyles.railLinkActive : shellStyles.railLink}
      >
        <ShieldCheck aria-hidden="true" />
      </Link>
    </nav>
  );
}
