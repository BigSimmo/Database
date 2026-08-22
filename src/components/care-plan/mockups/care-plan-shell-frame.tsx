"use client";

import {
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Home,
  MoreHorizontal,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { SearchField } from "@/components/ui/text-field";

import styles from "./care-plan.module.css";
import { PROTOTYPE_ROLE_LABEL } from "./prototype-ui";
import {
  CARE_PLAN_MORE_DESTINATIONS,
  CARE_PLAN_PRIMARY_DESTINATIONS,
  CARE_PLAN_SYSTEM_STATES_DESTINATION,
  type CarePlanDestination,
} from "./routes";
import type { PrototypeScenario, PrototypeUser } from "./types";

const DESTINATION_ICON: Record<CarePlanDestination, LucideIcon> = {
  Home,
  Patients: Users,
  Reviews: ClipboardCheck,
  Team: UsersRound,
  Governance: ShieldCheck,
  "System states": FlaskConical,
};

/** The four destinations the phone dock has room for. */
const PHONE_DESTINATIONS = CARE_PLAN_PRIMARY_DESTINATIONS.filter(
  ({ label }) => label === "Home" || label === "Patients" || label === "Reviews",
);

export type CarePlanShellFrameProps = {
  /**
   * The address being displayed. The shell persists across navigation, so this
   * — not the heading — is what tells it the route actually changed: two
   * patients' Management Plans share one heading, and keying on the heading
   * would leave that navigation silent for a screen-reader user.
   */
  pathname: string;
  /** The rail and dock entry that owns the current route. */
  activeDestination: CarePlanDestination;
  /** The single first-level heading for the route. */
  title: string;
  /** The named specimen state reconstructed from the URL, for inspection only. */
  scenario: PrototypeScenario;
  /** The synthetic clinician the prototype is signed in as. */
  activeUser: { id: string; displayName: string; title: string };
  /** Every synthetic clinician the switcher can move between. */
  prototypeUsers: readonly PrototypeUser[];
  /** Called with the chosen synthetic user; the caller dispatches `set-active-user`. */
  onSelectUser: (userId: string) => void;
  /** Called when the one search slot is submitted. */
  onSearchSubmit: () => void;
  /**
   * The route owns an in-flow search of its own, so the shell stands its
   * composer down. One page never carries two search fields: Home and Patients
   * put search inside the patient directory, where the results appear, and every
   * other route uses this one.
   */
  routeOwnsSearch?: boolean;
  /** The one route-owned action slot beside the page title. */
  headerAction?: ReactNode;
  children: ReactNode;
};

/**
 * The responsive Clinical Shell every Care Plan route renders inside: a desktop
 * rail beside a scrolling column, a phone dock with a More sheet, one search
 * slot, and the standing statement that this is synthetic and saves nothing.
 *
 * Every destination is a real `next/link` built from the route registry, so a
 * route can be reached, bookmarked and reconstructed rather than only reached by
 * clicking through from somewhere else.
 */
export function CarePlanShellFrame({
  pathname,
  activeDestination,
  title,
  scenario,
  activeUser,
  prototypeUsers,
  onSelectUser,
  onSearchSubmit,
  routeOwnsSearch = false,
  headerAction,
  children,
}: CarePlanShellFrameProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the heading whenever the address changes. Without it a
  // keyboard or screen-reader user stays parked on the link they activated and
  // has to travel the whole rail again to reach the new page.
  //
  // The dependency is the pathname, not the heading. Moving between two
  // patients' Management Plans keeps the same heading text, and keying on the
  // heading would make the commonest navigation in this product announce
  // nothing at all.
  //
  // This focus move is also the *only* route announcement. A hand-rolled
  // `aria-live` region repeating the heading would make every navigation
  // announce twice, once from the live region and once from the newly focused
  // heading, so there deliberately is not one.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearchSubmit();
  }

  const moreIsActive = CARE_PLAN_MORE_DESTINATIONS.some(({ label }) => label === activeDestination);

  return (
    <div className={styles.appRoot} data-care-plan-scenario={scenario}>
      <div className={styles.layout}>
        <aside className={styles.rail} data-print-hide="true">
          <div className={styles.railBrand}>
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">Care Plan</p>
            <p className="text-xs text-[color:var(--text-muted)]">Continuity for recurrent emergency care</p>
          </div>

          <nav aria-label="Care Plan sections" className={styles.railNav}>
            {CARE_PLAN_PRIMARY_DESTINATIONS.map(({ label, href }) => {
              const Icon = DESTINATION_ICON[label];
              return (
                <Link
                  key={label}
                  href={href}
                  aria-current={activeDestination === label ? "page" : undefined}
                  className={styles.navItem}
                >
                  <Icon aria-hidden="true" className="size-icon-md shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <nav aria-label="Care Plan prototype tools" className={styles.railTools}>
            <Link
              href={CARE_PLAN_SYSTEM_STATES_DESTINATION.href}
              aria-current={activeDestination === "System states" ? "page" : undefined}
              className={styles.navItem}
            >
              <FlaskConical aria-hidden="true" className="size-icon-md shrink-0" />
              <span>{CARE_PLAN_SYSTEM_STATES_DESTINATION.label}</span>
            </Link>
          </nav>

          {/*
            The displayed clinician, and the control that changes which one is
            displayed. It is interaction modelling: it explains why an action is
            offered on the surfaces below, and the reducer rechecks the role on
            every change either way. It authenticates nobody and protects nothing.
          */}
          <div
            data-testid="care-plan-active-user"
            className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
          >
            <p className="text-sm font-semibold text-[color:var(--text)]">{activeUser.displayName}</p>
            <p className="text-xs text-[color:var(--text-muted)]">{activeUser.title}</p>
            <Select
              label="Prototype role"
              className={styles.roleSwitcher}
              fieldClassName="mt-2"
              value={activeUser.id}
              onChange={(event) => onSelectUser(event.target.value)}
              hint="Choosing a clinician here explains which actions are offered. It is not a sign-in, and it protects nothing."
              options={prototypeUsers.map((user) => ({
                value: user.id,
                label: `${user.displayName} — ${PROTOTYPE_ROLE_LABEL[user.role]}`,
              }))}
            />
          </div>
        </aside>

        <div className={styles.column}>
          {/*
            The header is deliberately NOT print-hidden. It is the only place
            that says this content is fictional, and a printed Care Plan leaves
            the screen — it is carried to a bedside or sent with a handover. Paper
            showing a clinical heading with nothing marking it synthetic is the
            exact failure this guards against, so only the chrome inside the
            header (the search slot) is dropped for print.
          */}
          <header className={styles.header}>
            <div className={styles.headerIdentity}>
              <span data-testid="care-plan-synthetic-marker" className={styles.marker}>
                Synthetic prototype — fictional data only
              </span>
              <span className={styles.memoryNotice}>Nothing is saved. Reloading this page starts over.</span>
            </div>

            {routeOwnsSearch ? null : (
              <form role="search" onSubmit={handleSubmit} className={styles.searchSlot} data-print-hide="true">
                <SearchField
                  label="Search patients"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onClear={() => setSearchTerm("")}
                  placeholder="Search patients"
                  fieldClassName={styles.searchField}
                />
                <Button type="submit" variant="secondary">
                  Search patients
                </Button>
              </form>
            )}
          </header>

          <main className={styles.main}>
            <div className={styles.pageHead}>
              <h1 ref={titleRef} tabIndex={-1} className={styles.pageTitle}>
                {title}
              </h1>
              {headerAction ? <div>{headerAction}</div> : null}
            </div>
            {children}
          </main>
        </div>
      </div>

      <nav aria-label="Care Plan phone navigation" className={styles.dock} data-print-hide="true">
        {PHONE_DESTINATIONS.map(({ label, href }) => {
          const Icon = DESTINATION_ICON[label];
          return (
            <Link
              key={label}
              href={href}
              aria-current={activeDestination === label ? "page" : undefined}
              className={styles.dockItem}
            >
              <Icon aria-hidden="true" className="size-icon-md" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <button
          ref={moreTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreIsActive ? "page" : undefined}
          onClick={() => setMoreOpen(true)}
          className={styles.dockItem}
        >
          <MoreHorizontal aria-hidden="true" className="size-icon-md" />
          <span className="truncate">More</span>
        </button>
      </nav>

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        description="The Care Plan destinations the phone dock has no room for"
        closeLabel="Close more destinations"
        returnFocusRef={moreTriggerRef}
        mobileSize="content"
      >
        <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)]">
          {CARE_PLAN_MORE_DESTINATIONS.map(({ label, href, description }) => {
            const Icon = DESTINATION_ICON[label];
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-tap items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-left last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-0.125rem] focus-visible:outline-[color:var(--focus)]"
              >
                <Icon aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[color:var(--text)]">{label}</span>
                  <span className="mt-0.5 block text-sm text-[color:var(--text-muted)]">{description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
              </Link>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
