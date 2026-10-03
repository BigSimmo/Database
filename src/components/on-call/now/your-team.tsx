"use client";

import { Check, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { OnCallDialRow } from "@/components/on-call/kit/dial-row";
import { OnCallModuleSkeleton } from "@/components/on-call/kit/module-skeleton";
import {
  modeInsetHairline,
  modeIdentityIcon,
  modeIconTile,
  modeModuleSurface,
  modePressable,
  modeRowHeight,
} from "@/components/mode-kit/recipes";
import { modeNameText } from "@/components/mode-kit/type";
import { Sheet } from "@/components/ui/sheet";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { ON_CALL_WHOS_ON_ENABLED } from "@/lib/on-call/feature-flags";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import type { OnCallTeam } from "@/lib/on-call/handbook-title";
import { saveOnCallMyTeam } from "@/lib/on-call/my-team-storage";
import { ON_CALL_AFTER_HOURS_MANAGER, ON_CALL_TEAM_ROW_LIMIT } from "@/lib/on-call/now-rows";

const quietAction = cn(
  focusRing,
  "-my-3 inline-flex min-h-12 items-center rounded-md px-2 text-sm text-[color:var(--text-muted)] no-underline",
);

/** The team chooser: every team the handbook names, then "No team". 52px rows, a check on the current one. */
function TeamChooser({
  teams,
  myTeam,
  onChosen,
}: {
  readonly teams: readonly OnCallTeam[];
  readonly myTeam: OnCallTeam | null;
  readonly onChosen: () => void;
}) {
  const options: { readonly team: OnCallTeam | null; readonly label: string }[] = [
    ...teams.filter((team) => team !== ON_CALL_AFTER_HOURS_MANAGER).map((team) => ({ team, label: team })),
    { team: null, label: "No team" },
  ];
  return (
    <ul role="list" className={modeModuleSurface}>
      {options.map((option) => {
        const current = option.team === myTeam;
        return (
          <li key={option.label} className={modeInsetHairline}>
            <button
              type="button"
              aria-pressed={current}
              onClick={() => {
                saveOnCallMyTeam(option.team);
                onChosen();
              }}
              className={cn(
                modeRowHeight.double,
                modePressable,
                focusRing,
                "flex w-full min-w-0 items-center gap-3 px-3 text-left",
              )}
            >
              <span
                className={cn(
                  modeNameText,
                  "min-w-0 flex-1 break-words text-base-minus text-[color:var(--text-heading)]",
                )}
              >
                {option.label}
              </span>
              {current ? (
                <Check
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-icon-lg shrink-0 text-[color:var(--primary)]"
                />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Your team" (v6 Now): three roles from the reader's own team, chosen once and
 * kept on this device. Roles only; the handbook holds no names.
 *
 * With no team chosen and no rows, the module is one "Choose your team" row.
 * While the hospital loads it keeps the space of three rows when a team is
 * chosen, so it never grows under the thumb. The "Everyone on" link to Who's
 * on appears only while `ON_CALL_WHOS_ON_ENABLED` is on.
 */
export function NowYourTeam({
  status,
  rows,
  teams,
  myTeam,
  hospitalName,
  now,
}: {
  readonly status: "loading" | "ready";
  readonly rows: readonly HandbookItem[];
  readonly teams: readonly OnCallTeam[];
  readonly myTeam: OnCallTeam | null;
  readonly hospitalName: string | null;
  readonly now: Date;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  if (status === "loading") {
    return myTeam ? (
      <OnCallModuleSkeleton rows={ON_CALL_TEAM_ROW_LIMIT} eyebrow testId="on-call-now-team-outlines" />
    ) : null;
  }
  const chooser = (
    <Sheet open={open} onClose={() => setOpen(false)} title="Choose your team" testId="on-call-now-team-chooser">
      <TeamChooser teams={teams} myTeam={myTeam} onChosen={() => setOpen(false)} />
    </Sheet>
  );
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-2" data-testid="on-call-now-team">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <span aria-hidden="true" data-mode-identity="on-call" className={modeIconTile}>
          <Users aria-hidden="true" strokeWidth={1.5} className={modeIdentityIcon} />
        </span>
        <h2 id={headingId} className={cn(eyebrowText, "min-w-0 flex-1 break-words")}>
          {myTeam ? `Your team · ${myTeam}` : "Your team"}
        </h2>
        {ON_CALL_WHOS_ON_ENABLED ? (
          <Link href="/on-call/whos-on" className={quietAction}>
            Everyone on
          </Link>
        ) : null}
        {rows.length > 0 || myTeam ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            data-testid="on-call-now-team-change"
            className={quietAction}
          >
            Change team
          </button>
        ) : null}
      </div>
      <ul role="list" className={modeModuleSurface}>
        {rows.length > 0 ? (
          rows.map((item) => (
            <OnCallDialRow
              key={item.id}
              id={item.id}
              source="handbook"
              title={item.parsed.label}
              subtitle={item.parsed.team === myTeam ? undefined : (item.parsed.team ?? undefined)}
              dial={item.dial}
              mobileDial={item.mobileDial}
              updatedAt={item.updatedAt}
              lastConfirmedAt={item.lastConfirmedAt}
              sources={item.sources}
              hospitalName={hospitalName}
              now={now}
              testId={`on-call-now-team-${item.id}`}
            />
          ))
        ) : (
          <li className={modeInsetHairline}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              data-testid="on-call-now-team-choose"
              className={cn(
                modeRowHeight.single,
                modePressable,
                focusRing,
                "flex w-full min-w-0 items-center gap-3 px-3 text-left",
              )}
            >
              <span
                className={cn(
                  modeNameText,
                  "min-w-0 flex-1 break-words text-base-minus text-[color:var(--text-heading)]",
                )}
              >
                {myTeam ? `Not set up for this hospital` : "Choose your team"}
              </span>
              <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
            </button>
          </li>
        )}
      </ul>
      {chooser}
    </section>
  );
}
