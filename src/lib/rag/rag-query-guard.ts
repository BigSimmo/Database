import type { ClinicalQueryAnalysis } from "@/lib/types";

const clearlyNonClinicalConsumerPattern =
  /\b(coffee\s*machine|espresso|kitchen|recipe|holiday|hotel|restaurant|car|mortgage|insurance|gaming|laptop|phone|television|tv|washing\s*machine|air\s*fryer|vacuum|flight|airline)\b/i;

export const clearlyOutsideCorpusMedicalPattern =
  /\b(?:diabetic ketoacidosis|dka|community acquired pneumonia|pneumonia|antibiotic|ssri|adolescent depression|hyperkalaemia|hyperkalemia)\b/i;

export const unavailableDocumentNoisePattern =
  /\b(?:newly uploaded|future synthetic|not been uploaded|not uploaded|2027 revised|airport travel policy|gardening equipment checklist)\b/i;

const deterministicClinicalTermsPattern =
  /\b(?:bipolar|anorexia|bulimia|schizophreni|psychos|psychot|depress|anxiet|lithium|sertraline|antidepressant|antipsychotic|benzodiazepin|methylphenidate|adhd|autis|borderline|personality|suicid|self-harm|overdose|clozapine|olanzapine|quetiapine|valproate|lamotrigine|risperidone|aripiprazole|haloperidol|promethazine|diazepam|lorazepam|temazepam|zopiclone|melatonin|mirtazapine|venlafaxine|duloxetine|fluoxetine|citalopram|escitalopram|fluvoxamine|amitriptyline|clomipramine|imipramine|nortriptyline|phenelzine|tranylcypromine|moclobemide|trazodone|agomelatine|vortioxetine|bupropion|atomoxetine|dexamfetamine|lisdexamfetamine|guanfacine|clonidine|memantine|donepezil|galantamine|rivastigmine|naltrexone|acamprosate|disulfiram|buprenorphine|methadone|naloxone|flumazenil|propranolol|atenolol|hypertension|hypotension|tachycardia|bradycardia|ecg|electrocardiogram|qtc|serotonin syndrome|neuroleptic malignant syndrome|tardive dyskinesia|akathesia|akathisia|dystonia|parkinson|extrapyramidal|hyperprolactinaemia|hyponatraemia|agranulocytosis|neutropenia|thrombocytopenia|hepatotoxicity|nephrotoxicity|cardiotoxicity|neurotoxicity|teratogen|pregnancy|breastfeeding|lactation|renal impaired|hepatic impaired|elderly|paediatric|adolescent|child|neonat|titrat|taper|cross-taper|washout|contraindicat|interaction|adverse|side effect|dosed?|dosing|mg|mcg|unit|bd|tds|qds|prn|stat|mane|nocte|od|po|im|iv|subcut|sublingual|buccal|rectal|transdermal|topical|inhalation|intranasal|intra muscular|depot|modified release|immediate release|prolonged release|sustained release|extended release|gastro-resistant|enteric coated|or dispersible|liquid|syrup|suspension|solution|tablets?|capsules?|drops?|injections?|infusions?|patches?|cream|ointment|gel|spray|inhaler|nebuliser|suppositories?|pessary|management|assessment|treatment|guidance|therapy|monitoring|screening|diagnosis|clinical|patient|ward|discharge|admission)\b/i;

function unsupportedSoftTailEligible(analysis: ClinicalQueryAnalysis) {
  if (analysis.queryClass !== "unsupported_or_general") return false;
  if (analysis.documentTitleIntent || analysis.medications.length || analysis.thresholdTerms.length) return false;
  if (analysis.reasons.some((reason) => reason !== "no_specific_rag_class_terms")) return false;
  return true;
}

export function shouldShortCircuitUnsupportedSearch(query: string, analysis: ClinicalQueryAnalysis) {
  if (analysis.corpusGrounding === "out_of_corpus") return true;
  if (unavailableDocumentNoisePattern.test(query)) return true;
  if (clearlyOutsideCorpusMedicalPattern.test(query) && analysis.documentTitleTerms.length === 0) return true;
  if (!unsupportedSoftTailEligible(analysis)) return false;
  if (clearlyNonClinicalConsumerPattern.test(query)) return true;
  if (deterministicClinicalTermsPattern.test(query)) return false;
  return analysis.confidence <= 0.42 && analysis.expandedTerms.length <= 5;
}

// True only for queries that would short-circuit via the soft tail itself, not a pattern guard.
export function isUnsupportedSoftTailAnalysis(query: string, analysis: ClinicalQueryAnalysis) {
  if (unavailableDocumentNoisePattern.test(query)) return false;
  if (clearlyOutsideCorpusMedicalPattern.test(query) && analysis.documentTitleTerms.length === 0) return false;
  if (!unsupportedSoftTailEligible(analysis)) return false;
  if (clearlyNonClinicalConsumerPattern.test(query)) return false;
  return analysis.confidence <= 0.42 && analysis.expandedTerms.length <= 5;
}
