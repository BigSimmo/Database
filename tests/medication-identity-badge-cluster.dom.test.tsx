import { readFileSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BadgeCluster } from "@/components/clinical-dashboard/clinical-badge";
import { medicationIdentityBadges, type MedicationBadge } from "@/lib/medication-badges";
import { deriveMedicationSourceGovernance } from "@/lib/medication-records";
import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import type { MedicationRecord } from "@/lib/medications";

// What survives the medication hero's badge cluster, proved through the real
// component rather than through the badge array.
//
// Nothing asserted this before, which is how an always-on source-freshness chip
// shipped without anyone noticing that the cluster it joined was already full.
// `BadgeCluster` re-sorts by tone priority and slices to `limit`, and the overflow
// `+N` chip is plain, non-interactive text with no tooltip — so a badge pushed past
// the limit is not "collapsed", it is gone. On this cluster the casualties were the
// Poisons Schedule and the TGA/OFF indication tag, both `info`, both outranked by a
// `neutral` freshness chip. A record showing neither TGA nor OFF reads as unknown
// regulatory status rather than as approved.

const HERO_BADGE_LIMIT = 5;
const REFERENCE_DATE = new Date("2026-09-02T00:00:00.000Z");

const recordPageSource = readFileSync(
  path.resolve(process.cwd(), "src/components/clinical-dashboard/medication-record-page.tsx"),
  "utf8",
);

function governanceFor(record: MedicationRecord) {
  const derived = deriveMedicationSourceGovernance(record.sections, REFERENCE_DATE);
  return {
    sourceStatus: derived.sourceStatus,
    validationStatus: "unverified" as const,
    sourceCheckedAt: derived.sourceCheckedAt,
    sourcesRecorded: derived.sourcesRecorded,
  };
}

/**
 * The labels a reader can actually see, read from each chip's `title` (which is the
 * label verbatim) rather than from `textContent`, because warning/danger chips also
 * carry an `sr-only` tone prefix. The trailing `+N` overflow chip is included on
 * purpose: it is what the cluster shows INSTEAD of the badges it dropped, so a count
 * that moves from `+3` to `+4` is itself proof that one more badge went unreachable
 * even when the five visible chips happen to be unchanged.
 */
function visibleChips(badges: MedicationBadge[]): string[] {
  const { container, unmount } = render(<BadgeCluster items={badges} limit={HERO_BADGE_LIMIT} showOverflowCount />);
  const chips = Array.from(container.firstElementChild?.children ?? []).map(
    (element) => element.getAttribute("title") ?? "",
  );
  unmount();
  return chips;
}

describe("medication hero identity badge cluster", () => {
  it("pins the hero cluster limit this file measures against", () => {
    // If the hero's limit changes, these assertions stop describing the real surface.
    expect(recordPageSource).toContain(`<BadgeCluster items={badges} limit={${HERO_BADGE_LIMIT}} showOverflowCount`);
  });

  it("keeps the schedule and indication chips visible on a record with fresh sources", () => {
    // Agomelatine produces exactly five identity badges, so it fits the hero cluster
    // with nothing to spare — which is precisely the record an always-on freshness
    // chip pushed the TGA tag out of. (Records with six or more badges lose an `info`
    // chip to the limit regardless; this file's corpus test below is what covers the
    // difference the source badge itself makes.)
    const agomelatine = getMedicationRecord("agomelatine");
    expect(agomelatine, "agomelatine fixture missing").toBeTruthy();
    const chips = visibleChips(medicationIdentityBadges(agomelatine!, governanceFor(agomelatine!)));

    // S4 is the Poisons Schedule; TGA says the primary indication is approved. A record
    // showing neither TGA nor OFF reads as unknown regulatory status, not as approved.
    expect(chips).toContain("S4");
    expect(chips).toContain("TGA");
    // Nothing is dropped, so there is no overflow chip standing in for it either.
    expect(chips.some((chip) => /^\+\d+$/.test(chip))).toBe(false);
    // And no chip is spent restating that a healthy record is healthy.
    expect(chips.filter((chip) => /source/i.test(chip))).toEqual([]);
  });

  it("displaces nothing on any snapshot record whose sources are within the review interval", () => {
    const displaced: Array<{ slug: string; lost: string[] }> = [];

    for (const record of loadMedicationSnapshot()) {
      const governance = governanceFor(record);
      if (governance.sourceStatus !== "current") continue;
      const withGovernance = new Set(visibleChips(medicationIdentityBadges(record, governance)));
      const lost = visibleChips(medicationIdentityBadges(record)).filter((chip) => !withGovernance.has(chip));
      if (lost.length > 0) displaced.push({ slug: record.slug, lost });
    }

    expect(displaced).toEqual([]);
  });

  it("spends a slot only where there is a real deficiency to report", () => {
    // These three carry no `src` section at all. Here the warning IS the most
    // important thing about the record, so it correctly outranks an `info` chip.
    for (const slug of ["alimemazine", "edoxaban", "levomepromazine"]) {
      const record = getMedicationRecord(slug);
      expect(record, `${slug} fixture missing`).toBeTruthy();
      expect(visibleChips(medicationIdentityBadges(record!, governanceFor(record!)))).toContain("No sources recorded");
    }
  });

  it("surfaces a review-due warning ahead of passive identity metadata", () => {
    const agomelatine = getMedicationRecord("agomelatine");
    expect(agomelatine, "agomelatine fixture missing").toBeTruthy();
    const chips = visibleChips(
      medicationIdentityBadges(agomelatine!, {
        sourceStatus: "review_due",
        validationStatus: "unverified",
        sourceCheckedAt: "2026-05-14",
        sourcesRecorded: true,
      }),
    );
    expect(chips).toContain("Source check due — sources last checked May 2026");
  });
});
