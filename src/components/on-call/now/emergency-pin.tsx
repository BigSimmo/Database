"use client";

import { OnCallDialRow } from "@/components/on-call/kit/dial-row";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { OnCallModuleSkeleton } from "@/components/on-call/kit/module-skeleton";
import { OnCallUpdatedLine } from "@/components/on-call/kit/updated-line";
import type { HospitalHandbookState } from "@/components/on-call/use-hospital-handbook";
import type { HandbookItem } from "@/lib/on-call/handbook-items";

/**
 * The hospital's pinned emergency route, first under the hospital line: the
 * safety order puts it above everything else on Now.
 *
 * Only site-named, `clinical` `Emergency:` entries qualify (at most three,
 * `pinnedEmergencyEntries`), each with the quiet red dot and disc. A short code
 * is desk-only and shows "From a hospital phone"; the mobile route recorded
 * beside it is the row's only call link. With nothing qualifying, nothing
 * renders: the app never invents an emergency number, and never 000 in its
 * place.
 *
 * While the hospital loads, the slot is held as a static outline only when the
 * device remembers that this hospital HAS a pinned row (a yes or no, never the
 * number), so the rows never arrive above something the reader is about to tap.
 */
export function NowEmergencyPin({
  handbook,
  pins,
  now,
}: {
  readonly handbook: HospitalHandbookState;
  readonly pins: readonly HandbookItem[];
  readonly now?: Date;
}) {
  if (handbook.status === "loading") {
    return handbook.emergencyPinExpected ? (
      <OnCallModuleSkeleton rows={1} twoLine testId="on-call-now-emergency-outlines" />
    ) : null;
  }
  if (handbook.status !== "ready" || pins.length === 0) return null;
  const hospitalName = handbook.siteName ?? handbook.serviceName;
  const first = pins[0];
  return (
    <div className="grid min-w-0 gap-2">
      <OnCallGroupedList testId="on-call-now-emergency">
        {pins.map((item) => (
          <OnCallDialRow
            key={item.id}
            id={item.id}
            source="handbook"
            title={item.parsed.label}
            dial={item.dial}
            mobileDial={item.mobileDial}
            updatedAt={item.updatedAt}
            sources={item.sources}
            tone="emergency"
            hospitalName={hospitalName}
            now={now}
            testId={`on-call-now-emergency-${item.id}`}
          />
        ))}
      </OnCallGroupedList>
      {first ? (
        <div className="px-3">
          <OnCallUpdatedLine
            updatedAt={first.updatedAt}
            sources={first.sources}
            now={now}
            testId="on-call-now-emergency-updated"
          />
        </div>
      ) : null}
    </div>
  );
}
