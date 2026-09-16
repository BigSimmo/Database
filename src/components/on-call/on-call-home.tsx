"use client";

import { CalendarDays, ChevronRight, Phone, Printer, Shield, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { cardPadding, cardSurface, focusRing } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { OnCallPageMenu } from "@/components/on-call/on-call-page-menu";
import { OnCallSearchBox } from "@/components/on-call/on-call-search-box";
import { OnCallTeachingStrip } from "@/components/on-call/on-call-teaching-strip";
import {
  ON_CALL_HOME_ICON,
  ON_CALL_SECTION_HREFS,
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TILE_DESCRIPTIONS,
  ON_CALL_SECTION_TITLES,
} from "@/components/on-call/on-call-section-identity";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { selectUpcomingTeachingSessions } from "@/lib/on-call/teaching-schedule";
import { type OnCallEntry } from "@/lib/on-call/entry-model";
import {
  ON_CALL_HOME_TAGS,
  countOnCallEntriesBySection,
  onCallAvailability,
  onCallLocalDateKey,
  onCallPrimaryNumber,
  onCallTelHref,
  selectCallFirstContacts,
  selectPinnedPlaybookEntry,
  selectSwitchboardContact,
  selectWardContacts,
} from "@/lib/on-call/home-modules";
import { clearOnCallRecent, recordOnCallRecent, useOnCallRecent } from "@/lib/on-call/recent-storage";

/**
 * The On Call home: a dashboard for the shift, with one search box over it.
 *
 * `/on-call` used to redirect to the shared home at `/?mode=on-call`, which was
 * the one place in this mode a search composer appeared, and the redirect was
 * removed for a good reason: it sent someone hunting a ward number into the
 * app's UNIVERSAL search. What went with it, unintentionally, was any way to
 * search this mode at all — a reader had to know which of seven pages held a
 * number and scroll it. `OnCallSearchBox` is the answer to that and not a
 * reversal of the redirect decision: it searches only this mode's own entries,
 * already in the browser, so it costs no request and keeps working with no
 * signal. See `docs/on-call/design/prototypes/on-call-screens.html`, board 01.
 *
 * Every module below it is derived from tags the owner controls
 * (`src/lib/on-call/home-modules.ts`), so what appears here is editable from
 * inside the app. Each empty state names the tag that fills it, which is how the
 * convention is discovered.
 *
 * **There is deliberately no freshness warning on this page**, and this is the
 * second time that has been decided. A strip naming overdue sections was built
 * here and then removed on the owner's instruction (2026-09-16): overdue entries
 * are a maintenance fact, and a reader opening this page is mid-shift and
 * looking for a number. Overdue entries are reported in the developer hub
 * instead, at `/mockups/development/on-call-freshness`, which is where the
 * person who maintains the hub looks rather than the person using it. Individual
 * overdue rows still carry their own badge inside each section, where the row is
 * and where confirming it is one tap. Do not restore a warning here.
 */

/**
 * A module's trailing action.
 *
 * The label stays small because the drawing draws it small, but the target
 * does not: `min-h-tap` gives it the production 48 px floor and `-my-3`
 * hangs that hit area over the compact header row, so the row keeps its
 * height and the thumb still gets a full target. Shared by both actions so
 * one of them cannot quietly become a 24 px control again.
 */
const moduleAction = cn(
  "-my-3 inline-flex min-h-tap items-center gap-1 rounded-sm px-1.5 text-xs font-semibold no-underline",
  "text-[color:var(--text-muted)] transition-colors motion-reduce:transition-none hover:text-[color:var(--text-heading)]",
  focusRing,
);

/** A module: a quiet monospaced label, an optional trailing action, and a body. */
function HomeModule({
  id,
  label,
  action,
  children,
  className,
}: {
  id: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className={cn("grid gap-2", className)} data-testid={id}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 id={headingId} className={eyebrowText}>
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A call card.
 *
 * `--command` rather than the mode accent: this is the control you press, and
 * the command tone is what this design system already uses for "the primary
 * action on this surface". The accent is reserved for selection and evidence.
 */
function CallCard({ entry, now }: { entry: OnCallEntry; now: Date }) {
  const number = onCallPrimaryNumber(entry, now);
  const href = onCallTelHref(number?.value);
  const availability = onCallAvailability(entry);
  if (!href || !number) return null;
  return (
    <a
      href={href}
      onClick={() => recordOnCallRecent({ id: entry.id, title: entry.title })}
      data-testid={`on-call-home-call-${entry.slug}`}
      className={cn(
        "grid min-h-tap content-between gap-2 rounded-lg p-3 no-underline",
        "bg-[color:var(--command)] text-[color:var(--command-contrast)]",
        "transition-opacity motion-reduce:transition-none hover:opacity-90",
        focusRing,
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <Phone aria-hidden="true" className="size-icon-md" />
        {/* Which of the contact's numbers this is. `onCallPrimaryNumber` became
            time-aware when the after-hours rule landed, so the same card shows a
            different line at 09:00 and at 22:00 — printing the digits without
            saying which line they are is how someone rings the daytime desk
            overnight and believes they rang the right place. */}
        <span className="text-3xs font-bold uppercase tracking-kicker opacity-80">{number.label}</span>
      </span>
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{entry.title}</span>
        <span className="nums text-lg-minus font-bold tracking-display">{number.value}</span>
        {availability ? <span className="text-3xs font-semibold opacity-80">{availability}</span> : null}
      </span>
    </a>
  );
}

function SwitchboardRow({ entry, now }: { entry: OnCallEntry; now: Date }) {
  const number = onCallPrimaryNumber(entry, now);
  const href = onCallTelHref(number?.value);
  const content = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <Phone aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
      </span>
      <span className="min-w-0 flex-1 grid gap-0.5 text-left">
        <span className="text-sm font-semibold text-[color:var(--text-heading)]">{entry.title}</span>
        {entry.subtitle ? <span className={cn(textMuted, "text-xs")}>{entry.subtitle}</span> : null}
      </span>
      {number ? (
        <span className="grid shrink-0 justify-items-end gap-0.5">
          <span className={cn(textMuted, "text-3xs font-bold uppercase tracking-kicker")}>{number.label}</span>
          <span className="nums text-sm font-bold">{number.value}</span>
        </span>
      ) : null}
      <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
    </>
  );
  const className = cn(
    cardSurface,
    "flex min-h-tap items-center gap-2.5 px-3 no-underline",
    focusRing,
    href && "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
  );
  if (!href) {
    return (
      <div className={className} data-testid="on-call-home-switchboard">
        {content}
      </div>
    );
  }
  return (
    <a
      href={href}
      onClick={() => recordOnCallRecent({ id: entry.id, title: entry.title })}
      className={className}
      data-testid="on-call-home-switchboard"
    >
      {content}
    </a>
  );
}

function WardChip({ entry, now }: { entry: OnCallEntry; now: Date }) {
  const number = onCallPrimaryNumber(entry, now);
  const href = onCallTelHref(number?.value);
  if (!href || !number) return null;
  return (
    <a
      href={href}
      onClick={() => recordOnCallRecent({ id: entry.id, title: entry.title })}
      data-testid={`on-call-home-ward-${entry.slug}`}
      className={cn(
        cardSurface,
        "grid min-h-tap w-32 shrink-0 content-center gap-0.5 px-3 py-2 no-underline",
        "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
        focusRing,
      )}
    >
      <span className="truncate text-xs font-semibold text-[color:var(--text-heading)]">{entry.title}</span>
      <span className="nums text-sm font-bold text-[color:var(--text)]">{number.value}</span>
      <span className={cn(textMuted, "truncate text-3xs font-bold uppercase tracking-kicker")}>{number.label}</span>
    </a>
  );
}

/**
 * The pinned reminder.
 *
 * This is the one module painted in the mode's own colour. `category-identity.ts`
 * reserves the accent for within-surface category identity and says navigation
 * and mode homes stay unpainted — the carve-out written there covers exactly
 * this: it is page CONTENT on a home, not a navigation channel, and it is
 * paired with an icon and a heading so the colour is never the only signal.
 */
function PinnedReminder({ entry }: { entry: OnCallEntry }) {
  return (
    <Link
      href={ON_CALL_SECTION_HREFS.playbook}
      data-category-accent="purple"
      data-testid="on-call-home-pinned"
      className={cn(
        "flex min-h-tap items-start gap-2.5 rounded-lg border p-3 no-underline",
        "border-[color:var(--cat-border)] bg-[color:var(--cat-soft)]",
        "transition-colors motion-reduce:transition-none hover:border-[color:var(--cat-accent)]",
        focusRing,
      )}
    >
      <Shield aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--cat-accent)]" />
      <span className="min-w-0 flex-1 grid gap-1">
        <span className="text-sm font-semibold text-[color:var(--text-heading)]">{entry.title}</span>
        {entry.subtitle ? <span className="text-xs leading-5 text-[color:var(--text)]">{entry.subtitle}</span> : null}
        <span className={cn(textMuted, "text-xs")}>Open the Playbook ladder</span>
      </span>
      <ChevronRight aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
    </Link>
  );
}

/** A short local time for a recorded moment, e.g. "21:58". */
function timeLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${`${parsed.getHours()}`.padStart(2, "0")}:${`${parsed.getMinutes()}`.padStart(2, "0")}`;
}

export function OnCallHome({ now = new Date() }: { now?: Date } = {}) {
  const { entries, loading, isOffline, cachedAt } = useOnCallEntries();
  const recent = useOnCallRecent();

  // One clock for the whole page. `onCallPrimaryNumber` became time-aware when
  // the after-hours rule landed, so a second `new Date()` a line away could put
  // the ward strip on the daytime number while the call cards were already on
  // the after-hours one. Injectable so a test can stand at 22:00 without faking
  // the process clock, and deliberately NOT memoised: a phone left open across
  // 17:00 should pick up the after-hours number on its next render rather than
  // hold the clock it mounted with.
  const today = onCallLocalDateKey(now);
  const callFirst = useMemo(() => selectCallFirstContacts(entries), [entries]);
  const switchboard = useMemo(() => selectSwitchboardContact(entries), [entries]);
  const wards = useMemo(() => selectWardContacts(entries), [entries]);
  const pinned = useMemo(() => selectPinnedPlaybookEntry(entries), [entries]);
  // `selectUpcomingTeachingSessions` rather than `home-modules`' own selector:
  // a session with a recurrence rolls forward from its anchor instead of
  // vanishing the afternoon its date passes, which is what made this block go
  // blank every Thursday. Same `(entries, today)` string-date contract.
  const upcoming = useMemo(() => selectUpcomingTeachingSessions(entries, today), [entries, today]);
  const { counts } = useMemo(() => countOnCallEntriesBySection(entries), [entries]);

  // A hub with no entries at all and a hub whose entries are simply untagged are
  // different problems with different answers, and a single empty state that
  // tries to serve both ends up telling a first-time reader about tags they have
  // nothing to tag yet.
  const hasEntries = entries.length > 0;
  const homeIsUntagged = hasEntries && callFirst.length === 0 && !switchboard && wards.length === 0 && !pinned;

  // A Recent row names an entry the reader could see when they opened it. If
  // that entry is gone — deleted, or withheld because the session ended — the
  // row is dropped rather than rendered as a dead title.
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const recentEntries = useMemo(
    () =>
      recent
        .map((item) => ({ item, entry: entriesById.get(item.id) }))
        .filter((row): row is { item: (typeof recent)[number]; entry: OnCallEntry } => Boolean(row.entry)),
    [recent, entriesById],
  );

  const tiles = [
    ...(["contacts", "playbook", "referrals", "orientation", "education", "logistics"] as const).map((section) => ({
      key: section,
      href: ON_CALL_SECTION_HREFS[section],
      title: ON_CALL_SECTION_TITLES[section],
      description: ON_CALL_SECTION_TILE_DESCRIPTIONS[section],
      icon: ON_CALL_SECTION_ICONS[section],
      count: counts.get(section) ?? 0,
    })),
    {
      key: "who-is-who" as const,
      href: "/on-call/who-is-who",
      title: "Who's who",
      description: "Roles, and who to ask",
      icon: Users,
      // Drawn without a count, and correctly so: the other tiles count things
      // you might go and read, while these are an explanation of the ladder.
      // A number on it invites the reader to treat it as a list.
      count: null,
    },
  ];

  return (
    <>
      {/* No section rail here either. This page IS the section list — its tile
          grid names all nine with their counts — and the mode pill above opens
          the same nine. A bar between them would be the third copy. */}
      <OnCallPageMenu view="home" />
      <InformationPageShell testId="on-call-home-main">
        <h1 className="sr-only">On Call</h1>
        {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} /> : null}

        {/* Renders nothing but the field until something is typed, so it costs a
            reader who is not searching no vertical space at all. */}
        <OnCallSearchBox entries={entries} />

        {!loading && !hasEntries ? (
          <HomeModule id="on-call-home-first-run" label="Getting started">
            <EmptyState
              icon={ON_CALL_HOME_ICON}
              title="Your On Call hub is empty"
              body="Nothing has been added yet. Contacts is the page a shift actually opens, so it is the one worth filling first."
              description="Adding and editing needs an account. Reading does not."
              actions={
                <Link
                  href={ON_CALL_SECTION_HREFS.contacts}
                  className={cn(
                    "inline-flex min-h-tap items-center gap-1.5 rounded-sm px-1.5 text-sm font-semibold no-underline",
                    "text-[color:var(--text-heading)] transition-colors motion-reduce:transition-none hover:text-[color:var(--command)]",
                    focusRing,
                  )}
                >
                  Open Contacts
                  <ChevronRight aria-hidden="true" className="size-icon-xs" />
                </Link>
              }
              testId="on-call-home-first-run-empty"
            />
          </HomeModule>
        ) : null}

        <HomeModule id="on-call-home-call-first" label="Call first">
          {callFirst.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="Nothing pinned to call first"
              // One string rather than a body plus a description, because
              // `EmptyState` renders `body ?? description` and would silently
              // drop the second of the two. The remaining tags are only worth
              // naming once the reader has entries to put them on, which is
              // exactly when this page is otherwise a grid of tiles and nothing
              // else.
              body={
                homeIsUntagged
                  ? `Tag a contact "${ON_CALL_HOME_TAGS.callFirst}" and it appears here, as the first number of the shift. The rest of this page works the same way: "${ON_CALL_HOME_TAGS.switchboard}" for the switchboard row, "${ON_CALL_HOME_TAGS.ward}" for tonight's wards, "${ON_CALL_HOME_TAGS.pinned}" for the reminder.`
                  : `Tag a contact "${ON_CALL_HOME_TAGS.callFirst}" and it appears here, as the first number of the shift.`
              }
              testId="on-call-home-call-first-empty"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {callFirst.map((entry) => (
                <CallCard key={entry.id} entry={entry} now={now} />
              ))}
            </div>
          )}
          {switchboard ? <SwitchboardRow entry={switchboard} now={now} /> : null}
        </HomeModule>

        {recentEntries.length > 0 ? (
          <HomeModule
            id="on-call-home-recent"
            label="Recent"
            action={
              <button
                type="button"
                onClick={() => clearOnCallRecent()}
                data-testid="on-call-home-recent-clear"
                className={moduleAction}
              >
                <Trash2 aria-hidden="true" className="size-icon-xs" />
                Clear
              </button>
            }
          >
            <div className="grid gap-1.5">
              {recentEntries.map(({ item, entry }) => {
                // Same private treatment Contacts uses: a personal number does
                // not print on the home, even if the row itself is still named.
                const number = entry.isPersonal ? null : onCallPrimaryNumber(entry, now);
                const href = onCallTelHref(number?.value);
                const target = href ?? ON_CALL_SECTION_HREFS[entry.section];
                const at = timeLabel(item.at);
                const RecentIcon = ON_CALL_SECTION_ICONS[entry.section];
                return (
                  <a
                    key={item.id}
                    href={target}
                    onClick={() => recordOnCallRecent({ id: entry.id, title: entry.title })}
                    data-testid={`on-call-home-recent-${entry.slug}`}
                    className={cn(
                      cardSurface,
                      "flex min-h-tap items-center gap-2.5 px-3 no-underline",
                      "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
                      focusRing,
                    )}
                  >
                    {/* The section's own glyph, so a row is recognisable as a
                        contact, a service or a scenario before the title is
                        read — the drawing's leading icon. */}
                    <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
                      <RecentIcon aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
                    </span>
                    <span className="min-w-0 flex-1 grid gap-0.5">
                      <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
                        {entry.title}
                      </span>
                      {at ? <span className={cn(textMuted, "nums text-xs")}>{at}</span> : null}
                    </span>
                    {number ? (
                      <span className="grid shrink-0 justify-items-end gap-0.5">
                        <span className={cn(textMuted, "text-3xs font-bold uppercase tracking-kicker")}>
                          {number.label}
                        </span>
                        <span className="nums text-sm font-bold">{number.value}</span>
                      </span>
                    ) : null}
                    {/* A call affordance, not a control: the whole row already
                        dials, and a real button inside a link is invalid
                        markup that hands a screen reader two targets for one
                        action. The drawing's own `role="button"` here is a
                        drawing, not a contract. */}
                    {href ? (
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)]">
                        <Phone aria-hidden="true" className="size-icon-sm" />
                      </span>
                    ) : (
                      <ChevronRight
                        aria-hidden="true"
                        className="size-icon-sm shrink-0 text-[color:var(--text-muted)]"
                      />
                    )}
                  </a>
                );
              })}
            </div>
          </HomeModule>
        ) : null}

        {wards.length > 0 ? (
          <HomeModule
            id="on-call-home-wards"
            label="Your wards"
            action={
              <Link href={ON_CALL_SECTION_HREFS.contacts} className={moduleAction}>
                All contacts
                <ChevronRight aria-hidden="true" className="size-icon-xs" />
              </Link>
            }
          >
            {/* Scrolls inside its own container so the page body never scrolls
                sideways — the same treatment `ModeHomeTemplate` gives its pill
                row. */}
            <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:w-full sm:flex-wrap sm:px-0">
              {wards.map((entry) => (
                <WardChip key={entry.id} entry={entry} now={now} />
              ))}
            </div>
          </HomeModule>
        ) : null}

        {pinned ? (
          <HomeModule id="on-call-home-pinned-module" label="Remember">
            <PinnedReminder entry={pinned} />
          </HomeModule>
        ) : null}

        {upcoming.length > 0 ? (
          <HomeModule
            id="on-call-home-upcoming"
            label="Coming up"
            action={
              <Link href={ON_CALL_SECTION_HREFS.education} className={moduleAction}>
                All teaching
                <ChevronRight aria-hidden="true" className="size-icon-xs" />
              </Link>
            }
          >
            <OnCallTeachingStrip sessions={upcoming} />
          </HomeModule>
        ) : null}

        <HomeModule
          id="on-call-home-sections"
          label="All sections"
          action={
            <Link href="/on-call/card" className={moduleAction}>
              <Printer aria-hidden="true" className="size-icon-xs" />
              Printable card
            </Link>
          }
        >
          {loading && entries.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Loading your hub"
              body="Fetching the entries saved to this account."
              testId="on-call-home-loading"
            />
          ) : (
            // Two columns at phone width, as board 01 draws them. One column
            // made the home a very long scroll for a page whose whole promise
            // is that the thing you need is near the top.
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => {
                const TileIcon = tile.icon;
                return (
                  <Link
                    key={tile.key}
                    href={tile.href}
                    data-testid={`on-call-home-tile-${tile.key}`}
                    className={cn(
                      cardSurface,
                      cardPadding.compact,
                      "grid min-h-tap gap-1.5 no-underline",
                      "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
                      focusRing,
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <TileIcon aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
                      {/* A count, in ordinary ink. `Status never by colour alone`
                          cuts both ways: a number is not a status and must not be
                          painted like one. */}
                      {tile.count === null ? null : (
                        <span className="nums text-xs font-bold text-[color:var(--text-muted)]">{tile.count}</span>
                      )}
                    </span>
                    <span className="grid gap-0.5">
                      <span className="text-sm font-semibold text-[color:var(--text-heading)]">{tile.title}</span>
                      <span className={cn(textMuted, "text-xs")}>{tile.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </HomeModule>
      </InformationPageShell>
    </>
  );
}
