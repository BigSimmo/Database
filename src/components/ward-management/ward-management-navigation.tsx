"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutGrid, Menu, PanelLeftOpen } from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { Sheet } from "@/components/ui/sheet";

import shellStyles from "./ward-management.module.css";
import sidebarStyles from "./ward-sidebar.module.css";
import { WardDemoControls } from "./ward-demo-controls";
import { WardRoleSwitcher } from "./ward-role-switcher";
import { WardSidebarContent } from "./ward-sidebar-content";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "./ward-nav-icons";
import { WARD_DEVELOPER_HUB_HREF, WARD_NAV, WARD_VIEWS, type WardMode, type WardNavItem } from "./ward-nav";
import { useWardSidebarCollapsed } from "./use-ward-sidebar-collapsed";

export type { WardMode } from "./ward-nav";

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

function WardNavLink({ item }: { item: WardNavItem }) {
  const Icon = WARD_NAV_ICONS[item.id];
  return (
    <RailLink href={item.href} label={item.label}>
      <Icon aria-hidden="true" />
    </RailLink>
  );
}

/**
 * Ward Flow's sidebar, in the three shapes the rest of this repository already uses (see
 * `src/components/clinical-dashboard/ClinicalSidebar.tsx`):
 *
 * - **Phone (below 40rem):** no rail at all. A fixed header bar carries the brand and a menu
 *   button that opens a left drawer holding the full labelled navigation, which closes on
 *   navigate. Before this, the 4.5rem desktop icon column rendered unchanged on a 390px phone —
 *   18% of the viewport — because `ward-management.module.css` contained no width media query
 *   that touched the rail at all. The bar is the sidebar's own, not a host's: nine of the ten
 *   Ward Flow shells are a bare rail-plus-main grid with no header row for a trigger to live in.
 * - **Tablet (40rem to 64rem):** the icon rail, with a plain brand link and no expand control,
 *   because the expanded panel does not exist at this width — exactly how `ClinicalCollapsedRail`
 *   behaves between md and lg.
 * - **Desktop (64rem and up):** the icon rail or a 17rem labelled panel, chosen by the user and
 *   remembered per browser by `useWardSidebarCollapsed`. Hovering the brand mark reveals the
 *   expand control, as it does in the clinical sidebar.
 *
 * Every destination in all three shapes is read from `ward-nav.ts`. The eight views used to be
 * eight hand-written link blocks in `WardModeNavigation` below; a labelled panel cannot read
 * those, and copying them would have re-created the two-lists-drifting defect (D8/D9) that file
 * exists to prevent.
 *
 * All ten host screens still mount exactly one `<ClinicalRail />` and are unchanged apart from
 * their grid track, which is now `auto` so this component's own width decides the column.
 */
export function ClinicalRail({ activeMode }: { activeMode?: WardMode } = {}) {
  const [collapsed, setCollapsed] = useWardSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className={sidebarStyles.phoneBar}>
        <Link href="/mockups/ward-flow" className={sidebarStyles.phoneBrand}>
          <BrandMark className={sidebarStyles.brandGlyph} />
          <span className={sidebarStyles.phoneBrandName}>Ward Flow</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={sidebarStyles.menuButton}
          aria-label="Open Ward Flow menu"
          aria-expanded={menuOpen}
        >
          <Menu aria-hidden="true" />
        </button>
      </div>

      <WardIconRail activeMode={activeMode} hiddenOnDesktop={!collapsed} onExpand={() => setCollapsed(false)} />

      {!collapsed ? (
        <aside className={sidebarStyles.panel} aria-label="Ward Flow sidebar">
          <div className={sidebarStyles.panelScroll}>
            <WardSidebarContent activeMode={activeMode} onCollapse={() => setCollapsed(true)} />
          </div>
        </aside>
      ) : null}

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Ward Flow"
        description="Synthetic patient-flow prototype."
        closeLabel="Close Ward Flow menu"
        placement="left"
        contentClassName={sidebarStyles.drawerHidden}
        headerLeading={<BrandMark className={sidebarStyles.brandGlyph} />}
      >
        <div className={sidebarStyles.drawerBody}>
          <WardSidebarContent activeMode={activeMode} showBrandRow={false} onNavigate={() => setMenuOpen(false)} />
        </div>
      </Sheet>
    </>
  );
}

/**
 * The icon rail. Hidden below 40rem (the phone bar and drawer take over) and, when the user has
 * expanded the panel, from 64rem up.
 */
function WardIconRail({
  activeMode,
  hiddenOnDesktop,
  onExpand,
}: {
  activeMode?: WardMode;
  hiddenOnDesktop: boolean;
  onExpand: () => void;
}) {
  return (
    <aside
      className={`${shellStyles.clinicalRail}${hiddenOnDesktop ? ` ${shellStyles.railHiddenOnDesktop}` : ""}`}
      aria-label="Ward Flow"
    >
      {/* The brand mark. Below 64rem it is a plain link to Ward Flow's own home; from 64rem the
          expand control takes its place, revealing PanelLeftOpen on hover the way the clinical
          sidebar's does. Either way it points at Ward Flow's home and never at the site root: the
          logo was the ninth and most prominent exit out of the sandbox, and it took looking at a
          screenshot rather than any amount of source reading to notice. */}
      <Link href="/mockups/ward-flow" className={shellStyles.railBrand} aria-label="Ward Flow home">
        <BrandMark className={shellStyles.brandGlyph} />
      </Link>
      <button
        type="button"
        onClick={onExpand}
        className={shellStyles.railExpand}
        aria-label="Expand sidebar"
        title="Expand sidebar"
      >
        <BrandMark className={shellStyles.railExpandBrand} />
        <PanelLeftOpen aria-hidden="true" className={shellStyles.railExpandIcon} />
      </button>
      <div className={shellStyles.railRule} aria-hidden="true" />
      <WardModeNavigation active={activeMode} />
      <div className={shellStyles.railRule} aria-hidden="true" />
      {/*
       * "Ward Flow role screens" holds the one non-arbitrary role entry point (Officer); the
       * nested group holds the two that name one arbitrary synthetic instance rather than a
       * section of the app (D10) and says so in its own aria-label. Coordinator is deliberately
       * absent from both — it is the "Command" view one group up.
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
      <div className={shellStyles.railBottom}>
        {/* The role switcher is the one control the proof journey (spec section 14) uses to move
            between all four roles without ever reloading the page, and unlike the static links
            above its destination is dynamic. */}
        <WardRoleSwitcher />
        <div className={shellStyles.railRule} aria-hidden="true" />
        {/* A sandbox has exactly one way out, and it is the developer page it was opened from.
            This used to be Ward Flow's own copy of the clinical application's app switcher —
            Clinical Answers, Documents, Services, Medication, Tools, All applications — six links
            routing straight back into the application Ward Flow is meant to stand apart from.

            Removing them also fixed a real, browser-only defect: the rail is a fixed-height flex
            column, and those six links pushed its content past a 1024px viewport, so
            `.railBottom` overlapped the last nav links and swallowed their clicks. Every link
            stayed in the DOM and stayed keyboard-reachable, so the whole unit suite passed while
            a Chromium journey timed out clicking one. */}
        <RailLink href={WARD_DEVELOPER_HUB_HREF} label="Back to the developer hub">
          <LayoutGrid aria-hidden="true" />
        </RailLink>
        <div className={shellStyles.railRule} aria-hidden="true" />
        {/* The demo jump-forward clock and scenario reset, mounted once here so every Ward Flow
            route gets them without per-screen wiring. Placed last, after a rule, with its own
            warning-toned trigger: it is deliberately NOT another destination, it never navigates,
            and it must never be mistaken for one. */}
        <WardDemoControls />
        <span className={shellStyles.avatar} aria-label="Guest workspace">
          G
        </span>
      </div>
    </aside>
  );
}

/**
 * The eight views as an icon-only strip inside the rail. Rendered from `WARD_VIEWS` rather than
 * eight literal link blocks: the labelled panel and drawer need the same eight destinations, and
 * a second hand-maintained copy of them is exactly the defect `ward-nav.ts` was created to end.
 *
 * `active` is optional: a route with no natural eight-view equivalent (a role detail screen, a
 * board, the patient workspace) passes nothing, and every `aria-current` comparison is simply
 * false. The nav still orients the user without falsely claiming one of the eight is current.
 */
export function WardModeNavigation({ active }: { active?: WardMode }) {
  return (
    <nav className={shellStyles.railNav} aria-label="Ward Flow views">
      {WARD_VIEWS.map((view) => {
        const Icon = WARD_VIEW_ICONS[view.id];
        const isActive = active === view.id;
        return (
          <RailLink key={view.id} href={view.href} label={view.label} active={isActive}>
            <Icon aria-hidden="true" />
          </RailLink>
        );
      })}
    </nav>
  );
}
