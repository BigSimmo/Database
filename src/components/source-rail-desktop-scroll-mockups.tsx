"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, MousePointer2, Table2 } from "lucide-react";

import { focusRing } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Cited documents — reaching the off-screen cards with a mouse
 *
 * `AnswerSourceRail` is a horizontal scroller with its scrollbar hidden
 * (`[scrollbar-width:none]`), which is right on a phone and on a laptop
 * trackpad: a two-finger swipe moves it and no chrome is spent. With a
 * plain mouse there is no gesture at all. The only route left is
 * shift + wheel, which nobody discovers, so on a desktop PC every card
 * past the fade is simply unreachable — the sources are cited, drawn,
 * and then unopenable.
 *
 * Three directions, all keeping the phone behaviour byte-identical and
 * none of them restoring a visible scrollbar:
 *
 *   A  Edge chevrons     overlay buttons at each end, mouse only, shown
 *                        only on the side that has more to show
 *   B  Fit and expand    no sideways movement on desktop at all: one row
 *                        of cards plus "+N more", which wraps the rest
 *   C  Hover scrub       a 4 px track that appears under the rail on
 *                        hover, draggable, plus click-drag on the cards
 *
 * Wheel-to-horizontal is drawn as a separate switch rather than as part
 * of any one direction, because it composes with all three and because
 * taking over the page's vertical wheel is a decision worth making on
 * its own.
 *
 * The same fix is owed to the "Also in your library" row, which is the
 * second horizontal scroller on the same answer.
 * ------------------------------------------------------------------ */

type SampleSource = {
  title: string;
  page: number;
  status: string;
  cited: boolean;
  stale?: boolean;
  table?: boolean;
  image?: boolean;
};

/* Synthetic guideline titles. No patient content and no real document identifiers. */
const SOURCES: readonly SampleSource[] = [
  { title: "Lithium clinical guideline", page: 5, status: "Status unknown", cited: true, table: true },
  { title: "Mood stabiliser monitoring standard", page: 12, status: "Current", cited: true },
  { title: "Renal impairment prescribing note", page: 3, status: "Review due", cited: true, stale: true },
  { title: "Therapeutic drug monitoring handbook", page: 41, status: "Current", cited: true, table: true },
  { title: "Antenatal psychotropic guidance", page: 8, status: "Current", cited: true },
  { title: "Lithium toxicity response pathway", page: 2, status: "Current", cited: true, image: true },
  { title: "Formulary — mood stabilisers", page: 27, status: "Current", cited: true },
  { title: "Older adult prescribing addendum", page: 16, status: "Review due", cited: false, stale: true },
  { title: "Thyroid monitoring in lithium therapy", page: 9, status: "Current", cited: false },
  { title: "Inpatient medication reconciliation", page: 4, status: "Current", cited: false },
  { title: "Adult inpatient prescribing standard", page: 33, status: "Current", cited: false, table: true },
  { title: "Bipolar maintenance pathway", page: 19, status: "Current", cited: false },
];

const CARD_CLASS =
  "inline-flex min-h-12 min-w-0 items-center gap-2.5 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-1.5 text-left shadow-[var(--shadow-inset)] transition-[border-color,box-shadow] hover:border-[color:var(--border-strong)]";
const CARD_TEXT_WIDTH = "max-w-[158px]";

function SourceCard({ source, index }: { source: SampleSource; index: number }) {
  return (
    <button type="button" className={cn(CARD_CLASS, focusRing)}>
      <span
        aria-hidden="true"
        className={cn(
          "nums grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-[var(--radius-sm)] border px-1 text-2xs font-bold",
          !source.cited
            ? "border-dashed border-[color:var(--border-strong)] text-[color:var(--text-muted)]"
            : source.stale
              ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
              : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        )}
      >
        {source.cited ? index + 1 : "—"}
      </span>
      <span className="grid min-w-0 gap-0.5 text-left">
        <span
          className={cn(
            "block truncate text-xs font-semibold leading-tight text-[color:var(--text-heading)]",
            CARD_TEXT_WIDTH,
          )}
        >
          {source.title}
        </span>
        <span className={cn("flex items-center gap-1.5 truncate text-2xs leading-tight", CARD_TEXT_WIDTH, textMuted)}>
          <span className="shrink-0 tabular-nums">p. {source.page}</span>
          <span aria-hidden>·</span>
          <span className={source.stale ? "font-semibold text-[color:var(--warning)]" : undefined}>
            {source.status}
          </span>
          {source.table ? (
            <Table2 aria-hidden className="h-3 w-3 shrink-0 text-[color:var(--clinical-accent)]" />
          ) : null}
          {source.image ? (
            <ImageIcon aria-hidden className="h-3 w-3 shrink-0 text-[color:var(--clinical-accent)]" />
          ) : null}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------- behaviour ------------------------------- */

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Which ends of a scroller still have content behind them, kept in step with
 * scrolling, resizing, and the card list changing length. Both edges are
 * measured rather than inferred: a rail whose content fits shows no affordance
 * at all, which is the state the chrome has to disappear in.
 */
function useEdges(ref: RefObject<HTMLDivElement | null>) {
  const [edges, setEdges] = useState({ left: false, right: false, ratio: 1, offset: 0 });

  const sync = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({
      left: element.scrollLeft > 1,
      right: element.scrollLeft < max - 1,
      ratio: element.scrollWidth > 0 ? element.clientWidth / element.scrollWidth : 1,
      offset: element.scrollWidth > 0 ? element.scrollLeft / element.scrollWidth : 0,
    });
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    sync();
    element.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);
    return () => {
      element.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [ref, sync]);

  return edges;
}

/**
 * Turn a vertical wheel over the rail into horizontal movement.
 *
 * Deliberately conservative: it stands down for a pinch-zoom, for a gesture the
 * device already reports as horizontal, and — the one that matters — at either
 * end of the rail, so a page scrolled with the pointer resting over the sources
 * never stalls. Without that last condition a mouse user hits an invisible wall
 * halfway down the answer.
 */
function useWheelPan(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = element.scrollWidth - element.clientWidth;
      if (max <= 0) return;
      if (event.deltaY < 0 && element.scrollLeft <= 0) return;
      if (event.deltaY > 0 && element.scrollLeft >= max - 1) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref, enabled]);
}

function scrollByPage(element: HTMLDivElement | null, direction: 1 | -1) {
  if (!element) return;
  element.scrollBy({
    left: direction * Math.max(180, element.clientWidth * 0.8),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

const SCROLLER_CLASS =
  "flex snap-x snap-proximity gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "mb-1.5 flex items-baseline justify-between gap-2 text-2xs font-semibold uppercase tracking-wide",
        textMuted,
      )}
    >
      <span>Cited documents</span>
      {children}
    </p>
  );
}

/* -------------------------- A · edge chevrons --------------------------- */

function OptionAEdgeChevrons({
  sources,
  mouse,
  wheel,
}: {
  sources: readonly SampleSource[];
  mouse: boolean;
  wheel: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const edges = useEdges(scroller);
  useWheelPan(scroller, wheel);

  const arrow = (side: "left" | "right") => {
    const active = side === "left" ? edges.left : edges.right;
    if (!mouse || !active) return null;
    const Icon = side === "left" ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => scrollByPage(scroller.current, side === "left" ? -1 : 1)}
        className={cn(
          "absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full",
          "border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)]",
          "shadow-[var(--e2)] transition-opacity hover:bg-[color:var(--surface-subtle)] motion-reduce:transition-none",
          "opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100",
          // Overlaying the fade rather than straddling the card edge: half a button
          // hanging outside the answer card reads as a clipped element, not a control.
          side === "left" ? "left-1" : "right-1",
        )}
      >
        <Icon aria-hidden className="h-4 w-4" />
      </button>
    );
  };

  return (
    <section>
      <RailHeading>
        <span className="nums font-normal normal-case tracking-normal">{sources.length} cited</span>
      </RailHeading>
      <div className="group/rail relative min-w-0">
        <div ref={scroller} role="list" aria-label="Cited documents" className={cn(SCROLLER_CLASS, "pr-6")}>
          {sources.map((source, index) => (
            <div key={source.title} role="listitem" className="flex-none snap-start">
              <SourceCard source={source} index={index} />
            </div>
          ))}
        </div>
        {edges.right ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[color:var(--surface-raised)] to-transparent"
          />
        ) : null}
        {edges.left ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[color:var(--surface-raised)] to-transparent"
          />
        ) : null}
        {arrow("left")}
        {arrow("right")}
      </div>
    </section>
  );
}

/* -------------------------- B · fit and expand -------------------------- */

function OptionBFitAndExpand({ sources, mouse }: { sources: readonly SampleSource[]; mouse: boolean }) {
  const list = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(0);

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () => {
      const cards = Array.from(element.children) as HTMLElement[];
      if (!cards.length) return setHidden(0);
      const firstRowTop = cards[0].offsetTop;
      setHidden(cards.filter((card) => card.offsetTop > firstRowTop + 4).length);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [sources]);

  // On a touch device this direction stands down and the rail scrolls as it does
  // today: wrapping six cards onto three rows costs a phone more height than the
  // whole answer above them.
  if (!mouse) return <OptionAEdgeChevrons sources={sources} mouse={false} wheel={false} />;

  return (
    <section>
      <RailHeading>
        {hidden > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className={cn(
              "rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 py-0.5 text-2xs font-semibold normal-case tracking-normal",
              "text-[color:var(--clinical-accent)] transition-colors hover:bg-[color:var(--surface-subtle)] motion-reduce:transition-none",
              focusRing,
            )}
          >
            {expanded ? "Show fewer" : `+${hidden} more`}
          </button>
        ) : (
          <span className="nums font-normal normal-case tracking-normal">{sources.length} cited</span>
        )}
      </RailHeading>
      <div
        ref={list}
        role="list"
        aria-label="Cited documents"
        className={cn("flex flex-wrap gap-1.5", !expanded && "max-h-[3.25rem] overflow-hidden")}
      >
        {sources.map((source, index) => (
          <div key={source.title} role="listitem" className="flex-none">
            <SourceCard source={source} index={index} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------- C · hover scrub ---------------------------- */

function OptionCHoverScrub({
  sources,
  mouse,
  wheel,
}: {
  sources: readonly SampleSource[];
  mouse: boolean;
  wheel: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const edges = useEdges(scroller);
  useWheelPan(scroller, wheel);
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const scrollable = edges.ratio < 1;

  const seek = (clientX: number) => {
    const element = scroller.current;
    const rail = track.current;
    if (!element || !rail) return;
    const bounds = rail.getBoundingClientRect();
    const position = (clientX - bounds.left) / bounds.width;
    element.scrollLeft = position * element.scrollWidth - element.clientWidth / 2;
  };

  return (
    <section>
      <RailHeading>
        <span className="nums font-normal normal-case tracking-normal">{sources.length} cited</span>
      </RailHeading>
      <div className="group/rail min-w-0">
        <div
          ref={scroller}
          role="list"
          aria-label="Cited documents"
          className={cn(SCROLLER_CLASS, "pr-6", mouse && scrollable && "cursor-grab active:cursor-grabbing")}
          onPointerDown={(event) => {
            if (!mouse || event.pointerType !== "mouse" || !scrollable) return;
            drag.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
          }}
          onPointerMove={(event) => {
            const state = drag.current;
            const element = scroller.current;
            if (!state || !element) return;
            const dx = event.clientX - state.x;
            if (Math.abs(dx) > 5) state.moved = true;
            element.scrollLeft = state.scrollLeft - dx;
          }}
          onPointerUp={() => {
            // A pan that moved is not a click on the card underneath it.
            if (drag.current?.moved) window.setTimeout(() => (drag.current = null), 0);
            else drag.current = null;
          }}
          onPointerLeave={() => (drag.current = null)}
          onClickCapture={(event) => {
            if (drag.current?.moved) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {sources.map((source, index) => (
            <div key={source.title} role="listitem" className="flex-none snap-start">
              <SourceCard source={source} index={index} />
            </div>
          ))}
        </div>
        {mouse && scrollable ? (
          <div
            ref={track}
            aria-hidden="true"
            onPointerDown={(event) => {
              seek(event.clientX);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientX);
            }}
            className="mt-1 h-1 w-full cursor-pointer rounded-full bg-[color:var(--border)] opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 motion-reduce:transition-none"
          >
            <span
              className="block h-1 rounded-full bg-[color:var(--decoration-soft)]"
              style={{ width: `${Math.max(edges.ratio * 100, 12)}%`, marginLeft: `${edges.offset * 100}%` }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------- the study ------------------------------- */

function AnswerFrame({ width, caption, children }: { width: number; caption: string; children: React.ReactNode }) {
  return (
    <figure className="min-w-0" style={{ maxWidth: width }}>
      <figcaption className={cn("mb-2 text-2xs font-semibold uppercase tracking-wide", textMuted)}>
        {caption}
      </figcaption>
      <div className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--e2)]">
        <p className="mb-3 text-sm leading-relaxed text-[color:var(--text)]">
          For lithium, twice daily dosing should be spaced by <strong>12 hours</strong>. Lithium citrate per label 127.2
          mg/mL is equivalent to lithium carbonate 50 mg/mL.
        </p>
        {children}
      </div>
    </figure>
  );
}

function Option({
  letter,
  title,
  thesis,
  costs,
  recommended,
  children,
}: {
  letter: string;
  title: string;
  thesis: string;
  costs: readonly string[];
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-[color:var(--border)] pt-6">
      <header className="grid gap-1">
        <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-[color:var(--text-heading)]">
          <span className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] bg-[color:var(--clinical-accent-soft)] text-2xs font-bold text-[color:var(--clinical-accent)]">
            {letter}
          </span>
          {title}
          {recommended ? (
            <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
              Recommended
            </span>
          ) : null}
        </h2>
        <p className={cn("max-w-prose text-sm", textMuted)}>{thesis}</p>
      </header>
      {children}
      <ul className={cn("grid max-w-prose gap-1 text-xs", textMuted)}>
        {costs.map((cost) => (
          <li key={cost} className="flex gap-2">
            <span aria-hidden>·</span>
            <span>{cost}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const COUNTS = [3, 7, 12] as const;
const WIDTHS = [
  { label: "Narrow 620", value: 620 },
  { label: "Standard 760", value: 760 },
  { label: "Wide 920", value: 920 },
] as const;

export function SourceRailDesktopScrollMockupsPage() {
  const [count, setCount] = useState<number>(7);
  const [width, setWidth] = useState<number>(760);
  const [mouse, setMouse] = useState(true);
  const [wheel, setWheel] = useState(true);
  const sources = SOURCES.slice(0, count);

  const control =
    "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] transition-colors hover:bg-[color:var(--surface-subtle)] motion-reduce:transition-none";
  const controlOn =
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";

  return (
    <main className="mx-auto grid max-w-[1100px] gap-6 px-4 py-8">
      <header className="grid gap-2">
        <p className={cn("text-2xs font-semibold uppercase tracking-wide", textMuted)}>Answer · cited documents</p>
        <h1 className="text-xl font-semibold text-[color:var(--text-heading)]">
          Reaching the off-screen source cards with a mouse
        </h1>
        <p className="max-w-prose text-sm text-[color:var(--text)]">
          The rail scrolls sideways and its scrollbar is hidden. A finger swipes it and a trackpad swipes it, but a
          desktop mouse has no gesture at all, so cards past the fade cannot be opened. Three directions below. Each
          keeps the phone behaviour exactly as it is today and none of them brings a scrollbar back.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
        <span className={cn("text-2xs font-semibold uppercase tracking-wide", textMuted)}>Sources</span>
        {COUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCount(value)}
            className={cn(control, focusRing, count === value && controlOn)}
          >
            {value}
          </button>
        ))}
        <span className={cn("ml-3 text-2xs font-semibold uppercase tracking-wide", textMuted)}>Column</span>
        {WIDTHS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setWidth(option.value)}
            className={cn(control, focusRing, width === option.value && controlOn)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMouse((on) => !on)}
          className={cn(control, focusRing, "ml-3 inline-flex items-center gap-1.5", mouse && controlOn)}
        >
          <MousePointer2 aria-hidden className="h-3 w-3" />
          {mouse ? "Mouse (pointer: fine)" : "Touch (pointer: coarse)"}
        </button>
        <button
          type="button"
          onClick={() => setWheel((on) => !on)}
          className={cn(control, focusRing, wheel && controlOn)}
        >
          Wheel pans sideways {wheel ? "on" : "off"}
        </button>
      </div>

      <p className={cn("max-w-prose text-xs", textMuted)}>
        Every desktop-only affordance below is drawn only while the pointer toggle says mouse. In production that is a{" "}
        <code>pointer: fine</code> media query, so a phone and a tablet never render any of it. Wheel panning is drawn
        as its own switch because it composes with all three directions.
      </p>

      <Option
        letter="A"
        title="Edge chevrons, revealed on hover"
        thesis="Two round buttons overlaying the ends of the rail. They fade in when the pointer is over the rail, each one appears only while that side still has cards behind it, and a click moves the rail by roughly one screen of cards."
        costs={[
          "The pattern every reader already knows from a media carousel, so nothing has to be discovered.",
          "Overlays the existing fade rather than taking layout width, so no card is pushed off screen to make room for it.",
          "Not in the tab order. Tabbing already walks the cards and the browser scrolls each one into view, so a focusable button here would only add two empty tab stops.",
          "Costs two visible controls on hover, which is the most chrome of the three.",
          "Smooth scrolling drops to an instant jump under prefers-reduced-motion.",
        ]}
        recommended
      >
        <AnswerFrame width={width} caption="Desktop · hover the rail">
          <OptionAEdgeChevrons sources={sources} mouse={mouse} wheel={wheel} />
        </AnswerFrame>
      </Option>

      <Option
        letter="B"
        title="Fit and expand, no sideways movement"
        thesis="Desktop stops scrolling sideways altogether. One row of cards is shown, a chip in the heading says how many are hidden, and expanding wraps the rest onto further rows. Phones keep today's scroller."
        costs={[
          "Nothing is hidden behind a gesture, so the failure this is fixing cannot recur in any input mode.",
          "Keyboard and screen reader support come free. It is a list and a disclosure button, with no scroll mechanics to describe.",
          "Expanding pushes the follow-up questions down the page, which is the one thing the horizontal rail was built to avoid.",
          "Two layouts to maintain for one component, and the count only exists after a measuring pass in the browser.",
        ]}
      >
        <AnswerFrame width={width} caption="Desktop · collapsed to one row">
          <OptionBFitAndExpand sources={sources} mouse={mouse} />
        </AnswerFrame>
      </Option>

      <Option
        letter="C"
        title="Hover scrub track and drag to pan"
        thesis="No buttons. A 4 px track appears under the cards on hover and can be dragged or clicked, and the cards themselves can be grabbed and pushed. A drag that moved does not open the card underneath it."
        costs={[
          "The least chrome of the three, and at rest the rail looks exactly as it does today.",
          "The track is a thin target and dragging is a fine-motor action, which is worse than a button for anyone who finds precise pointing hard.",
          "Grab-to-pan has to suppress the click it would otherwise fire, and that suppression is the part most likely to feel wrong.",
          "It is a styled scrollbar in all but name, which is the thing the current design deliberately removed.",
        ]}
      >
        <AnswerFrame width={width} caption="Desktop · hover the rail, then drag either the cards or the track">
          <OptionCHoverScrub sources={sources} mouse={mouse} wheel={wheel} />
        </AnswerFrame>
      </Option>

      <section className="grid gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-4">
        <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">Recommendation</h2>
        <p className="max-w-prose text-sm text-[color:var(--text)]">
          A, with wheel panning switched on. It is the familiar pattern, it costs no layout height, it disappears
          entirely when the cards already fit, and it never reaches a phone. B is the safer answer if the rail is ever
          expected to hold more than about ten cards, because at that length a paged scroller is a poor way to find one
          named document. C reads well at rest but asks the most of the reader&rsquo;s hands for the least certainty.
        </p>
      </section>
    </main>
  );
}
