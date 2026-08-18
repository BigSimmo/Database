// Intent-conditioned answer composition (RAG improvement programme, packet S2 / README §A2).
//
// A pure, deterministic map from (RagQueryClass, ClinicalQueryIntent) to the "related
// information" menu: the answerSections kinds a psychiatrist colleague would append
// unprompted for that question type. The menu is serialised as ONE line in the "Interpreted
// clinical task" block of the generation prompt (`buildAnswerInput` in rag.ts) and is
// advisory only — the model attempts a kind only when the retrieved excerpts support it, and
// every emitted section still carries citation_chunk_ids and passes the unchanged
// verification / claim-support / render-trust ladder. No new pipeline stage, RagAnswer
// field, or render block.
//
// This is a protected RAG surface: changing a menu changes generation behaviour and needs a
// RAG-impact statement plus a live canary pair (docs/rag-behaviour/safeguards.md).
//
// Design rule (see tests/answer-composition.test.ts): the query class is authoritative;
// the heuristic intent refines only the two clinical-fact classes, and only on the
// `escalation_risk` signal. `document_lookup` and `unsupported_or_general` deliberately get
// no menu — the latter is the only class where the simple-direct over-expansion gate
// (`isOverExpandedSimpleGeneratedAnswer`) can fire, so the prompt must not invite sections
// there. The `definition` intent does not silence a menu: `intentFromSignals` matches
// "long-term" and "determine" as definitions, so narrowness is governed by the prompt's
// narrow-question rule (which the menu never overrides), not by this table.

import type { AnswerSectionKind, ClinicalQueryIntent, RagQueryClass } from "@/lib/types";

/** One related-information candidate: an answerSections kind plus the focus it should take here. */
export type RelatedInformationItem = Readonly<{ kind: AnswerSectionKind; focus: string }>;

/** Named menus, so downstream consumers (S3 follow-ups) can branch on the shape, not the items. */
export type RelatedInformationMenuKey = "dosing" | "escalation" | "threshold" | "comparison" | "management" | "none";

export type RelatedInformationMenu = Readonly<{
  key: RelatedInformationMenuKey;
  queryClass: RagQueryClass;
  intent: ClinicalQueryIntent;
  items: readonly RelatedInformationItem[];
}>;

const item = (kind: AnswerSectionKind, focus: string): RelatedInformationItem => Object.freeze({ kind, focus });

const menuItems: Record<Exclude<RelatedInformationMenuKey, "none">, readonly RelatedInformationItem[]> = {
  // README §A2 row 1: medication_dose_risk / drug_dosing. "Related documents" is not a
  // section kind — relatedDocuments is built deterministically (buildRelatedDocumentsSafe)
  // and rendered at high trust already — so it is not offered to the model.
  dosing: Object.freeze([
    item("monitoring_timing", "monitoring schedule and levels"),
    item("contraindications_cautions", "contraindications and cautions"),
    item("escalation_risk", "escalation and stop triggers"),
    item("medication_dose", "dose adjustment for renal or hepatic impairment and older adults"),
  ]),
  // README §A2 row 5: escalation_risk.
  escalation: Object.freeze([
    item("required_actions", "immediate actions"),
    item("thresholds", "the thresholds that trigger them"),
    item("escalation_risk", "who to contact or refer to"),
    item("documentation", "what to document"),
  ]),
  // README §A2 row 2: table_threshold.
  threshold: Object.freeze([
    item("thresholds", "adjacent thresholds or bands in the same scale"),
    item("required_actions", "required actions per band"),
    item("escalation_risk", "escalation pathway"),
  ]),
  // README §A2 row 3: comparison. Two `comparison` items are distinct by focus.
  comparison: Object.freeze([
    item("comparison", "decision factors"),
    item("comparison", "per-source differences and conflicts"),
    item("required_actions", "switching or washout considerations"),
  ]),
  // README §A2 row 4: broad_summary / protocol.
  management: Object.freeze([
    item("required_actions", "weighted management map: risk, first-line, adjuncts, monitoring, special populations"),
    item("documentation", "documentation and forms"),
    item("source_gap", "source gaps"),
  ]),
};

const noItems: readonly RelatedInformationItem[] = Object.freeze([]);

/** Menu key for a (class, intent) cell. Exhaustive over RagQueryClass so a new class fails typecheck. */
function menuKeyFor(queryClass: RagQueryClass, intent: ClinicalQueryIntent): RelatedInformationMenuKey {
  switch (queryClass) {
    case "medication_dose_risk":
      return intent === "escalation_risk" ? "escalation" : "dosing";
    case "table_threshold":
      return intent === "escalation_risk" ? "escalation" : "threshold";
    case "comparison":
      return "comparison";
    case "broad_summary":
      return "management";
    case "document_lookup":
    case "unsupported_or_general":
      return "none";
    default: {
      const exhaustive: never = queryClass;
      return exhaustive;
    }
  }
}

/** Build the related-information menu for a query class and heuristic intent. */
export function buildRelatedInformationMenu(
  queryClass: RagQueryClass,
  intent: ClinicalQueryIntent,
): RelatedInformationMenu {
  const key = menuKeyFor(queryClass, intent);
  return Object.freeze({ key, queryClass, intent, items: key === "none" ? noItems : menuItems[key] });
}

const noMenuLine =
  "related_information_menu: none — no related-information menu for this question type; apply the Answer sections rules as written";

/** Serialise a menu as the single `related_information_menu:` prompt line. */
export function formatRelatedInformationMenuLine(menu: RelatedInformationMenu): string {
  if (menu.items.length === 0) return noMenuLine;
  return `related_information_menu: ${menu.items.map((entry) => `${entry.kind} — ${entry.focus}`).join("; ")}`;
}

/** Convenience for the prompt builder: one call, one line. */
export function relatedInformationMenuLine(queryClass: RagQueryClass, intent: ClinicalQueryIntent): string {
  return formatRelatedInformationMenuLine(buildRelatedInformationMenu(queryClass, intent));
}
