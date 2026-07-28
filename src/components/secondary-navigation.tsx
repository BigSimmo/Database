"use client";

import Link from "next/link";
import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/components/ui-primitives";
import { resolveScrollBehavior } from "@/lib/scroll-behavior";

const secondaryNavigationSectionSelectEvent = "secondary-navigation:section-select";
// Page sections use the repository's shared scroll-mt-20 (80px) offset below
// the pinned navigation. Match that clearance so a section aligned by a
// fragment click counts as current at the same point it becomes readable.
const sectionActivationClearance = 80;
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

export type SecondaryNavigationSectionItem = SecondaryNavigationBaseItem & {
  kind: "section";
  targetId: string;
  /** Stable URL fragment when the rendered target differs across breakpoints. */
  fragmentId?: string;
};

export type SecondaryNavigationActionItem = SecondaryNavigationBaseItem & {
  kind: "action";
  onSelect: () => void;
  current?: boolean;
  controlsId?: string;
  disabled?: boolean;
};

export type SecondaryNavigationItem =
  SecondaryNavigationRouteItem | SecondaryNavigationSectionItem | SecondaryNavigationActionItem;

function nearestScrollOwner(element: HTMLElement): HTMLElement | Window {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight + 1) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

function sectionFragmentId(item: SecondaryNavigationSectionItem): string {
  return item.fragmentId ?? item.targetId;
}

function useActiveSection(
  items: readonly SecondaryNavigationSectionItem[],
  navigationRef: { readonly current: HTMLElement | null },
): string | null {
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return items[0]?.id ?? null;
    const hash = window.location.hash.slice(1);
    return items.find((item) => sectionFragmentId(item) === hash)?.id ?? items[0]?.id ?? null;
  });
  const signature = items.map((item) => `${item.id}:${item.targetId}:${sectionFragmentId(item)}`).join("|");

  useEffect(() => {
    const sections = items
      .map((item) => ({ item, element: document.getElementById(item.targetId) }))
      .filter((entry): entry is { item: SecondaryNavigationSectionItem; element: HTMLElement } =>
        Boolean(entry.element),
      );
    if (!sections.length) return undefined;

    const owners = new Set<HTMLElement | Window>(sections.map((section) => nearestScrollOwner(section.element)));
    let frame = 0;
    let settleTimer = 0;
    const evaluate = () => {
      frame = 0;
      const activationLine =
        Math.max(0, navigationRef.current?.getBoundingClientRect().bottom ?? 56) + sectionActivationClearance;
      const positioned = sections
        .map((section) => ({ ...section, top: section.element.getBoundingClientRect().top }))
        .sort((left, right) => left.top - right.top);
      const next =
        positioned.filter((section) => section.top <= activationLine).at(-1)?.item.id ?? positioned[0].item.id;
      setActiveId((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(evaluate);
      window.clearTimeout(settleTimer);
      // The universal chrome animates after the scroll direction changes.
      // Re-evaluate once that movement settles so the activation line follows
      // the navigation bar's final viewport position.
      settleTimer = window.setTimeout(evaluate, 280);
    };
    const alignCurrentFragment = () => {
      const targetId = window.location.hash.slice(1);
      const section = sections.find((entry) => sectionFragmentId(entry.item) === targetId);
      if (!section) return false;
      if (section.element instanceof HTMLDetailsElement) section.element.open = true;
      setActiveId(section.item.id);
      section.element.scrollIntoView({ behavior: "auto", block: "start" });
      return true;
    };
    const onHistoryNavigation = () => {
      if (!alignCurrentFragment()) onScroll();
    };
    const onSectionSelect = (event: Event) => {
      const targetId = (event as CustomEvent<string>).detail;
      const section = sections.find((entry) => entry.item.targetId === targetId);
      if (section) setActiveId(section.item.id);
    };
    owners.forEach((owner) => owner.addEventListener("scroll", onScroll, { passive: true }));
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("popstate", onHistoryNavigation);
    window.addEventListener("hashchange", onHistoryNavigation);
    window.addEventListener(secondaryNavigationSectionSelectEvent, onSectionSelect);
    const initialFragmentFrame = window.requestAnimationFrame(() => {
      if (!alignCurrentFragment()) evaluate();
    });
    return () => {
      owners.forEach((owner) => owner.removeEventListener("scroll", onScroll));
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("popstate", onHistoryNavigation);
      window.removeEventListener("hashchange", onHistoryNavigation);
      window.removeEventListener(secondaryNavigationSectionSelectEvent, onSectionSelect);
      window.cancelAnimationFrame(initialFragmentFrame);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [items, signature]);

  return activeId;
}

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
  const sectionItems = useMemo(
    () => items.filter((item): item is SecondaryNavigationSectionItem => item.kind === "section"),
    [items],
  );
  const navigationRef = useRef<HTMLElement | null>(null);
  const observedSectionId = useActiveSection(sectionItems, navigationRef);
  const resolvedActiveId = activeId ?? observedSectionId;
  const itemRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!resolvedActiveId) return;
    itemRefs.current
      .get(resolvedActiveId)
      ?.scrollIntoView({ behavior: resolveScrollBehavior(), block: "nearest", inline: "nearest" });
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
        role={tablist ? "tablist" : undefined}
        aria-label={tablist ? ariaLabel : undefined}
        onKeyDown={handleTabKeyDown}
        className="polished-scroll mx-auto flex min-h-14 max-w-7xl items-center gap-1 overflow-x-auto overscroll-x-contain px-3 py-1.5 sm:px-5 lg:px-8"
      >
        {items.map((item) => {
          const selected = item.id === resolvedActiveId || (item.kind !== "section" && Boolean(item.current));
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

          if (item.kind === "section") {
            const fragmentId = sectionFragmentId(item);
            return (
              <a
                key={item.id}
                ref={setRef as (element: HTMLAnchorElement | null) => void}
                href={`#${fragmentId}`}
                aria-label={item.shortLabel ? item.label : undefined}
                aria-current={selected ? "location" : undefined}
                className={itemClass(selected)}
                onClick={(event) => {
                  const target = document.getElementById(item.targetId);
                  if (!target) return;
                  event.preventDefault();
                  if (target instanceof HTMLDetailsElement) target.open = true;
                  // Preserve Next's app-router history metadata so fragment
                  // back/forward does not detach the entry from its route tree.
                  window.history.pushState(window.history.state, "", `#${fragmentId}`);
                  window.dispatchEvent(
                    new CustomEvent<string>(secondaryNavigationSectionSelectEvent, { detail: item.targetId }),
                  );
                  target.scrollIntoView({ behavior: resolveScrollBehavior(), block: "start" });
                }}
              >
                {label}
              </a>
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
