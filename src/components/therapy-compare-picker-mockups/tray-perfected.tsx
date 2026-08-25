"use client";

import { ArrowLeft, Check, ChevronUp, Copy, FileText, Plus, Scale, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type UIEvent } from "react";

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
 * Direction C, perfected.
 *
 * Same model as the first tray study — you fill the set where the therapies
 * are, and the compare screen only ever holds a comparison — with the four
 * things that study got wrong fixed:
 *
 *   1. The tray does not exist until something is in it. An empty Therapy
 *      screen is exactly as tall as it is today.
 *   2. The tray and the composer are one bottom stack that hides together on
 *      scroll and takes a zero content reserve while hidden, which is what
 *      `docs/search-chrome-behaviour.md` requires of phone chrome.
 *   3. You can add from a therapy record, not only from a list — that is the
 *      whole point of carrying a set, and the first study never showed it.
 *   4. Arrival is legible: the tray rises the first time, and the slot it
 *      filled marks itself, so a tap that changes state off-screen still
 *      reads as having done something.
 * ------------------------------------------------------------------ */

/**
 * The real list is 205 records. The prototype shows every fixture rather than a
 * handful, because a short list cannot demonstrate scroll-hide honestly — it
 * un-scrolls the moment the reserve is released.
 */

/** Heights the reserve maths depends on, kept in one place and to scale. */
const COMPOSER_H = 62;
const TRAY_H = 64;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

type Screen = { kind: "list" } | { kind: "record"; slug: string } | { kind: "compare" };

function PerfectedPhone() {
  const set = useCompareSet();
  const reduced = useReducedMotion();
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const lastScroll = useRef(0);

  const count = set.selected.length;
  const hasTray = count > 0;
  // Derived, never latched: emptying the tray cannot strand you on a blank
  // comparison, whichever control did the emptying.
  const showCompare = screen.kind === "compare" && count >= 2;
  const record = screen.kind === "record" ? bySlug(screen.slug) : undefined;

  // Hidden chrome takes a zero reserve — not a residual pad, not the safe-area
  // inset. Visible chrome reserves exactly its own height.
  const chromeVisible = !hidden || expanded;
  const reserve = chromeVisible ? COMPOSER_H + (hasTray ? TRAY_H : 0) : 0;

  function onScroll(event: UIEvent<HTMLElement>) {
    const top = event.currentTarget.scrollTop;
    const delta = top - lastScroll.current;
    if (Math.abs(delta) < 6) return;
    lastScroll.current = top;
    if (expanded) return;
    setHidden(delta > 0 && top > 40);
  }

  function add(slug: string) {
    if (set.full || set.selected.includes(slug)) return;
    const index = count;
    set.add(slug);
    setHidden(false);
    setLanded(index);
    window.setTimeout(() => setLanded(null), 900);
  }

  const transition = reduced ? undefined : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <PhoneFrame
      label="Direction C — perfected — live"
      note="Add one and the tray rises. Scroll the list and both bottom bars leave together; scroll back up and they return. With nothing selected there is no tray at all."
      tall
    >
      <PhoneTopBar title={showCompare ? "Compare" : "Therapy"} />

      {/* ---------------- Compare ---------------- */}
      {showCompare ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-3"
          style={{ paddingBottom: reserve + 12 }}
          onScroll={onScroll}
        >
          <button
            type="button"
            onClick={() => setScreen({ kind: "list" })}
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
      ) : record ? (
        /* ---------------- A therapy record ---------------- */
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-3"
          style={{ paddingBottom: reserve + 12 }}
          onScroll={onScroll}
        >
          <button
            type="button"
            onClick={() => setScreen({ kind: "list" })}
            className={cn(
              "-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            All therapies
          </button>
          <h2 className="mt-1 text-xl font-semibold leading-7 tracking-tight text-[color:var(--text-heading)]">
            {record.name}
          </h2>
          <p className="mt-1 text-3xs font-semibold text-[color:var(--text-muted)]">{record.category}</p>
          <div className="mt-2">
            <ReviewPill />
          </div>

          {/* The point of the whole direction: add without leaving what you
              are reading. */}
          <button
            type="button"
            onClick={() => (set.selected.includes(record.slug) ? set.remove(record.slug) : add(record.slug))}
            aria-pressed={set.selected.includes(record.slug)}
            aria-disabled={!set.selected.includes(record.slug) && set.full ? true : undefined}
            title={
              !set.selected.includes(record.slug) && set.full
                ? `Tray full — remove one to add ${record.short}`
                : undefined
            }
            className={cn(
              "mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold",
              focusRing,
              set.selected.includes(record.slug)
                ? "border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
                : "bg-[color:var(--command)] text-[color:var(--command-contrast)]",
            )}
            style={!set.selected.includes(record.slug) && set.full ? { opacity: 0.4 } : undefined}
          >
            {set.selected.includes(record.slug) ? (
              <>
                <Check aria-hidden="true" className="h-4 w-4" />
                In compare tray
              </>
            ) : (
              <>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add to compare
              </>
            )}
          </button>

          <div className="mt-4 space-y-2.5">
            <RecordBlock label="Best fit" body={record.fit} />
            <RecordBlock label="Time required" body={record.time} />
            <RecordBlock label="Clinician skill" body={record.complexity} />
            <RecordBlock label="When not to use" body={record.caution} warn />
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-3xs font-semibold text-[color:var(--text-muted)]">
            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
            Placeholder copy — layout only, not clinical content.
          </p>
        </div>
      ) : (
        /* ---------------- The therapy list ---------------- */
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
          <ul
            className="min-h-0 flex-1 overflow-y-auto px-4"
            style={{ paddingBottom: reserve + 12 }}
            onScroll={onScroll}
          >
            {filterTherapies(query, "All").map((therapy) => {
              const held = set.selected.includes(therapy.slug);
              const blocked = !held && set.full;
              return (
                <li
                  key={therapy.slug}
                  className="flex items-center gap-2 border-b border-[color:var(--border)] py-1.5 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setScreen({ kind: "record", slug: therapy.slug })}
                    className={cn("min-w-0 flex-1 py-2 text-left", focusRing)}
                  >
                    <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                      {therapy.name}
                    </span>
                    <span className="mt-0.5 block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                      {therapy.category}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (held ? set.remove(therapy.slug) : blocked ? undefined : add(therapy.slug))}
                    aria-pressed={held}
                    aria-disabled={blocked || undefined}
                    title={blocked ? `Tray full — remove one to add ${therapy.short}` : undefined}
                    aria-label={
                      held
                        ? `Remove ${therapy.short} from the compare tray`
                        : blocked
                          ? `Cannot add ${therapy.short} — the compare tray already holds ${MAX_COMPARE}`
                          : `Add ${therapy.short} to the compare tray`
                    }
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
                      focusRing,
                      held
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
                        : blocked
                          ? "border-[color:var(--border)] text-[color:var(--text-muted)]"
                          : "border-[color:var(--border-strong)] text-[color:var(--clinical-accent)]",
                    )}
                    style={blocked ? { opacity: 0.4 } : undefined}
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
      )}

      {/* Scrim, only while the tray is open as a sheet. */}
      {expanded ? (
        <button
          type="button"
          aria-label="Collapse the compare tray"
          onClick={() => setExpanded(false)}
          className="absolute inset-0 z-10"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-heading) 28%, transparent)" }}
        />
      ) : null}

      {/* ---------------- One bottom stack: tray above composer ---------------- */}
      <div
        className="absolute inset-x-0 bottom-0 z-20"
        style={{
          transform: chromeVisible ? "translateY(0)" : `translateY(${COMPOSER_H + (hasTray ? TRAY_H : 0)}px)`,
          transition,
        }}
      >
        {/* The expanded sheet. */}
        {expanded && hasTray ? (
          <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 pb-2 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-soft)]">
                Compare tray · {count} of {MAX_COMPARE}
                {set.full ? " · full" : ""}
              </p>
              <button
                type="button"
                onClick={set.clear}
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
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
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
                    onClick={() => set.remove(therapy.slug)}
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
            </ul>
            {count === 1 ? (
              <p className="mt-2 text-3xs font-semibold text-[color:var(--text-muted)]">
                Add one more to compare. Up to {MAX_COMPARE}.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* The collapsed bar. Only exists once something is in it. */}
        {hasTray ? (
          <div
            className="flex items-center gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3"
            style={{ height: TRAY_H }}
          >
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-label={`Compare tray, ${count} of ${MAX_COMPARE} selected`}
              className={cn("flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-1 text-left", focusRing)}
            >
              <span className="flex shrink-0 gap-0.5">
                {Array.from({ length: MAX_COMPARE }, (_, index) => {
                  const therapy = set.items[index];
                  const isLanded = landed === index && !reduced;
                  return (
                    <span
                      key={index}
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-3xs font-black",
                        therapy
                          ? index === 0
                            ? "bg-[color:var(--clinical-accent)] text-[color:var(--command-contrast)]"
                            : index === 1
                              ? "bg-[color:var(--info)] text-[color:var(--command-contrast)]"
                              : "bg-[color:var(--text-muted)] text-[color:var(--command-contrast)]"
                          : "border border-dashed border-[color:var(--border-strong)] text-[color:var(--text-muted)]",
                      )}
                      style={
                        isLanded
                          ? { transform: "scale(1.25)", transition: "transform 300ms ease-out" }
                          : { transform: "scale(1)", transition: reduced ? undefined : "transform 300ms ease-out" }
                      }
                    >
                      {therapy ? SLOT_LETTERS[index] : ""}
                    </span>
                  );
                })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">
                  {count === 1 ? `${set.items[0]?.short} — add one more` : set.items.map((i) => i.short).join(" · ")}
                </span>
                <span className="block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                  {count} of {MAX_COMPARE} selected
                </span>
              </span>
              <ChevronUp
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]"
                style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition }}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                if (count < 2) return;
                setScreen({ kind: "compare" });
                setExpanded(false);
                setHidden(false);
              }}
              aria-disabled={count < 2 || undefined}
              title={count < 2 ? "Add one more therapy to compare" : undefined}
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
        ) : null}

        {/* The universal composer, unchanged and still the bottom-most owner. */}
        <div
          className="border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3"
          style={{ height: COMPOSER_H, paddingTop: 10 }}
        >
          <div className="flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
            <span className="text-xs text-[color:var(--text-muted)]">Search therapies…</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function RecordBlock({ label, body, warn }: { label: string; body: string; warn?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        warn
          ? "border-[color:var(--border-strong)] bg-[color:var(--warning-bg)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <p
        className={cn(
          "text-3xs font-black uppercase tracking-eyebrow",
          warn ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]",
        )}
      >
        {label}
      </p>
      <p
        className={cn("mt-1 text-xs leading-5", warn ? "text-[color:var(--warning-text)]" : "text-[color:var(--text)]")}
      >
        {body}
      </p>
    </div>
  );
}

const RESTING_ROWS = [
  "cognitive-behavioural-therapy-cbt",
  "acceptance-and-commitment-therapy-act",
  "behavioural-activation-ba",
  "interpersonal-psychotherapy-ipt",
  "dialectical-behaviour-therapy-dbt",
  "exposure-and-response-prevention-erp",
];

/** The zero state, drawn on its own so the cost of the idea is visible: none. */
function RestingPhone() {
  return (
    <PhoneFrame
      label="Nothing selected — no tray at all"
      note="This is the whole argument for the perfected version. With an empty set the screen is identical to today's: one composer at the bottom and not a pixel more. The tray is paid for only once it is carrying something."
    >
      <PhoneTopBar />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3">
          <Search aria-hidden="true" className="h-4 w-4 text-[color:var(--text-muted)]" />
          <span className="text-sm text-[color:var(--text-muted)]">Search 205 therapies</span>
        </div>
        <ul>
          {RESTING_ROWS.map((slug) => {
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
      <div
        className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3"
        style={{ height: COMPOSER_H, paddingTop: 10 }}
      >
        <div className="flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5">
          <Search aria-hidden="true" className="h-4 w-4 text-[color:var(--text-muted)]" />
          <span className="text-xs text-[color:var(--text-muted)]">Search therapies…</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function TherapyComparePerfectedMockups() {
  return (
    <MockupShell
      current="therapy-compare-perfected"
      letter="C+"
      name="Carry a compare tray, perfected"
      headline="The tray costs nothing until it is carrying something."
      intro="The first tray study was the strongest idea of the three and the weakest execution: it drew a permanent second bar across the bottom of every screen, hid the composer it had to share that space with, and never showed you adding a therapy from the one place you would most want to — the record you are reading. This version fixes all three and keeps what made it good."
    >
      <MockupSection
        id="perfected-live"
        title="The screen, live"
        intro="Three things to try, in this order. Add one therapy and watch the tray arrive. Scroll the list down, then back up. Open a therapy by tapping its name, and add it from there without losing your place."
      >
        <div className="flex flex-wrap items-start gap-8">
          <PerfectedPhone />
          <RestingPhone />
        </div>
      </MockupSection>

      <MockupSection id="perfected-changes" title="What changed from the first tray study">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="No tray until there is a set"
            body="The first version drew a 68 px bar with four hollow dots before you had chosen anything — permanent furniture advertising a feature you were not using. Now an empty Therapy screen is byte-for-byte what it is today. The bar appears on the first add and leaves when you empty it."
          />
          <NoteCard
            tone="accent"
            title="One bottom stack that hides as one"
            body="Tray and composer sit in a single container that translates off together on scroll-down and returns on scroll-up, and the content reserve goes to zero while they are gone — not a residual pad, not the safe-area inset. That is the contract in `docs/search-chrome-behaviour.md`, and the first study only promised it in prose."
          />
          <NoteCard
            tone="accent"
            title="Add from the record you are reading"
            body="Tap a therapy's name to open it, and the primary action on that record adds it to the tray. This is the reason to carry a set at all, and the first study only ever showed adding from a list — which any picker can already do."
          />
          <NoteCard
            title="The tap is legible from the far end of the screen"
            body="Adding is a state change that happens 600 px from your thumb. The filled slot marks itself as it lands, the row's control flips to a tick, and the bar names what it holds — so nothing depends on you noticing a number change. The motion is dropped entirely under reduced-motion."
          />
          <NoteCard
            title="The ceiling explains itself"
            body="At four, remaining controls dim, carry `aria-disabled`, and say `Tray full — remove one to add ACT` on long-press or hover; the heading reads `4 of 4 · full`. No native disabled attribute, so the tab stop and the reason both survive."
          />
          <NoteCard
            title="Compare is unreachable without a set, by construction"
            body="The comparison view is derived from the count rather than latched, so emptying the tray while reading a comparison returns you to the list — whichever control emptied it, including any added later."
          />
        </div>
      </MockupSection>

      <MockupSection id="perfected-cost" title="What it would take to build">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            title="Still the largest of the four"
            body="A persistent tray component, add controls on result rows and record headers, selection state lifted above the route, and the scroll-hide negotiated with the existing collapse owner rather than a second one. This mockup fakes that last part with its own scroll handler; the real build must use the phone chrome's single owner."
          />
          <NoteCard
            title="It changes what Compare is for"
            body="The compare route stops being where you choose and becomes where you read. Worth doing deliberately: the nav entry and any deep links into it need revisiting at the same time."
          />
          <NoteCard
            tone="warn"
            title="Verification is wider than one component"
            body="Phone-chrome changes mean the reserve helper, the CSS tokens, the phone-scroll browser coverage and the static contract tests move together, and `npm run verify:phone-chrome` is the gate — not a focused component test."
          />
          <NoteCard
            tone="warn"
            title="Direction A is still worth shipping first"
            body="Even with this built, someone can reach the comparison screen with nothing selected. It should not greet them with four empty slots. A is a small, independent fix that stays correct underneath this one."
          />
          <NoteCard
            title="Sequence"
            body="Ship A. Then build this as its own piece of work with the phone-chrome contract in front of you. Nothing in A has to be undone to get here."
          />
          <NoteCard
            title="Still design scratch"
            body="These routes 404 in production and the comparison copy is placeholder text for layout only. Every record in the real catalogue is `needs_review`, which is why each card says so."
          />
        </div>
      </MockupSection>

      <CurrentDefects />
    </MockupShell>
  );
}
