import mhaSections from "../../data/mha-2014-sections.json";
import type { FormActSection } from "@/lib/form-ranker";

/**
 * Plain-English summaries of the Mental Health Act 2014 (WA) sections cited by the
 * Forms mode, keyed by section number so each is written and reviewed exactly once.
 *
 * Section 89 is cited by four forms and ss 55/56/61/72/90/131 by three each; holding
 * the text per form would mean maintaining the same clinical sentence in several
 * places. A section summary is a property of the Act, not of a form — a form only
 * supplies the citation list, via `sourceFacts.sectionCue`.
 *
 * Generated and gated by scripts/build-mha-act-sections.mjs.
 */
export type MhaActSectionStatus = "reviewed" | "pending";

export type MhaActSection = {
  section: string;
  title: string;
  /** Absent until a clinician has signed the summary off against the Act text. */
  summary?: string;
  status: MhaActSectionStatus;
};

type MhaActSectionsFile = {
  exportMetadata: { actVersion: string; actAsAt: string; sourceUrl: string };
  sections: MhaActSection[];
};

const file = mhaSections as MhaActSectionsFile;

export const mhaActMetadata = {
  actVersion: file.exportMetadata.actVersion,
  actAsAt: file.exportMetadata.actAsAt,
  sourceUrl: file.exportMetadata.sourceUrl,
} as const;

const bySection = new Map(file.sections.map((entry) => [entry.section, entry]));

/**
 * Free-text section cue -> ordered, de-duplicated section numbers.
 *
 * Mirrors parseSectionCue in scripts/build-mha-act-sections.mjs, which is what makes
 * the build gate and the runtime agree on which sections a form cites. Order is
 * first-appearance and is never sorted: it mirrors the approved form, and Form 1A's
 * reviewed order is pinned by tests/forms.test.ts.
 */
export function parseSectionCue(cue: string | undefined | null): string[] {
  if (typeof cue !== "string") return [];
  return [...new Set(cue.match(/\d+[A-Z]*/g) ?? [])];
}

export function mhaActSection(section: string): MhaActSection | undefined {
  return bySection.get(section);
}

/**
 * Renderable Act sections for a form's cue, or `undefined` to leave the Source status
 * card in place.
 *
 * Returns `undefined` unless EVERY cited section has a reviewed summary. That is the
 * staged-rollout gate: summaries land in clinically reviewed batches, and a form flips
 * to the Act-sections card only once its whole citation list is signed off, so no form
 * ever shows a half-populated authority card.
 *
 * Throws for a cue naming a section absent from the curated file — that is a data
 * defect the build gate also catches, and it must never render as a dead chip.
 */
export function actSectionsForCue(cue: string | undefined | null): FormActSection[] | undefined {
  const numbers = parseSectionCue(cue);
  if (!numbers.length) return undefined;

  const sections = numbers.map((section) => {
    const entry = bySection.get(section);
    if (!entry) {
      throw new Error(`Form cue cites Mental Health Act 2014 section ${section}, which has no curated entry.`);
    }
    return entry;
  });

  if (sections.some((entry) => entry.status !== "reviewed" || !entry.summary?.trim())) return undefined;

  return sections.map((entry) => ({ section: entry.section, title: entry.title, summary: entry.summary }));
}
