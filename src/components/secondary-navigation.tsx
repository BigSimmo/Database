"use client";

import Link from "next/link";
import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/components/ui-primitives";
import { resolveScrollBehavior } from "@/lib/scroll-behavior";

const SecondaryNavigationShellHostContext = createContext<HTMLElement | null>(null);

export function SecondaryNavigationShellHostProvider({
  host,
  children,
}: {
  host: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <SecondaryNavigationShellHostContext.Provider value={host}>{children}</SecondaryNavigationShellHostContext.Provider>
  );
}

type SecondaryNavigationBaseItem = {
  id: string;
  elementId?: string;
  label: string;
  shortLabel?: string;
  icon?: ReactNode;
};

export type SecondaryNavigationRouteItem = SecondaryNavigationBaseItem & {
  kind: "route";
  href: string;
  current?: boolean;
};

/**
 * No live consumer as of the mode-strip removal. The seven modes that built
 * action items each registered a single entry that focused an already-visible
 * composer, and those were deleted; `therapy-compass` still declares action
 * entries but `PageSecondaryNavigation` early-returns on `/therapy-compass*`
 * before reading them.
 *
 * Kept deliberately rather than deleted alongside them: the kind carries the
 * `tablist` roving-focus behaviour and is covered directly by
 * `tests/secondary-navigation.dom.test.tsx`, so this is component API with
 * tests, not orphaned code. Removing it is a clean separate change — do not do
 * half of each. Note it is invisible to `check:knip`, which runs without
 * `--include exports`.
 */
export type SecondaryNavigationActionItem = SecondaryNavigationBaseItem & {
  kind: "action";
  onSelect: () => void;
  current?: boolean;
  controlsId?: string;
  disabled?: boolean;
};

export type SecondaryNavigationItem = SecondaryNavigationRouteItem | SecondaryNavigationActionItem;

export function SecondaryNavigation({
  ariaLabel,
  items,
  activeId,
  sticky = true,
  stickyTop = 0,
  tablist = false,
  placeInShell = false,
  className,
}: {
  ariaLabel: string;
  items: readonly SecondaryNavigationItem[];
  activeId?: string;
  sticky?: boolean;
  stickyTop?: number | string;
  tablist?: boolean;
  placeInShell?: boolean;
  className?: string;
}) {
  const shellHost = useContext(SecondaryNavigationShellHostContext);
  const effectiveSticky = sticky && !(placeInShell && shellHost);
  const navigationRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const resolvedActiveId = activeId;
  const itemRefs = useRef(new Map<string, HTMLElement>());

  // Keep the active chip in the horizontal rail without calling scrollIntoView —
  // block:"nearest" also adjusts the page vertically when the bar is off-screen,
  // which yanks readers back to the top as they scroll through long records.
  useEffect(() => {
    if (!resolvedActiveId) return;
    const item = itemRefs.current.get(resolvedActiveId);
    const rail = railRef.current;
    if (!item || !rail) return;
    const railRect = rail.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const overflowLeft = itemRect.left - railRect.left;
    const overflowRight = itemRect.right - railRect.right;
    if (overflowLeft >= 0 && overflowRight <= 0) return;
    const nextLeft = rail.scrollLeft + (overflowLeft < 0 ? overflowLeft : overflowRight);
    if (typeof rail.scrollTo === "function") {
      rail.scrollTo({ left: nextLeft, behavior: resolveScrollBehavior() });
    } else {
      rail.scrollLeft = nextLeft;
    }
  }, [placeInShell, resolvedActiveId, shellHost]);

  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!tablist) return;
    const enabled = items.filter((item) => item.kind === "action" && !item.disabled);
    const activeIndex = enabled.findIndex((item) => item.id === resolvedActiveId);
    const index = activeIndex >= 0 ? activeIndex : 0;
    const next =
      event.key === "ArrowRight"
        ? enabled[(index + 1 + enabled.length) % enabled.length]
        : event.key === "ArrowLeft"
          ? enabled[(index - 1 + enabled.length) % enabled.length]
          : event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : null;
    if (!next || next.kind !== "action") return;
    event.preventDefault();
    next.onSelect();
    itemRefs.current.get(next.id)?.focus();
  }

  if (!items.length) return null;

  const itemClass = (selected: boolean) =>
    cn(
      "inline-flex min-h-tap shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-sm",
      selected
        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] forced-colors:outline forced-colors:outline-2 forced-colors:[outline-color:Highlight]"
        : "border-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]",
    );

  const navigation = (
    <nav
      ref={navigationRef}
      aria-label={ariaLabel}
      data-testid="secondary-navigation"
      style={effectiveSticky ? { top: stickyTop } : undefined}
      className={cn(
        "secondary-navigation isolate z-20 w-full border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl",
        effectiveSticky && "sticky top-0 transition-[top] motion-reduce:transition-none",
        className,
      )}
    >
      <div
        ref={railRef}
        role={tablist ? "tablist" : undefined}
        aria-label={tablist ? ariaLabel : undefined}
        onKeyDown={handleTabKeyDown}
        className="polished-scroll mx-auto flex min-h-14 max-w-7xl items-center gap-1 overflow-x-auto overscroll-x-contain px-3 py-1.5 sm:px-5 lg:px-8"
      >
        {items.map((item) => {
          const selected = item.id === resolvedActiveId || Boolean(item.current);
          const label = (
            <>
              {item.icon}
              {item.shortLabel ? (
                <>
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </>
              ) : (
                <span>{item.label}</span>
              )}
            </>
          );
          const setRef = (element: HTMLElement | null) => {
            if (element) itemRefs.current.set(item.id, element);
            else itemRefs.current.delete(item.id);
          };

          if (item.kind === "route") {
            return (
              <Link
                key={item.id}
                ref={setRef as (element: HTMLAnchorElement | null) => void}
                href={item.href}
                aria-label={item.shortLabel ? item.label : undefined}
                aria-current={selected ? "page" : undefined}
                className={itemClass(selected)}
              >
                {label}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              ref={setRef as (element: HTMLButtonElement | null) => void}
              type="button"
              role={tablist ? "tab" : undefined}
              id={
                tablist
                  ? (item.elementId ?? `${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${item.id}`)
                  : undefined
              }
              aria-current={!tablist && selected ? "page" : undefined}
              aria-label={item.shortLabel ? item.label : undefined}
              aria-selected={tablist ? selected : undefined}
              aria-controls={item.controlsId}
              tabIndex={tablist ? (selected ? 0 : -1) : undefined}
              disabled={item.disabled}
              onClick={item.onSelect}
              className={itemClass(selected)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  return placeInShell && shellHost ? createPortal(navigation, shellHost) : navigation;
}
