import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const answerStatusSource = readFileSync(
  new URL("../src/components/clinical-dashboard/answer-status.tsx", import.meta.url),
  "utf8",
);

/**
 * The successor to `answer-activity-trace-css.test.ts`, which pinned the
 * scrolling ECG strip the answer-progress panel used to draw. That component was
 * deleted when the wait was redrawn as a single quiet line, so its CSS contract
 * went with it — but the *reason* that file existed did not, and this file
 * carries it forward.
 *
 * The defect it guards is real and was reported from a physical iPhone: with OS
 * Reduce Motion on, the app's own reduced-motion CSS stopped every animation and
 * additionally set the trace to `opacity: 0`, so the only progress indicator on
 * the surface disappeared and users watched a dead panel while an answer
 * generated. Suppressing motion must never remove the indicator.
 *
 * The new indicator is a 5px dot whose animation is an opacity breath. That
 * choice is what makes the guarantee cheap to hold: a stopped dot is a correct,
 * fully visible bullet, whereas a stopped spinner is a fragment of a circle.
 */
function keyframes(name: string) {
  const start = globalsCss.indexOf(`@keyframes ${name}`);
  expect(start, `${name} keyframes are missing`).toBeGreaterThanOrEqual(0);

  let depth = 0;
  let opened = false;
  for (let index = start; index < globalsCss.length; index += 1) {
    if (globalsCss[index] === "{") {
      depth += 1;
      opened = true;
    } else if (globalsCss[index] === "}") {
      depth -= 1;
      if (opened && depth === 0) return globalsCss.slice(start, index + 1);
    }
  }

  throw new Error(`${name} keyframes are unterminated`);
}

/** The character range of the `@layer components { … }` block, so a rule can be shown to sit
 *  outside it. Layered rules lose to unlayered ones in the cascade regardless of specificity,
 *  which is the whole reason the rail's override is declared where it is. */
function componentsLayerRange() {
  const start = globalsCss.indexOf("@layer components {");
  expect(start, "@layer components is missing").toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let index = start; index < globalsCss.length; index += 1) {
    if (globalsCss[index] === "{") depth += 1;
    else if (globalsCss[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        const end = index;
        return { contains: (position: number) => position > start && position < end };
      }
    }
  }

  throw new Error("@layer components is unterminated");
}

function dotRuleBodies() {
  return [...globalsCss.matchAll(/\.answer-progress-dot\s*{([^}]*)}/g)].map((match) => match[1] ?? "");
}

describe("answer progress indicator CSS", () => {
  it("never animates the indicator to invisible", () => {
    const breath = keyframes("answer-progress-breath");
    const opacities = [...breath.matchAll(/opacity:\s*([\d.]+)\s*;/g)].map((match) => Number(match[1]));

    expect(opacities.length, "the breath is an opacity animation").toBeGreaterThanOrEqual(2);
    for (const opacity of opacities) {
      expect(opacity).toBeGreaterThan(0.2);
    }
  });

  it("leaves the indicator fully visible when motion is suppressed", () => {
    // The regression this whole file exists for. A stopped animation must leave a
    // painted dot, and the resting frame must not be a faded one either — there
    // is no strip to soften here, so the dot simply sits at full opacity.
    const stopped = dotRuleBodies().filter((body) => /animation:\s*none/.test(body));

    expect(stopped.length, "expected reduced-motion and data-motion=reduced rules").toBeGreaterThanOrEqual(2);
    for (const body of stopped) {
      expect(body).not.toMatch(/opacity:\s*0\s*;/);
      expect(body).toMatch(/opacity:\s*1\s*;/);
      expect(body).not.toMatch(/display:\s*none/);
      expect(body).not.toMatch(/visibility:\s*hidden/);
    }
  });

  it("lets the in-app motion preference opt back in over the OS setting", () => {
    // iOS Reduce Motion is commonly on for reasons unrelated to vestibular
    // sensitivity. Without this override there is no in-app way to get the
    // answer-progress feedback back on a physical iPhone. A Tailwind
    // `motion-safe:` variant cannot express this, which is why the animation
    // lives in globals.css rather than on the element.
    expect(globalsCss).toMatch(/@custom-variant\s+motion-reduce\s*{/);
    expect(globalsCss).toMatch(/@custom-variant\s+motion-safe\s*{/);
    expect(globalsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) {\s*html:not\(\[data-motion="full"\]\) \.answer-progress-dot/s,
    );
    // The universal suppression is what froze the old step spinner; it must be gated too.
    expect(globalsCss).toMatch(/html:not\(\[data-motion="full"\]\) \*,/);
  });

  it("hosts the indicator on the element the component actually renders", () => {
    // A CSS contract that no markup opts into is a comment. Both the progress
    // line and the pre-first-event skeleton carry the class.
    // Exactly one. The skeleton that renders in the answer's body slot during the
    // same window carries no indicator and no status text of its own, because two
    // indicators disagreeing on one screen is worse than one.
    expect([...answerStatusSource.matchAll(/data-slot="answer-progress-dot"/g)]).toHaveLength(1);
    // …and it opts into the CSS contract by class, not only by data-slot.
    expect(answerStatusSource).toContain("answer-progress-dot grid");
  });

  it("paces the arriving source rail apart from the shared cascade rung", () => {
    // The rail's cards must arrive one at a time, not as one block. `.stagger-item`
    // ships 35ms, which is right for the prose skeleton bars directly above the rail
    // and for search result grids; six cards at that interval is 175ms and reads as a
    // single movement. The override is pinned here so a later edit to the shared rung
    // cannot silently re-collapse the rail into one beat.
    const railRule = globalsCss.match(/\.answer-sources-arriving \.stagger-item\s*{([^}]*)}/);
    expect(railRule, "the rail's stagger override is missing").not.toBeNull();
    const interval = Number(railRule?.[1]?.match(/\*\s*(\d+)ms/)?.[1]);
    expect(interval).toBeGreaterThan(35);

    // Declared UNLAYERED. `.answer-sources-arriving` itself lives in @layer components,
    // and a layered override loses to the unlayered `.stagger-item` rule whatever its
    // specificity — the rail would silently keep the 35ms rung.
    const railIndex = globalsCss.indexOf(".answer-sources-arriving .stagger-item");
    expect(railIndex).toBeGreaterThan(0);
    expect(componentsLayerRange().contains(railIndex), "the override must not sit in @layer components").toBe(false);

    // And the reduced-motion resets must still come after it, so a suppressed rail
    // shows every card at once rather than holding six invisible cards for 450ms.
    expect(globalsCss.lastIndexOf('html[data-motion="reduced"] .stagger-item')).toBeGreaterThan(
      globalsCss.indexOf(".answer-sources-arriving .stagger-item"),
    );
  });

  it("keeps the retired ECG trace and its animation deleted", () => {
    // The component, its CSS, its two animation tokens and its keyframes were
    // removed together. A partial revival — markup without the compositor rules,
    // or rules without the reduced-motion guard above — is how the original
    // defect got shipped.
    for (const retired of [
      "answer-activity-trace",
      "answer-ecg-scroll",
      "--animate-answer-ecg",
      "--animate-answer-ecg-compact",
    ]) {
      expect(globalsCss).not.toContain(retired);
    }
    expect(answerStatusSource).not.toContain("answer-activity-trace");
  });
});
