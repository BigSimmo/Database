"use client";

import { CalendarDays, ChevronRight, Phone, Shield, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { cardPadding, cardSurface, focusRing } from "@/components/card-recipes";
import { RegistryModeNav } from "@/components/mode-nav/registry-mode-nav";
import { InformationPageShell } from "@/components/information-page-shell";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { OnCallPageMenu } from "@/components/on-call/on-call-page-menu";
import {
  ON_CALL_SECTION_HREFS,
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TILE_DESCRIPTIONS,
  ON_CALL_SECTION_TITLES,
} from "@/components/on-call/on-call-section-identity";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { activeModeSecondaryNavigationId } from "@/lib/mode-secondary-navigation";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
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
  selectUpcomingSessions,
  selectWardContacts,
  type OnCallUpcomingSession,
} from "@/lib/on-call/home-modules";
import { clearOnCallRecent, useOnCallRecent } from "@/lib/on-call/recent-storage";

/**
 * The On Call home: a dashboard for the shift rather than a search box.
 *
 * `/on-call` used to redirect to the shared home at `/?mode=on-call`, which was
 * the one place in this mode a search composer appeared. The mode declares no
 * search surface — filter chips inside a page do the narrowing — so the redirect
 * was removed and this took its place. See
 * `docs/on-call/design/prototypes/on-call-screens.html`, board 01.
 *
 * Every module is derived from tags the owner controls (`src/lib/on-call/home-modules.ts`),
 * so what appears here is editable from inside the app. Each empty state names
 * the tag that fills it, which is how the convention is discovered.
 *
 * There is deliberately **no freshness warning on this page.** Overdue entries
 * surface on Contacts, where the row is and where the fix is one tap; a count of
 * stale entries on the home is a number you cannot act on from the home.
 */

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
function CallCard({ entry }: { entry: OnCallEntry }) {
  const number = onCallPrimaryNumber(entry);
  const href = onCallTelHref(number?.value);
  const availability = onCallAvailability(entry);
  if (!href || !number) return null;
  return (
    <a
      href={href}
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
        {availability ? (
          <span className="text-3xs font-bold uppercase tracking-kicker opacity-80">{availability}</span>
        ) : null}
      </span>
      <span className="grid gap-0.5">
        <span className="text-sm-minus font-semibold">{entry.title}</span>
        <span className="nums text-lg-minus font-bold tracking-display">{number.value}</span>
      </span>
    </a>
  );
}

function SwitchboardRow({ entry }: { entry: OnCallEntry }) {
  const number = onCallPrimaryNumber(entry);
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
      {number ? <span className="nums shrink-0 text-sm font-bold">{number.value}</span> : null}
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
    <a href={href} className={className} data-testid="on-call-home-switchboard">
      {content}
    </a>
  );
}

function WardChip({ entry }: { entry: OnCallEntry }) {
  const number = onCallPrimaryNumber(entry);
  const href = onCallTelHref(number?.value);
  if (!href || !number) return null;
  return (
    <a
      href={href}
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

function UpcomingRow({ session }: { session: OnCallUpcomingSession }) {
  const [year, month, day] = session.date.split("-");
  const detail = [session.when, session.location, session.presenter].filter(Boolean).join(" · ");
  return (
    <Link
      href={ON_CALL_SECTION_HREFS.education}
      data-testid={`on-call-home-upcoming-${session.entry.slug}`}
      className={cn(
        cardSurface,
        "flex min-h-tap items-center gap-2.5 px-3 no-underline",
        "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
        focusRing,
      )}
    >
      {/* A date, not a countdown: "Tue 16 Sep" is checkable against a roster in
          a way "in 4 days" is not. */}
      <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <span className="nums text-sm font-bold leading-none text-[color:var(--text-heading)]">{day}</span>
        <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
          {monthLabel(month, year)}
        </span>
      </span>
      <span className="min-w-0 flex-1 grid gap-0.5">
        <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{session.entry.title}</span>
        {detail ? <span className={cn(textMuted, "truncate text-xs")}>{detail}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
    </Link>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month abbreviation from a `YYYY-MM-DD` part, without constructing a Date —
 *  the string is already the answer, and parsing it would reintroduce a zone. */
function monthLabel(month: string | undefined, year: string | undefined): string {
  const index = Number(month) - 1;
  return MONTH_LABELS[index] ?? year ?? "";
}

/** A short local time for a recorded moment, e.g. "21:58". */
function timeLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${`${parsed.getHours()}`.padStart(2, "0")}:${`${parsed.getMinutes()}`.padStart(2, "0")}`;
}

export function OnCallHome() {
  const pathname = usePathname();
  const { entries, loading, isOffline, cachedAt } = useOnCallEntries();
  const recent = useOnCallRecent();

  const today = onCallLocalDateKey(new Date());
  const callFirst = useMemo(() => selectCallFirstContacts(entries), [entries]);
  const switchboard = useMemo(() => selectSwitchboardContact(entries), [entries]);
  const wards = useMemo(() => selectWardContacts(entries), [entries]);
  const pinned = useMemo(() => selectPinnedPlaybookEntry(entries), [entries]);
  const upcoming = useMemo(() => selectUpcomingSessions(entries, today), [entries, today]);
  const { counts, roleExplainers } = useMemo(() => countOnCallEntriesBySection(entries), [entries]);

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
      count: roleExplainers,
    },
  ];

  return (
    <>
      <RegistryModeNav modeId="on-call" activeId={activeModeSecondaryNavigationId("on-call", pathname)} />
      <OnCallPageMenu view="home" />
      <InformationPageShell testId="on-call-home-main">
        <h1 className="sr-only">On Call</h1>
        {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} /> : null}

        <HomeModule id="on-call-home-call-first" label="Call first">
          {callFirst.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="Nothing pinned to call first"
              body={`Tag a contact "${ON_CALL_HOME_TAGS.callFirst}" and it appears here, as the first number of the shift.`}
              testId="on-call-home-call-first-empty"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {callFirst.map((entry) => (
                <CallCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
          {switchboard ? <SwitchboardRow entry={switchboard} /> : null}
        </HomeModule>

        {wards.length > 0 ? (
          <HomeModule
            id="on-call-home-wards"
            label="Your wards"
            action={
              <Link
                href={ON_CALL_SECTION_HREFS.contacts}
                className={cn("text-xs font-semibold no-underline", focusRing)}
              >
                All contacts
              </Link>
            }
          >
            {/* Scrolls inside its own container so the page body never scrolls
                sideways — the same treatment `ModeHomeTemplate` gives its pill
                row. */}
            <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:w-full sm:flex-wrap sm:px-0">
              {wards.map((entry) => (
                <WardChip key={entry.id} entry={entry} />
              ))}
            </div>
          </HomeModule>
        ) : null}

        {pinned ? (
          <HomeModule id="on-call-home-pinned-module" label="Remember">
            <PinnedReminder entry={pinned} />
          </HomeModule>
        ) : null}

        {recentEntries.length > 0 ? (
          <HomeModule
            id="on-call-home-recent"
            label="Recent"
            action={
              <button
                type="button"
                onClick={() => clearOnCallRecent()}
                data-testid="on-call-home-recent-clear"
                className={cn(
                  "inline-flex min-h-6 items-center gap-1 rounded-sm px-1.5 text-xs font-semibold text-[color:var(--text-muted)]",
                  "transition-colors motion-reduce:transition-none hover:text-[color:var(--text-heading)]",
                  focusRing,
                )}
              >
                <Trash2 aria-hidden="true" className="size-icon-xs" />
                Clear
              </button>
            }
          >
            <div className="grid gap-1.5">
              {recentEntries.map(({ item, entry }) => {
                const number = onCallPrimaryNumber(entry);
                const href = onCallTelHref(number?.value);
                const target = href ?? ON_CALL_SECTION_HREFS[entry.section];
                const at = timeLabel(item.at);
                return (
                  <a
                    key={item.id}
                    href={target}
                    data-testid={`on-call-home-recent-${entry.slug}`}
                    className={cn(
                      cardSurface,
                      "flex min-h-tap items-center gap-2.5 px-3 no-underline",
                      "transition-colors motion-reduce:transition-none hover:border-[color:var(--border-strong)]",
                      focusRing,
                    )}
                  >
                    <span className="min-w-0 flex-1 grid gap-0.5">
                      <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
                        {entry.title}
                      </span>
                      {at ? <span className={cn(textMuted, "nums text-xs")}>{at}</span> : null}
                    </span>
                    {number ? <span className="nums shrink-0 text-sm font-bold">{number.value}</span> : null}
                    <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
                  </a>
                );
              })}
            </div>
          </HomeModule>
        ) : null}

        {upcoming.length > 0 ? (
          <HomeModule id="on-call-home-upcoming" label="Coming up">
            <div className="grid gap-1.5">
              {upcoming.map((session) => (
                <UpcomingRow key={session.entry.id} session={session} />
              ))}
            </div>
          </HomeModule>
        ) : null}

        <HomeModule id="on-call-home-sections" label="All sections">
          {loading && entries.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Loading your hub"
              body="Fetching the entries saved to this account."
              testId="on-call-home-loading"
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
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
                      <span className="nums text-xs font-bold text-[color:var(--text-muted)]">{tile.count}</span>
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
