/**
 * The full prohibited vocabulary for caring-contacts interface copy, in ONE place.
 *
 * It was defined twice, byte for byte, in `caring-contacts-overlay-definitions.test.ts`
 * and `caring-contacts-overlay-host.dom.test.tsx`. Two copies of a safety list drift:
 * a term added to one would leave the other quietly checking the old set, and the
 * failure mode is a green suite that no longer covers what it claims to.
 *
 * `lead` is not a plain word-boundary match, though word boundaries are still what keep it off
 * `already`. It is three alternatives. `leads` in the plural is refused outright, because nobody's
 * job title is plural. `lead` followed by a commercial companion word -- generation, capture,
 * nurturing, a magnet, a pipeline, numbers -- is refused even when a job-title qualifier sits
 * immediately before it, so an exemption cannot license whatever follows the word it exempts.
 * Otherwise `lead` is refused as a whole word, exempt only when one of this domain's closed set of
 * job titles sits IMMEDIATELY before it: incident, programme, clinical, service or team lead.
 * Refusal is the default and the exemption is the narrow case, rather than the other way round,
 * because the commercial vocabulary for `lead` is open-ended and an allowlist of sales phrasing
 * refuses only what somebody thought to list. That allowlist was itself the defect; the fix
 * round 1 note above `COMMERCIAL_LEAD_PATTERN` in `src/lib/caring-contacts/message-rules.ts`
 * records it.
 *
 * That same rule is written a second time, for messages, as `COMMERCIAL_LEAD_PATTERN` in
 * `src/lib/caring-contacts/message-rules.ts`, term for term the same three alternatives. Nothing
 * under `src/lib/caring-contacts/**` may import a test helper, so the duplication is structural
 * rather than accidental and cannot be removed by sharing this constant. What holds the two in
 * step is the Ruling [143] parity block at the bottom of
 * `tests/caring-contacts-interface-vocabulary.test.ts`, whose invariant is one-directional:
 * nothing the screen refuses may be permitted in a message. Anyone editing EITHER definition runs
 * that test.
 *
 * The list is deliberately wider than `PROVISIONAL_MESSAGE_RULES.prohibitedTerms` in
 * `src/lib/caring-contacts/message-rules.ts`, which governs the words that may appear
 * in a MESSAGE to a patient. This governs interface copy, and adds the scoring and
 * reply-monitoring claims that a message could not make but a screen could.
 */
export const CARING_CONTACTS_PROHIBITED_LANGUAGE =
  /\bhigh risk\b|\bsafe\b|\bengagement scores?\b|\bcampaigns?\b|\bleads\b|\blead\s+(?:generation|capture|gen\b|nurturing|magnet|source|score|scoring|pipeline|qualification|conversion|database|numbers)\b|(?<!\b(?:incident|programme|clinical|service|team) )\blead\b|\bconversions?\b|\bbest match\b|\binbox(es)?\b|\bconversations?\b|\bclinical risk\b|\brisk scores?\b|\bwellbeing scores?\b|monitor(s|ed|ing)? (the )?repl(y|ies)|repl(y|ies) (are|is) monitored/i;
