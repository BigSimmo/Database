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
import { modeInsetHairline, modeModuleSurface, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { onCallGroupAnchorId } from "@/components/on-call/on-call-page-anchors";
import { ON_CALL_HUB_GROUPS, onCallHubPageSections } from "@/components/on-call/on-call-page-sections";
import { ON_CALL_ON_SITE_HREF, ON_CALL_ON_SITE_LABEL } from "@/components/on-call/on-call-section-identity";
import { useHospitalHandbook } from "@/components/on-call/use-hospital-handbook";
import { SearchField } from "@/components/ui/text-field";
import { cn } from "@/components/ui-primitives";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import { searchHandbookItems } from "@/lib/on-call/handbook-search";

type FindSlug = (typeof ON_CALL_HUB_GROUPS.find)[number]["slug"];

/**
 * Which Find group an item belongs to, or null when Find does not list it.
 * `Access:` items (building access, parking, food, taxi) belong to Admin, so
 * Find leaves them out and links there instead (owner 16:06Z).
 */
function findGroup(item: HandbookItem): FindSlug | null {
  if (item.section === "documentation") return "manuals";
  if (item.section !== "resources") return null;
  switch (item.parsed.prefix) {
    case "Downtime":
      return "downtime";
    case "Ward":
      return "wards";
    case "Equipment":
      return "equipment";
    case null:
      return "other";
    default:
      return null;
  }
}

function secondaryLine(item: HandbookItem): string | null {
  return item.aliases[0] ?? handbookFirstLine(item.body);
}

/**
 * Find: where things are, and what to do when systems fail (owner 16:06Z:
 * Systems down, Wards, Equipment, Manuals, then anything else).
 *
 * Systems down comes first, because Now's "Systems down" row lands on it
 * (`/on-call/find#on-call-group-downtime`). Each item is one row whose detail
 * opens in a sheet. On-site help is Admin's, so the page ends with one link
 * there. One in-flow search box filters on the device only, and finds a ward
 * by its everyday name ("HDU" finds "Ward: 4B").
 */
export function OnCallFindPage() {
  const handbook = useHospitalHandbook();
  const hospitalPhone = useOnCallHospitalPhone();
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const ready = handbook.status === "ready";
  const hospitalName = handbook.siteName ?? handbook.serviceName;

  const listed = useMemo(() => handbook.items.filter((item) => findGroup(item) !== null), [handbook.items]);
  const groups = useMemo(() => {
    const shown = searching ? searchHandbookItems(listed, query) : listed;
    return ON_CALL_HUB_GROUPS.find.map((group) => ({
      ...group,
      items: shown.filter((item) => findGroup(item) === group.slug),
    }));
  }, [listed, query, searching]);

  const sections = onCallHubPageSections("find", new Map(groups.map((group) => [group.slug, group.items.length])));
  const resultCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const hasDeskOnly = listed.some((item) => item.dial.kind === "extension");

  return (
    <OnCallHubPageFrame page="find" sections={ready ? sections : []} lead={<OnCallHospitalLine handbook={handbook} />}>
      <OnCallHandbookState handbook={handbook} page="find" />
      {ready ? null : <OnCallCrisisLines />}

      {ready ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <div data-testid="on-call-find-search">
            <SearchField
              label="Search Find"
              placeholder="Search numbers, wards, roles"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              clearLabel="Clear the Find search"
              autoComplete="off"
            />
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {searching ? `${resultCount} ${resultCount === 1 ? "result" : "results"}` : ""}
          </p>
        </div>
      ) : null}

      {ready
        ? groups.map((group) => {
            // Manuals keeps its link to the reader's own shelf even with no hospital manuals.
            const keep = group.items.length > 0 || (group.slug === "manuals" && !searching);
            if (!keep) return null;
            return (
              <OnCallGroupedList
                key={group.slug}
                eyebrow={group.label}
                headerIcon={group.icon}
                id={onCallGroupAnchorId(group.slug)}
                testId={`on-call-find-group-${group.slug}`}
              >
                {group.items.map((item) => (
                  <OnCallHandbookItemRow
                    key={item.id}
                    item={item}
                    secondary={secondaryLine(item)}
                    hospitalName={hospitalName}
                    hospitalPhone={hospitalPhone}
                    detailTestId="on-call-find-detail"
                    testId={`on-call-find-row-${item.id}`}
                  />
                ))}
                {group.slug === "manuals" ? (
                  <li className={cn(modeInsetHairline, "min-w-0")}>
                    {/* A literal next/link href: route-reachability counts only those. */}
                    <Link
                      href="/on-call/orientation"
                      data-testid="on-call-find-manuals-link"
                      className={cn(
                        modeRowHeight.single,
                        modePressable,
                        focusRing,
                        "flex min-w-0 items-center gap-3 px-3 text-[color:var(--text-heading)] no-underline",
                      )}
                    >
                      <span className={cn(modeNameText, "min-w-0 flex-1 break-words text-base-minus")}>
                        Your manuals
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-icon-md shrink-0 text-[color:var(--text-muted)]"
                      />
                    </Link>
                  </li>
                ) : null}
              </OnCallGroupedList>
            );
          })
        : null}
      {ready && !searching && (hasDeskOnly || hospitalPhone) ? <OnCallHospitalPhoneSwitch on={hospitalPhone} /> : null}

      <div className={modeModuleSurface} data-testid="on-call-find-on-site">
        <Link
          href={ON_CALL_ON_SITE_HREF}
          className={cn(
            modeRowHeight.single,
            modePressable,
            focusRing,
            "flex min-w-0 items-center gap-3 px-3 text-[color:var(--text-heading)] no-underline",
          )}
        >
          <span className={cn(modeNameText, "min-w-0 flex-1 break-words text-base-minus")}>
            {ON_CALL_ON_SITE_LABEL}
          </span>
          <span className={modeSecondaryText}>Admin</span>
          <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
        </Link>
      </div>
    </OnCallHubPageFrame>
  );
}
