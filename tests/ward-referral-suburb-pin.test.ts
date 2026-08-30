import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * THE SUBURB NOTE, AND THE MODEL FACT THAT IS THE ONLY REASON IT IS TRUE.
 *
 * The intake form's Suburb control is answered by a clinician and then deliberately dropped: it
 * reads the catchment for the destination picker below it and goes no further. `RECEIVE_REFERRAL`
 * has nowhere to put it, because `Referral` carries `homeRegion` and nothing finer. So the form
 * says so, in a sentence beside the control, rather than leaving a clinician to assume their
 * answer was recorded.
 *
 * That sentence is TRUE ONLY WHILE `Referral` HAS NO SUBURB FIELD. Widening the model is already
 * specified (spec Part 1, FD-15/FD-11) and is owned elsewhere — decided, not built. On the day it
 * is built, this screen carries on telling clinicians their answer was discarded *after it stopped
 * being discarded*: a false reassurance about what the record holds, with every gate green.
 *
 * So this file pins BOTH halves together, and neither half is worth anything alone:
 *
 *   1. The note is on screen, in words a clinician can read — so it cannot be quietly deleted,
 *      leaving a control that silently discards its answer.
 *   2. `Referral` carries no `suburb` key — so the day it gains one, THIS FILE goes red and sends
 *      whoever widened the model straight to the sentence that has just become a lie.
 *
 * Half 2 is the whole point. A test that pinned only the note text would stay green while the note
 * lied, and would look like coverage while doing the opposite of its job.
 *
 * **Why the anchor is asserted before anything is asserted about what it found.** Half 2 reads a
 * type declaration out of another file's SOURCE TEXT, and the failure mode of every such check is
 * that the extraction matches nothing — after a rename, a reformat, or a move to another file —
 * and "no `suburb` key in a block I never found" then reads exactly like success. So the anchor is
 * a test of its own: exactly one declaration found, and a positive control (`homeRegion`, the very
 * field the note names) proving the key matcher can match at all. Neither the anchor test nor the
 * `suburb` assertion can pass vacuously.
 *
 * The anchor is the exact full line `export type Referral = {`, never a keyword search. Two
 * sibling declarations would swallow a looser pattern: `ReferralAddressing` in the same file, and
 * the intake form's own module-private `ReferralDraft`, which carries `suburb` on purpose — a
 * pattern that caught that one instead would invert this result while looking right.
 *
 * This file is `.test.ts`, not `.dom.test.tsx`, so it collects under vitest.config.mts's "node"
 * project: half 2 is a source-text check with no DOM in it, and half 1 uses `renderToStaticMarkup`
 * to render the real component tree to an HTML string, the "SSR-string component test" pattern
 * tests/ward-landmarks.test.ts already establishes for this same form. `.ts` cannot contain JSX,
 * so elements are built with `createElement`, exactly as that file does.
 */

// Same reason as tests/ward-landmarks.test.ts: `ClinicalRail` (rendered by the intake form) uses
// next/link, and this suite never checks routing, so a plain <a> avoids an App Router context the
// node project cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** The note's own test id, as the component sets it. */
const NOTE_TEST_ID = "ward-referral-intake-suburb-note";

/**
 * The sentence as it RENDERS, read off the rendered output rather than copied from the JSX — the
 * source wraps it across two lines and JSX collapses that wrap into a single space.
 */
const NOTE_TEXT =
  "Used here to read the catchment for each destination below. " +
  "It is not yet recorded on the referral, which holds a home region and nothing finer.";

const MODEL_PATH = path.join(__dirname, "..", "src", "components", "ward-management", "ward-model.ts");

/** The declaration half 2 is about. Named once, so the anchor guard below has something to fail on. */
const REFERRAL_TYPE_NAME = "Referral";

/** The field the note names — the positive control that proves the key matcher is not inert. */
const FIELD_THE_NOTE_NAMES = "homeRegion";

/** The field whose arrival makes the note a lie. */
const FIELD_THAT_WOULD_FALSIFY_THE_NOTE = "suburb";

function renderIntakeMarkup(): string {
  // `children` goes in the props object because `WardFlowProviderProps` declares it required, and
  // this file cannot use JSX — the same trade tests/ward-landmarks.test.ts documents.
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- WardFlowProviderProps requires `children`
    createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children: createElement(ReferralIntakeForm) }),
  );
}

/**
 * The body of `export type <typeName> = { ... };` in `ward-model.ts`, comments stripped.
 *
 * Anchored on the exact full line, so `ReferralAddressing` and every other `Referral*` declaration
 * in the same file are excluded by construction rather than by hoping a pattern is tight enough.
 * Both the opener and the terminator are asserted, each with its own message, BEFORE the caller is
 * given anything to assert about — a block that was never found must fail loudly, never pass.
 */
function declarationBody(typeName: string): string {
  const source = readFileSync(MODEL_PATH, "utf8");
  const lines = source.split(/\r?\n/);
  const opener = `export type ${typeName} = {`;

  const openerLines = lines.flatMap((line, index) => (line === opener ? [index] : []));
  expect(
    openerLines,
    `expected exactly one line reading \`${opener}\` in ward-model.ts, found ${openerLines.length}. ` +
      `The declaration has been renamed, reformatted or moved — this pin cannot read it, and must ` +
      `not be taken to mean the type is unchanged.`,
  ).toHaveLength(1);

  const start = openerLines[0];
  // The type's own terminator is the next `};` at column zero; anything nested inside it is
  // indented, so an exact match cannot stop short.
  const end = lines.indexOf("};", start + 1);
  expect(
    end,
    `found \`${opener}\` at line ${start + 1} of ward-model.ts but no closing \`};\` at column zero ` +
      `after it — the block could not be delimited, so nothing below has been checked.`,
  ).toBeGreaterThan(start);

  return lines
    .slice(start + 1, end)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** Matches `name:` or `name?:` as a declared key, never a mention of the word in prose. */
function declaresKey(body: string, name: string): boolean {
  return new RegExp(`^\\s*${name}\\??\\s*:`, "m").test(body);
}

describe("the suburb note, and the model fact that is the only reason it is true", () => {
  it("half 1 — the intake form renders the note that says the suburb is not recorded", () => {
    const markup = renderIntakeMarkup();

    const found = markup.match(new RegExp(`<p\\b[^>]*data-testid="${NOTE_TEST_ID}"[^>]*>([\\s\\S]*?)</p>`));
    expect(
      found,
      `the intake form rendered no element with data-testid="${NOTE_TEST_ID}". The Suburb control ` +
        `is answered and then dropped; without this sentence beside it, the form quietly discards ` +
        `a clinician's answer while looking like it recorded it.`,
    ).not.toBeNull();

    const text = found![1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expect(text).toBe(NOTE_TEXT);
  });

  it("the anchor finds exactly one `Referral` declaration, and it is the one the note is about", () => {
    const body = declarationBody(REFERRAL_TYPE_NAME);

    // Non-vacuity. If the key matcher could not match anything — a reformat that put every field on
    // one line, a stripping bug that ate the body — the `suburb` assertion below would pass while
    // checking nothing. `homeRegion` is the right control precisely because it is the field the
    // note names: "which holds a home region and nothing finer".
    expect(
      declaresKey(body, FIELD_THE_NOTE_NAMES),
      `the block extracted for \`${REFERRAL_TYPE_NAME}\` does not declare \`${FIELD_THE_NOTE_NAMES}\`. ` +
        `Either the wrong block was captured or the key matcher cannot match — either way the ` +
        `\`${FIELD_THAT_WOULD_FALSIFY_THE_NOTE}\` check below would be vacuous.`,
    ).toBe(true);
  });

  it("half 2 — `Referral` carries no `suburb` key, which is what keeps the note on screen true", () => {
    const body = declarationBody(REFERRAL_TYPE_NAME);

    expect(
      declaresKey(body, FIELD_THAT_WOULD_FALSIFY_THE_NOTE),
      `\`${REFERRAL_TYPE_NAME}\` now declares \`${FIELD_THAT_WOULD_FALSIFY_THE_NOTE}\`, so the ` +
        `referral CAN hold a suburb. The intake form still tells clinicians it cannot — see the ` +
        `note at data-testid="${NOTE_TEST_ID}" in referral-intake.tsx, which reads: "${NOTE_TEXT}" ` +
        `That sentence is now false, and it is a false reassurance about what the record holds. ` +
        `Rewrite the note (and this test) rather than deleting either.`,
    ).toBe(false);
  });
});
