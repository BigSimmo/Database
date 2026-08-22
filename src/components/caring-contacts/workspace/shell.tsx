import { CalendarDays, FileText, HeartHandshake, LayoutDashboard, MoreHorizontal, Users } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";

import { UnavailableDestination } from "./unavailable-destination";

/**
 * The safeguard wording, repeated verbatim from the frozen prototype baseline.
 *
 * It is redeclared here rather than imported: production may never import from
 * the frozen prototype tree, and `tests/caring-contact-route-files.test.ts`
 * holds that separation in both directions — including against a mere mention
 * of the prototype's path, which is why this comment names it in words only.
 * Rendering the marker as visible text on every screen — not as a tooltip
 * alone — is what makes listing this workspace in the live tools catalogue
 * defensible: every patient in it is invented.
 */
export const FICTIONAL_DATA_MARKER = "Synthetic prototype — fictional data only";

/** The anchor the phone "More" destination jumps to. */
const MORE_DESTINATIONS_ID = "caring-contacts-more";

type NavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The four primary destinations, frozen by the approved route identities.
 * Only `Today` has a page in Phase 2A; Plan 2B builds the other three, and the
 * More panel below states that in plain words in the meantime.
 */
const primaryDestinations: readonly { label: string; href: string; icon: NavigationIcon }[] = [
  { label: "Today", href: CARING_CONTACTS_ROUTES.today, icon: LayoutDashboard },
  { label: "Patients", href: CARING_CONTACTS_ROUTES.patients, icon: Users },
  { label: "Schedule", href: CARING_CONTACTS_ROUTES.schedule, icon: CalendarDays },
  { label: "Templates", href: CARING_CONTACTS_ROUTES.templates, icon: FileText },
];

/** The phone bar carries three destinations plus a jump to the More panel. */
const phoneDestinations = primaryDestinations.filter((destination) => destination.label !== "Templates");

/**
 * Every declared destination that has no page yet, with what it will hold.
 * `docs/wiring-conventions.md` requires the reason to be stated, not implied.
 */
const unbuiltDestinations: readonly { id: string; label: string; reason: string }[] = [
  { id: "new-plan", label: "New plan", reason: "Starting a caring-contact plan for a patient." },
  { id: "team", label: "Team", reason: "Ownership, capacity and unclaimed work." },
  { id: "guidance", label: "Guidance", reason: "Programme boundaries and operational guidance." },
  { id: "reports", label: "Reports", reason: "Aggregate operational reporting." },
  { id: "service-stop", label: "Service stop", reason: "Stopping the whole service, and restarting it." },
  { id: "access-trail", label: "Access trail", reason: "Who opened which record, and when." },
  { id: "workload", label: "Workload", reason: "Work waiting across the team." },
  { id: "reconciliation", label: "Reconciliation", reason: "Differences between what was planned and what happened." },
  { id: "notifications", label: "Notifications", reason: "What the team is told, and how." },
  { id: "training", label: "Training", reason: "Practice mode, kept apart from real records." },
  { id: "coverage", label: "Coverage", reason: "Who is covering while someone is away." },
];

export type CaringContactsShellProps = {
  /** The screen's own name; rendered as the one and only `h1`. */
  title: string;
  /** Optional plain-words statement of what this screen is for. */
  description?: string;
  children: ReactNode;
};

const navigationItemClass =
  "flex min-h-tap min-w-0 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none";

const phoneItemClass =
  "flex min-h-tap min-w-0 flex-col items-center justify-center gap-1 px-1 text-2xs font-medium text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-0.125rem] focus-visible:outline-[color:var(--focus)]";

/**
 * The Caring Contacts workspace shell.
 *
 * A Server Component by design. The four width states of coordination design
 * spec §7 are expressed entirely in Tailwind media classes, so the layout needs
 * no JavaScript at all:
 *
 * | state   | width       | classes                                          |
 * | ------- | ----------- | ------------------------------------------------ |
 * | compact | below 768   | base — phone bar, no rail, one column            |
 * | rail    | 768-1023    | `md:` — icon rail, labels kept for screen readers |
 * | split   | 1024-1439   | `lg:` — labelled rail, More panel as a column    |
 * | wide    | 1440 and up | `xl:` — the same split at a wider measure        |
 *
 * `width-state.ts` holds the same boundaries as numbers for the overlay
 * modality decision; nothing here re-derives them.
 */
export function CaringContactsShell({ title, description, children }: CaringContactsShellProps) {
  return (
    <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)] md:flex">
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface-chrome)] md:flex md:w-20 lg:w-64">
        <div className="flex min-h-[var(--header-h)] items-center gap-3 border-b border-[color:var(--border)] px-4 lg:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] forced-colors:border forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]">
            <HeartHandshake aria-hidden="true" className="size-icon-lg" />
          </span>
          <span className="sr-only min-w-0 lg:not-sr-only">
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
              Caring Contacts
            </span>
          </span>
        </div>

        <nav aria-label="Workspace" className="mt-3 flex flex-1 flex-col gap-1 px-3">
          {primaryDestinations.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} data-internal-link="true" className={navigationItemClass}>
              <Icon aria-hidden="true" className="size-icon-lg shrink-0" />
              <span className="truncate sr-only lg:not-sr-only">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[var(--z-raised)] border-b border-[color:var(--border)] bg-[color:var(--surface-chrome)] px-4 sm:px-6 lg:px-8 forced-colors:bg-[Canvas]">
          <div className="flex min-h-[var(--header-h)] flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex min-w-0 items-center gap-3 md:hidden">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] forced-colors:border forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]">
                <HeartHandshake aria-hidden="true" className="size-icon-lg" />
              </span>
              <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Caring Contacts</span>
            </div>
            <span
              data-testid="caring-contacts-synthetic-marker"
              className="ml-auto inline-flex items-center rounded-[var(--radius-sm)] border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 py-1 text-2xs font-semibold text-[color:var(--clinical-accent)] sm:text-xs forced-colors:border-[CanvasText]"
            >
              {FICTIONAL_DATA_MARKER}
            </span>
          </div>
        </header>

        <main className="min-w-0 px-4 pb-28 pt-5 sm:px-6 sm:pt-7 md:pb-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl xl:max-w-[90rem]">
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
              <div className="min-w-0">
                <div className="mb-6 border-b border-[color:var(--border)] pb-5">
                  <h1 className="text-[length:var(--text-hero)] font-semibold leading-[var(--text-hero--line-height)] tracking-[var(--text-hero-tr)] text-[color:var(--text-heading)]">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
                      {description}
                    </p>
                  ) : null}
                </div>
                {children}
              </div>

              <section
                id={MORE_DESTINATIONS_ID}
                aria-labelledby={`${MORE_DESTINATIONS_ID}-heading`}
                className="mt-10 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:mt-0"
              >
                <h2
                  id={`${MORE_DESTINATIONS_ID}-heading`}
                  className="text-sm font-semibold text-[color:var(--text-heading)]"
                >
                  More destinations
                </h2>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                  These destinations are planned. Each one states what it will hold once it is built.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {unbuiltDestinations.map((destination) => (
                    <UnavailableDestination key={destination.id} {...destination} />
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </main>
      </div>

      <nav
        aria-label="Phone workspace"
        className="fixed inset-x-0 bottom-0 z-[var(--z-chrome)] grid grid-cols-4 border-t border-[color:var(--border)] bg-[color:var(--surface-chrome)] pb-[var(--safe-area-bottom)] md:hidden"
      >
        {phoneDestinations.map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href} data-internal-link="true" className={phoneItemClass}>
            <Icon aria-hidden="true" className="size-icon-lg shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        {/*
          An in-page jump, not a route: the More panel is rendered in this same
          document, so this is deliberately a fragment anchor rather than a
          `<Link>`. The internal-navigation rule covers `href="/…"` targets.
        */}
        <a href={`#${MORE_DESTINATIONS_ID}`} className={phoneItemClass}>
          <MoreHorizontal aria-hidden="true" className="size-icon-lg shrink-0" />
          <span className="truncate">More</span>
        </a>
      </nav>
    </div>
  );
}
