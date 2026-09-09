# Clinical Knowledge Support

Clinical Knowledge Support is the clinician-facing context that turns governed reference material into searchable records and source-linked decision support. Its language keeps generated assistance distinct from clinical judgment and patient-record functions.

## Language

**Mode-aware Clinical Ask**:
A clinician-initiated question that is interpreted, researched, and answered according to the currently selected application mode.
_Avoid_: AI diagnosis, autonomous clinical agent, smart search

**Clinical Ask Session**:
The temporary, in-tab working period containing one question, its confirmed context, answers, and follow-ups. It ends when the clinician clears it, starts a new chat, signs out, or closes or refreshes the tab.
_Avoid_: Patient record, case file, saved consultation

**Case Context**:
Clinician-confirmed, non-identifying presentation details used to focus one Clinical Ask Session. Suggested details are not facts until the clinician confirms them.
_Avoid_: Patient profile, inferred history, chart

**Mode Answer Profile**:
The binding clinical purpose, evidence requirements, output shape, cautions, and handoffs for one supported mode.
_Avoid_: Prompt template, persona

**Clarification Gate**:
A pause that asks for material missing information before a mode answer can be safely composed.
_Avoid_: Intake form, interrogation

**Evidence Ladder**:
The visible ordering of catalogue evidence, indexed organisational evidence, and approved external-authority evidence used for an answer.
_Avoid_: Confidence score, source ranking

**Catalogue Evidence**:
Structured content from the selected mode's repository-owned catalogue, carrying its recorded source and review state.
_Avoid_: Model knowledge, database truth

**Indexed Evidence**:
Retrieved excerpts from authorised documents already indexed by PsychSift.
_Avoid_: Uploaded truth, internal authority

**External Authority Evidence**:
Material found at request time only from approved authoritative publishers outside the local index, with its publisher, jurisdiction, date, retrieval time, and review caveats retained.
_Avoid_: Web result, internet answer, open-web evidence

**Evidence Gap**:
A clinically important part of the question that the available evidence cannot support.
_Avoid_: Low confidence, model uncertainty

**Source Review State**:
The recorded governance state that describes whether a source or catalogue record has been clinically and operationally reviewed. It is separate from relevance.
_Avoid_: Accuracy score, trust score

**Clinician Confirmation**:
The explicit human act that accepts or corrects suggested context or wording before it can be reused or acted on.
_Avoid_: AI approval, automatic validation

**Cross-mode Handoff**:
A clinician-triggered move of confirmed Case Context into another supported mode without carrying the raw narrative in a URL.
_Avoid_: Autonomous routing, automatic workflow
