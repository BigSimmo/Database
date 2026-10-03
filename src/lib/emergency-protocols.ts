/**
 * Immediate, deterministic acute psychiatric emergency protocol aide-mémoire.
 *
 * Provides instant (0ms latency, zero provider/LLM dependency) first-line clinical
 * action steps, urgent diagnostics, and toxicological escalation details when a
 * clinician searches for life-threatening acute psychiatric emergencies or
 * toxicities (e.g. NMS, Serotonin Syndrome, Lithium Toxicity, Acute Dystonic Reaction,
 * Clozapine Myocarditis, Malignant Catatonia).
 *
 * Single source of truth for acute psychiatric emergency fast-path guidance.
 */

export interface EmergencyActionStep {
  readonly title: string;
  readonly detail: string;
  readonly isHighPriority?: boolean;
}

export interface EmergencyClinicalProtocol {
  readonly id: string;
  readonly name: string;
  readonly acronym?: string;
  readonly triggerPatterns: readonly RegExp[];
  readonly category: "toxicity" | "reaction" | "cardiac" | "syndrome";
  readonly firstLineAction: string;
  readonly warningNotice: string;
  readonly diagnosticFeatures: readonly string[];
  readonly urgentInvestigations: readonly string[];
  readonly immediateManagement: readonly EmergencyActionStep[];
  readonly specialistContacts: readonly string[];
  readonly caveat: string;
  readonly evidenceSource: string;
}

export const EMERGENCY_CLINICAL_PROTOCOLS: readonly EmergencyClinicalProtocol[] = [
  {
    id: "EMERG-NMS",
    name: "Neuroleptic Malignant Syndrome (NMS)",
    acronym: "NMS",
    category: "syndrome",
    triggerPatterns: [
      /\b(?:nms|neuroleptic\s+malignant\s+syndrome|lead[\s-]?pipe\s+rigidity)\b/i,
      /\bhyperthermia\s+(?:and|with)\s+(?:rigidity|antipsychotic)\b/i,
    ],
    firstLineAction: "Cease all dopamine antagonists and antipsychotics immediately.",
    warningNotice:
      "Life-threatening medical emergency. High risk of rhabdomyolysis, acute kidney injury, cardiovascular collapse, and mortality. Activate hospital emergency response (MET / Code Blue / ICU).",
    diagnosticFeatures: [
      "Severe 'lead-pipe' muscular rigidity (generalized, sustained resistance to passive movement)",
      "Hyperthermia (frequently > 38°C, can exceed 40°C)",
      "Autonomic instability: labile blood pressure, marked tachycardia, tachypnea, profuse diaphoresis",
      "Altered mental status: confusion, delirium, stupor, mutism, fluctuating consciousness",
    ],
    urgentInvestigations: [
      "Serum Creatine Kinase (CK): typically markedly elevated (> 1,000–10,000+ U/L; indicates rhabdomyolysis)",
      "EUC & Creatinine: assess for acute kidney injury secondary to myoglobinuria",
      "Full Blood Count (FBC): leukocytosis (often 10,000–40,000/mcL)",
      "Electrolytes, Troponin, 12-lead ECG, Liver function tests, Blood gas, Coagulation profile (DIC check)",
    ],
    immediateManagement: [
      {
        title: "Immediate Antipsychotic Cessation",
        detail:
          "Stop all dopamine antagonists immediately. Do not abruptly cease dopamine agonists if Parkinson's disease is present.",
        isHighPriority: true,
      },
      {
        title: "Aggressive IV Hydration & Renal Protection",
        detail:
          "Infuse IV normal saline (e.g. 150–250 mL/h, titrate to urine output > 100–200 mL/h) to prevent myoglobin-induced renal tubular necrosis.",
        isHighPriority: true,
      },
      {
        title: "Active Physical Cooling",
        detail:
          "Remove excess clothing, apply cooling blankets, ice packs to axillae/groin, and maintain room cooling. Antipyretics are generally ineffective (central set-point intact).",
      },
      {
        title: "Specific Pharmacotherapy (under ICU / Specialist Guidance)",
        detail:
          "Bromocriptine (dopamine agonist) 2.5–5 mg TDS/QDS via NG/oral, or Dantrolene (skeletal muscle relaxant) 1–2.5 mg/kg IV up to 10 mg/kg/day in refractory hyperthermia.",
      },
    ],
    specialistContacts: [
      "Poisons Information Centre: 13 11 26 (24 hours Australia-wide)",
      "Hospital Medical Emergency Team (MET) / Intensive Care Unit",
      "On-call Consultation-Liaison Psychiatrist",
    ],
    caveat:
      "Aide-mémoire for emergency clinical orientation only. Management must follow local hospital resuscitation and intensive care protocols.",
    evidenceSource:
      "Maudsley Prescribing Guidelines in Psychiatry (14th ed); Therapeutic Guidelines: Psychotropic (Version 8); Australian Prescriber.",
  },
  {
    id: "EMERG-SEROTONIN-SYNDROME",
    name: "Serotonin Syndrome (Serotonin Toxicity)",
    acronym: "SS",
    category: "toxicity",
    triggerPatterns: [
      /\b(?:serotonin\s+syndrome|serotonin\s+toxicity|hunter\s+criteria)\b/i,
      /\b(?:ssri|snri|maoi)\s+(?:toxicity|overdose|clonus)\b/i,
    ],
    firstLineAction: "Cease all serotonergic agents immediately.",
    warningNotice:
      "Rapidly evolving neuromuscular and autonomic toxidrome. Can escalate within hours to severe hyperthermia, seizures, metabolic acidosis, rhabdomyolysis, and death.",
    diagnosticFeatures: [
      "Hunter Serotonin Toxicity Criteria: spontaneous clonus, OR inducible clonus + agitation/diaphoresis, OR ocular clonus + agitation/diaphoresis, OR tremor + hyperreflexia, OR hypertonia + temp > 38°C + ocular clonus",
      "Neuromuscular excitation: spontaneous/ocular clonus, hyperreflexia (prominent in lower limbs), tremors, shivering",
      "Autonomic hyperactivity: diaphoresis, tachycardia, pyrexia, flushing, mydriasis, loose stools / diarrhea",
      "Altered mental state: agitation, restlessness, pressured speech, delirium, confusion",
    ],
    urgentInvestigations: [
      "Serum CK and EUC: evaluate for rhabdomyolysis and acute kidney injury",
      "12-lead ECG: monitor for tachycardia and conduction abnormalities",
      "Full blood count, arterial/venous blood gas, blood glucose level (exclude hypoglycemia)",
    ],
    immediateManagement: [
      {
        title: "Withhold All Serotonergic Medications",
        detail:
          "Stop SSRIs, SNRIs, MAOIs, TCAs, lithium, tramadol, fentanyl, dextromethorphan, triptans, and illicit serotonergic drugs (MDMA, amphetamines).",
        isHighPriority: true,
      },
      {
        title: "Symptom Control with Benzodiazepines",
        detail:
          "Administer Diazepam (5–10 mg oral or IV slowly) titrated to control neuromuscular agitation, muscle hyperactivity, and tremor.",
        isHighPriority: true,
      },
      {
        title: "Cooling & Avoid Physical Restraint",
        detail:
          "Active cooling for temperature > 38.5°C. Avoid physical restraints because isometric muscle struggle dramatically worsens hyperthermia, lactic acidosis, and rhabdomyolysis.",
      },
      {
        title: "Antidote for Moderate–Severe Cases (Specialist Directed)",
        detail:
          "Cyproheptadine (5-HT2A antagonist): initial dose 12 mg oral/NG, followed by 4–8 mg every 4–6 hours as indicated (maximum 32 mg/24h).",
      },
    ],
    specialistContacts: [
      "Poisons Information Centre: 13 11 26 (24 hours Australia-wide)",
      "Clinical Toxicology Service / Intensive Care Unit",
    ],
    caveat:
      "Aide-mémoire for acute management. Confirm diagnostic criteria and titrate interventions under specialist medical/toxicological direction.",
    evidenceSource:
      "Hunter Serotonin Toxicity Criteria (Dunkley et al., QJM 2003); Therapeutic Guidelines: Toxicology & Psychotropic; Australian Prescriber.",
  },
  {
    id: "EMERG-ACUTE-DYSTONIA",
    name: "Acute Dystonic Reaction (including Laryngeal & Oculogyric Crisis)",
    acronym: "ADR",
    category: "reaction",
    triggerPatterns: [
      /\b(?:acute\s+dystoni\w*|oculogyric\s+crisis|torticollis\s+antipsychotic|dystonic\s+reaction)\b/i,
      /\blaryngeal\s+dystoni\w*\b/i,
    ],
    firstLineAction: "Administer anticholinergic medication (Benztropine) promptly.",
    warningNotice:
      "Extremely distressing and painful muscular spasm. Laryngeal dystonia presents with stridor and dyspnoea and constitutes a life-threatening airway emergency.",
    diagnosticFeatures: [
      "Oculogyric crisis: sustained, involuntary upward or lateral gaze fixation",
      "Torticollis / retrocollis: severe, painful spasmodic rotation or hyperextension of neck",
      "Trismus (involuntary jaw clenching), facial grimacing, forced tongue protrusion, dysarthria",
      "Laryngeal dystonia: stridor, difficulty breathing, cyanosis (immediate airway risk)",
      "Opisthotonos: severe spasm of the back and neck muscles with backward arching",
    ],
    urgentInvestigations: [
      "Immediate clinical airway and respiratory assessment (oxygen saturation, respiratory effort, stridor)",
      "If stridor or respiratory distress present: prepare for emergency airway intervention / call MET",
    ],
    immediateManagement: [
      {
        title: "Anticholinergic Administration (Benztropine)",
        detail:
          "Administer Benztropine 1 to 2 mg IM or slow IV over 2 minutes (IV acts within 2–5 minutes; IM acts within 10–20 minutes).",
        isHighPriority: true,
      },
      {
        title: "Repeat Dose if Incomplete Response",
        detail: "If response is incomplete, repeat Benztropine 1–2 mg after 20–30 minutes (maximum 4 mg in 24 hours).",
      },
      {
        title: "Alternative Agent (if Benztropine Unavailable)",
        detail: "Promethazine 25 to 50 mg deep IM or slow IV, or Diazepam 5–10 mg oral/IV.",
      },
      {
        title: "Preventing Recurrence",
        detail:
          "Prescribe oral Benztropine 1–2 mg daily to BD for 48–72 hours following acute reversal, as the causative antipsychotic may outlast the anticholinergic.",
      },
    ],
    specialistContacts: [
      "Hospital Medical Emergency Team / Anaesthetics if stridor or airway compromise",
      "Poisons Information Centre: 13 11 26",
    ],
    caveat:
      "Rapidly reversible with anticholinergics. Ensure patient reassurance during distressing spasm. Review antipsychotic dose and regimen prior to next dose.",
    evidenceSource:
      "Therapeutic Guidelines: Psychotropic; Maudsley Prescribing Guidelines (14th ed); British National Formulary.",
  },
  {
    id: "EMERG-LITHIUM-TOXICITY",
    name: "Acute / Chronic Lithium Toxicity",
    acronym: "Li Tox",
    category: "toxicity",
    triggerPatterns: [
      /\b(?:lithium\s+toxic\w*|lithium\s+overdose|high\s+lithium\s+level|lithium\s+poisoning)\b/i,
      /\b(?:coarse\s+tremor|ataxia)\s+(?:and|with|from)\s+lithium\b/i,
    ],
    firstLineAction: "Withhold lithium immediately.",
    warningNotice:
      "Narrow therapeutic index. Severe toxicity (> 2.0–2.5 mmol/L) carries high risk of permanent cerebellar dysfunction (SILENT syndrome), seizures, arrhythmias, and acute renal failure.",
    diagnosticFeatures: [
      "Mild–Moderate (1.5–2.0 mmol/L): Coarse tremor, ataxia, nausea, vomiting, diarrhoea, muscle weakness, drowsiness, hyperreflexia",
      "Severe (> 2.0–2.5 mmol/L): Marked confusion, dysarthria, gross ataxia, myoclonus, fasciculations, seizures, hypotension, acute kidney injury",
      "Critical (> 3.5–4.0 mmol/L): Coma, status epilepticus, cardiovascular collapse, irreversible neurotoxicity",
    ],
    urgentInvestigations: [
      "Stat serum lithium level (repeat every 4–6 hours to monitor trajectory until clearly declining)",
      "EUC & eGFR: assess renal function and baseline clearance capacity",
      "Serum electrolytes: especially sodium (hyponatremia impairs renal lithium excretion)",
      "12-lead ECG: evaluate for T-wave inversion/flattening, sinus node dysfunction, QT prolongation, arrhythmias",
    ],
    immediateManagement: [
      {
        title: "Withhold Lithium & Nephrotoxic Offending Agents",
        detail:
          "Cease lithium immediately. Withhold ACE inhibitors, ARBs, NSAIDs, and thiazide/loop diuretics which impair renal lithium clearance.",
        isHighPriority: true,
      },
      {
        title: "Intravenous Normal Saline Resuscitation",
        detail:
          "Administer IV 0.9% Normal Saline (e.g. 150–250 mL/h adjusted for cardiovascular status) to correct volume depletion, maintain GFR, and promote urinary lithium excretion.",
        isHighPriority: true,
      },
      {
        title: "Haemodialysis Evaluation (Nephrology / ICU)",
        detail:
          "Indications for urgent haemodialysis: serum lithium > 4.0 mmol/L, OR > 2.5 mmol/L with severe neurological signs (seizures, altered conscious state) or acute renal failure.",
      },
    ],
    specialistContacts: [
      "Poisons Information Centre: 13 11 26 (24 hours Australia-wide)",
      "On-call Nephrology / Dialysis Unit",
      "Intensive Care Unit (ICU)",
    ],
    caveat:
      "Chronic toxicity carries greater tissue saturation and neurotoxicity than acute single overdose at equivalent serum levels. Manage in high-dependency or intensive care.",
    evidenceSource:
      "Extracorporeal Treatments in Poisoning (EXTRIP) Workgroup guidelines for lithium poisoning; Therapeutic Guidelines: Toxicology; Australian Prescriber.",
  },
  {
    id: "EMERG-CLOZAPINE-MYOCARDITIS",
    name: "Clozapine-Induced Myocarditis & Cardiomyopathy",
    acronym: "Clozapine Myocarditis",
    category: "cardiac",
    triggerPatterns: [
      /\b(?:clozapine\s+myocarditis|clozapine\s+troponin|clozapine\s+cardiac)\b/i,
      /\b(?:tachycardia|chest\s+pain|fever)\s+(?:and|with|on)\s+clozapine\b/i,
    ],
    firstLineAction: "Cease clozapine immediately if myocarditis is confirmed or strongly suspected.",
    warningNotice:
      "Potentially fatal IgE-mediated hypersensitivity myocarditis. Peak onset is during weeks 2 to 8 of initiation. Permanent contraindication to clozapine re-challenge once confirmed.",
    diagnosticFeatures: [
      "Persistent unexplained resting tachycardia (> 100–110 bpm) or orthostatic hypotension",
      "Unexplained fever (> 38°C) or flu-like symptoms during first 8 weeks of clozapine titration",
      "Shortness of breath, orthopnoea, chest tightness/pain, peripheral oedema",
      "Palpitations, marked fatigue, syncope, or elevated jugular venous pressure",
    ],
    urgentInvestigations: [
      "Urgent Serum Troponin I or T (compare with baseline)",
      "High-sensitivity C-reactive Protein (hs-CRP): sensitive early inflammatory marker",
      "12-lead ECG: assess for ST/T wave changes, sinus tachycardia, PR depression, arrhythmias",
      "Echocardiogram: evaluate for left ventricular systolic dysfunction, wall motion abnormalities, or pericardial effusion",
      "Full blood count: assess for eosinophilia (present in ~50% of cases)",
    ],
    immediateManagement: [
      {
        title: "Immediate Clozapine Cessation Thresholds",
        detail:
          "Cease clozapine immediately if Troponin exceeds 2x upper limit of normal OR if hs-CRP exceeds 100 mg/L alongside suggestive clinical signs.",
        isHighPriority: true,
      },
      {
        title: "Urgent Cardiology Referral",
        detail:
          "Consult cardiology immediately for echocardiography, cardiac monitoring, and heart failure management (ACE inhibitors, beta-blockers as indicated).",
        isHighPriority: true,
      },
      {
        title: "Permanent Contraindication to Re-challenge",
        detail:
          "Confirmed clozapine-induced myocarditis is an absolute contraindication to re-trial. Record adverse drug reaction prominently in medical records.",
      },
    ],
    specialistContacts: [
      "On-call Cardiology / Cardiac Care Unit",
      "Treating Consultant Psychiatrist / Hospital Clozapine Coordinator",
      "Poisons Information Centre: 13 11 26",
    ],
    caveat:
      "Tachycardia alone is common and often benign with clozapine, but persistent tachycardia with fever, dyspnoea, or elevated biomarkers mandates immediate cessation and investigation.",
    evidenceSource:
      "Ronaldson et al., Australian & New Zealand Journal of Psychiatry (Clozapine myocarditis monitoring protocol); Therapeutic Guidelines: Psychotropic; RANZCP Guidelines.",
  },
  {
    id: "EMERG-MALIGNANT-CATATONIA",
    name: "Malignant (Lethal) Catatonia",
    acronym: "Malignant Catatonia",
    category: "syndrome",
    triggerPatterns: [
      /\b(?:malignant\s+catatoni\w*|lethal\s+catatoni\w*|catatonic\s+excitement)\b/i,
      /\bcatatonia\s+(?:and|with)\s+(?:fever|hyperthermia|autonomic)\b/i,
    ],
    firstLineAction: "High-dose Benzodiazepine challenge (Lorazepam) & Urgent ECT Consultation.",
    warningNotice:
      "Life-threatening psychiatric emergency characterized by severe catatonic symptoms, hyperthermia, and autonomic collapse. High mortality without prompt treatment.",
    diagnosticFeatures: [
      "Catatonic motor signs: stupor, mutism, waxy flexibility, posturing, negativism, catalepsy",
      "Autonomic instability: pyrexia, fluctuating blood pressure, tachycardia, tachypnea, profuse sweating",
      "Course: often preceded by intense psychotic agitation or delirium ('catatonic excitement') culminating in stupor",
      "Distinction from NMS: NMS typically follows initiation/escalation of dopamine antagonists, whereas catatonia frequently has motor features prior to medications.",
    ],
    urgentInvestigations: [
      "Serum CK (Creatine Kinase): assess muscle breakdown and rhabdomyolysis",
      "EUC, FBC, Electrolytes, Coagulation profile, Blood gas",
      "Urgent neuroimaging (CT/MRI brain) and septic screen to exclude intracranial or infective pathology (e.g. anti-NMDA receptor encephalitis)",
    ],
    immediateManagement: [
      {
        title: "Lorazepam Challenge Test",
        detail:
          "Administer Lorazepam 1 to 2 mg sublingually, IV, or IM. Monitor for objective reduction in rigidity, mutism, or stupor within 30–60 minutes.",
        isHighPriority: true,
      },
      {
        title: "Urgent Electroconvulsive Therapy (ECT)",
        detail:
          "ECT is the definitive, life-saving first-line intervention for malignant catatonia, particularly when benzodiazepine response is incomplete or delayed.",
        isHighPriority: true,
      },
      {
        title: "Supportive Medical & Intensive Care",
        detail:
          "Hydration, nutritional support, venous thromboembolism (VTE) prophylaxis, pressure injury prevention, aspiration precautions.",
      },
    ],
    specialistContacts: [
      "Poisons Information Centre: 13 11 26 (24 hours Australia-wide)",
      "On-call ECT Coordinator / Consultant Psychiatrist",
      "Hospital Medical Emergency Team (MET) / Intensive Care Unit",
    ],
    caveat:
      "Dopamine antagonists (antipsychotics) must be avoided in acute catatonia as they can precipitate or aggravate neuroleptic malignant syndrome.",
    evidenceSource:
      "Bush-Francis Catatonia Rating Scale guidelines; Maudsley Prescribing Guidelines (14th ed); Fink & Taylor, Catatonia: A Clinician's Guide to Diagnosis and Treatment.",
  },
] as const;

/**
 * Matches an input search query against the curated acute psychiatric emergency protocols.
 * Returns the matching protocol or null if no acute emergency pattern is present.
 */
export function matchEmergencyClinicalProtocol(text: string | null | undefined): EmergencyClinicalProtocol | null {
  if (!text) return null;
  const normalized = text.normalize("NFKC").trim();
  if (normalized.length < 2) return null;

  for (const protocol of EMERGENCY_CLINICAL_PROTOCOLS) {
    for (const pattern of protocol.triggerPatterns) {
      if (pattern.test(normalized)) {
        return protocol;
      }
    }
  }

  return null;
}
