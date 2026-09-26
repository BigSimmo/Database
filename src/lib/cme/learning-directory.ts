import { z } from "zod";

import directoryJson from "@/data/cme/wa-learning-directory.json";
import { normalizeCmeSourceUrl } from "@/lib/cme/learning-source";

/**
 * WA LEARNING DIRECTORY — a curated, hand-checked list of upcoming courses and
 * events in Western Australia that a psychiatrist may want to attend.
 *
 * The data lives in `src/data/cme/wa-learning-directory.json`, not the database,
 * so a monthly check (by a person or an automated job) can rewrite that one file
 * and open a pull request. Everything that job must get right is enforced here:
 * the schema is strict, so a misspelt field fails the unit test instead of
 * silently rendering nothing.
 *
 * Nothing here fetches, tracks or logs attendance. "Log as CPD" only prefills the
 * new-entry form with a title and a link; the owner still decides what to record.
 *
 * Dates are Perth calendar dates (`YYYY-MM-DD`), compared as strings — the same
 * discipline `cpd-year.ts` documents, so no runtime time zone can roll a date.
 */

/** A list older than this is flagged as possibly out of date. */
export const LEARNING_DIRECTORY_STALE_AFTER_DAYS = 45;

const MS_PER_DAY = 86_400_000;

function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine(isRealCalendarDate, "Not a real calendar date.");

/** An https link that also passes the CME source-link rules (no credentials, no control characters). */
const httpsUrlSchema = z.string().transform((value, context) => {
  const normalized = normalizeCmeSourceUrl(value);
  if (!normalized || !normalized.startsWith("https://")) {
    context.addIssue({ code: "custom", message: "Links must be absolute https URLs." });
    return z.NEVER;
  }
  return normalized;
});

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

const learningDirectoryItemSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase, hyphenated id.")
      .max(120),
    title: nonEmptyText(200),
    provider: nonEmptyText(160),
    kind: z.enum(["course", "event", "recorded"]),
    /**
     * False when the organiser's page did not give a date that could be
     * confirmed. Such items may carry null dates, never drop off automatically,
     * and are shown apart from the dated list.
     */
    datesConfirmed: z.boolean(),
    startsOn: calendarDateSchema.nullable(),
    endsOn: calendarDateSchema.nullable(),
    mode: z.enum(["online", "in-person", "both"]),
    location: nonEmptyText(160).nullable(),
    costNote: nonEmptyText(200).nullable(),
    url: httpsUrlSchema,
    /** Where the details were confirmed; may equal `url`. */
    sourceUrl: httpsUrlSchema,
    lastCheckedOn: calendarDateSchema,
  })
  .strict()
  .superRefine((item, context) => {
    if (item.datesConfirmed && item.startsOn === null && item.kind !== "recorded") {
      context.addIssue({
        code: "custom",
        path: ["startsOn"],
        message: "A course or event with confirmed dates needs a start date.",
      });
    }
    if (item.endsOn !== null && item.startsOn === null) {
      context.addIssue({ code: "custom", path: ["endsOn"], message: "An end date needs a start date." });
    }
    if (item.endsOn !== null && item.startsOn !== null && item.endsOn < item.startsOn) {
      context.addIssue({ code: "custom", path: ["endsOn"], message: "The end date is before the start date." });
    }
  });

const learningDirectorySchema = z
  .object({
    lastCheckedOn: calendarDateSchema,
    items: z.array(learningDirectoryItemSchema),
  })
  .strict()
  .superRefine((directory, context) => {
    const seen = new Set<string>();
    directory.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({ code: "custom", path: ["items", index, "id"], message: `Duplicate id "${item.id}".` });
      }
      seen.add(item.id);
    });
  });

export type LearningDirectoryItem = z.infer<typeof learningDirectoryItemSchema>;
type LearningDirectory = z.infer<typeof learningDirectorySchema>;

/** Validates a directory file. Throws with every problem listed, so a bad monthly rewrite fails loudly. */
export function parseLearningDirectory(input: unknown): LearningDirectory {
  const result = learningDirectorySchema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`The WA learning directory is invalid:\n${problems.join("\n")}`);
  }
  return result.data;
}

/** Validated once at module load: an invalid file breaks the build and the tests, never the reader's page silently. */
const WA_LEARNING_DIRECTORY = parseLearningDirectory(directoryJson);

export function loadLearningDirectory(): LearningDirectory {
  return WA_LEARNING_DIRECTORY;
}

function byStartThenTitle(a: LearningDirectoryItem, b: LearningDirectoryItem): number {
  if (a.startsOn !== b.startsOn) {
    if (a.startsOn === null) return 1;
    if (b.startsOn === null) return -1;
    return a.startsOn < b.startsOn ? -1 : 1;
  }
  return a.title.localeCompare(b.title, "en-AU");
}

/**
 * The dated list: items whose dates were confirmed and which have not finished
 * before `todayPerth`. An item finishes on its `endsOn`, or on its `startsOn`
 * when it has no end date; an item running today still shows. A recorded item
 * with no date always shows. Sorted by start date, undated last.
 *
 * Items whose dates are unconfirmed are excluded here — see
 * `unconfirmedLearningItems` — because a date nobody confirmed must not be the
 * reason something disappears.
 */
export function upcomingLearningItems(
  items: readonly LearningDirectoryItem[],
  todayPerth: string,
): LearningDirectoryItem[] {
  return items
    .filter((item) => item.datesConfirmed)
    .filter((item) => {
      const finishesOn = item.endsOn ?? item.startsOn;
      return finishesOn === null || finishesOn >= todayPerth;
    })
    .sort(byStartThenTitle);
}

/** Items whose dates could not be confirmed. They never drop off automatically. */
export function unconfirmedLearningItems(items: readonly LearningDirectoryItem[]): LearningDirectoryItem[] {
  return items.filter((item) => !item.datesConfirmed).sort(byStartThenTitle);
}

/** True when the list was last checked more than 45 days before today's Perth date. */
export function isDirectoryStale(lastCheckedOn: string, todayPerth: string): boolean {
  const days = (Date.parse(`${todayPerth}T00:00:00Z`) - Date.parse(`${lastCheckedOn}T00:00:00Z`)) / MS_PER_DAY;
  return days > LEARNING_DIRECTORY_STALE_AFTER_DAYS;
}

/** The new-entry form's prefill link. Carries only a title and a link; it never records attendance. */
export function learningItemLogHref(item: Pick<LearningDirectoryItem, "title" | "url">): string {
  return `/cme/new?${new URLSearchParams({ title: item.title, sourceUrl: item.url }).toString()}`;
}
