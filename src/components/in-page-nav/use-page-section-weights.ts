"use client";

import { useEffect, useState } from "react";

import { resolveVisibleElement } from "@/components/document-viewer/use-section-spy";
import { sectionTargetIds, type PageSection } from "@/components/in-page-nav/page-section-index";

/**
 * No segment may be thinner than this share of the tallest one. Without it a
 * short "Verification" footer beside a long criteria table renders as a hairline
 * the reader cannot see, let alone read as position.
 */
const shortestSegmentShareOfTallest = 0.12;

/**
 * `id>target,target` per section, joined by `|`. Sections are rebuilt on most
 * renders, so the array identity is never a usable effect dependency — this is
 * the value-equality stand-in, and it carries enough to rebuild the plan inside
 * the effect without a ref that could go stale.
 */
function measurementPlanKey(sections: readonly PageSection[]): string {
  return sections
    .filter((section) => section.weight === undefined)
    .map((section) => `${section.id}>${sectionTargetIds(section).join(",")}`)
    .join("|");
}

function parseMeasurementPlan(key: string): Array<{ id: string; targets: string[] }> {
  if (!key) return [];
  return key.split("|").map((entry) => {
    const [id, targets] = entry.split(">");
    return { id: id ?? "", targets: (targets ?? "").split(",").filter(Boolean) };
  });
}

function signature(weights: ReadonlyMap<string, number>): string {
  return Array.from(weights, ([id, weight]) => `${id}:${weight.toFixed(4)}`).join("|");
}

const noWeights: ReadonlyMap<string, number> = new Map();

/**
 * Measures how much of the page each section actually occupies, so the header's
 * segment track reads as "how far through" rather than "which of five".
 *
 * Documents and the differentials detail tabs compute weights from their own
 * payloads and pass them explicitly — a tab panel that is not on screen has no
 * height to measure. When every section carries an explicit weight this hook
 * observes nothing at all and returns an empty map, so those pages pay none of
 * this cost.
 */
export function usePageSectionWeights(sections: readonly PageSection[]): ReadonlyMap<string, number> {
  const planKey = measurementPlanKey(sections);
  // Keyed by the plan the measurement was taken against, so a plan change can
  // invalidate it during render rather than through a synchronous setState in
  // the effect body — which is a cascading render, and lint rejects it.
  const [measured, setMeasured] = useState<{ key: string; weights: ReadonlyMap<string, number> }>(() => ({
    key: planKey,
    weights: noWeights,
  }));

  useEffect(() => {
    const plan = parseMeasurementPlan(planKey);
    if (plan.length === 0 || typeof window === "undefined") return undefined;

    let frame = 0;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    // Re-observing an element that is already observed would fire the callback
    // again and schedule another measure, which re-observes — an endless loop.
    // Only genuinely new elements are handed to the observer.
    const observed = new WeakSet<HTMLElement>();

    const publish = (weights: ReadonlyMap<string, number>) => {
      setMeasured((current) =>
        current.key === planKey && signature(current.weights) === signature(weights)
          ? current
          : { key: planKey, weights },
      );
    };

    const measure = () => {
      frame = 0;
      const heights = plan.map(({ id, targets }) => {
        const element = resolveVisibleElement(targets.length ? targets : [id]);
        // Sections mount after the effect (record data arriving) and swap copies
        // across breakpoints, so the observer's targets are picked up here rather
        // than once at setup. Otherwise a late section's own resizes — an image
        // loading, a font swapping — change its height with nothing watching.
        if (element && resize && !observed.has(element)) {
          observed.add(element);
          resize.observe(element);
        }
        return { id, height: element?.offsetHeight ?? 0 };
      });
      const tallest = heights.reduce((max, entry) => Math.max(max, entry.height), 0);
      // Nothing is laid out yet (first frame, or every section hidden at this
      // breakpoint). Publish no weights and let the equal-share fallback stand
      // rather than dividing by zero into a track of NaN-width segments.
      if (tallest <= 0) {
        publish(noWeights);
        return;
      }

      const floor = tallest * shortestSegmentShareOfTallest;
      const floored = heights.map((entry) => ({ id: entry.id, value: Math.max(entry.height, floor) }));
      const total = floored.reduce((sum, entry) => sum + entry.value, 0) || 1;

      publish(new Map(floored.map((entry) => [entry.id, entry.value / total])));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    const cleanup: Array<() => void> = [];

    if (resize) cleanup.push(() => resize.disconnect());

    // Sections mount and unmount as record data arrives, and which breakpoint
    // copy is displayed changes without any element resizing.
    if (typeof MutationObserver !== "undefined") {
      const root = window.document.getElementById("main-content") ?? window.document.body;
      const mutations = new MutationObserver(schedule);
      mutations.observe(root, { childList: true, subtree: true });
      cleanup.push(() => mutations.disconnect());
    }

    window.addEventListener("resize", schedule, { passive: true });
    cleanup.push(() => window.removeEventListener("resize", schedule));

    schedule();

    return () => {
      cleanup.forEach((dispose) => dispose());
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [planKey]);

  // Measurements taken against a previous plan describe a page that is no longer
  // on screen; equal shares are the honest answer until the new ones land.
  return measured.key === planKey ? measured.weights : noWeights;
}
