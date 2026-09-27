import { addDays } from "@/lib/calendar/calendar-event";
import { PublicApiError } from "@/lib/http";
import {
  DEMO_TEACHING_SERVICE_ID,
  demoSeriesId,
  demoTeachingSessionDetail,
  demoTeachingSessions,
  parseDemoOccurrenceId,
} from "@/lib/teaching/demo-programme";
import {
  resourceRowSchema,
  type CollectionRead,
  type ResourceRow,
  type ResourcesForSession,
  type ResourcesForWeek,
  type TeachingResourcesQuery,
} from "@/lib/teaching/model";
import { perthToday } from "@/lib/teaching/time";

/**
 * Resources for the demo (master plan R8): the four collection tiles and nine resources the
 * mockups show, every title "Demo ..." and every link on example.org.
 *
 * Two collections are organiser-made (Exam prep, with Written exam and Clinical exam sections, and
 * an empty Orientation); Recordings and Saved are the built-in pair. Six resources sit in Exam prep.
 * Three belong to the demo service's own weekly sessions, so "For this week" always has something:
 * slides for that week's registrar teaching (slides always name one session, master plan R27), a
 * case conference reading for the whole series, and the case conference recording once that week's
 * conference has ended, marked catch-up because the demo viewer has no attendance for it.
 *
 * The two library items point at the synthetic demo library's own documents, which exist in demo
 * mode, so they open inside the app.
 */

const EXAM_PREP_ID = "00000000-0000-4000-b900-000000000001";
const ORIENTATION_ID = "00000000-0000-4000-b900-000000000002";
const WRITTEN_SECTION_ID = "00000000-0000-4000-b901-000000000001";
const CLINICAL_SECTION_ID = "00000000-0000-4000-b901-000000000002";
/** Synthetic demo library documents (`src/lib/demo-data.ts`): the lithium and risk triage protocols. */
const DEMO_LIBRARY_LITHIUM = "11111111-1111-4111-8111-111111111111";
const DEMO_LIBRARY_RISK = "33333333-3333-4333-8333-333333333333";
const REGISTRAR_TEACHING_KEY = 1;
const CASE_CONFERENCE_KEY = 3;
const STATIC_ADDED_AT = "2026-08-03T01:00:00.000Z";

const COLLECTIONS = [
  { collectionId: EXAM_PREP_ID, serviceId: DEMO_TEACHING_SERVICE_ID, name: "Exam prep" },
  { collectionId: ORIENTATION_ID, serviceId: DEMO_TEACHING_SERVICE_ID, name: "Orientation" },
] as const;

const SECTIONS: Record<string, CollectionRead["sections"]> = {
  [EXAM_PREP_ID]: [
    { sectionId: WRITTEN_SECTION_ID, name: "Written exam", sortOrder: 0 },
    { sectionId: CLINICAL_SECTION_ID, name: "Clinical exam", sortOrder: 1 },
  ],
  [ORIENTATION_ID]: [],
};

function resourceId(index: number, date?: string): string {
  const tail = date ? `${date.replace(/-/g, "")}0000` : "000000000000";
  return `00000000-0000-4000-8${String(index).padStart(3, "0")}-${tail}`;
}

function examPrep(
  index: number,
  title: string,
  kind: ResourceRow["kind"],
  sectionId: string,
  link: { url: string } | { libraryDocumentId: string },
  saved = false,
): ResourceRow {
  return {
    resourceId: resourceId(index),
    serviceId: DEMO_TEACHING_SERVICE_ID,
    title,
    kind,
    url: "url" in link ? link.url : null,
    libraryDocumentId: "libraryDocumentId" in link ? link.libraryDocumentId : null,
    collectionId: EXAM_PREP_ID,
    sectionId,
    occurrenceId: null,
    seriesId: null,
    addedAt: STATIC_ADDED_AT,
    saved,
  };
}

const EXAM_PREP_ITEMS: readonly ResourceRow[] = [
  examPrep(
    1,
    "Demo MCQ technique",
    "recording",
    WRITTEN_SECTION_ID,
    { url: "https://example.org/demo-mcq-technique" },
    true,
  ),
  examPrep(2, "Demo past paper walkthrough", "link", WRITTEN_SECTION_ID, {
    url: "https://example.org/demo-past-paper-walkthrough",
  }),
  examPrep(3, "Demo exam syllabus", "link", WRITTEN_SECTION_ID, { url: "https://example.org/demo-exam-syllabus" }),
  examPrep(4, "Demo guideline", "library", WRITTEN_SECTION_ID, { libraryDocumentId: DEMO_LIBRARY_LITHIUM }),
  examPrep(5, "Demo observed interview practice", "recording", CLINICAL_SECTION_ID, {
    url: "https://example.org/demo-observed-interview",
  }),
  examPrep(6, "Demo formulation template", "reading", CLINICAL_SECTION_ID, {
    url: "https://example.org/demo-formulation-template",
  }),
];

type WeekItem = ResourceRow & { catchUp: boolean; firstStart: string };

/** The three session resources of one week, [from, from + 6], as the database would list them. */
function weekItems(from: string, now: Date): WeekItem[] {
  const sessions = demoTeachingSessions({ from, to: addDays(from, 6) }, now);
  const items: WeekItem[] = [];
  const conferenceSeries = demoSeriesId(CASE_CONFERENCE_KEY);
  for (const session of sessions) {
    const parsed = parseDemoOccurrenceId(session.occurrenceId);
    if (!parsed) continue;
    const ended = Date.parse(session.endsAt) <= now.getTime() && session.status !== "cancelled";
    const base = {
      serviceId: DEMO_TEACHING_SERVICE_ID,
      libraryDocumentId: null,
      collectionId: null,
      sectionId: null,
      seriesId: null,
      saved: false,
      firstStart: session.startsAt,
    };
    if (parsed.key === REGISTRAR_TEACHING_KEY) {
      items.push({
        ...base,
        resourceId: resourceId(7, parsed.date),
        title: "Demo registrar teaching slides",
        kind: "slides",
        url: "https://example.org/demo-registrar-teaching-slides",
        occurrenceId: session.occurrenceId,
        addedAt: new Date(Date.parse(session.startsAt) - 86_400_000).toISOString(),
        saved: true,
        catchUp: ended,
      });
    }
    if (parsed.key !== CASE_CONFERENCE_KEY) continue;
    if (!items.some((item) => item.seriesId === conferenceSeries)) {
      items.push({
        ...base,
        resourceId: resourceId(8),
        title: "Demo case conference reading",
        kind: "library",
        url: null,
        libraryDocumentId: DEMO_LIBRARY_RISK,
        occurrenceId: null,
        seriesId: conferenceSeries,
        addedAt: STATIC_ADDED_AT,
        catchUp: false,
      });
    }
    if (ended) {
      items.push({
        ...base,
        resourceId: resourceId(9, parsed.date),
        title: "Demo case conference recording",
        kind: "recording",
        url: "https://example.org/demo-case-conference-recording",
        occurrenceId: session.occurrenceId,
        addedAt: session.endsAt,
        catchUp: true,
      });
    }
  }
  return items.sort((a, b) => a.firstStart.localeCompare(b.firstStart) || a.resourceId.localeCompare(b.resourceId));
}

/** The resource as the database returns it: parsing drops the demo's own bookkeeping keys. */
function row(item: WeekItem): ResourceRow {
  return resourceRowSchema.parse(item);
}

function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/** Everything the demo viewer can see today: Exam prep and this Perth week's session resources. */
function library(now: Date): ResourceRow[] {
  return [...EXAM_PREP_ITEMS, ...weekItems(mondayOf(perthToday(now)), now).map(row)];
}

function byTitle(a: ResourceRow, b: ResourceRow): number {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || a.resourceId.localeCompare(b.resourceId);
}

function newestFirst(a: ResourceRow, b: ResourceRow): number {
  return b.addedAt.localeCompare(a.addedAt) || a.resourceId.localeCompare(b.resourceId);
}

function notInDemo(): PublicApiError {
  return new PublicApiError("This isn't available in the demo.", 404, { code: "teaching_not_found" });
}

function forSession(occurrenceId: string, now: Date): ResourcesForSession {
  const parsed = parseDemoOccurrenceId(occurrenceId);
  if (!parsed || !demoTeachingSessionDetail(occurrenceId, now)) throw notInDemo();
  const series = demoSeriesId(parsed.key);
  const items = weekItems(mondayOf(parsed.date), now)
    .filter((item) => item.occurrenceId === occurrenceId || (item.occurrenceId === null && item.seriesId === series))
    .map(row)
    .sort((a, b) => a.kind.localeCompare(b.kind) || byTitle(a, b));
  return { items };
}

function forWeek(weekStart: string, now: Date): ResourcesForWeek {
  const all = library(now);
  return {
    forThisWeek: weekItems(weekStart, now).map((item) => ({ ...row(item), catchUp: item.catchUp })),
    collections: COLLECTIONS.map((collection) => ({
      ...collection,
      count: all.filter((item) => item.collectionId === collection.collectionId).length,
    })),
    recordingsCount: all.filter((item) => item.kind === "recording").length,
    savedCount: all.filter((item) => item.saved).length,
  };
}

function readCollection(query: { collectionId?: string; builtIn?: string }, now: Date): CollectionRead {
  const all = library(now);
  if (query.builtIn === "recordings")
    return { collection: null, sections: [], items: all.filter((item) => item.kind === "recording").sort(newestFirst) };
  if (query.builtIn === "saved")
    return { collection: null, sections: [], items: all.filter((item) => item.saved).sort(newestFirst) };
  const collection = COLLECTIONS.find((candidate) => candidate.collectionId === query.collectionId);
  if (!collection) throw notInDemo();
  return {
    collection: { ...collection },
    sections: SECTIONS[collection.collectionId] ?? [],
    items: all.filter((item) => item.collectionId === collection.collectionId).sort(byTitle),
  };
}

/** `GET /api/teaching/resources` in demo mode: the same shapes the database returns, from made-up data. */
export function demoTeachingResources(
  query: TeachingResourcesQuery,
  now: Date = new Date(),
): ResourcesForSession | ResourcesForWeek | CollectionRead {
  if (query.action === "collection.read") return readCollection(query, now);
  if (query.occurrenceId) return forSession(query.occurrenceId, now);
  if (query.weekStart) return forWeek(query.weekStart, now);
  throw notInDemo();
}
