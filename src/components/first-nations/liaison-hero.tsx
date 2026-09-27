"use client";
import { Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { DayTrack } from "@/components/first-nations/day-track";
import { FnLiveStatus, type FnLiveTone } from "@/components/first-nations/kit";
import { NumberButton } from "@/components/first-nations/number-button";
import { systemClock, type Clock } from "@/lib/caring-contacts/clock";
import { telHref } from "@/lib/first-nations/contact-format";
import { callState, hoursInWords, type CallState } from "@/lib/first-nations/hours";
import type { HospitalView } from "@/lib/first-nations/view-model";

const SYSTEM_CLOCK = systemClock();

function status(state: CallState): { label: string; tone: FnLiveTone } {
  switch (state.kind) {
    case "open":
      return { label: "Open now", tone: "live" };
    case "closed":
      return state.opensAt
        ? {
            label: `Closed · opens ${state.opensOn === "today" ? "" : `${state.opensOn} `}${state.opensAt}`,
            tone: "muted",
          }
        : { label: "Closed", tone: "muted" };
    case "overdue":
      // Never "open" when the recheck is overdue, even inside the hours on file.
      return { label: "Due for a check", tone: "warning" };
    default:
      return { label: "Hours not confirmed", tone: "muted" };
  }
}

/**
 * The Bedside hero: whether the Aboriginal liaison team is open now, and whom to
 * call. The server render and first paint say "Hours not confirmed" (the clock
 * has not run yet); the first client tick settles the real state, and the green
 * dot pulses only on a later change to open.
 */
export function LiaisonHero({ hospital, clock = SYSTEM_CLOCK }: { hospital: HospitalView; clock?: Clock }) {
  const [state, setState] = useState<CallState>({ kind: "unconfirmed" });
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => {
      const current = clock.now();
      setNow(current);
      setState(callState(hospital.liaison.hours ?? undefined, hospital.liaison.checkedAt, current));
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [clock, hospital]);

  const { label, tone } = status(state);
  const open = state.kind === "open";
  const target = open ? hospital.liaison : hospital.switchboard;
  const targetHref = telHref(target.number);
  // A number that cannot be dialled (for example "See website") shows as text, never a call control.
  const liaisonNumber = (className: string) =>
    telHref(hospital.liaison.number) ? (
      <NumberButton contact={hospital.liaison} className={className} />
    ) : (
      <span className={className}>{hospital.liaison.number}</span>
    );
  const hoursLine = hospital.liaison.hours ? hoursInWords(hospital.liaison.hours) : "Hours not set";

  return (
    <section
      aria-labelledby="fn-liaison-title"
      data-fn-part="hero"
      className="grid gap-2 rounded-2xl border border-[color:var(--surface-summary-line)] bg-[color:var(--surface-summary)] p-3 text-[color:var(--surface-summary-ink)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="fn-liaison-title"
          className="text-2xs font-semibold uppercase tracking-label text-[color:var(--surface-summary-muted)]"
        >
          Aboriginal liaison
        </h2>
        <p className="text-sm-minus">
          <FnLiveStatus tone={tone} settled={now !== null}>
            {label}
          </FnLiveStatus>
        </p>
      </div>
      {/* Design SPEC §9.2: the visible status is plain content; this hidden announcer speaks its changes. */}
      <span role="status" className="sr-only">
        {now ? `Aboriginal liaison: ${label}` : ""}
      </span>
      <p data-testid="fn-hero-figure" className="fn-display-36 break-words">
        <span className="text-sm-minus font-normal text-[color:var(--surface-summary-muted)]">
          {open ? "until " : "switchboard "}
        </span>
        <span>{state.kind === "open" ? state.closesAt : hospital.switchboard.number}</span>
      </p>
      {now ? <DayTrack hours={hospital.liaison.hours} now={now} label={`${hoursLine}; ${label}`} /> : null}
      <p className="text-sm-minus text-[color:var(--surface-summary-muted)]">{hoursLine}</p>
      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--surface-summary-line)] pt-2">
        <div className="grid min-w-0 text-sm-minus text-[color:var(--surface-summary-muted)]">
          {open ? (
            <>
              {liaisonNumber("text-lg-minus text-[color:var(--surface-summary-ink)]")}
              <span>After hours, switchboard {hospital.switchboard.number}</span>
            </>
          ) : (
            <>
              <span>
                {state.kind === "overdue" ? "Liaison hours need a recheck" : "Ask who covers liaison tonight"}
              </span>
              <span>Liaison {liaisonNumber("text-[color:var(--surface-summary-ink)]")}</span>
            </>
          )}
        </div>
        {targetHref ? (
          <a
            href={targetHref}
            aria-label={`Call ${target.name}`}
            data-fn-filled=""
            className="grid size-12 shrink-0 place-items-center rounded-full bg-[color:var(--surface-summary-ink)] text-[color:var(--surface-summary)]"
          >
            <Phone className="size-icon-md" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
