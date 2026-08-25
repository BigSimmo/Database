"use client";

import Link from "next/link";
import { LayoutGrid, PanelLeftClose } from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";

import { WardDemoControls } from "./ward-demo-controls";
import { WardRoleSwitcher } from "./ward-role-switcher";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "./ward-nav-icons";
import {
  WARD_DEVELOPER_HUB_HREF,
  WARD_NAV,
  WARD_VIEWS,
  type WardMode,
  type WardNavItem,
} from "./ward-nav";

import styles from "./ward-sidebar.module.css";

/**
 * Ward Flow's labelled sidebar body, mounted by both the expanded desktop panel and the phone
 * drawer — the same one-content-two-hosts arrangement `ClinicalSidebarContent` uses for the
 * clinical application's sidebar and mobile sheet. Writing the destinations once is the whole
 * point: the icon rail, this panel and this drawer all read `ward-nav.ts`, so a destination
 * added in one place appears in all three or in none.
 */
export function WardSidebarContent({
  activeMode,
  showBrandRow = true,
  onCollapse,
  onNavigate,
}: {
  activeMode?: WardMode;
  /** The drawer's Sheet supplies its own header, so it turns this off. */
  showBrandRow?: boolean;
  /** Present only on the desktop panel; the drawer closes instead of collapsing. */
  onCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      {showBrandRow ? (
        <div className={styles.brandRow}>
          <Link href="/mockups/ward-flow" className={styles.brandLink} onClick={onNavigate}>
            <BrandMark className={styles.brandGlyph} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>Ward Flow</span>
              <span className={styles.brandTagline}>Synthetic patient-flow prototype</span>
            </span>
          </Link>
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className={styles.collapseButton}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <nav className={styles.group} aria-label="Ward Flow views">
        <span className={styles.groupLabel}>Views</span>
        {WARD_VIEWS.map((view) => {
          const Icon = WARD_VIEW_ICONS[view.id];
          const active = activeMode === view.id;
          return (
            <Link
              key={view.id}
              href={view.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={active ? styles.linkActive : styles.link}
            >
              <Icon aria-hidden="true" />
              <span className={styles.linkLabel}>{view.label}</span>
            </Link>
          );
        })}
      </nav>

      <WardSidebarGroup
        label="Role screens"
        items={WARD_NAV.filter((item) => item.group === "role")}
        onNavigate={onNavigate}
      />

      <WardSidebarGroup
        label="Boards"
        items={WARD_NAV.filter((item) => item.group === "board")}
        onNavigate={onNavigate}
      />

      <div className={styles.footer}>
        {/* The role switcher and the demo clock are mounted here exactly as the rail mounts them
            — same components, same behaviour. The clock is not a destination and never navigates;
            it sits below the rule with every real link above it, as it does in the rail. */}
        <div className={styles.footerControls}>
          <WardRoleSwitcher />
          <WardDemoControls />
          <span className={styles.guest} aria-label="Guest workspace">
            G
          </span>
        </div>
        {/* The single way out of the sandbox. */}
        <Link href={WARD_DEVELOPER_HUB_HREF} className={styles.link} onClick={onNavigate}>
          <LayoutGrid aria-hidden="true" />
          <span className={styles.linkLabel}>Back to the developer hub</span>
        </Link>
      </div>
    </>
  );
}

function WardSidebarGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: readonly WardNavItem[];
  onNavigate?: () => void;
}) {
  return (
    <nav className={styles.group} aria-label={`Ward Flow ${label.toLowerCase()}`}>
      <span className={styles.groupLabel}>{label}</span>
      {items.map((item) => {
        const Icon = WARD_NAV_ICONS[item.id];
        return (
          <Link key={item.id} href={item.href} onClick={onNavigate} className={styles.link}>
            <Icon aria-hidden="true" />
            <span className={styles.linkLabel}>{item.label}</span>
            {/* D10: this href names one arbitrary synthetic instance, not a section of the app.
                The icon rail can only say so in an aria-label; a labelled row can show it. */}
            {item.exampleOnly ? <span className={styles.exampleTag}>example</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
