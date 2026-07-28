"use client";

import { ChevronRight, Columns3, Ellipsis, Layers, Search, type LucideIcon } from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui-primitives";

import {
  CATEGORY_COUNT,
  ContentSkeleton,
  CurrentDefects,
  DeviceFrame,
  MAX_COMPARE,
  MockupSection,
  MockupShell,
  NoteCard,
  REVIEW_COUNT,
  THERAPY_COUNT,
  UniversalTopBar,
  categories,
  compareBasket,
  destinationsIn,
  focusRing,
  groupCaptions,
  groupLabels,
  selectedTherapy,
  type Destination,
  type DestinationGroup,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction A — Grouped rail.
 *
 * The destinations are ranked spatially instead of being flattened into a
 * pill row: Library (ways in), Your workspace (what you are carrying), and
 * a third group that only exists while a therapy is selected and is named
 * after it. Same model at every width; only the surface changes.
 * ------------------------------------------------------------------ */

const GROUP_ORDER: DestinationGroup[] = ["library", "workspace", "therapy"];

/**
 * The collapsed rail keeps counts as badges, but a badge is 16 px: a raw 205
 * would blow the icon out, so anything past two digits is capped rather than
 * dropped — the number still says "a lot", the rail still fits.
 */
function collapsedBadge(meta: string | undefined): string | null {
  if (!meta) return null;
  const leading = meta.split("/")[0];
  if (!/^\d+$/.test(leading)) return null;
  const value = Number(leading);
  return value > 99 ? "99+" : leading;
}

function RailRow({
  destination,
  active,
  collapsed = false,
}: {
  destination: Destination;
  active: boolean;
  collapsed?: boolean;
}) {
  const Icon = destination.icon;
  const badge = collapsedBadge(destination.meta);

  if (collapsed) {
    return (
      <li>
        <button
          type="button"
          onClick={() => undefined}
          title={destination.label}
          aria-label={destination.meta ? `${destination.label} — ${destination.meta}` : destination.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative grid h-11 w-11 place-items-center rounded-lg transition",
            focusRing,
            active
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          {active ? (
            <span
              aria-hidden="true"
              className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
            />
          ) : null}
          <Icon aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
          {badge ? (
            <span
              aria-hidden="true"
              className="nums absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--clinical-accent)] px-1 text-4xs font-black text-[color:var(--clinical-accent-contrast)]"
            >
              {badge}
            </span>
          ) : null}
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
          focusRing,
          active
            ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
        )}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
          />
        ) : null}
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{destination.label}</span>
        {destination.meta ? (
          <span className="nums shrink-0 text-3xs font-semibold text-[color:var(--text-soft)]">{destination.meta}</span>
        ) : null}
      </button>
    </li>
  );
}

function GroupHeading({ group, collapsed = false }: { group: DestinationGroup; collapsed?: boolean }) {
  if (collapsed) {
    return <li aria-hidden="true" className="mx-auto my-1.5 h-px w-6 bg-[color:var(--border)]" />;
  }

  return (
    <li className="px-0.5 pb-1 pt-3 first:pt-0">
      <p
        className={cn(
          "text-3xs font-black uppercase tracking-[0.12em]",
          group === "therapy" ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
        )}
      >
        {groupLabels[group]}
      </p>
      <p className="mt-0.5 text-3xs leading-4 text-[color:var(--text-soft)]">{groupCaptions[group]}</p>
    </li>
  );
}

/** The therapy group is present only when a therapy is actually selected. */
function GroupedList({
  activeId,
  collapsed = false,
  withTherapy = true,
}: {
  activeId: string;
  collapsed?: boolean;
  withTherapy?: boolean;
}) {
  const groups = withTherapy ? GROUP_ORDER : GROUP_ORDER.filter((group) => group !== "therapy");

  return (
    <ul className="space-y-0.5">
      {groups.map((group) => (
        <li key={group}>
          <ul className="space-y-0.5">
            <GroupHeading group={group} collapsed={collapsed} />
            {destinationsIn(group).map((destination) => (
              <RailRow
                key={destination.id}
                destination={destination}
                active={destination.id === activeId}
                collapsed={collapsed}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Nothing selected: the third group is replaced by an honest empty state. */
function NoTherapyHint() {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-[color:var(--border-strong)] p-2.5">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">No therapy open</p>
      <p className="mt-1 text-3xs leading-4 text-[color:var(--text-soft)]">
        Brief intervention and Patient sheet appear here, named after the record they will act on.
      </p>
    </div>
  );
}

function CategoryPeek() {
  return (
    <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Top categories</p>
      <ul className="mt-1.5 space-y-1">
        {categories.slice(0, 4).map((category) => (
          <li key={category.name} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-3xs font-semibold text-[color:var(--text-muted)]">
              {category.name}
            </span>
            <span className="nums shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">{category.count}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => undefined}
        className={cn(
          "mt-1.5 inline-flex min-h-11 items-center gap-1 text-3xs font-black text-[color:var(--clinical-accent)]",
          focusRing,
        )}
      >
        All {CATEGORY_COUNT} categories
        <ChevronRight aria-hidden="true" className="h-3 w-3" />
      </button>
    </div>
  );
}

function DesktopRail({ activeId, withTherapy = true }: { activeId: string; withTherapy?: boolean }) {
  return (
    <nav
      aria-label="Therapy sections"
      className="min-h-0 w-[16.25rem] shrink-0 overflow-y-auto border-r border-[color:var(--border)] bg-[color:var(--surface)] p-3"
    >
      <GroupedList activeId={activeId} withTherapy={withTherapy} />
      {withTherapy ? <CategoryPeek /> : <NoTherapyHint />}
    </nav>
  );
}

function DesktopFrame({ withTherapy = true }: { withTherapy?: boolean }) {
  return (
    <DeviceFrame
      device="desktop"
      label={withTherapy ? "Desktop · 1440 px · therapy open" : "Desktop · 1440 px · nothing selected"}
      note={
        withTherapy
          ? "The rail is the whole model at once: four ways in, two stateful workspaces, and three actions that belong to ACT specifically. The counts are live — 205 records, 16 categories, 3 of 4 compare slots filled, 205 still awaiting review."
          : "With no therapy open the third group is absent rather than greyed out, and a dashed hint says what will appear there and what it will act on."
      }
    >
      <UniversalTopBar device="desktop" />
      <div className="flex min-h-0 flex-1">
        <DesktopRail activeId={withTherapy ? "brief" : "search"} withTherapy={withTherapy} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)]">
          <ContentSkeleton
            eyebrow={withTherapy ? selectedTherapy.short : "Library"}
            title={withTherapy ? "Brief intervention · 5 minutes" : `Search ${THERAPY_COUNT} therapy records`}
            blocks={2}
          />
        </div>
      </div>
    </DeviceFrame>
  );
}

/** Tablet: the rail keeps its order and grouping, loses its labels. */
function TabletFrame() {
  return (
    <DeviceFrame
      device="tablet"
      label="Tablet · 768 px"
      note="Same rail, same order, 44 px of it. Hairlines stand in for the group headings, count badges survive the collapse, and a context strip above the content carries the therapy name the labels used to."
    >
      <UniversalTopBar device="tablet" />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Therapy sections"
          className="shrink-0 overflow-y-auto border-r border-[color:var(--border)] bg-[color:var(--surface)] p-1.5"
        >
          <GroupedList activeId="brief" collapsed />
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)]">
          <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-3xs font-black text-[color:var(--clinical-accent)]">
              {selectedTherapy.short}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">
                {selectedTherapy.name}
              </span>
              <span className="block truncate text-3xs font-semibold text-[color:var(--text-soft)]">
                {selectedTherapy.category} · Brief intervention
              </span>
            </span>
            <span className="nums shrink-0 rounded-full border border-[color:var(--border)] px-2 py-1 text-3xs font-bold text-[color:var(--text-soft)]">
              {compareBasket.length}/{MAX_COMPARE}
            </span>
          </div>
          <ContentSkeleton eyebrow={selectedTherapy.short} title="Brief intervention · 5 minutes" compact blocks={2} />
        </div>
      </div>
    </DeviceFrame>
  );
}

/* -- Phone -------------------------------------------------------------- */

type PhoneState = "rest" | "sheet" | "hidden" | "empty";

const PHONE_TABS: Array<{ id: string; label: string; icon: LucideIcon; badge?: string }> = [
  { id: "search", label: "Search", icon: Search },
  { id: "browse", label: "Browse", icon: Layers },
  { id: "compare", label: "Compare", icon: Columns3, badge: `${compareBasket.length}` },
  { id: "more", label: "More", icon: Ellipsis },
];

function PhoneTabBar({ activeId, sheetOpen, sheetId }: { activeId: string; sheetOpen: boolean; sheetId: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)]">
      <nav aria-label="Therapy sections" className="flex items-stretch">
        {PHONE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeId;
          const isMore = tab.id === "more";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => undefined}
              aria-current={active ? "page" : undefined}
              aria-expanded={isMore ? sheetOpen : undefined}
              aria-controls={isMore ? sheetId : undefined}
              className={cn(
                "relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 px-1 pb-[env(safe-area-inset-bottom)] transition",
                focusRing,
                active || (isMore && sheetOpen)
                  ? "text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)]",
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-[color:var(--clinical-accent)]"
                />
              ) : null}
              <span className="relative">
                <Icon aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
                {tab.badge ? (
                  <span
                    aria-hidden="true"
                    className="nums absolute -right-2 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[color:var(--clinical-accent)] px-1 text-4xs font-black text-[color:var(--clinical-accent-contrast)]"
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-4xs font-black uppercase tracking-[0.08em]">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MoreSheet({ id, withTherapy }: { id: string; withTherapy: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 z-40 bg-[color:var(--text-heading)]/40" />
      <div
        id={id}
        role="dialog"
        aria-label="All therapy destinations"
        className="absolute inset-x-0 bottom-0 z-50 max-h-[78%] overflow-y-auto rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 pb-4 pt-2 shadow-[var(--shadow-lux)]"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
        />
        <GroupedList activeId="brief" withTherapy={withTherapy} />
        {withTherapy ? null : <NoTherapyHint />}
      </div>
    </>
  );
}

function PhoneFrame({ state }: { state: PhoneState }) {
  const sheetId = useId();
  const sheet = state === "sheet";
  const hidden = state === "hidden";
  const empty = state === "empty";

  return (
    <div className="relative flex h-full flex-col">
      {hidden ? null : <UniversalTopBar device="phone" />}
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <ContentSkeleton
          eyebrow={empty ? "Library" : selectedTherapy.short}
          title={empty ? `Search ${THERAPY_COUNT} therapy records` : "Brief intervention · 5 minutes"}
          compact
          blocks={3}
        />
      </div>
      {hidden ? null : (
        <PhoneTabBar activeId={sheet ? "more" : empty ? "search" : "compare"} sheetOpen={sheet} sheetId={sheetId} />
      )}
      {sheet ? <MoreSheet id={sheetId} withTherapy={!empty} /> : null}
    </div>
  );
}

const PHONE_STATES: Array<{ state: PhoneState; label: string; note: string }> = [
  {
    state: "rest",
    label: "At rest",
    note: "Four fixed slots, no horizontal scroll, nothing off-screen. Compare wears its basket count so the workspace stops being invisible.",
  },
  {
    state: "sheet",
    label: "More — the full model",
    note: "The same three groups as the desktop rail, in the same order, viewport-anchored. Everything the strip used to hide past the right edge is one tap away and legible.",
  },
  {
    state: "hidden",
    label: "Scrolled — chrome gone",
    note: "The bar leaves with the universal header on a deliberate descent and releases its reserve to 0 rem. No phantom padding: the content paints to the physical edge.",
  },
  {
    state: "empty",
    label: "Nothing selected",
    note: "The therapy group is omitted, not greyed. A dashed hint names what will appear and what it will act on, so Brief intervention can never silently open a different record's.",
  },
];

export function TherapyNavigationRailMockups() {
  return (
    <MockupShell
      current="therapy-navigation-rail"
      letter="A"
      name="Grouped rail"
      headline="Give the seven destinations a rank, and the rank a shape"
      intro="One model at every width: Library is how you get in, Your workspace is what you are carrying between screens, and the third group exists only while a therapy is open and is named after it. Desktop shows all three at once, tablet keeps the order and drops the labels, and a phone gets four fixed slots plus a sheet holding the same list."
    >
      <CurrentDefects />

      <MockupSection
        id="rail-model-title"
        title="The model this direction commits to"
        intro="Three groups, one order, every surface."
      >
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="Library — four doors, not two"
            body={`Browse by category is added because category is a first-class field on all ${THERAPY_COUNT} records and splits them into ${CATEGORY_COUNT} groups. Today it has no entry point anywhere in navigation.`}
          />
          <NoteCard
            tone="accent"
            title="Your workspace — the stateful pair"
            body={`Compare shows how many of the ${MAX_COMPARE} slots are filled. Review is promoted out of nowhere: it is already a real route with an active nav style computed for it, and all ${REVIEW_COUNT} records still need one.`}
          />
          <NoteCard
            tone="accent"
            title="This therapy — scoped and named"
            body="Overview, Brief intervention and Patient sheet are grouped under the record they act on and titled with it, so the silent fallback to another therapy has nowhere to hide."
          />
        </div>
      </MockupSection>

      <MockupSection
        id="rail-wide-title"
        title="Desktop and tablet"
        intro="The width the current strip wastes is where the model lives."
      >
        <div className="space-y-6">
          <DesktopFrame />
          <DesktopFrame withTherapy={false} />
          <TabletFrame />
        </div>
      </MockupSection>

      <MockupSection id="rail-phone-title" title="Phone · 390 px" intro="Four slots, one sheet, zero hidden scroll.">
        <div className="flex flex-wrap gap-5">
          {PHONE_STATES.map((item) => (
            <DeviceFrame key={item.state} device="phone" label={item.label} note={item.note}>
              <PhoneFrame state={item.state} />
            </DeviceFrame>
          ))}
        </div>
      </MockupSection>

      <MockupSection id="rail-cost-title" title="What it costs">
        <div className="grid gap-2 sm:grid-cols-2">
          <NoteCard
            tone="warn"
            title="It spends horizontal room"
            body="260 px of desktop width is permanently committed. On a compare table four therapies wide, that is real content taken away — this direction bets the orientation is worth it."
          />
          <NoteCard
            tone="warn"
            title="A phone bottom bar competes with the composer"
            body="Therapy's mode home keeps its search composer in the hero and submitted views dock it at the bottom. A tab bar and a docked composer cannot both own that edge; the tab bar would have to yield on search-result views."
          />
        </div>
      </MockupSection>
    </MockupShell>
  );
}
