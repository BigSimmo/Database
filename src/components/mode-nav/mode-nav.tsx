"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, type MouseEvent } from "react";

import { cn } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";

import { MODE_NAV_MIN_ITEMS, planModeNavBands } from "./mode-nav-bands";
import { ModeNavHeaderPortal } from "./mode-nav-portal";

export type ModeNavItem = {
  id: string;
  /** The only label. Never abbreviated — a slot shows its real word or folds into More. */
  label: string;
  /** A real URL. Never an onClick-only control: deep links, back and prefetch must work. */
  href: string;
  icon: LucideIcon;
  /**
   * State, not size: "3/4" for a basket that holds four, never "205" for a
   * catalogue. A total is noise on every screen; a fill is worth a glance.
   */
  count?: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--focus)]";

/** 48px hit area — matches `--spacing-tap`, clear of the `expectMinTouchTarget` rounding flake. */
const slotBase =
  "mode-nav__slot relative flex min-h-12 min-w-0 items-center justify-center px-3 no-underline transition-colors";

function SlotInk({
  icon: Icon,
  label,
  count,
  state,
  trailing,
}: {
  icon?: LucideIcon;
  label: string;
  count?: string;
  state: "on" | "trail" | "off";
  trailing?: boolean;
}) {
  return (
    <span
      className={cn(
        // One weight in every state. Bolding the active label changes its width,
        // which shifts the rule and every neighbour on each navigation.
        "relative flex h-5 min-w-0 items-center gap-2 text-sm-minus font-semibold tracking-[-0.008em]",
        // The 2px rule takes space at the bottom of the bar, so a centred label
        // sits optically high without this compensating offset.
        "mt-0.5",
        state === "on" ? "text-[color:var(--text-heading)]" : "text-[color:var(--text-muted)]",
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn(
            "h-[1.0625rem] w-[1.0625rem] shrink-0",
            state === "on"
              ? "text-[color:var(--clinical-accent)]"
              : state === "trail"
                ? "text-[color:var(--clinical-accent)]/55"
                : "opacity-70",
          )}
        />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      {count ? (
        <span
          className={cn(
            "nums grid h-[1.125rem] min-w-[1.125rem] shrink-0 place-items-center rounded-full border px-1.5 text-3xs font-bold leading-none",
            state === "on"
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
              : "border-[color:var(--border-strong)] text-[color:var(--text-soft)]",
          )}
        >
          {count}
        </span>
      ) : null}
      {trailing ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-55" /> : null}
      {/* The rule hangs off the ink, so it is exactly as wide as icon plus word:
          short under "Search", long under "Recommend". A rule sized to the
          padding box always looks a few pixels wrong. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 -bottom-[0.8125rem] rounded-t-[2px]",
          state === "on"
            ? "h-0.5 bg-[color:var(--clinical-accent)]"
            : state === "trail"
              ? "h-px bg-[color:var(--clinical-accent)]/35"
              : "h-0.5 bg-transparent",
        )}
      />
    </span>
  );
}

/**
 * Navigation for the pages of one mode, pinned inside the universal header.
 *
 * Only destinations belong here. Anything needing an already-selected record —
 * a therapy's brief intervention, its patient sheet — belongs on that record's
 * page; putting it in a bar is what let the old Therapy strip silently retarget
 * to a different therapy when the selected one had no artifact.
 *
 * Density is chosen by container width in `globals.css`; see the "Mode
 * navigation" block there for why the unit is `rem` rather than `px`.
 */
export function ModeNav({
  items,
  label,
  activeId,
  originId,
}: {
  items: ModeNavItem[];
  /** Names the landmark, e.g. "Therapy pages". */
  label: string;
  /** Defaults to the item whose href matches the current path. */
  activeId?: string;
  /** The page arrived from; marked with a half-weight trail while on a record. */
  originId?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The sheet has two openers and CSS decides which one exists: below a 16rem
  // container only the collapsed control is displayed, at 16rem and up only the
  // More slot is. Both stay in the DOM either way, so a ref pinned to one of
  // them hands the Sheet a `display: none` element to restore focus to half the
  // time — the browser refuses to focus it and the keyboard user is dropped on
  // <body>. Capture whichever button was actually clicked; by definition it is
  // the displayed one.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const openSheet = (event: MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setOpen(true);
  };
  const plan = useMemo(() => planModeNavBands(items.length), [items.length]);

  if (items.length < MODE_NAV_MIN_ITEMS) return null;

  // Record routes (`/therapy-compass/<slug>`) match no item, so nothing claims
  // to be the current page and the origin trail carries lineage instead.
  const derived = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const active = activeId ? items.find((item) => item.id === activeId) : derived;
  const activeIndex = active ? items.indexOf(active) : -1;

  // If the page you are on has folded into the overflow, More takes its label,
  // icon and rule rather than reading "More" with nothing active — and keeps
  // its chevron, so it is still obviously the way to the rest.
  const activeBand = activeIndex >= 0 ? plan.firstVisibleBand.get(activeIndex) : undefined;
  const moreCarriesActive = plan.moreUntil !== null && activeBand === undefined && activeIndex >= 0;

  const bar = (
    <nav
      aria-label={label}
      data-testid="mode-nav"
      className="mode-nav border-b border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      {/* Collapsed: the default, and the only state that cannot overflow. */}
      <div className="mode-nav__control px-4 pb-2.5 pt-1.5">
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex min-h-12 w-full items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 text-left text-sm-minus font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-lift)]",
            focusRing,
          )}
        >
          {active ? (
            <active.icon
              aria-hidden="true"
              className="h-[1.0625rem] w-[1.0625rem] text-[color:var(--clinical-accent)]"
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate">{active ? active.label : label}</span>
          {active ? (
            <span className="nums shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">
              {activeIndex + 1}/{items.length}
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
        </button>
      </div>

      {/* Enhanced: the bar, once the container can hold at least three slots.
          Left padding is the gutter minus the slot padding, so the INK aligns
          to the mark above it rather than the box. */}
      <ul className="mode-nav__bar h-12 items-stretch px-1">
        {items.map((item, index) => {
          const band = plan.firstVisibleBand.get(index);
          const isActive = item.id === active?.id;
          const isOrigin = !isActive && item.id === originId;
          return (
            <li
              key={item.id}
              data-band={band ?? "none"}
              className={cn(slotBase, focusRing, band ? undefined : "hidden")}
            >
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn("flex h-full w-full items-center justify-center rounded-lg no-underline", focusRing)}
              >
                <SlotInk
                  icon={item.icon}
                  label={item.label}
                  count={item.count}
                  state={isActive ? "on" : isOrigin ? "trail" : "off"}
                />
              </Link>
            </li>
          );
        })}
        {plan.moreUntil !== null ? (
          <li data-until={plan.moreUntil} className={cn(slotBase, "flex")}>
            <button
              type="button"
              onClick={openSheet}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cn("flex h-full w-full items-center justify-center rounded-lg", focusRing)}
            >
              <SlotInk
                icon={moreCarriesActive ? active?.icon : undefined}
                label={moreCarriesActive && active ? active.label : "More"}
                state={moreCarriesActive ? "on" : "off"}
                trailing
              />
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );

  return (
    <>
      <ModeNavHeaderPortal>{bar}</ModeNavHeaderPortal>
      {/* Portaled to the body so the sheet is never inside the collapsing grid:
          the scroll signal must not be able to hide an open dialog. */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        returnFocusRef={openerRef}
        portal
        testId="mode-nav-sheet"
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = item.id === active?.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-2.5 text-sm font-semibold no-underline",
                    focusRing,
                    isActive
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "h-[1.15rem] w-[1.15rem] shrink-0",
                      isActive && "text-[color:var(--clinical-accent)]",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count ? (
                    <span className="nums shrink-0 text-2xs font-bold text-[color:var(--text-soft)]">{item.count}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
