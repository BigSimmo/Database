/**
 * The place-name leak detector for Ward Flow's `FD-23` privacy guards.
 *
 * Lifted out of three test files on 2026-09-02 — `ward-screen-fd23-leaks.dom.test.tsx`,
 * `ward-withdrawal-reason-privacy.test.ts` and `ward-person-screen.dom.test.tsx` — which each held
 * a hand-copied version.
 *
 * ⚠️ **THIS IS NOT AN ARGUMENT FROM PRINCIPLE ABOUT DUPLICATION. IT IS THE OBSERVED FAILURE MODE,
 * ON THIS FUNCTION, WITH A DATE ON IT.** On 2026-09-02 one of the three copies was defective while
 * the other two were correct, the defect was found only by a mutation, and **the master line
 * shipped the broken copy for part of that day.** Three copies of a privacy detector decay
 * independently and nothing goes red when they diverge.
 *
 * **What this file deliberately does NOT own: the forbidden-name registers, or any call site's
 * positive controls.** Each guard still builds its own set from `ward-sites.ts` and still proves,
 * in its own file, that it can fire. **Centralising the proofs as well as the detector would swap
 * three independently-decaying copies for one silently-shared blind spot — a worse trade.** This
 * file owns the matching rule and nothing else.
 */

export function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether `text` genuinely names the real place `placeName`.
 *
 * ⚠️ **THE MATCHING RULE DEPENDS ON THE NAME, AND A BARE `\b…\b` FOR EVERY NAME IS THE DEFECT THIS
 * FILE EXISTS TO STOP REPEATING.**
 *
 * **Single-token names** — hospital codes like `ARM`, `BUN`, `GER` — are ordinary English fragments.
 * A substring search flags "w`ARM`ly" or "dan`GER`ous" as if they named a place, so these need
 * `\b…\b`. Matching is case-sensitive: every register entry is a proper noun or an all-caps code,
 * and no real label capitalises mid-sentence.
 *
 * **Multi-word names** — "Armadale Hospital Emergency Department" — must NOT use `\b`. A DOM
 * `textContent` concatenates sibling elements with no separator, so rendered text reads
 * `…Emergency DepartmentWF-013…`. The character after "Department" is `W`; both sides are word
 * characters, **no boundary exists there, and `\b…\b` cannot match.** A guard written that way
 * reports "no place named" while the place is on the screen.
 *
 * A multi-word proper noun cannot plausibly occur as a coincidental substring of English, so plain
 * containment is both sufficient and correct for it.
 *
 * **The rule: boundary-match a bare token, contain-match anything with a space in it.**
 *
 * ⚠️ **AND THE REASON THE DEFECT SURVIVED IN ONE FILE FOR SO LONG:** that file's three positive
 * controls all happened to end the place name with a full stop, so a word boundary always existed
 * after it. **The controls were real, they fired, and they certified the wrong thing** — every one
 * of them exercised the easy shape, and none could distinguish the two rules. `ward-place-names`'s
 * own tests carry the concatenated case for exactly that reason.
 *
 * Refuses anything under 3 characters outright rather than silently matching it: the shortest real
 * entry today is a 3-letter code, so a shorter one arriving later fails loudly here instead of
 * joining a sweep unexamined.
 */
export function namesRealPlace(text: string, placeName: string): boolean {
  if (placeName.length < 3) {
    throw new Error(`forbidden place name is shorter than the 3-character floor this check assumes: "${placeName}"`);
  }
  if (placeName.includes(" ")) return text.includes(placeName);
  return new RegExp(`\\b${escapeForRegExp(placeName)}\\b`).test(text);
}
