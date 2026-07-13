"""Tag clinical assertion status for target terms inside chunk texts.

Uses medspaCy's ConText implementation (negation / uncertainty / family /
historical modifiers). ConText only marks target entities, so the caller must
supply the target term list — the worker passes the clinical vocabulary, the
eval harness passes per-fixture targets.

Usage: analyze_assertions.py input.json [output.json]

Input JSON:  {"chunks": [{"id": str, "text": str}], "targets": [str, ...]}
Output JSON: {"assertions": [{"id": str, "negated_terms": [str], "uncertain_terms": [str],
              "family_terms": [str], "historical_terms": [str]}],
              "version": str, "warnings": [str]}

Exit codes mirror extract_pdf_assets.py: 1 usage error, 2 missing dependency.
"""

import json
import sys

try:
    import medspacy
    from medspacy.context import ConTextRule
    from medspacy.target_matcher import TargetRule
except Exception as exc:  # noqa: BLE001 - report any import failure and exit
    sys.stderr.write(f"medspacy unavailable: {exc}\n")
    sys.exit(2)

# AU clinical phrasing missing from medspaCy's default (US-leaning) ConText rules.
# Gaps were identified by scripts/fixtures/assertion-golden.json via
# `npm run eval:assertions` — extend the fixture first when adding rules here.
AU_CONTEXT_RULES = [
    ConTextRule("nil", "NEGATED_EXISTENCE", direction="FORWARD"),
    # max_scope bounds the forward reach so a cue over one finding does not leak onto
    # later mentions in the same sentence ("Suspected myocarditis ... of clozapine").
    ConTextRule("query", "POSSIBLE_EXISTENCE", direction="FORWARD", max_scope=4),
    ConTextRule("suspected", "POSSIBLE_EXISTENCE", direction="FORWARD", max_scope=4),
    ConTextRule("may represent", "POSSIBLE_EXISTENCE", direction="FORWARD", max_scope=4),
    ConTextRule("may have", "POSSIBLE_EXISTENCE", direction="FORWARD", max_scope=4),
    ConTextRule("differential diagnosis includes", "POSSIBLE_EXISTENCE", direction="FORWARD"),
    ConTextRule("impression:", "POSSIBLE_EXISTENCE", direction="FORWARD"),
    ConTextRule("previous episode of", "HISTORICAL", direction="FORWARD"),
    ConTextRule("previous episodes of", "HISTORICAL", direction="FORWARD"),
]


def build_nlp(targets):
    nlp = medspacy.load()
    matcher = nlp.get_pipe("medspacy_target_matcher")
    matcher.add([TargetRule(literal=term, category="CLINICAL_TERM") for term in targets])
    nlp.get_pipe("medspacy_context").add(AU_CONTEXT_RULES)
    return nlp


def analyze_chunk(nlp, chunk):
    doc = nlp(chunk["text"])
    result = {
        "id": chunk["id"],
        "negated_terms": [],
        "uncertain_terms": [],
        "family_terms": [],
        "historical_terms": [],
    }
    seen = set()
    for ent in doc.ents:
        term = ent.text.lower()
        flags = (
            ("negated_terms", bool(ent._.is_negated)),
            ("uncertain_terms", bool(ent._.is_uncertain) or bool(ent._.is_hypothetical)),
            ("family_terms", bool(ent._.is_family)),
            ("historical_terms", bool(ent._.is_historical)),
        )
        for key, flagged in flags:
            if flagged and (key, term) not in seen:
                seen.add((key, term))
                result[key].append(term)
    return result


def run(input_path, output_path=None):
    with open(input_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    chunks = payload.get("chunks") or []
    targets = [term for term in (payload.get("targets") or []) if isinstance(term, str) and term.strip()]
    warnings = []
    if not targets:
        warnings.append("no targets supplied; nothing to tag")

    nlp = build_nlp(targets) if targets else None
    assertions = []
    for chunk in chunks:
        if not isinstance(chunk, dict) or not isinstance(chunk.get("text"), str) or "id" not in chunk:
            warnings.append(f"skipped malformed chunk: {chunk!r:.120}")
            continue
        if nlp is None:
            assertions.append(
                {
                    "id": chunk["id"],
                    "negated_terms": [],
                    "uncertain_terms": [],
                    "family_terms": [],
                    "historical_terms": [],
                }
            )
            continue
        assertions.append(analyze_chunk(nlp, chunk))

    result = {
        "assertions": assertions,
        "version": getattr(medspacy, "__version__", "unknown"),
        "warnings": warnings,
    }
    if output_path:
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(result, handle)
    print(json.dumps(result))


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.stderr.write("usage: analyze_assertions.py input.json [output.json]\n")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else None)
