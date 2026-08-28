// tests/caring-contacts-interface-vocabulary.test.ts
//
// Item B3 (2026-08-24): extend the prohibited-word scan to interface strings.
//
// Until now, the prohibition on words like "campaign", "engagement score", and "inbox" ran only
// against outgoing messages (message-policy.ts) and the 24 frozen overlay definition rows
// (caring-contacts-overlay-definitions.test.ts). Nothing checked the words on a SCREEN, so the ban
// on interface wording was policy held by people rather than by software. This scans every string
// and template literal under the workspace and caring-contacts app trees for the same wider
// interface vocabulary (CARING_CONTACTS_PROHIBITED_LANGUAGE) already used by the overlay tests.
//
// See docs/caring-contacts/phase-2b-sdd-archive/task-c-brief.md, "B3".
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateGovernedMessage } from "@/lib/caring-contacts/message-policy";

import { CARING_CONTACTS_PROHIBITED_LANGUAGE } from "./helpers/caring-contacts-prohibited-language";

// Deliberately narrow roots, not "all of src/components/caring-contacts": this excludes
// src/components/caring-contacts/mockups/** without needing a special-case skip. Mockups are
// frozen design scratch that 404 in production and knowingly contain one prohibited phrase the
// owner ruled (B4) to leave alone -- see task-c-brief.md, "B3", "Scope limits, deliberate".
const SCAN_ROOTS = [
  path.join(process.cwd(), "src", "components", "caring-contacts", "workspace"),
  path.join(process.cwd(), "src", "app", "caring-contacts"),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * Every quoted string and template literal in `source`, with line/block comments skipped.
 *
 * A naive quote-matching regex over the raw source is unsound here: JSDoc comments in this tree
 * use single backticks for inline code (`` `useSearchParams` ``), and an odd number of them across
 * a comment block pairs a backtick from one inline-code span with one from a much later, unrelated
 * span, capturing the entire stretch between as a single fake "template literal". A small
 * character-by-character scan that recognises both line comments and block comments avoids that,
 * and handles escaped quote characters inside real literals.
 */
function extractStringAndTemplateLiterals(source: string): string[] {
  const literals: string[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      const end = source.indexOf("\n", i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      let content = "";
      while (j < n) {
        if (source[j] === "\\") {
          content += source[j] + (source[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (source[j] === quote) {
          j += 1;
          break;
        }
        content += source[j];
        j += 1;
      }
      literals.push(content);
      i = j;
      continue;
    }
    i += 1;
  }
  return literals;
}

/**
 * `className` attribute VALUES are excluded before extraction. This is narrowing which literals
 * reach the scan, not adding a file to an ignore list: a `className` value is CSS/Tailwind tokens,
 * including custom-property names like `var(--safe-area-bottom)`, which contains "safe" as a
 * substring of a CSS identifier with no relationship to interface prose a patient or clinician
 * would read. Both real occurrences of `--safe-area-bottom` in this tree are inside `className`
 * attributes (shell.tsx, overlay-host.tsx) -- confirmed while building this scan.
 */
const CLASSNAME_ATTRIBUTE_VALUE = /className\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g;

function extractInterfaceStrings(source: string): string[] {
  return extractStringAndTemplateLiterals(source.replace(CLASSNAME_ATTRIBUTE_VALUE, ""));
}

/**
 * `source` with only comments and `className` attribute values removed -- everything else is
 * left exactly as written, including plain JSX text nodes that carry no quotes at all.
 *
 * Fix round 1 (Important 3): `extractInterfaceStrings` above only sees quoted/template-literal
 * strings, but this tree writes copy the OTHER way too -- as plain JSX text between tags (e.g.
 * shell.tsx's `<span>Caring Contacts</span>`, loading.tsx's `<p className="sr-only">Loading the
 * Caring Contacts workspace</p>`). `<p>Check your inbox for the latest campaign.</p>` extracted
 * nothing and scored zero offences under the quote-only scan, while the same words wrapped as
 * `<p>{"..."}</p>` were caught -- this function is the second pass that closes that gap.
 */
function stripCommentsAndClassNameValues(source: string): string {
  const withoutClassNames = source.replace(CLASSNAME_ATTRIBUTE_VALUE, "");
  let result = "";
  let i = 0;
  const n = withoutClassNames.length;
  while (i < n) {
    const two = withoutClassNames.slice(i, i + 2);
    if (two === "//") {
      const end = withoutClassNames.indexOf("\n", i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (two === "/*") {
      const end = withoutClassNames.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    result += withoutClassNames[i];
    i += 1;
  }
  return result;
}

// A `g`-flagged copy of the shared vocabulary regex, so `matchAll` can enumerate every hit in the
// raw-prose pass rather than only reporting the first (`CARING_CONTACTS_PROHIBITED_LANGUAGE`
// itself stays non-global, matching how the quoted-literal pass above uses `.test()` on it).
const CARING_CONTACTS_PROHIBITED_LANGUAGE_GLOBAL = new RegExp(
  CARING_CONTACTS_PROHIBITED_LANGUAGE.source,
  CARING_CONTACTS_PROHIBITED_LANGUAGE.flags.includes("g")
    ? CARING_CONTACTS_PROHIBITED_LANGUAGE.flags
    : `${CARING_CONTACTS_PROHIBITED_LANGUAGE.flags}g`,
);

/** Every prohibited-vocabulary match found directly in the comment/className-stripped source. */
function scanRawProseForProhibitedLanguage(source: string): string[] {
  const stripped = stripCommentsAndClassNameValues(source);
  return [...stripped.matchAll(CARING_CONTACTS_PROHIBITED_LANGUAGE_GLOBAL)].map((match) => match[0]);
}

/** Every offence in one file: quoted/template-literal strings, plus raw prose (JSX text). */
function scanOneFileForProhibitedLanguage(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const relativePath = path.relative(process.cwd(), file);
  const offences: string[] = [];
  for (const literal of extractInterfaceStrings(source)) {
    if (CARING_CONTACTS_PROHIBITED_LANGUAGE.test(literal)) {
      offences.push(`${relativePath}: ${JSON.stringify(literal)}`);
    }
  }
  for (const match of scanRawProseForProhibitedLanguage(source)) {
    offences.push(`${relativePath} (raw prose, e.g. JSX text): ${JSON.stringify(match)}`);
  }
  return offences;
}

/** Every `root -> file -> offending literal` combination found under `root`. */
function scanRootForProhibitedLanguage(root: string): string[] {
  return walk(root).flatMap((file) => scanOneFileForProhibitedLanguage(file));
}

describe("caring-contacts interface vocabulary (B3)", () => {
  it("finds a deliberately planted prohibited string in a fixture -- proving the scan can fail", () => {
    // Runs the real file-scanning code path (walk + read + extract + match) against a temporary
    // fixture, not just the extraction function in isolation. "A scan that cannot fail is worse
    // than no scan" (task-c-brief.md) -- this is that proof.
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "caring-contacts-interface-vocabulary-fixture-"));
    try {
      writeFileSync(
        path.join(fixtureDir, "planted-banner.tsx"),
        [
          "export function PlantedBanner() {",
          '  return <p>{"Following up on your sales lead from this campaign."}</p>;',
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const offences = scanRootForProhibitedLanguage(fixtureDir);
      expect(offences.length).toBeGreaterThan(0);
      expect(offences.some((offence) => offence.includes("campaign"))).toBe(true);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  // Fix round 1 (Important 3): the extractor above only sees quoted/template-literal strings, but
  // this tree writes copy the OTHER way too -- as plain JSX text between tags with no quotes at
  // all (e.g. shell.tsx's `<span>Caring Contacts</span>`, loading.tsx's `<p className="sr-only">
  // Loading the Caring Contacts workspace</p>`). `<p>Check your inbox for the latest
  // campaign.</p>` extracted nothing and scored zero offences before this fix, while the same
  // words wrapped as `<p>{"..."}</p>` were caught -- an inconsistency the fixture below is
  // deliberately shaped to close, not to lean on.
  it("finds a prohibited word planted as PLAIN JSX TEXT, not just inside quotes", () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "caring-contacts-interface-vocabulary-jsx-text-fixture-"));
    try {
      writeFileSync(
        path.join(fixtureDir, "planted-plain-text-banner.tsx"),
        [
          "export function PlantedPlainTextBanner() {",
          "  return <p>Check your inbox for the latest campaign.</p>;",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const offences = scanRootForProhibitedLanguage(fixtureDir);
      expect(offences.length).toBeGreaterThan(0);
      expect(offences.some((offence) => offence.includes("inbox"))).toBe(true);
      expect(offences.some((offence) => offence.includes("campaign"))).toBe(true);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("finds nothing in the real workspace and caring-contacts app tree", () => {
    // Minor 7: a root that exists but holds no .ts/.tsx file would otherwise pass this test
    // vacuously -- close that with a floor on how many files were actually read.
    let filesScanned = 0;
    const offences = SCAN_ROOTS.flatMap((root) => {
      const files = walk(root);
      filesScanned += files.length;
      return files.flatMap((file) => scanOneFileForProhibitedLanguage(file));
    });
    expect(filesScanned).toBeGreaterThan(0);
    expect(offences).toEqual([]);
  });

  it("distinguishes clinical job titles from commercial lead generation", () => {
    expect("clinical programme lead").not.toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("incident lead").not.toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("team lead").not.toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("service lead").not.toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("clinical lead").not.toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);

    expect("sales lead generation").toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("new leads").toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("lead capture").toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("sales team lead generation").toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("clinical lead capture").toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
    expect("Our team lead nurturing numbers are up").toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
  });
});

// ---------------------------------------------------------------------------
// Ruling [143] — the "lead" rule has TWO definitions, and the patient-facing one was the weaker
//
// `CARING_CONTACTS_PROHIBITED_LANGUAGE` above governs what a CLINICIAN reads on a screen.
// `PROVISIONAL_MESSAGE_RULES.prohibitedTermPatternOverrides.lead` governs what a DISCHARGED
// PATIENT reads in a message. They were written by two different sessions and nothing held them in
// step: measured over the same phrases, seven disagreed, and every disagreement ran the same way --
// the screen refused and the message permitted. The surface with the worse consequence had the
// weaker guard.
//
// Two definitions for two surfaces is defensible; the message side being the LOOSER of the two is
// not. This block pins the invariant that fixes the direction, and it is the durable half of that
// fix: the pattern edit stops today's seven, this stops the next seven from arriving unnoticed.
//
// Deliberately NOT an equality between the two regexes. They legitimately differ -- the screen list
// also bans scoring and reply-monitoring claims a message could not make -- so equality would be a
// false pin that later, correct divergence would have to weaken. The invariant is one-directional:
// NOTHING the screen refuses may be permitted in a message.
// ---------------------------------------------------------------------------

/** What a clinician's screen refuses. */
function screenRefuses(text: string): boolean {
  return CARING_CONTACTS_PROHIBITED_LANGUAGE.test(text);
}

/**
 * Whether a MESSAGE to a patient would be refused for the prohibited term "lead".
 *
 * Asked through `validateGovernedMessage` rather than by testing the override pattern directly:
 * that is the surface a message actually passes through, and a pattern proven in isolation would
 * not notice an override that stopped being wired into `prohibitedTermPatternOverrides` at all.
 * The issue is matched on its term so a phrase that also tripped another prohibited term could not
 * be mistaken for the "lead" rule working.
 */
function messageRefusesLead(text: string): boolean {
  const result = validateGovernedMessage({ text, messageType: "standard" });
  return !result.valid && result.issues.some((issue) => issue.code === "prohibited-term" && issue.term === "lead");
}

// Job titles this domain's own wording actually uses. BOTH surfaces must permit these: refusing a
// clinician's real title is its own defect, and so is a message that cannot say "the clinical lead".
const LEAD_JOB_TITLES_BOTH_PERMIT = [
  "Please contact the incident lead for an update.",
  "This was escalated to the programme lead.",
  "This was escalated to the clinical programme lead.",
  "Speak to the clinical lead about this.",
  "The team lead approved the change.",
  "Contact the service lead for details.",
];

// The seven phrases Ruling [143] measured as divergent: the screen refused each one and the message
// permitted it. Listed separately from the rest so a regression names which of the seven came back.
const LEAD_PHRASES_RULING_143_MEASURED_DIVERGENT = [
  "team leads",
  "clinical leads",
  "programme leads",
  "service leads",
  "incident leads",
  "clinical lead capture",
  "team lead nurturing numbers",
];

// Commercial phrasing both surfaces already refused, kept as the control that the direction of the
// fix is "make the message stricter" rather than "make the screen looser".
const LEAD_PHRASES_BOTH_ALREADY_REFUSED = [
  "lead capture",
  "new leads",
  "sales lead generation",
  "Check out our new lead magnet.",
  "Please qualify this lead.",
];

describe('the "lead" rule is defined twice, and the message side is never the looser one (Ruling [143])', () => {
  it("permits this domain's job titles on BOTH surfaces", () => {
    for (const phrase of LEAD_JOB_TITLES_BOTH_PERMIT) {
      expect(screenRefuses(phrase), `screen refuses the job title ${JSON.stringify(phrase)}`).toBe(false);
      expect(messageRefusesLead(phrase), `message refuses the job title ${JSON.stringify(phrase)}`).toBe(false);
    }
  });

  it("refuses on BOTH surfaces every phrase Ruling [143] measured as divergent", () => {
    for (const phrase of LEAD_PHRASES_RULING_143_MEASURED_DIVERGENT) {
      // The screen half is the positive control: it establishes that this phrase really is one the
      // interface rule refuses, so the message half below is a comparison rather than a lone claim.
      expect(screenRefuses(phrase), `screen no longer refuses ${JSON.stringify(phrase)}`).toBe(true);
      expect(messageRefusesLead(phrase), `a patient could still read ${JSON.stringify(phrase)}`).toBe(true);
    }
  });

  it("keeps refusing on BOTH surfaces the commercial phrasing neither ever allowed", () => {
    for (const phrase of LEAD_PHRASES_BOTH_ALREADY_REFUSED) {
      expect(screenRefuses(phrase), `screen no longer refuses ${JSON.stringify(phrase)}`).toBe(true);
      expect(messageRefusesLead(phrase), `message no longer refuses ${JSON.stringify(phrase)}`).toBe(true);
    }
  });

  it("permits in a message NOTHING the screen refuses, across every phrase above", () => {
    // The invariant itself, stated over the union rather than per list, so a phrase added to only
    // one list in future is still held to it. Reported as the offending phrases, not as a count.
    const everyPhrase = [
      ...LEAD_JOB_TITLES_BOTH_PERMIT,
      ...LEAD_PHRASES_RULING_143_MEASURED_DIVERGENT,
      ...LEAD_PHRASES_BOTH_ALREADY_REFUSED,
    ];
    const refusedOnScreenButPermittedInAMessage = everyPhrase.filter(
      (phrase) => screenRefuses(phrase) && !messageRefusesLead(phrase),
    );
    expect(refusedOnScreenButPermittedInAMessage).toEqual([]);

    // Positive controls, so the empty list above cannot be the vacuous kind: the corpus really does
    // contain phrases the screen refuses, and really does contain phrases it permits. Without both,
    // an interface rule that had stopped matching anything at all would satisfy the filter.
    expect(everyPhrase.filter(screenRefuses)).not.toEqual([]);
    expect(everyPhrase.filter((phrase) => !screenRefuses(phrase))).not.toEqual([]);
  });
});
