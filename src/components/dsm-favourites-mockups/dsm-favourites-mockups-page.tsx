"use client";

import { BookOpenCheck, Check, ChevronRight, Pin, Star, Tag } from "lucide-react";
import { useState } from "react";

/**
 * Design scratch for "save a DSM diagnosis to favourites".
 *
 * This is the ONE page-level capability the diagnosis-page review found that
 * cannot be built without a schema change: `favouriteContentTypeSchema` and the
 * `user_favourites_content_type_check` constraint both allow only
 * service | form | differential | therapy. Adding `dsm` reaches the live clinical
 * database on merge, so the shape wants deciding on a page before it is decided
 * in a migration.
 *
 * There is a precedent to copy exactly: `20260814150000_add_therapy_favourites.sql`
 * dropped and re-added the check constraint with `therapy`, and
 * `20260814151000_validate_therapy_favourites_content_type.sql` validated it as a
 * separate migration. Same two-step here.
 *
 * NOTHING BELOW IS WIRED. Every control is local state over fixed data, so the
 * page can be read without a database, an account, or a decision having been
 * made. The open questions are stated on the page itself rather than in a doc
 * nobody opens next to the pictures.
 */

type SaveState = "idle" | "saved";

const DIAGNOSIS = {
  title: "Panic disorder",
  icd: "F41.0",
  category: "Anxiety disorders",
  criteria: "4 criteria, A-D",
};

const SET_OPTIONS = ["Unsorted", "Clinical review", "Ward round", "On call", "Teaching", "Reference"] as const;

/** What a saved DSM favourite would look like beside the types that already exist. */
const LIBRARY_ROWS: ReadonlyArray<{
  type: string;
  title: string;
  meta: string;
  set: string;
  isNew?: boolean;
}> = [
  {
    type: "DSM diagnosis",
    title: "Panic disorder",
    meta: "F41.0 · Anxiety disorders · 4 criteria",
    set: "Clinical review",
    isNew: true,
  },
  { type: "Therapy", title: "CBT for panic", meta: "Structured protocol · 12 sessions", set: "Clinical review" },
  { type: "Differential", title: "Acute chest pain", meta: "Presentation · 9 candidates", set: "Ward round" },
  { type: "Form", title: "Form 1A — Referral", meta: "Mental Health Act 2014", set: "On call" },
] as const;

function Panel({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[11px] text-[color:var(--clinical-accent-contrast)]">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border-l-[3px] border-l-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--warning-text)]">
      <strong className="font-bold">Decision: </strong>
      {children}
    </p>
  );
}

export function DsmFavouritesMockupsPage() {
  const [headerSave, setHeaderSave] = useState<SaveState>("idle");
  const [chosenSet, setChosenSet] = useState<(typeof SET_OPTIONS)[number]>("Unsorted");
  const [pinned, setPinned] = useState(false);

  return (
    <main className="mx-auto max-w-4xl space-y-4 bg-[color:var(--surface-wash)] p-4 sm:p-6">
      <header className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">
          Mockup · not wired
        </p>
        <h1 className="mt-1 text-xl font-extrabold text-[color:var(--text-heading)]">
          Save a DSM diagnosis to favourites
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
          Favourites currently accept services, forms, differentials and therapies. A diagnosis cannot be saved, because
          the content type is constrained in two places at once: a Zod enum and a Postgres check constraint. Adding one
          reaches the live clinical database the moment the migration merges, so the three decisions below are worth
          settling here first.
        </p>
      </header>

      <Panel n={1} title="Where the save control lives on the diagnosis page">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
            <span className="text-base font-extrabold text-[color:var(--text-heading)]">{DIAGNOSIS.title}</span>
            <span className="rounded-md bg-[color:var(--surface)] px-2 py-0.5 font-mono text-xs text-[color:var(--text-heading)] ring-1 ring-[color:var(--border)]">
              {DIAGNOSIS.icd}
            </span>
            <span className="rounded-md bg-[color:var(--surface)] px-2 py-0.5 text-xs text-[color:var(--text-muted)] ring-1 ring-[color:var(--border)]">
              {DIAGNOSIS.category}
            </span>

            <button
              type="button"
              onClick={() => setHeaderSave(headerSave === "idle" ? "saved" : "idle")}
              className={`ml-auto inline-flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
                headerSave === "saved"
                  ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                  : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-heading)] hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]"
              }`}
            >
              {headerSave === "saved" ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Star className="h-4 w-4" aria-hidden />
              )}
              {headerSave === "saved" ? "Saved" : "Save"}
            </button>
          </div>

          {headerSave === "saved" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2">
              <Tag className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
              <span className="text-xs font-bold text-[color:var(--clinical-accent)]">Add to set</span>
              <div className="flex flex-wrap gap-1.5">
                {SET_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setChosenSet(option)}
                    className={`min-h-12 rounded-md px-2.5 text-xs font-semibold ${
                      chosenSet === option
                        ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : "border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPinned(!pinned)}
                className={`ml-auto inline-flex min-h-12 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ${
                  pinned
                    ? "bg-[color:var(--warning)] text-[color:var(--clinical-accent-contrast)]"
                    : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-heading)]"
                }`}
              >
                <Pin className="h-3.5 w-3.5" aria-hidden />
                {pinned ? "Pinned" : "Pin"}
              </button>
            </div>
          ) : null}
        </div>

        <Question>
          Save sits in the page header here, beside the code. The alternative is the ellipsis menu, where Compare used
          to live. Header costs a permanent control on every diagnosis page; the menu costs a tap and is easy to miss.
          My recommendation is the header, because saving is a one-tap action you do while reading, and the menu is
          where Compare was when the review found nobody used it.
        </Question>
      </Panel>

      <Panel n={2} title="What a saved diagnosis looks like in the library">
        <ul className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
          {LIBRARY_ROWS.map((row) => (
            <li
              key={row.title}
              className={`flex items-center gap-3 px-3 py-3 ${row.isNew ? "bg-[color:var(--clinical-accent-soft)]" : "bg-[color:var(--surface)]"}`}
            >
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  row.isNew
                    ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                }`}
              >
                {row.type}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{row.title}</span>
                <span className="block truncate text-xs text-[color:var(--text-muted)]">{row.meta}</span>
              </span>
              <span className="hidden shrink-0 text-xs text-[color:var(--text-muted)] sm:block">{row.set}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
            </li>
          ))}
        </ul>

        <Question>
          The metadata line reads <em>code · category · criteria count</em>. Every other favourite type shows something
          source-backed there. A diagnosis has no source to cite, so this is the closest equivalent — it is what tells
          two saved anxiety disorders apart in a list. Confirm that is the right three facts, or name different ones.
        </Question>
      </Panel>

      <Panel n={3} title="What it costs to build, and the part that is irreversible">
        <ol className="space-y-2 text-sm leading-6 text-[color:var(--text-heading)]">
          <li>
            <strong className="font-bold text-[color:var(--text-heading)]">1. Two-step migration.</strong> Drop and
            re-add
            <code className="mx-1 rounded bg-[color:var(--surface-subtle)] px-1 py-0.5 font-mono text-xs">
              user_favourites_content_type_check
            </code>
            with <code className="rounded bg-[color:var(--surface-subtle)] px-1 py-0.5 font-mono text-xs">dsm</code>{" "}
            added, then a separate validate migration. This is exactly the therapy precedent from 2026-08-14, which is
            the reason this is a known-safe shape rather than a new one.
          </li>
          <li>
            <strong className="font-bold text-[color:var(--text-heading)]">2. Widen the enum</strong> in the favourites
            contract, and add a diagnosis branch to the reference check so a saved favourite must point at a real
            record.
          </li>
          <li>
            <strong className="font-bold text-[color:var(--text-heading)]">3. Wire the control</strong> and give the
            library its label and icon.
          </li>
        </ol>

        <p className="mt-3 rounded-lg border-l-[3px] border-l-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--danger-text)]">
          <strong className="font-bold">Irreversible step: </strong>
          merging the migration applies it to the live clinical database within seconds, with no deploy step in between.
          It is additive and widens what is allowed rather than narrowing it, so nothing existing breaks — but it merges
          inside an approved window, never on auto-merge.
        </p>
      </Panel>

      <footer className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-xs leading-5 text-[color:var(--text-muted)]">
        Static mockup. No account, no database, no network. The controls above change local state only, so nothing here
        can save anything.
      </footer>
    </main>
  );
}
