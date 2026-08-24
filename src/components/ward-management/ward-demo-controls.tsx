"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";

import styles from "./ward-demo-controls.module.css";

/**
 * Whole-branch review I3. Spec §2 decision 5 ("Does the clock move? Yes, with a jump-forward
 * control") and §5 ("+15 min, +1 hour … so a held bed can be watched expiring in seconds rather
 * than in an hour") are settled product decisions. `ADVANCE_CLOCK` and `RESET_SCENARIO` were
 * implemented and tested in the reducer from Task 3 onward but dispatched only from test-harness
 * buttons (`tests/ward-flow-clock-consistency.dom.test.tsx`'s `ClockAdvancer`) — no product
 * surface ever raised either event, so `bedHeldUntil` (always `now + 60`) could never actually be
 * watched expiring, the one thing §5 says the control exists to demonstrate.
 *
 * Mounted once in `ClinicalRail` (`ward-management-navigation.tsx`, next to `WardRoleSwitcher`),
 * so it is present on every `/ward-management/*` route without any per-screen wiring — the clock
 * is shared state, not a per-screen concern.
 *
 * **This must never be mistaken for a clinical action.** Three distinct signals carry that,
 * deliberately redundant rather than resting on any one of them:
 *   - A warning-toned trigger (`ward-demo-controls.module.css`'s own `--dc-warn` palette), not the
 *     role switcher's blue — the two controls sit side by side in the rail and must not read as
 *     one family.
 *   - A flask icon (`FlaskConical`) rather than a clock or gear — nothing in the rest of this
 *     phase uses it, so it carries no borrowed clinical meaning.
 *   - Every visible string says "demo" or "scenario", never "clinical" or a clinical verb, and the
 *     open menu leads with a notice sentence before any button is reachable.
 *
 * `ADVANCE_CLOCK`/`RESET_SCENARIO` carry no reducer precondition beyond the role check
 * (`ward-flow-reducer.ts`'s `case "ADVANCE_CLOCK"`/`case "RESET_SCENARIO"` — see `EVENT_ROLE`'s
 * `demo` role), so unlike every clinical control in this phase, these two buttons need no
 * `*BlockedReason` guard: raised with `role: "demo"`, the reducer can never refuse either.
 */
export function WardDemoControls() {
  const { now, dispatch } = useWardFlow();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function advance(minutes: number) {
    dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes });
  }

  function reset() {
    dispatch({ type: "RESET_SCENARIO", role: "demo", now });
    setOpen(false);
  }

  return (
    <div className={styles.demo} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        data-testid="ward-demo-controls-trigger"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="ward-demo-controls-menu"
        aria-label="Demo clock controls — not a clinical action"
        title="Demo clock controls — moves only the prototype's scenario clock, never a clinical action"
        onClick={() => setOpen((value) => !value)}
      >
        <FlaskConical aria-hidden="true" />
      </button>
      {open ? (
        <div id="ward-demo-controls-menu" className={styles.menu} role="menu" aria-label="Demo clock controls">
          <p className={styles.notice}>
            Demo tool, not part of the clinical record. Moves only this prototype&apos;s shared scenario clock.
          </p>
          <span className={styles.clockReadout} data-testid="ward-demo-clock-readout">
            Scenario clock: {formatInstant(now)}
          </span>
          <div className={styles.actionRow}>
            <button
              type="button"
              role="menuitem"
              data-testid="ward-demo-advance-15"
              className={styles.advanceButton}
              onClick={() => advance(15)}
            >
              +15 min
            </button>
            <button
              type="button"
              role="menuitem"
              data-testid="ward-demo-advance-60"
              className={styles.advanceButton}
              onClick={() => advance(60)}
            >
              +1 hour
            </button>
          </div>
          <div className={styles.resetRow}>
            <button
              type="button"
              role="menuitem"
              data-testid="ward-demo-reset"
              className={styles.resetButton}
              onClick={reset}
            >
              Reset scenario
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
