"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { useOnCallHospitalPhone } from "@/components/on-call/call/call-device-stores";
import { OnCallHospitalPhoneSwitch } from "@/components/on-call/call/hospital-phone-switch";
import { OnCallCrisisLines } from "@/components/on-call/call/external-line-rows";
import { handbookFirstLine, OnCallHandbookItemRow } from "@/components/on-call/find/handbook-item-row";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { OnCallHandbookState } from "@/components/on-call/kit/handbook-state";
import { OnCallHospitalLine } from "@/components/on-call/kit/hospital-line";
import { OnCallHubPageFrame } from "@/components/on-call/kit/hub-page-frame";
import { onCallInsetHairline, onCallPressable, onCallRowHeight } from "@/components/on-call/kit/recipes";
import { onCallNameText, onCallSecondaryText } from "@/components/on-call/kit/type";
import { OnCallFilterChips } from "@/components/on-call/on-call-filter-chips";
import { onCallEntryAnchorId, onCallGroupAnchorId } from "@/components/on-call/on-call-page-anchors";
import { ON_CALL_HUB_GROUPS, onCallHubPageSections } from "@/components/on-call/on-call-page-sections";
import { useHospitalHandbook } from "@/components/on-call/use-hospital-handbook";
import { cn } from "@/components/ui-primitives";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import { compareOnCallTeams, onCallTeamBarLabel } from "@/lib/on-call/handbook-title";

const ALL_TEAMS = "All teams";

const groupIcon = (slug: string) => ON_CALL_HUB_GROUPS.refer.find((group) => group.slug === slug)?.icon;

/**
 * Refer: how to reach each service at the hospital, and the reader's own
 * referral notes (plan 3.4; v6 figure 07).
 *
 * The Hospital/Mine split is the header's tab row. One quiet chip row filters
 * the hospital's referrals by team, and shows only when there are two or more
 * teams, with no team chosen at first. Each referral is one row; its detail —
 * the hospital's own words, the number and the Updated line — opens in a
 * sheet. Open or closed needs the hospital's hours, which are not recorded
 * yet, so nothing here says either.
 */
export function OnCallReferPage() {
  const handbook = useHospitalHandbook();
  const entries = useOnCallEntries();
  const hospitalPhone = useOnCallHospitalPhone();
  const [team, setTeam] = useState(ALL_TEAMS);
  const ready = handbook.status === "ready";
  const hospitalName = handbook.siteName ?? handbook.serviceName;

  const referrals = useMemo(
    () => (ready ? handbook.items.filter((item) => item.section === "referrals") : []),
    [handbook.items, ready],
  );
  const teams = useMemo(
    () =>
      [...new Set(referrals.map((item) => item.parsed.team).filter((name): name is string => Boolean(name)))].sort(
        compareOnCallTeams,
      ),
    [referrals],
  );
  const chosen = teams.includes(team) ? team : ALL_TEAMS;
  const shown = chosen === ALL_TEAMS ? referrals : referrals.filter((item) => item.parsed.team === chosen);
  const hasDeskOnly = referrals.some((item) => item.dial.kind === "extension");

  const signedOut = entries.signedOut || handbook.status === "signed-out";
  const mine = useMemo(
    () => entries.entries.filter((entry) => entry.isPersonal && entry.section === "referrals"),
    [entries.entries],
  );

  const sections = onCallHubPageSections(
    "refer",
    new Map([
      ["hospital", shown.length],
      ["mine", signedOut ? 0 : mine.length],
    ]),
  );

  const secondary = (item: HandbookItem) =>
    item.parsed.team ? onCallTeamBarLabel(item.parsed.team) : handbookFirstLine(item.body);

  return (
    <OnCallHubPageFrame page="refer" sections={sections} lead={<OnCallHospitalLine handbook={handbook} />}>
      <OnCallHandbookState handbook={handbook} page="refer" />
      {ready ? null : <OnCallCrisisLines />}

      {ready && teams.length >= 2 ? (
        <OnCallFilterChips
          options={[ALL_TEAMS, ...teams]}
          active={chosen}
          onChange={setTeam}
          label="Team"
          testId="on-call-refer-team"
        />
      ) : null}

      {ready && shown.length > 0 ? (
        <OnCallGroupedList
          eyebrow="Hospital"
          headerIcon={groupIcon("hospital")}
          id={onCallGroupAnchorId("hospital")}
          testId="on-call-refer-hospital"
        >
          {shown.map((item) => (
            <OnCallHandbookItemRow
              key={item.id}
              item={item}
              secondary={secondary(item)}
              hospitalName={hospitalName}
              hospitalPhone={hospitalPhone}
              detailTestId="on-call-refer-detail"
              testId={`on-call-refer-row-${item.id}`}
            />
          ))}
        </OnCallGroupedList>
      ) : null}
      {ready && (hasDeskOnly || hospitalPhone) ? <OnCallHospitalPhoneSwitch on={hospitalPhone} /> : null}

      <OnCallGroupedList
        eyebrow="Mine"
        headerIcon={groupIcon("mine")}
        id={onCallGroupAnchorId("mine")}
        testId="on-call-refer-mine"
      >
        {signedOut
          ? null
          : mine.map((entry) => (
              <li key={entry.id} className={cn(onCallInsetHairline, "min-w-0")}>
                <Link
                  href={`/on-call/referrals#${onCallEntryAnchorId(entry.id)}`}
                  className={cn(
                    entry.subtitle ? onCallRowHeight.double : onCallRowHeight.single,
                    onCallPressable,
                    focusRing,
                    "flex min-w-0 items-center gap-3 px-3 no-underline",
                  )}
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span
                      className={cn(onCallNameText, "break-words text-base-minus text-[color:var(--text-heading)]")}
                    >
                      {entry.title}
                    </span>
                    {entry.subtitle ? (
                      <span className={cn(onCallSecondaryText, "break-words")}>{entry.subtitle}</span>
                    ) : null}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
                </Link>
              </li>
            ))}
        {signedOut ? (
          <li className={cn(onCallInsetHairline, onCallRowHeight.single, "flex min-w-0 items-center px-3")}>
            <span className={cn(onCallSecondaryText, "break-words")}>Sign in to keep your own referrals.</span>
          </li>
        ) : null}
        <li className={cn(onCallInsetHairline, "min-w-0")}>
          {/* A literal next/link href: route-reachability counts only those. */}
          <Link
            href="/on-call/referrals"
            data-testid="on-call-refer-mine-link"
            className={cn(
              onCallRowHeight.single,
              onCallPressable,
              focusRing,
              "flex min-w-0 items-center gap-3 px-3 text-[color:var(--text-heading)] no-underline",
            )}
          >
            <span className={cn(onCallNameText, "min-w-0 flex-1 break-words text-base-minus")}>Your own referrals</span>
            <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          </Link>
        </li>
      </OnCallGroupedList>
    </OnCallHubPageFrame>
  );
}
