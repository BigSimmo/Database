"use client";

import { ChevronUp, Scale, Trash2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { interactiveRowBase } from "@/components/ui/interactive-row";
import { Sheet } from "@/components/ui/sheet";
import { cn, ignoreUnavailableActivation } from "@/components/ui-primitives";
import { therapyCompareAddonSlotId } from "@/lib/mode-home-composer";
import { THERAPY_MAX_COMPARE, therapyScreenHref } from "@/lib/therapy-compass-navigation";

import { useTcBindings } from "./bindings";
import type { Therapy } from "./data/types";

const SLOT_LETTERS = ["A", "B", "C", "D"] as const;

/**
 * The phone compare tray, docked above the therapy search composer.
 *
 * It is NOT independently fixed-positioned. Like `PatientDetailsDockAction` it
 * portals into a slot *inside* the phone dock's form, so it inherits the dock's
 * `position: fixed`, z-index, safe-area padding and — the whole point — its
 * scroll-hide transform. No second scroll listener, no bottom-offset
 * arithmetic: the composer hides, the tray hides with it.
 *
 * Two rules this component must not break:
 *
 * - **Exactly one row tall, always.** The dock's content clearance is a static
 *   token (`--phone-dock-therapy-compare-clearance`), so a dock that grows
 *   covers page content by exactly its own growth. That is why the expanded
 *   state is a bottom `Sheet` rather than the growing bar the prototype drew.
 * - **Nothing rendered when the set is empty.** The shell only claims the addon
 *   slot when the URL carries a compare set, and the reserve inflates on claim.
 *   The two conditions have to agree or the page gets a blank band.
 *
 * The gate is 639px, matching the dock (`.phone-footer-layer` is `sm:fixed`),
 * deliberately not the 1023px the Differentials Compare bar uses — above 640px
 * that bar renders into a slot on a form that is not fixed.
 */
export function TherapyCompareTray() {
  const b = useTcBindings();
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetId = useId();

  const items = b.compareTherapies;
  const count = items.length;

  useEffect(() => {
    const phoneMediaQuery = window.matchMedia("(max-width: 639px)");
    let observer: MutationObserver | null = null;

    const syncHost = () => setHost(document.getElementById(therapyCompareAddonSlotId));

    const attachObserver = () => {
      if (observer) return;
      observer = new MutationObserver(syncHost);
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const detachObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    const onMediaChange = () => {
      if (phoneMediaQuery.matches) {
        syncHost();
        attachObserver();
      } else {
        setHost(null);
        detachObserver();
      }
    };

    onMediaChange();
    phoneMediaQuery.addEventListener("change", onMediaChange);
    return () => {
      phoneMediaQuery.removeEventListener("change", onMediaChange);
      detachObserver();
    };
  }, []);

  // An emptied tray does not exist, so the sheet that belongs to it cannot be
  // open. Adjusting state during render rather than in an effect (the React
  // documented alternative) means a later re-add opens with the sheet closed.
  if (sheetOpen && count === 0) setSheetOpen(false);
  const open = sheetOpen && count > 0;

  const landed = useArrivalSlot(b.compareSlugs);

  // The compare page owns selection in its top chrome; duplicating the dock tray
  // there wastes reserve and splits one mental model across two surfaces.
  if (pathname === therapyScreenHref("compare")) return null;

  if (count === 0 || !host) return null;

  const readyToCompare = count >= 2;

  return (
    <>
      {createPortal(
        <div data-testid="therapy-compare-tray" className="therapy-compare-tray">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={sheetId}
            data-testid="therapy-compare-tray-open"
            aria-label={`Compare tray, ${count} of ${THERAPY_MAX_COMPARE} selected`}
            className={cn(interactiveRowBase, "therapy-compare-tray__summary")}
          >
            <span className="therapy-compare-tray__pips" aria-hidden="true">
              {Array.from({ length: THERAPY_MAX_COMPARE }, (_, index) => (
                <span
                  key={index}
                  data-filled={index < count ? "true" : undefined}
                  data-landed={landed === index ? "true" : undefined}
                  className="therapy-compare-tray__pip"
                >
                  {index < count ? SLOT_LETTERS[index] : ""}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="therapy-compare-tray__names">
                {count === 1 ? `${shortTherapyName(items[0])} — add one more` : items.map(shortTherapyName).join(" · ")}
              </span>
              <span className="therapy-compare-tray__count">
                {count} of {THERAPY_MAX_COMPARE} selected
              </span>
            </span>
            <ChevronUp aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          </button>
          <Button
            // The one filled action in the dock — but only once there is a
            // comparison to open. `aria-disabled` rather than native `disabled`
            // keeps the tab stop, so the reason in the title stays reachable.
            variant={readyToCompare ? "primary" : "secondary"}
            size="sm"
            icon={Scale}
            className="shrink-0"
            onClick={readyToCompare ? () => b.goCompare() : ignoreUnavailableActivation}
            aria-disabled={readyToCompare ? undefined : true}
            title={readyToCompare ? undefined : "Add one more therapy to compare"}
            testId="therapy-compare-tray-compare"
          >
            Compare
          </Button>
        </div>,
        host,
      )}
      <Sheet
        id={sheetId}
        open={open}
        onClose={() => setSheetOpen(false)}
        title="Compare tray"
        description={`${count} of ${THERAPY_MAX_COMPARE} therapies selected.`}
        mobilePlacement="bottom"
        testId="therapy-compare-tray-sheet"
      >
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((therapy, index) => (
            <li
              key={therapy.slug}
              className="flex items-center gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5"
            >
              <span aria-hidden="true" className="therapy-compare-tray__pip" data-filled="true">
                {SLOT_LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">
                {therapy.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                className="shrink-0"
                onClick={() => {
                  // Removing the last one empties the tray; close with it
                  // rather than leaving a dialog over nothing.
                  if (count <= 1) setSheetOpen(false);
                  b.removeCompare(therapy.slug);
                }}
                aria-label={`Remove ${therapy.name} from the comparison`}
              >
                <span className="sr-only">Remove</span>
              </Button>
            </li>
          ))}
        </ul>
        {count === 1 ? (
          <p className="mt-2 mb-0 text-xs font-semibold text-[color:var(--text-muted)]">
            Add one more to compare. Up to {THERAPY_MAX_COMPARE}.
          </p>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          className="mt-3"
          onClick={() => {
            setSheetOpen(false);
            b.clearCompare();
          }}
        >
          Empty the tray
        </Button>
      </Sheet>
    </>
  );
}

/**
 * Which slot just gained a therapy, or null.
 *
 * Derived from the set itself rather than reported by whatever added it, so the
 * pip animates whichever control was used — a result card, a record button, a
 * restored set — without any of them needing to know the tray exists.
 */
function useArrivalSlot(slugs: readonly string[]): number | null {
  const previous = useRef<readonly string[]>(slugs);
  const [landed, setLanded] = useState<number | null>(null);

  useEffect(() => {
    const grew = slugs.length > previous.current.length;
    previous.current = slugs;
    if (!grew) return;
    setLanded(slugs.length - 1);
    const timer = window.setTimeout(() => setLanded(null), 400);
    return () => window.clearTimeout(timer);
  }, [slugs]);

  return landed;
}

/**
 * The tray is one line wide, so it shows the record's own abbreviation where it
 * has a short one ("CBT", "EMDR") and the full name otherwise. Truncation is
 * left to CSS — cutting a therapy name mid-word in JS reads as a data error.
 */
function shortTherapyName(therapy: Therapy | undefined): string {
  if (!therapy) return "";
  const alias = therapy.aliases.map((value) => value.trim()).find((value) => value.length > 0 && value.length <= 10);
  return alias ?? therapy.name;
}
