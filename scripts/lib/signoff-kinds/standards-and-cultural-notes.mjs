/**
 * Sign-off kinds registered with npm run clinical:review. See ./index.mjs for the interface.
 *
 *   standard       data/chief-psychiatrist-standards.json  `standards`, one drafted summary of
 *                  each Chief Psychiatrist's Standard for Clinical Care, shown on /forms/act.
 *                  The file already carries status, reviewedBy and reviewedAt on every entry,
 *                  so, like the `section` kind, the record is its own view and a sign-off adds
 *                  reviewedContentSha256 beside them.
 *   cultural-note  data/forms-cultural-notes.json  `notes`, one interpreter, Aboriginal-liaison
 *                  or Mental Health Act note shown in a form's "Interpreter, Aboriginal liaison
 *                  and Act notes" block. Notes carry only `status` natively, so a sign-off adds
 *                  reviewedBy, reviewedAt and reviewedContentSha256 flat beside it on the signed
 *                  note alone; unsigned notes keep their five fields.
 *
 * What the pin covers:
 *
 *   standard       every non-review field: id, title, summary (the text the row opens to),
 *                  sourceUrl (the "Read the standard" link) and sourceId.
 *   cultural-note  every non-review field of the note (formCode, kind, text, sourceId) plus
 *                  `label`, the heading the page prints above the note ("Interpreter",
 *                  "Aboriginal liaison" or "Mental Health Act"). The note's `id` is NOT pinned:
 *                  the file has no ids, so the view derives one from its position
 *                  (`<formCode>-<kind>-<n>`), and reordering the file must not unsign a note
 *                  whose words did not change.
 *
 * The page-level text around these records (section headings and the drafted caveat) is
 * shared by every record and is not part of any one record's pin.
 */

const REVIEW_METADATA_KEYS = Object.freeze(["status", "reviewedBy", "reviewedAt", "reviewedContentSha256"]);
const DRAFTED_AND_REVIEWED = Object.freeze(["drafted", "reviewed"]);

/**
 * The label above each note, exactly as src/lib/forms-cultural-notes.ts `CULTURAL_NOTE_LABELS`
 * gives it to the form page. tests/signoff-standards-and-cultural-notes.test.ts compares the two.
 */
export const CULTURAL_NOTE_LABELS = Object.freeze({
  interpreter: "Interpreter",
  "aboriginal-liaison": "Aboriginal liaison",
  statutory: "Mental Health Act",
});

/** The heading the form page prints above every form's notes (page-level, not pinned). */
const CULTURAL_NOTES_HEADING = "Interpreter, Aboriginal liaison and Act notes";

const isPlainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const withoutMetadata = (record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !REVIEW_METADATA_KEYS.includes(key)));

function notesOf(document) {
  const notes = document?.notes;
  if (!Array.isArray(notes)) throw new Error('data/forms-cultural-notes.json must hold a "notes" array.');
  return notes;
}

/** `<formCode>-<kind>-<n>`: n counts that form's notes of that kind, in file order, from 1. */
function culturalNoteIds(notes) {
  const seen = new Map();
  return notes.map((note) => {
    const stem = `${String(note?.formCode ?? "").trim()}-${String(note?.kind ?? "").trim()}`;
    const count = (seen.get(stem) ?? 0) + 1;
    seen.set(stem, count);
    return `${stem}-${count}`;
  });
}

function culturalNoteView(native, id) {
  if (!isPlainRecord(native)) return native;
  for (const key of ["id", "label"]) {
    if (Object.hasOwn(native, key)) {
      throw new Error(`Cultural note ${id} already has a "${key}" field; the sign-off view would hide it.`);
    }
  }
  const { status, reviewedBy, reviewedAt, reviewedContentSha256, ...content } = native;
  return {
    id,
    ...content,
    label: Object.hasOwn(CULTURAL_NOTE_LABELS, native.kind) ? CULTURAL_NOTE_LABELS[native.kind] : null,
    status,
    reviewedBy: reviewedBy ?? null,
    reviewedAt: reviewedAt ?? null,
    reviewedContentSha256: reviewedContentSha256 ?? null,
  };
}

function culturalNoteRecords(document) {
  const notes = notesOf(document);
  const ids = culturalNoteIds(notes);
  return notes.map((note, index) => culturalNoteView(note, ids[index]));
}

/** The note's content as a reader sees it: the view less its derived id and review state. */
function culturalNoteAttested(record) {
  const content = withoutMetadata(record);
  delete content.id;
  return content;
}

const sameContent = (left, right) =>
  JSON.stringify(Object.entries(left).sort(([a], [b]) => a.localeCompare(b))) ===
  JSON.stringify(Object.entries(right).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Sign exactly one note. Fails closed when the id no longer points at a note with the same
 * words (the file changed between reading and writing), rather than sign a different note.
 */
function writeCulturalNoteReview(document, view) {
  const notes = notesOf(document);
  const ids = culturalNoteIds(notes);
  const target = String(view?.id ?? "")
    .trim()
    .toLowerCase();
  const matches = ids.flatMap((id, index) => (id.toLowerCase() === target ? [index] : []));
  if (matches.length !== 1) {
    throw new Error(`Cultural note ${view?.id} matched ${matches.length} notes in data/forms-cultural-notes.json.`);
  }
  const [index] = matches;
  const current = culturalNoteView(notes[index], ids[index]);
  if (!sameContent(culturalNoteAttested(current), culturalNoteAttested(view))) {
    throw new Error(`Cultural note ${view.id} in data/forms-cultural-notes.json no longer matches what was reviewed.`);
  }
  const signed = {
    ...notes[index],
    status: view.status,
    reviewedBy: view.reviewedBy,
    reviewedAt: view.reviewedAt,
    reviewedContentSha256: view.reviewedContentSha256,
  };
  return { ...document, notes: notes.map((note, position) => (position === index ? signed : note)) };
}

// Both kinds are `optional` only so the queue report still runs against a partial checkout or a
// test fixture root; tests/signoff-standards-and-cultural-notes.test.ts requires both real files.
export const kinds = {
  standard: {
    noun: "Standard",
    heading: "Chief Psychiatrist's Standards for Clinical Care",
    path: "data/chief-psychiatrist-standards.json",
    optional: true,
    collectionKey: "standards",
    idField: "id",
    statuses: DRAFTED_AND_REVIEWED,
    attested: (record) => withoutMetadata(record),
  },
  "cultural-note": {
    noun: "Cultural note",
    heading: "Forms: interpreter, Aboriginal liaison and Act notes",
    path: "data/forms-cultural-notes.json",
    optional: true,
    collectionKey: "notes",
    idField: "id",
    statuses: DRAFTED_AND_REVIEWED,
    records: culturalNoteRecords,
    write: writeCulturalNoteReview,
    attested: culturalNoteAttested,
  },
};

/** The captured source a record cites, for the reviewer to check against; never shown on the site. */
function citedSource(context, sourceId) {
  const entry = context?.sources?.[sourceId];
  if (!entry) return `${sourceId} (not in src/data/source-acquisitions.json)`;
  return [entry.title, entry.publisher, entry.canonicalUrl].filter(Boolean).join("\n    ");
}

export const display = {
  standard(record, context) {
    return [
      ["Standard (the row title on /forms/act)", record.title],
      ["Summary (shown when the row is opened)", record.summary],
      ["Link shown", record.sourceUrl ? `Read the standard: ${record.sourceUrl}` : "(no link)"],
      ["Cited source (for your check; not shown on the site)", citedSource(context, record.sourceId)],
      [
        "On the site today",
        'Marked "Awaiting clinical review". Signing it off replaces that with "Reviewed by <your name>".',
      ],
    ];
  },
  "cultural-note"(record, context) {
    return [
      ["Form", `Form ${record.formCode}, under "${CULTURAL_NOTES_HEADING}"`],
      ["Label shown above the note", record.label ?? `(unknown kind: ${record.kind})`],
      ["Note", record.text],
      ["Cited source (for your check; not shown on the site)", citedSource(context, record.sourceId)],
      [
        "On the site today",
        'Shown under "awaiting clinical review". Signing it off shows "Reviewed by <your name>" under this note.',
      ],
    ];
  },
};

export async function loadContext(_name, root) {
  const { existsSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const path = join(root, "src", "data", "source-acquisitions.json");
  if (!existsSync(path)) return { sources: {} };
  const ledger = JSON.parse(readFileSync(path, "utf8"));
  const entries = Array.isArray(ledger) ? ledger : [];
  return { sources: Object.fromEntries(entries.filter((entry) => entry?.id).map((entry) => [entry.id, entry])) };
}
