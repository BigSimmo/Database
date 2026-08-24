"use client";

import { ArrowLeft, Check, ChevronUp, Copy, Plus, Scale, Search, Trash2, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/ui-primitives";

import {
  ComparisonPreview,
  CurrentDefects,
  MAX_COMPARE,
  MockupSection,
  MockupShell,
  NoteCard,
  PhoneFrame,
  PhoneTopBar,
  ReviewPill,
  SLOT_LETTERS,
  SlotBadge,
  THERAPY_COUNT,
  bySlug,
  filterTherapies,
  focusRing,
  useCompareSet,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction C — Carry a compare tray.
 *
 * Selection stops being page content. A tray sits at the bottom of every
 * Therapy screen showing what you are carrying; you fill it from search
 * results and therapy records without ever visiting a compare screen with
 * nothing in it. The compare page is then only ever the comparison.
 * ------------------------------------------------------------------ */

const BROWSE_RESULTS = [
  "cognitive-behavioural-therapy-cbt",
  "acceptance-and-commitment-therapy-act",
  "behavioural-activation-ba",
  "interpersonal-psychotherapy-ipt",
  "dialectical-behaviour-therapy-dbt",
  "exposure-and-response-prevention-erp",
];

function TrayPhone() {
  const set = useCompareSet();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"browse" | "compare">("browse");
  const [query, setQuery] = useState("");
  const count = set.selected.length;
  const results = filterTherapies(query, "All").filter((therapy) =>
    query.trim() ? true : BROWSE_RESULTS.includes(therapy.slug),
  );

  return (
    <PhoneFrame
      label="Direction C — live"
      note="Add from the list. The tray fills at the bottom; tap it to expand, then Compare. You never see a compare screen with empty slots because you cannot reach one."
      tall
    >
      <PhoneTopBar title={view === "compare" ? "Compare" : "Therapy"} />

      {view === "browse" ? (
        <>
          <div className="shrink-0 px-4 pb-2 pt-3">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${THERAPY_COUNT} therapies`}
                aria-label="Search therapies"
                className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)]"
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
            {results.map((therapy) => {
              const held = set.selected.includes(therapy.slug);
              const blocked = !held && set.full;
              return (
                <li
                  key={therapy.slug}
                  className="flex items-center gap-2 border-b border-[color:var(--border)] py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-5 text-[color:var(--text-heading)]">{therapy.name}</p>
                    <p className="mt-0.5 truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                      {therapy.category}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (held ? set.remove(therapy.slug) : blocked ? undefined : set.add(therapy.slug))}
                    aria-pressed={held}
                    aria-disabled={blocked || undefined}
                    aria-label={
                      held
                        ? `Remove ${therapy.short} from the compare tray`
                        : `Add ${therapy.short} to the compare tray`
                    }
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
                      focusRing,
                      held
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
                        : blocked
                          ? "border-[color:var(--border)] text-[color:var(--text-muted)] opacity-40"
                          : "border-[color:var(--border-strong)] text-[color:var(--clinical-accent)]",
                    )}
                  >
                    {held ? (
                      <Check aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-3">
          <button
            type="button"
            onClick={() => setView("browse")}
            className={cn(
              "-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to therapies
          </button>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--text-heading)]">
            {set.items.map((item) => item.short).join(" vs ")}
          </h2>
          <button
            type="button"
            onClick={() => undefined}
            className={cn(
              "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-bold text-[color:var(--text-heading)]",
              focusRing,
            )}
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            Copy set as text
          </button>
          <div className="mt-4">
            <ComparisonPreview items={set.items} />
          </div>
        </div>
      )}

      {/* The tray. Present on every Therapy screen, above the composer. */}
      {expanded ? (
        <button
          type="button"
          aria-label="Collapse the compare tray"
          onClick={() => setExpanded(false)}
          className="absolute inset-0 z-10"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-heading) 25%, transparent)" }}
        />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]">
          {expanded ? (
            <div className="max-h-72 overflow-y-auto px-4 pb-2 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-soft)]">
                  Compare tray · {count} of {MAX_COMPARE}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set.clear();
                    setView("browse");
                  }}
                  aria-label="Empty the compare tray"
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-3xs font-bold text-[color:var(--text-muted)]",
                    focusRing,
                  )}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Empty
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {set.items.map((therapy, index) => (
                  <li
                    key={therapy.slug}
                    className="flex items-center gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5"
                  >
                    <SlotBadge index={index} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[color:var(--text-heading)]">{therapy.name}</p>
                      <div className="mt-1">
                        <ReviewPill />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        set.remove(therapy.slug);
                        if (count <= 2) setView("browse");
                      }}
                      aria-label={`Remove ${therapy.short}`}
                      className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)]",
                        focusRing,
                      )}
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
                {count === 0 ? (
                  <li className="rounded-xl border border-dashed border-[color:var(--border-strong)] px-3 py-4 text-center text-xs text-[color:var(--text-muted)]">
                    Nothing in the tray yet. Add from any therapy in the list above.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {/* The collapsed bar. Always visible; the whole bar is the toggle. */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className={cn("flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-1 text-left", focusRing)}
            >
              <span className="flex shrink-0 gap-0.5">
                {Array.from({ length: MAX_COMPARE }, (_, index) => {
                  const therapy = set.items[index];
                  return (
                    <span
                      key={index}
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full border-2 border-[color:var(--surface-lux)] text-3xs font-black",
                        therapy
                          ? index === 0
                            ? "bg-[color:var(--clinical-accent)] text-[color:var(--command-contrast)]"
                            : index === 1
                              ? "bg-[color:var(--info)] text-[color:var(--command-contrast)]"
                              : "bg-[color:var(--text-muted)] text-[color:var(--command-contrast)]"
                          : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
                      )}
                    >
                      {therapy ? SLOT_LETTERS[index] : "·"}
                    </span>
                  );
                })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">
                  {count === 0
                    ? "Compare tray empty"
                    : count === 1
                      ? `${set.items[0]?.short} — add one more`
                      : set.items.map((item) => item.short).join(" · ")}
                </span>
                <span className="block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                  {count} of {MAX_COMPARE} selected
                </span>
              </span>
              <ChevronUp
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition", expanded && "rotate-180")}
              />
            </button>
            <button
              type="button"
              onClick={() => (count >= 2 ? (setView("compare"), setExpanded(false)) : undefined)}
              aria-disabled={count < 2 || undefined}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold",
                focusRing,
                count >= 2
                  ? "bg-[color:var(--command)] text-[color:var(--command-contrast)]"
                  : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
              )}
            >
              <Scale aria-hidden="true" className="h-4 w-4" />
              Compare
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function TrayEmptyPhone() {
  return (
    <PhoneFrame
      label="Direction C — the tray at rest"
      note="With nothing selected the tray is a 68 px bar with four hollow dots. It is the only thing on any Therapy screen that mentions comparing, and it never occupies the page body."
    >
      <PhoneTopBar />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3">
          <Search aria-hidden="true" className="h-4 w-4 text-[color:var(--text-muted)]" />
          <span className="text-sm text-[color:var(--text-muted)]">Search 205 therapies</span>
        </div>
        <ul className="mt-1">
          {BROWSE_RESULTS.slice(0, 5).map((slug) => {
            const therapy = bySlug(slug);
            if (!therapy) return null;
            return (
              <li key={slug} className="flex items-center gap-2 border-b border-[color:var(--border)] py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                    {therapy.name}
                  </span>
                  <span className="mt-0.5 block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                    {therapy.category}
                  </span>
                </span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:var(--border-strong)] text-[color:var(--clinical-accent)]">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex shrink-0 gap-0.5">
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={index}
                className="grid h-6 w-6 place-items-center rounded-full border-2 border-[color:var(--surface-lux)] bg-[color:var(--surface-inset)] text-3xs font-black text-[color:var(--text-muted)]"
              >
                ·
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-[color:var(--text-heading)]">Compare tray empty</span>
            <span className="block text-3xs font-semibold text-[color:var(--text-muted)]">0 of 4 selected</span>
          </span>
          <span className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-[color:var(--surface-inset)] px-3 text-xs font-extrabold text-[color:var(--text-muted)]">
            <Scale aria-hidden="true" className="h-4 w-4" />
            Compare
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function TherapyCompareTrayMockups() {
  return (
    <MockupShell
      current="therapy-compare-tray"
      letter="C"
      name="Carry a compare tray"
      headline="Fill the set where the therapies are."
      intro="The deepest change of the three: selection stops being page content at all. A tray docks at the bottom of every Therapy screen, you fill it as you browse or search, and the compare page is only ever reached with something already in it. There is no empty compare screen to design because there is no way to open one."
    >
      <CurrentDefects />

      <MockupSection
        id="c-live"
        title="The screen, live"
        intro="Add two or three from the list, tap the tray to expand it, then press Compare. Use Back to therapies to return — the tray keeps its contents."
      >
        <div className="flex flex-wrap items-start gap-8">
          <TrayPhone />
          <TrayEmptyPhone />
        </div>
      </MockupSection>

      <MockupSection id="c-rules" title="The rules this direction commits to">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="You add where you are looking"
            body="A plus beside each search result and each therapy record. Choosing a therapy to compare no longer means leaving the therapy you were reading, which is the actual reason someone opens the compare screen in the first place."
          />
          <NoteCard
            title="Empty state is 68 px, not a page"
            body="Nothing selected renders as four hollow dots and a dimmed Compare. The whole viewport above stays available for the 205 records you are choosing between."
          />
          <NoteCard
            title="State is always in sight"
            body="`2 of 4 selected` sits on the tray, beside the two initials it is counting, on every screen. That is what the detached header badge was trying to be."
          />
          <NoteCard
            title="Expanding is where management happens"
            body="One tap raises the tray into a half sheet with the ordered slots, review status and a remove control each, plus Empty. Reordering by drag is a natural fit here and has nowhere to live in the other two."
          />
          <NoteCard
            tone="warn"
            title="This collides with the phone composer"
            body="`docs/search-chrome-behaviour.md` gives one owner per page and an edge-to-edge composer flush to the viewport bottom. A tray must stack above it, hide with it on scroll, and take a zero reserve when hidden — otherwise it is the second fixed bottom bar the contract forbids."
          />
          <NoteCard
            tone="warn"
            title="It is a mode-wide commitment"
            body="A tray on Compare only is worse than what exists now. It has to be on search, browse, records and pathways to be worth anything — which means every Therapy screen changes, not one."
          />
        </div>
      </MockupSection>

      <MockupSection id="c-cost" title="What it costs to build">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            title="Largest of the three"
            body="A persistent tray component, add controls on result rows and record headers, shared selection state above the route, and the chrome negotiation with the composer and the scroll-hide owner."
          />
          <NoteCard
            title="It changes what Compare is for"
            body="The compare route stops being a place you go to choose and becomes a place you go to read. That is the right model, but it needs the nav strip and any deep links into `/therapy-compass/compare` reconsidered with it."
          />
          <NoteCard
            tone="warn"
            title="Verification is wider"
            body="Phone chrome changes mean `npm run verify:phone-chrome` and its owner/journey selection, not just a focused component test — the reserve helper, CSS tokens and phone-scroll coverage all move together."
          />
        </div>
      </MockupSection>

      <MockupSection id="c-pick" title="If you only want one of the three">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="Ship A"
            body="It is the smallest diff, it is the literal answer to the ask, it lands on all five compare screens at once, and nothing in B or C is blocked by it later."
          />
          <NoteCard
            title="Then B's sheet"
            body="Multi-select in one pass is the natural second step once the empty slots are gone, and it reuses A's picker rather than replacing it."
          />
          <NoteCard
            title="C is a separate decision"
            body="Worth doing, but it is a Therapy-mode change with a phone-chrome contract attached, not a compare-screen fix. Do not bundle it with either of the others."
          />
        </div>
      </MockupSection>
    </MockupShell>
  );
}
