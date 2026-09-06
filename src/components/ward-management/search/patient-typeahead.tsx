"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { Referral, ReferralState } from "@/components/ward-management/ward-model";
import {
  findPatients,
  nearPatients,
  patientDisplayName,
  type Patient,
} from "@/components/ward-management/ward-patients";
import { referralState } from "@/components/ward-management/ward-referrals";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";

import styles from "./patient-typeahead.module.css";

/**
 * THE PATIENT TYPEAHEAD — a name box that shows you who it found while you are still typing.
 *
 * Owner request, 2026-09-05: "a smart patient dropdown for me when typing patient names."
 *
 * ⚠️ WHAT "SMART" IS NOT ALLOWED TO MEAN HERE, and this is the whole design.
 *
 * `nearPatients` in `ward-patients.ts` already settled this question for its own output and the
 * ruling binds this component too: it returns candidates *"deliberately UNRANKED: presenting a
 * 'best' match is an invitation, and on this screen an invitation is the hazard."* So this dropdown
 * does not score, does not rank, and does not put a most-likely person at the top. It groups, it
 * labels each group with the rule that produced it, and it leaves the choosing to the clinician.
 *
 * Three consequences, each of which looks like a missing feature and is not:
 *
 *   1. **NOTHING IS PRESELECTED.** `activeIndex` starts at −1 and stays there until the clinician
 *      presses an arrow key. A dropdown that highlights its first row has already made the choice;
 *      pressing Enter out of habit then picks a patient nobody read. On a screen whose output is a
 *      human being's record, that is the failure worth engineering against.
 *   2. **NEAR-SPELLINGS APPEAR ONLY WHEN NOTHING MATCHED.** `nearPatients`'s own contract is that
 *      it is *"offered only to a clinician the search has already told 'nobody is known', and never
 *      as a match."* Mixing one-keystroke candidates in beside real matches would turn a suggestion
 *      into a result. They get their own group, under their own heading, below an explicit sentence
 *      saying nobody actually matched.
 *   3. **EVERY OPTION CARRIES THE TWO FACTS THAT DISTINGUISH PEOPLE** — record number and date of
 *      birth — because the near-spelling pairs seeded into this system (Halloway/Hallowin,
 *      Marrowby/Marrowbee, O'Quinn/Oquinn) are indistinguishable by name alone, on purpose.
 *
 * What it DOES add over a bare text field: it tells you, before you commit, whether the person you
 * are typing already has a referral still waiting for a decision. That is the fact a clinician is
 * usually actually after, and today it costs a search, a scan and a click to reach.
 *
 * ⚠️ AND IT CANNOT TELL YOU WHETHER THEY ARE ON A MOVEMENT, BECAUSE THE MODEL CANNOT.
 *
 * ⚠️ **AN EARLIER DRAFT OF THIS COMMENT SAID "`Movement` CARRIES NO PATIENT LINK OF ANY KIND".
 * THAT WAS WRONG, AND WRONG IN THE DIRECTION THAT GETS A FINDING DISMISSED** — the next reader
 * greps, finds `Movement.referralId`, and concludes the whole paragraph is unreliable. Corrected
 * after Ward Lead caught it; re-measured here rather than taken on trust.
 *
 * What is actually true, measured against `ward-model.ts` at `d5f0fcc05`: the link exists and is
 * **two optional hops long**. `Movement.referralId?: string` (`:718`) → `Referral` →
 * `Referral.patientId?: PatientId` (`:1463`, added by the owner's ruling of 2026-09-02).
 * `referralForMovement` (`ward-derivations.ts:287`) returns `undefined` the moment the first hop
 * is absent.
 *
 * **And the first hop is absent in the ordinary case: 2 of the 20 hand-authored movements carry a
 * `referralId`; the other 18 carry nothing** (that field's own comment, owner ruling
 * `R-2026-09-04-D`). So the sharpened statement is worse for the product than the wrong one was:
 * a partial link compiles, resolves for a tenth of the fixture, and returns `undefined` for the
 * rest — and an `undefined` rendered as "nothing attached" reads as an answer rather than as a
 * gap. That is precisely the defect this component's first draft had. A first draft of this file
 * looked up `movements.find((m) => m.patientId === patient.id)` and would not have compiled; had it
 * compiled against a looser type it would have rendered "Nothing attached" for every patient on a
 * movement, which reads as an answer rather than as an absence. **The gap is reported here rather
 * than papered over, and closing it is a model decision for the owner, not a UI one.**
 *
 * ⚠️ IT ASSESSES NOTHING. No risk, no acuity, no priority, no ordering by need. The screen this
 * mounts on promises a clinician it never does, and a dropdown that quietly sorted by anything
 * clinical would break that promise where nobody would look for it.
 *
 * Keyboard, per the ARIA 1.2 combobox pattern: ArrowDown/ArrowUp move, Home/End jump, Enter picks
 * the active option (and does nothing when none is active), Escape closes without picking.
 */
export function PatientTypeahead({
  patients,
  referrals,
  value,
  onValueChange,
  onPick,
  label = "Find a person",
  placeholder = "Name or record number…",
  offerAddPerson = true,
}: {
  patients: readonly Patient[];
  referrals: readonly Referral[];
  value: string;
  onValueChange: (next: string) => void;
  /** Called when a clinician chooses somebody. The page decides what choosing means. */
  onPick?: (patient: Patient) => void;
  label?: string;
  placeholder?: string;
  /**
   * Whether the "nobody matches" state offers the add-person route.
   *
   * ⚠️ DEFAULTS TO TRUE, AND THE SEARCH PAGE PASSES FALSE. Standalone, this control must offer the
   * way out of a dead end — a clinician told "nobody matches" with no next step is exactly the
   * silent failure this prototype keeps finding. But `patient-search.tsx` ALREADY carries that
   * route in its own people panel, with wording it chose and a testid two tests pin. Rendering
   * both put two identical calls to action on one screen, one of them floating over the other.
   * Two routes to one destination is not twice as helpful; it is a reader wondering whether they
   * are different.
   */
  offerAddPerson?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const query = value.trim();

  const matches = useMemo(() => findPatients(patients, query), [patients, query]);

  /*
   * Only when nothing matched — see rule 2 above.
   *
   * ⚠️ EVERY WORD OF THE TYPED QUERY IS ITS OWN TERM, NOT THE WHOLE STRING AS ONE. This screen used
   * to pass the entire box as a single term, which is exactly the shape `nearPatients` was NOT
   * built for — read its own doc comment: it compares EACH term against EACH name field because the
   * commonest real duplicate is a correct first name sitting next to a misspelt surname. Typed as
   * one string, "Talia Hallowey" is nowhere near "Talia Halloway" (they differ by far more than one
   * keystroke as whole strings), so the combined-term version returned nothing and told a clinician
   * "no name is one keystroke away from it either" — false: `hallowey`/`halloway` is a single
   * substitution apart, and this is the ordinary way a clinician re-types a name they already
   * half-remember. Splitting on whitespace is what the add-patient screen already does by calling
   * `nearPatients(patients, [givenName, familyName])`; this applies the same idea to one free-text
   * box instead of two separate fields.
   */
  const near = useMemo(() => {
    if (query.length === 0 || matches.length > 0) return [];
    const terms = query.split(/\s+/).filter((term) => term.length > 0);
    return nearPatients(patients, terms);
  }, [patients, query, matches.length]);

  const options = useMemo(() => [...matches, ...near], [matches, near]);

  /*
   * THE ACTIVE ROW RESETS WHENEVER THE OPTION LIST CHANGES IDENTITY, not merely when it shortens.
   * Keeping an index across a changed list is how a keyboard user ends up on a different person
   * than the one they were reading — the row number survived and the row did not.
   *
   * ⚠️ ADJUSTED DURING RENDER, NOT IN AN EFFECT, and that is a correctness point rather than a
   * lint concession. `react-hooks/set-state-in-effect` rejected the effect form, and it was right
   * to: an effect runs AFTER paint, so for one frame the popup would have drawn a new list with
   * the old row highlighted — on this control, that frame shows the wrong patient marked as the
   * one you are about to choose. Resetting during render means the new list has never been painted
   * with a stale selection. This is React's documented pattern for adjusting state when an input
   * changes; the comparison is against a key, so it runs once per change and cannot loop.
   */
  const optionsKey = useMemo(() => options.map((patient) => patient.id).join("|"), [options]);
  const [seenOptionsKey, setSeenOptionsKey] = useState(optionsKey);
  if (optionsKey !== seenOptionsKey) {
    setSeenOptionsKey(optionsKey);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (!open) return;
    function onDocumentPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        // ⚠️ EVERY OTHER EXIT PATH RESETS `activeIndex` TOO (Escape, a completed pick, Clear) —
        // this one did not, and it is reached exactly as often as the others: click outside, then
        // refocus the input. `onFocus` below calls `setOpen(true)`, and the render-phase reset a
        // few lines up only fires when the OPTIONS LIST changes identity — which it has not, since
        // the query never changed. So the popup reopened with a row still highlighted from before
        // the click, and Enter picked a patient nobody had read on this pass. That directly
        // falsified this component's own documented promise that nothing is ever preselected.
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocumentPointerDown);
    return () => document.removeEventListener("mousedown", onDocumentPointerDown);
  }, [open]);

  const showPopup = open && query.length > 0;

  /*
   * D1 FIX: keep the active row on screen. The popup clips at `max-height: 24rem` with its own
   * scrollbar (`patient-typeahead.module.css`), and ArrowDown/End can move `activeIndex` to a row
   * that is scrolled out of view — nothing scrolled the list to follow the keyboard before this.
   * Concretely: type a query that matches every seeded patient, press End, press Enter, and the
   * option picked was never rendered on screen. `block: "nearest"` moves the popup only as far as
   * it has to, rather than re-centring the option and shifting a row the clinician was already
   * reading.
   */
  useEffect(() => {
    if (!showPopup || activeIndex < 0) return;
    document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, showPopup, id]);

  function pick(patient: Patient) {
    onValueChange(patientDisplayName(patient));
    setOpen(false);
    setActiveIndex(-1);
    onPick?.(patient);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (showPopup) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (!showPopup || options.length === 0) {
      if (event.key === "ArrowDown" && query.length > 0) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter") {
      // No active row means the clinician has not chosen anybody. Enter then belongs to the form
      // this box sits in, and must not be turned into a pick.
      if (activeIndex >= 0) {
        event.preventDefault();
        pick(options[activeIndex]);
      }
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      <div className={styles.controlBox}>
        <svg className={styles.icon} width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>

        <input
          id={id}
          className={styles.input}
          type="text"
          autoComplete="off"
          spellCheck={false}
          /*
           * ⚠️ NO `role="combobox"` AND NO `aria-expanded`, AND BOTH ABSENCES ARE DELIBERATE.
           *
           * ARIA 1.2 puts `role="combobox"` on the input, and that is what this had. It cost the
           * input its implicit `textbox` role, and `tests/ward-patient-search.dom.test.tsx` asserts
           * this page owns exactly ONE text input — the one-composer-per-page contract in
           * `docs/search-chrome-behaviour.md`. The composer count never changed; only the role name
           * did, and the guard could not tell those apart. The repo contract wins over the generic
           * pattern (AGENTS.md, "External skill precedence"), so the code moved rather than the test.
           *
           * What is left is spec-valid for a textbox with a popup list: `aria-haspopup`,
           * `aria-controls`, `aria-activedescendant` and `aria-autocomplete` are all supported
           * states of role `textbox`. `aria-expanded` is NOT, which is why it is gone rather than
           * merely unused — it would have been invalid on a plain textbox.
           */
          aria-haspopup="listbox"
          aria-controls={showPopup ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-describedby={`${id}-hint`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          data-testid="ward-patient-typeahead-input"
        />

        {value.length > 0 ? (
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              onValueChange("");
              setOpen(false);
              setActiveIndex(-1);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className={styles.guidance} id={`${id}-hint`}>
        Related spellings are found too. Press <kbd>↓</kbd> to step through the list — nothing is chosen for you.
      </p>

      {/*
        The count is announced rather than only drawn, because a clinician using a screen reader
        needs to know the list changed under them as they type.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {query.length === 0
          ? ""
          : matches.length > 0
            ? `${matches.length} ${matches.length === 1 ? "person" : "people"} found.`
            : near.length > 0
              ? `Nobody matches. ${near.length} ${near.length === 1 ? "name is" : "names are"} one keystroke away.`
              : "Nobody matches."}
      </p>

      {showPopup ? (
        <div className={styles.popup} data-testid="ward-patient-typeahead-popup">
          <ul id={listId} role="listbox" aria-label="People found">
            {matches.length > 0 ? (
              <li role="presentation">
                <span className={styles.group} id={`${id}-grp-known`}>
                  Known to this system
                </span>
              </li>
            ) : null}

            {matches.map((patient, index) => (
              <PatientOption
                key={patient.id}
                domId={`${id}-opt-${index}`}
                patient={patient}
                query={query}
                referrals={referrals}
                active={activeIndex === index}
                onChoose={() => pick(patient)}
              />
            ))}

            {near.length > 0 ? (
              <li role="presentation">
                <span className={styles.group}>One keystroke away</span>
                <span className={styles.groupNote}>
                  <strong>Nobody matches what you typed.</strong> These names differ by a single letter. They are
                  offered for you to compare — none of them is a match, and this list is in record order, not
                  best-first.
                </span>
              </li>
            ) : null}

            {near.map((patient, index) => (
              <PatientOption
                key={patient.id}
                domId={`${id}-opt-${matches.length + index}`}
                patient={patient}
                query={query}
                referrals={referrals}
                active={activeIndex === matches.length + index}
                onChoose={() => pick(patient)}
              />
            ))}

            {options.length === 0 ? (
              <li role="presentation">
                <div className={styles.empty} data-testid="ward-patient-typeahead-empty">
                  <span>
                    <strong>Nobody known to this system matches “{query}”</strong>, and no name is one keystroke away
                    from it either.
                  </span>
                  {offerAddPerson ? (
                    <Link className={styles.addLink} href={`${WARD_ADD_PERSON_HREF}?name=${encodeURIComponent(query)}`}>
                      Add this person
                    </Link>
                  ) : null}
                </div>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One person in the list.
 *
 * The referral line is the reason this component earns its place: it answers "is this person
 * already waiting on somebody" without a second search. It reads the live referral list directly
 * rather than a precomputed index, so it can never disagree with the board a click away.
 *
 * ⚠️ THE "NOTHING FOUND" WORDING IS "NO REFERRAL LINKED TO THIS RECORD", NEVER "NOTHING ATTACHED"
 * AND NEVER "NO REFERRAL ON RECORD". "Nothing attached" would be a claim about movements as well,
 * and this component cannot see movements from a person — see the model gap in the component doc
 * above. "No referral ON RECORD" is a stronger claim than this component can support for a
 * different reason: `patientId` is an OPTIONAL pointer (`ward-model.ts`) that today sits unset on
 * every seeded referral, so this line renders for people who genuinely DO have a referral sitting
 * in the queue — it just isn't linked to their patient record yet. "On record" reads as "this
 * person has no referral", which is a fact about the WORLD this component cannot see. "Linked to
 * this record" states only the fact it actually knows: no referral POINTS here. A sentence must
 * not be wider than the data behind it.
 *
 * ⚠️ AND THE FOUND-REFERRAL LINE NAMES THE ACTUAL STATE, NEVER A FIXED "WAITING FOR A DECISION".
 * `referralState` (`ward-referrals.ts`) returns "queued" | "accepted" | "declined", and a chip that
 * said "waiting for a decision" regardless of which one it read was a false statement about anyone
 * whose bed was already agreed, or whose referral every destination had refused. The page below
 * this control already applies the state filter; this component didn't, so the two could disagree
 * about the same referral on the same screen.
 */
function PatientOption({
  domId,
  patient,
  query,
  referrals,
  active,
  onChoose,
}: {
  domId: string;
  patient: Patient;
  query: string;
  referrals: readonly Referral[];
  active: boolean;
  onChoose: () => void;
}) {
  const referral = referrals.find((candidate) => candidate.patientId === patient.id);
  const referralLine = referral ? referralLineText(referralState(referral), referral.id) : null;

  return (
    <li
      id={domId}
      role="option"
      aria-selected={active}
      className={`${styles.option}${active ? ` ${styles.optionActive}` : ""}`}
      onClick={onChoose}
      onMouseDown={(event) => event.preventDefault()}
      data-testid={`ward-patient-typeahead-option-${patient.id}`}
    >
      <span className={styles.name}>
        <Highlighted text={patientDisplayName(patient)} query={query} />
      </span>

      <span className={styles.attrs}>
        <span>
          <Highlighted text={patient.umrn} query={query} />
        </span>
        <span aria-hidden="true">·</span>
        <span>
          born <b>{patient.dateOfBirth}</b>
        </span>
      </span>

      {/*
        ⚠️ TWO STATES, BOTH SAID IN WORDS, AND NEITHER LEFT BLANK — a blank row and a row with
        nothing on it look identical and mean different things. There is deliberately no third
        state for movements: the model holds no person-to-movement link, so this component would
        have to guess, and a guess here reads to a clinician as a finding.
      */}
      {referralLine ? (
        <span className={`${styles.attached} ${styles.attachedReferral}`}>{referralLine}</span>
      ) : (
        <span className={styles.attached}>No referral linked to this record</span>
      )}
    </li>
  );
}

/** One sentence per `ReferralState` — see the doc comment above for why a fixed sentence was the
 *  defect. */
function referralLineText(state: ReferralState, referralId: string): string {
  switch (state) {
    case "accepted":
      return `Referral ${referralId} — accepted`;
    case "declined":
      return `Referral ${referralId} — declined`;
    case "queued":
      return `Referral ${referralId} — waiting for a decision`;
  }
}

/**
 * Marks the run of text the search actually matched.
 *
 * ⚠️ CASE-INSENSITIVE, AND NOTHING MORE. `findPatients` folds punctuation and accents away before
 * matching, so "oquinn" legitimately finds "O'Quinn" — and there is no honest way to underline a
 * run in the DISPLAY string that only exists in the FOLDED one. Rather than guess at a span and
 * mark the wrong letters, this marks only what it can locate exactly and otherwise marks nothing.
 * An absent highlight is a smaller lie than a misplaced one.
 */
function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (needle.length === 0) return <>{text}</>;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={styles.mark}>{text.slice(at, at + needle.length)}</span>
      {text.slice(at + needle.length)}
    </>
  );
}
