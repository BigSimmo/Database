import formsActSectionCues from "../../data/forms-act-section-cues.json";
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
/**
 * `drafted` — written from the extracted statutory text and pinned to it by hash, but
 * not yet signed off by a clinician. It renders, with a visible caveat on the section
 * sheet, so the reader is never told a summary carries clinical review it does not have.
 * `reviewed` — a named clinician confirmed it against that same text; the caveat drops.
 */
export type MhaActSectionStatus = "reviewed" | "drafted" | "pending";

export type MhaActSection = {
  section: string;
  title: string;
  /** Absent until the summary has been written from the Act text. */
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

type FormsActSectionCuesFile = { forms: { code: string; sections: string[]; basis: string }[] };

const normalizeFormCode = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Governing sections for the seven official forms that the archive never indexed, so
 * they carry no `sourceFacts.sectionCue`. Each entry states its basis in
 * `data/forms-act-section-cues.json` so the mapping can be checked.
 */
const supplementalCueByCode = new Map(
  (formsActSectionCues as FormsActSectionCuesFile).forms.map((form) => [
    normalizeFormCode(form.code),
    form.sections.join(", "),
  ]),
);

/** The section cue for a form: its own if the archive indexed one, else the supplemental map. */
export function sectionCueForForm(code: string, catalogCue: string | undefined | null): string | undefined {
  if (typeof catalogCue === "string" && catalogCue.trim()) return catalogCue;
  return supplementalCueByCode.get(normalizeFormCode(code));
}

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
 * Returns `undefined` unless EVERY cited section has a summary (drafted or reviewed).
 * That is the staged-rollout gate: a form flips to the Act-sections card only once its
 * whole citation list is written, so no form ever shows a half-populated authority card.
 * Drafted sections carry `reviewStatus` through to the sheet, which shows the
 * awaiting-review caveat.
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

  if (sections.some((entry) => entry.status === "pending" || !entry.summary?.trim())) return undefined;

  return sections.map((entry) => ({
    section: entry.section,
    title: entry.title,
    summary: entry.summary,
    reviewStatus: entry.status === "reviewed" ? "reviewed" : "drafted",
  }));
}
