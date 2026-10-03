"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { focusRing } from "@/components/card-recipes";
import { modeSummaryHairline, modeSummaryMutedText, modeSummarySurface } from "@/components/mode-kit/recipes";
import { OnCallDialRow } from "@/components/on-call/kit/dial-row";
import { OnCallRow } from "@/components/on-call/kit/grouped-list";
import { modeInsetHairline, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { OnCallStateLabel } from "@/components/on-call/kit/state-label";
import { modeHeadingText, modeNameText, modeNumberText } from "@/components/mode-kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import type { OnCallPeriod } from "@/lib/on-call/number-resolver";
import { onCallHoursTrack, type OnCallHospitalHours } from "@/lib/on-call/now-rows";

/**
 * The kit rows draw in `--text-heading`, `--text`, `--text-muted`, `--border`
 * and the `--command` disc. Inside the dark summary panel those are re-pointed
 * at the `--surface-summary*` tokens (standard v13.3), so the same rows read
 * light-on-dark in both themes and the call disc becomes the light disc a dark
 * surface needs, rather than vanishing into it. Sheets portal to the body, so
 * nothing opened from here inherits the re-pointing.
 */
const SUMMARY_TOKENS = cn(
  "[--text-heading:var(--surface-summary-ink)] [--text:var(--surface-summary-ink)]",
  "[--text-muted:var(--surface-summary-muted)] [--border:var(--surface-summary-line)]",
  "[--command:var(--surface-summary-ink)] [--command-contrast:var(--surface-summary)]",
  "[--surface-wash:var(--surface-summary-line)]",
);

/**
 * "Right now" (v6 Now; owner card: the dark hero, no live clock): who covers
 * this hour, and how to ring them. Standard module 8, the one hero on Now.
 *
 * Until the hospital sets its after-hours times (a Stage B field), Now does not
 * adapt: there is no period line and no track, and the answer is the
 * hospital's switchboard (v6 figure 03). With times set, the period and a slim
 * 24-hour track appear, and after hours the answer is the first after-hours
 * role for the reader's team.
 */
export function NowRightNow({
  status,
  answer,
  hours,
  hospitalPeriod,
  hospitalName,
  now,
}: {
  readonly status: "loading" | "ready";
  /** The row that answers "who do I ring now?", or null when the hospital has not recorded one. */
  readonly answer: HandbookItem | null;
  readonly hours: OnCallHospitalHours | null;
  readonly hospitalPeriod: OnCallPeriod | null;
  readonly hospitalName: string | null;
  readonly now: Date;
}) {
  const headingId = useId();
  const track = onCallHoursTrack(hours, now);
  const afterHours = hospitalPeriod === "after-hours";
  return (
    <section
      aria-labelledby={headingId}
      data-testid="on-call-now-right-now"
      className={cn(modeSummarySurface, SUMMARY_TOKENS, "grid min-w-0 overflow-hidden")}
    >
      <div className="grid min-w-0 gap-0.5 px-3 pt-3">
        <h2 id={headingId} className={cn(eyebrowText, modeSummaryMutedText)}>
          Right now
        </h2>
        {hours && hospitalPeriod ? (
          <p className={cn(modeNumberText, "text-sm text-[color:var(--surface-summary-ink)]")}>
            <span className={modeNameText}>{afterHours ? "After hours" : "In hours"}</span>
            <span className={modeSummaryMutedText}>
              {afterHours
                ? ` since ${hours.afterHoursFrom} · until ${hours.afterHoursUntil}`
                : ` until ${hours.afterHoursFrom}`}
            </span>
          </p>
        ) : null}
      </div>

      {track ? (
        <div aria-hidden="true" className="relative mx-3 mt-3 h-8" data-testid="on-call-now-right-now-track">
          <span className="absolute inset-x-0 top-1.5 h-px bg-[color:var(--surface-summary-line)]" />
          {/* The dark-theme mode colour and "now" blue on the dark panel, in
              both themes: the `.dark` scope resolves the tokens to their dark
              values without a hex value here. */}
          <span className="dark absolute inset-0">
            {track.spans.map((span) => (
              <span
                key={span.from}
                data-mode-identity="on-call"
                className="absolute top-1 h-1.5 rounded-full bg-[color:var(--mode-identity)]"
                style={{ left: `${span.from}%`, width: `${span.to - span.from}%` }}
              />
            ))}
            <span
              className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-[color:var(--primary)]"
              style={{ left: `${track.now}%` }}
            />
          </span>
          <span
            className={cn(
              modeNumberText,
              modeSummaryMutedText,
              "absolute inset-x-0 top-4 flex justify-between text-2xs leading-4",
            )}
          >
            {["00", "06", "12", "18", "24"].map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </span>
        </div>
      ) : null}

      <ul role="list" className={cn("mt-2 border-t", modeSummaryHairline)}>
        {status === "loading" ? (
          <li
            aria-hidden="true"
            data-testid="on-call-now-right-now-outline"
            className={cn(modeInsetHairline, modeRowHeight.double, "flex items-center gap-3 px-3")}
          >
            <span className="h-3 w-2/5 rounded-sm bg-[color:var(--surface-summary-line)]" />
            <span className="ml-auto h-3 w-1/5 rounded-sm bg-[color:var(--surface-summary-line)]" />
          </li>
        ) : answer ? (
          <OnCallDialRow
            id={answer.id}
            source="handbook"
            title={answer.parsed.label}
            dial={answer.dial}
            mobileDial={answer.mobileDial}
            updatedAt={answer.updatedAt}
            sources={answer.sources}
            hospitalName={hospitalName}
            now={now}
            testId={`on-call-now-right-now-${answer.id}`}
          />
        ) : (
          <OnCallRow
            title="Switchboard"
            meta={<OnCallStateLabel state={{ kind: "not-set-up" }} />}
            testId="on-call-now-right-now-not-set-up"
          />
        )}
      </ul>

      {/* A literal href: the route-reachability guard reads literal hrefs only. */}
      <Link
        href="/on-call/call"
        data-testid="on-call-now-all-roles"
        className={cn(
          modeRowHeight.single,
          modePressable,
          focusRing,
          modeSummaryHairline,
          modeHeadingText,
          "flex min-w-0 items-center gap-3 border-t px-3 text-base-minus text-[color:var(--surface-summary-ink)] no-underline",
        )}
      >
        <span className="min-w-0 flex-1 break-words">{afterHours ? "All after-hours roles" : "All roles"}</span>
        <ChevronRight aria-hidden="true" className={cn("size-icon-md shrink-0", modeSummaryMutedText)} />
      </Link>
    </section>
  );
}
