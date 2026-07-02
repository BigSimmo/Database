export type DifferentialStreamType = "presentations" | "diagnoses";

export type DifferentialLikelihood = "most-likely" | "possible" | "less-likely" | "must-not-miss";

export type DifferentialMapNode = {
  id: string;
  label: string;
  likelihood: DifferentialLikelihood;
  note: string;
};

export type DifferentialSection = {
  id: string;
  title: string;
  summary: string;
  items: string[];
  tone: "fit" | "warning" | "question" | "action" | "test" | "overlap";
};

export type DifferentialRecord = {
  slug: string;
  title: string;
  status: "emergent" | "urgent" | "routine";
  subtitle: string;
  clinicalHinge: string;
  safetySnapshot: {
    summary: string;
    tags: string[];
  };
  sections: DifferentialSection[];
  related: DifferentialMapNode[];
  currentPresentation: string[];
  investigations: string[];
  immediateActions: string[];
};

export type DifferentialStreamCard = {
  id: string;
  title: string;
  description: string;
  examples: string[];
  href: string;
};

export type DifferentialComparisonCriterion = {
  id: string;
  title: string;
  tone: DifferentialSection["tone"];
};

export type DifferentialComparisonCandidate = {
  slug: string;
  selected: boolean;
  comparison: Record<string, string>;
};

export type DifferentialPresentationWorkflow = {
  id: string;
  title: string;
  status: DifferentialRecord["status"];
  subtitle: string;
  selectedCount: number;
  totalCount: number;
  safetySnapshot: {
    summary: string;
    tags: string[];
  };
  criteria: DifferentialComparisonCriterion[];
  candidates: DifferentialComparisonCandidate[];
  reviewChecklist: string[];
  highestUrgencyNote: string;
  sourceStatus: {
    label: string;
    version: string;
    lastUpdated: string;
  };
};

type PlaceholderRecordInput = {
  slug: string;
  title: string;
  status: DifferentialRecord["status"];
  subtitle: string;
  clinicalHinge: string;
  safetySummary: string;
  currentPresentation: string[];
  investigations: string[];
  immediateActions: string[];
  whyFits: string;
  arguesAgainst: string;
  mustNotMiss: string;
  bedsideQuestion: string;
  mimicsOverlap: string;
};

function placeholderRecord(input: PlaceholderRecordInput): DifferentialRecord {
  return {
    slug: input.slug,
    title: input.title,
    status: input.status,
    subtitle: input.subtitle,
    clinicalHinge: input.clinicalHinge,
    safetySnapshot: {
      summary: input.safetySummary,
      tags: ["Placeholder", "Review locally", "Source needed"],
    },
    sections: [
      {
        id: "why-it-fits",
        title: "Why it fits",
        summary: input.whyFits,
        items: [
          input.whyFits,
          "Placeholder information page. Replace with source-backed local guidance before clinical release.",
          "Use collateral history, observations, and examination to confirm the pattern.",
        ],
        tone: "fit",
      },
      {
        id: "what-argues-against",
        title: "What argues against",
        summary: input.arguesAgainst,
        items: [
          input.arguesAgainst,
          "Absence of the key exposure, timing, or examination pattern should reduce likelihood.",
          "Reassess if the clinical course changes.",
        ],
        tone: "overlap",
      },
      {
        id: "must-not-miss",
        title: "Must-not-miss",
        summary: input.mustNotMiss,
        items: [
          input.mustNotMiss,
          "Treat immediate threats first while the differential is being refined.",
          "Escalate if airway, breathing, circulation, consciousness, or sepsis concern is present.",
        ],
        tone: "warning",
      },
      {
        id: "bedside-question",
        title: "Bedside question",
        summary: input.bedsideQuestion,
        items: [
          input.bedsideQuestion,
          "Ask witnesses, carers, family, ambulance, or ward staff for the last-known-normal timeline.",
          "Check whether symptoms are improving, fluctuating, or progressing.",
        ],
        tone: "question",
      },
      {
        id: "immediate-action",
        title: "Immediate action",
        summary: input.immediateActions.join(" "),
        items: input.immediateActions,
        tone: "action",
      },
      {
        id: "investigations",
        title: "Investigations",
        summary: input.investigations.join(", "),
        items: input.investigations,
        tone: "test",
      },
      {
        id: "mimics-overlap",
        title: "Mimics / overlap",
        summary: input.mimicsOverlap,
        items: [
          input.mimicsOverlap,
          "This page is a placeholder scaffold pending reviewed local content.",
          "Use the presentation comparison workflow to keep immediate risks visible.",
        ],
        tone: "overlap",
      },
    ],
    related: [
      {
        id: "acute-confusion",
        label: "Acute confusion / encephalopathy",
        likelihood: "possible",
        note: "Presentation-level comparison workflow.",
      },
      {
        id: "delirium",
        label: "Delirium",
        likelihood: "possible",
        note: "Common overlapping presentation with fluctuating attention.",
      },
      {
        id: "sepsis",
        label: "Sepsis",
        likelihood: "must-not-miss",
        note: "May present with acute confusion before focal signs are clear.",
      },
    ],
    currentPresentation: input.currentPresentation,
    investigations: input.investigations,
    immediateActions: input.immediateActions,
  };
}

export const differentialRecords: DifferentialRecord[] = [
  {
    slug: "delirium",
    title: "Delirium",
    status: "emergent",
    subtitle: "Common cause of acute change in attention and awareness.",
    clinicalHinge:
      "Acute onset and fluctuating attention with altered awareness. Treat reversible precipitants while looking for must-not-miss causes.",
    safetySnapshot: {
      summary: "Stabilise ABCs, check BGL, vitals, oxygen saturations, attention test, and treat precipitants early.",
      tags: ["High risk", "Rapid deterioration", "Falls", "Aspiration"],
    },
    sections: [
      {
        id: "why-it-fits",
        title: "Why it fits",
        summary: "Acute onset with fluctuating course, inattention, disorientation, and altered awareness.",
        items: [
          "Reduced or fluctuating attention",
          "Altered level of awareness",
          "Sleep-wake disturbance or agitation",
          "Collateral history supports a recent change from baseline",
        ],
        tone: "fit",
      },
      {
        id: "must-not-miss",
        title: "Must-not-miss",
        summary: "Sepsis, hypoxia, intracranial bleed, severe dehydration, hypoglycaemia, and drug toxicity.",
        items: [
          "Sepsis or occult infection",
          "Hypoxia, hypercapnia, or pulmonary embolism",
          "Intracranial bleed, seizure, or head injury",
          "Medication toxicity, withdrawal, or anticholinergic burden",
        ],
        tone: "warning",
      },
      {
        id: "bedside-question",
        title: "Bedside question",
        summary: "Does attention fluctuate, for example when asked to recite months backwards?",
        items: [
          "Ask collateral: when was the patient last clearly normal?",
          "Check whether symptoms fluctuate over minutes to hours",
          "Screen attention before assuming primary psychiatric illness",
        ],
        tone: "question",
      },
      {
        id: "immediate-action",
        title: "Immediate action",
        summary: "Treat cause, oxygenate, rehydrate, stop deliriogenic medicines, and optimise environment.",
        items: [
          "Correct hypoxia, hypoglycaemia, pain, dehydration, and urinary retention",
          "Review medicines and remove anticholinergic or sedating burden where safe",
          "Use orientation cues, glasses/hearing aids, sleep protection, and family support",
        ],
        tone: "action",
      },
      {
        id: "investigations",
        title: "Investigations",
        summary: "BGL, FBC, U&E, CRP, LFTs, ABG/VBG if hypoxic, CXR, ECG, and urinalysis.",
        items: [
          "BGL, FBC, U&E, CRP, LFTs, calcium, thyroid where indicated",
          "Oxygenation assessment and ABG/VBG if respiratory compromise is possible",
          "CXR, ECG, urinalysis, cultures, drug levels, and CT head when indicated",
        ],
        tone: "test",
      },
      {
        id: "mimics-overlap",
        title: "Mimics / overlap",
        summary: "Dementia, depression, intoxication, post-ictal state, catatonia, and metabolic causes.",
        items: [
          "Dementia usually has slower onset but can coexist with delirium",
          "Depression may impair concentration without fluctuating awareness",
          "Post-ictal confusion and intoxication can look identical at first contact",
        ],
        tone: "overlap",
      },
    ],
    related: [
      {
        id: "acute-confusion",
        label: "Acute confusion / encephalopathy",
        likelihood: "possible",
        note: "Presentation-level label while the precipitant is being identified.",
      },
      {
        id: "substance-intoxication",
        label: "Substance intoxication",
        likelihood: "possible",
        note: "Temporal relationship to alcohol, sedatives, opioids, stimulants, or withdrawal.",
      },
      {
        id: "post-ictal-state",
        label: "Post-ictal confusion",
        likelihood: "possible",
        note: "Look for witnessed seizure, tongue bite, incontinence, or focal recovery pattern.",
      },
      {
        id: "sepsis",
        label: "Sepsis",
        likelihood: "must-not-miss",
        note: "May present as confusion before fever or focal symptoms are obvious.",
      },
      {
        id: "hypoxia",
        label: "Hypoxia",
        likelihood: "less-likely",
        note: "Check oxygen saturations and respiratory work early.",
      },
      {
        id: "dementia",
        label: "Dementia",
        likelihood: "less-likely",
        note: "Usually chronic; collateral history distinguishes baseline from acute change.",
      },
    ],
    currentPresentation: ["Attention fluctuates", "Altered awareness", "No fever documented"],
    investigations: ["BGL", "FBC", "U&E", "CRP", "LFTs", "ABG/VBG", "CXR", "ECG", "Urinalysis"],
    immediateActions: [
      "Stabilise ABCs and oxygenation",
      "Treat reversible precipitants",
      "Reduce deliriogenic medicines where safe",
      "Use environmental and orientation measures",
    ],
  },
  {
    slug: "pneumonia",
    title: "Pneumonia",
    status: "urgent",
    subtitle: "Infective inflammation of lung parenchyma causing cough, fever, dyspnoea, or pleuritic pain.",
    clinicalHinge:
      "Respiratory symptoms plus systemic features, focal chest signs, or imaging support. Assess severity and aspiration risk early.",
    safetySnapshot: {
      summary:
        "Rapid deterioration, sepsis, or hypoxia can occur. Assess oxygenation, severity, and admission need early.",
      tags: ["SpO2 < 92%", "Respiratory distress", "SBP < 90 mmHg", "Confusion / delirium"],
    },
    sections: [
      {
        id: "why-it-fits",
        title: "Why it fits",
        summary: "Fever, cough, purulent sputum, pleuritic pain, focal chest signs, or consolidation on imaging.",
        items: [
          "Cough, fever, chills, rigors, dyspnoea, or pleuritic chest pain",
          "Focal crackles, bronchial breathing, or reduced breath sounds",
          "Raised inflammatory markers with compatible clinical picture",
          "Delirium or acute deterioration in older adults",
        ],
        tone: "fit",
      },
      {
        id: "must-not-miss",
        title: "Must-not-miss",
        summary: "Sepsis, respiratory failure, pulmonary embolism, pneumothorax, heart failure, and aspiration.",
        items: [
          "Sepsis or septic shock",
          "Hypoxia, hypercapnia, or respiratory fatigue",
          "Pulmonary embolism or pneumothorax mimicking pneumonia",
          "Aspiration after reduced consciousness, dysphagia, or vomiting",
        ],
        tone: "warning",
      },
      {
        id: "bedside-question",
        title: "Bedside question",
        summary: "Is there respiratory compromise or a non-infective mimic that changes urgent management?",
        items: [
          "Check respiratory rate, work of breathing, oxygen saturation, and blood pressure",
          "Ask about aspiration, immunosuppression, recent admission, and antibiotic exposure",
          "Look for wheeze, raised JVP, leg swelling, pleuritic risk factors, or unilateral signs",
        ],
        tone: "question",
      },
      {
        id: "immediate-action",
        title: "Immediate action",
        summary:
          "Give oxygen if hypoxic, assess severity, treat sepsis, and start antibiotics when bacterial pneumonia is likely.",
        items: [
          "Use local severity pathway such as CURB-65/CRB-65 where appropriate",
          "Start antibiotics according to local guideline if bacterial pneumonia is likely",
          "Escalate for oxygen need, sepsis, frailty, immunosuppression, or high severity score",
        ],
        tone: "action",
      },
      {
        id: "investigations",
        title: "Investigations",
        summary:
          "CXR, FBC, CRP, U&E, LFTs, oxygenation assessment, blood cultures if severe, and sputum testing where useful.",
        items: [
          "CXR or appropriate imaging when diagnosis or severity is uncertain",
          "FBC, CRP, U&E, LFTs, oxygen saturation, ABG/VBG if hypoxic or severely unwell",
          "Blood cultures before antibiotics if severe, sputum culture if high-risk or non-response",
        ],
        tone: "test",
      },
      {
        id: "mimics-overlap",
        title: "Mimics / overlap",
        summary:
          "COPD/asthma exacerbation, heart failure, pulmonary embolism, pneumothorax, atelectasis, and malignancy.",
        items: [
          "Wheeze without focal signs may suggest asthma or COPD exacerbation",
          "Raised JVP, oedema, and bilateral crackles may suggest heart failure",
          "Sudden pleuritic pain, hypoxia, or risk factors may suggest pulmonary embolism",
        ],
        tone: "overlap",
      },
    ],
    related: [
      {
        id: "copd-asthma",
        label: "Asthma / COPD exacerbation",
        likelihood: "possible",
        note: "Prominent wheeze, trigger exposure, or prior obstructive disease.",
      },
      {
        id: "heart-failure",
        label: "Heart failure",
        likelihood: "possible",
        note: "Raised JVP, oedema, orthopnoea, or pulmonary oedema pattern.",
      },
      {
        id: "pulmonary-embolism",
        label: "Pulmonary embolism",
        likelihood: "must-not-miss",
        note: "Sudden pleuritic pain, tachycardia, hypoxia, or thrombotic risk.",
      },
      {
        id: "aspiration",
        label: "Aspiration pneumonitis / pneumonia",
        likelihood: "possible",
        note: "Reduced consciousness, dysphagia, vomiting, seizure, or intoxication.",
      },
      {
        id: "viral-urti",
        label: "Viral URTI / bronchitis",
        likelihood: "less-likely",
        note: "Coryzal symptoms without focal signs or systemic severity.",
      },
      {
        id: "pneumothorax",
        label: "Pneumothorax",
        likelihood: "less-likely",
        note: "Sudden unilateral pleuritic pain and reduced breath sounds.",
      },
    ],
    currentPresentation: ["Cough or dyspnoea", "Possible fever or systemic upset", "Chest signs pending"],
    investigations: ["CXR", "FBC", "CRP", "U&E", "LFTs", "SpO2", "ABG/VBG if hypoxic", "Blood cultures if severe"],
    immediateActions: [
      "Assess ABCs and oxygenation",
      "Calculate severity and admission risk",
      "Start antibiotics if bacterial pneumonia likely",
      "Escalate if hypoxic, septic, frail, or immunosuppressed",
    ],
  },
  placeholderRecord({
    slug: "substance-intoxication",
    title: "Substance intoxication",
    status: "emergent",
    subtitle: "Placeholder scaffold for acute intoxication causing altered mental state.",
    clinicalHinge:
      "Recent use, altered consciousness, ataxia, slurred speech, abnormal pupils, or toxidrome features can support intoxication.",
    safetySummary:
      "Airway, breathing, circulation, temperature, glucose, and co-ingestion risk are immediate priorities.",
    currentPresentation: ["Recent use possible", "Abnormal pupils or speech", "Consciousness altered"],
    investigations: ["Toxicology screen", "VBG/ABG", "U&E", "LFTs", "ECG", "BGL"],
    immediateActions: ["Support airway and breathing", "Check BGL", "Decontaminate if indicated", "Treat toxidrome"],
    whyFits: "Recent use, altered consciousness, ataxia, slurred speech, or abnormal pupils.",
    arguesAgainst: "No access to substance, normal pupils, and no toxidrome.",
    mustNotMiss: "Opioid toxicity, severe stimulant toxicity, mixed ingestion, serotonin syndrome.",
    bedsideQuestion: "Any recent use of alcohol, medicines, recreational drugs, or other substances?",
    mimicsOverlap: "Stroke, hypoglycaemia, sepsis, psychiatric causes, and post-ictal states.",
  }),
  placeholderRecord({
    slug: "substance-withdrawal",
    title: "Substance withdrawal",
    status: "emergent",
    subtitle: "Placeholder scaffold for withdrawal states causing agitation, confusion, or autonomic features.",
    clinicalHinge:
      "Recent reduction or cessation with autonomic symptoms, agitation, tremor, craving, seizures, or hallucinations can support withdrawal.",
    safetySummary:
      "Withdrawal can deteriorate quickly. Assess autonomic instability, seizures, hydration, and delirium risk.",
    currentPresentation: ["Recent cessation possible", "Autonomic symptoms", "Agitation or tremor"],
    investigations: ["BGL", "U&E", "LFTs", "Mg", "PO4", "Thiamine", "Toxicology if unclear"],
    immediateActions: [
      "Treat withdrawal syndrome",
      "Give thiamine where indicated",
      "Correct electrolytes",
      "Monitor closely",
    ],
    whyFits: "Recent cessation or reduction in use with autonomic symptoms, cravings, or agitation.",
    arguesAgainst: "No recent use or cessation and no autonomic features.",
    mustNotMiss: "Alcohol or benzodiazepine withdrawal, delirium tremens, seizures.",
    bedsideQuestion: "When was the last use? Any withdrawal symptoms or prior withdrawal seizures?",
    mimicsOverlap: "Anxiety disorder, sepsis, pain, thyrotoxicosis, and medication adverse effects.",
  }),
  placeholderRecord({
    slug: "post-ictal-confusion",
    title: "Post-ictal confusion",
    status: "emergent",
    subtitle: "Placeholder scaffold for confusion after suspected or witnessed seizure.",
    clinicalHinge:
      "Confusion after a witnessed or suspected seizure, amnesia, fatigue, tongue bite, incontinence, or focal recovery pattern can support a post-ictal state.",
    safetySummary:
      "Protect airway, check glucose, assess injury, and identify ongoing seizure or non-convulsive status risk.",
    currentPresentation: ["Witnessed event possible", "Amnesia or fatigue", "Injury check needed"],
    investigations: ["BGL", "U&E", "EEG if persistent", "CT/MRI if focal", "ECG"],
    immediateActions: ["Ensure safety", "Check glucose", "Treat seizures if present", "Assess injury"],
    whyFits: "After witnessed or suspected seizure with confusion, amnesia, or fatigue.",
    arguesAgainst: "No seizure history, rapid onset without post-ictal features, or persistent alternative cause.",
    mustNotMiss: "Non-convulsive status, metabolic injury, head injury, intracranial pathology.",
    bedsideQuestion: "Was there a seizure? Any witness report, tongue bite, incontinence, or focal weakness?",
    mimicsOverlap: "Syncope, TIA, stroke, intoxication, and metabolic encephalopathy.",
  }),
  placeholderRecord({
    slug: "wernicke-encephalopathy",
    title: "Wernicke encephalopathy",
    status: "emergent",
    subtitle: "Placeholder scaffold for thiamine deficiency encephalopathy.",
    clinicalHinge:
      "Alcohol use, poor nutrition, confusion, ataxia, eye signs, or high-risk malnutrition should prompt urgent thiamine treatment.",
    safetySummary: "Give parenteral thiamine before glucose where risk is significant and correct electrolytes.",
    currentPresentation: ["Nutrition risk", "Confusion", "Ataxia or eye signs"],
    investigations: ["BGL", "U&E", "Mg", "PO4", "LFTs", "Consider EEG", "MRI if atypical"],
    immediateActions: [
      "Give IV thiamine before glucose",
      "Correct electrolytes",
      "Treat nutrition risk",
      "Escalate if atypical",
    ],
    whyFits: "Alcohol use or poor nutrition with confusion, ataxia, eye signs, or ophthalmoplegia.",
    arguesAgainst: "No alcohol use, no risk factors, no eye signs, and adequate nutrition.",
    mustNotMiss: "Korsakoff syndrome and reversible thiamine deficiency.",
    bedsideQuestion: "Alcohol use, poor nutrition, vomiting, bariatric surgery, or eye signs?",
    mimicsOverlap: "Labyrinthitis, stroke, intoxication, migraine, and nutritional deficiency.",
  }),
  placeholderRecord({
    slug: "hepatic-encephalopathy",
    title: "Hepatic encephalopathy",
    status: "emergent",
    subtitle: "Placeholder scaffold for encephalopathy in liver disease.",
    clinicalHinge:
      "Known liver disease, asterixis, sleep reversal, personality change, GI bleed, infection, constipation, or precipitating factors can support hepatic encephalopathy.",
    safetySummary:
      "Treat precipitants, check for GI bleed or sepsis, and correct dehydration or electrolyte disturbance.",
    currentPresentation: ["Liver disease context", "Sleep reversal", "Precipitant check needed"],
    investigations: ["LFTs", "Ammonia", "U&E", "Coagulation", "FBC", "Liver ultrasound if needed"],
    immediateActions: ["Treat precipitants", "Consider lactulose", "Consider rifaximin", "Correct electrolytes"],
    whyFits: "Liver disease context, asterixis, sleep reversal, attention, or personality change.",
    arguesAgainst: "No liver disease or stigmata and normal ammonia where clinically relevant.",
    mustNotMiss: "GI bleed, sepsis, precipitating factors, severe hepatic failure.",
    bedsideQuestion: "Known liver disease, GI bleed, constipation, infection, sedatives, or dehydration?",
    mimicsOverlap: "Delirium, sepsis, intoxication effect, uraemia, and metabolic causes.",
  }),
  placeholderRecord({
    slug: "meningitis-encephalitis",
    title: "Meningitis / encephalitis",
    status: "emergent",
    subtitle: "Placeholder scaffold for CNS infection causing confusion or encephalopathy.",
    clinicalHinge:
      "Fever, headache, meningism, photophobia, rash, focal neurological signs, seizure, or immunosuppression should raise concern for CNS infection.",
    safetySummary:
      "Sepsis, raised intracranial pressure, seizures, and delayed antimicrobial treatment are priority risks.",
    currentPresentation: ["Fever or headache check", "Neck stiffness check", "Seizure or focal signs"],
    investigations: ["BGL", "FBC", "CRP", "U&E", "Blood cultures", "CT head if indicated", "LP when safe"],
    immediateActions: ["Stabilise ABCs", "Treat sepsis", "Start antimicrobials if suspected", "Escalate urgently"],
    whyFits: "Fever, headache, meningism, photophobia, seizure, focal signs, or immunosuppression.",
    arguesAgainst:
      "Afebrile presentation with no headache, meningism, focal signs, or infection risk lowers likelihood.",
    mustNotMiss: "Bacterial meningitis, HSV encephalitis, sepsis, raised intracranial pressure.",
    bedsideQuestion: "Any fever, headache, photophobia, rash, neck stiffness, seizure, or immunosuppression?",
    mimicsOverlap: "Delirium, migraine, post-ictal state, intoxication, and stroke.",
  }),
  placeholderRecord({
    slug: "thyroid-disease",
    title: "Thyroid disease",
    status: "urgent",
    subtitle: "Placeholder scaffold for thyroid dysfunction contributing to altered mental state.",
    clinicalHinge:
      "Severe hyperthyroidism, hypothyroidism, medication changes, systemic illness, temperature disturbance, or autonomic features can contribute to confusion.",
    safetySummary:
      "Temperature, pulse, blood pressure, hydration, cardiac rhythm, and endocrine escalation guide urgency.",
    currentPresentation: ["Autonomic features", "Temperature disturbance", "Medication history"],
    investigations: ["BGL", "U&E", "TSH", "Free T4", "ECG", "FBC", "CRP"],
    immediateActions: ["Assess ABCs", "Correct dehydration", "Treat temperature disturbance", "Seek endocrine advice"],
    whyFits: "Autonomic symptoms, tremor, temperature disturbance, weight change, or known thyroid disease.",
    arguesAgainst: "No thyroid history, no autonomic features, and normal thyroid testing where available.",
    mustNotMiss: "Thyroid storm, myxoedema coma, arrhythmia, adrenal overlap.",
    bedsideQuestion: "Any thyroid history, medicines, weight change, heat or cold intolerance, tremor, or bradycardia?",
    mimicsOverlap: "Sepsis, anxiety disorder, medication toxicity, withdrawal, and metabolic causes.",
  }),
];

export const acuteConfusionPresentationWorkflow: DifferentialPresentationWorkflow = {
  id: "acute-confusion-encephalopathy",
  title: "Acute confusion / encephalopathy",
  status: "emergent",
  subtitle: "Compare leading differentials side-by-side. Local clinical decision support only.",
  selectedCount: 6,
  totalCount: 8,
  safetySnapshot: {
    summary: "Stabilise ABCs, check BGL, sats, attention test, collateral, review meds/substances.",
    tags: ["Immediate risk", "Rapid deterioration", "Aspiration"],
  },
  criteria: [
    { id: "why-it-fits", title: "Why it fits", tone: "fit" },
    { id: "what-argues-against", title: "What argues against", tone: "overlap" },
    { id: "must-not-miss", title: "Must-not-miss", tone: "warning" },
    { id: "bedside-question", title: "Bedside question", tone: "question" },
    { id: "immediate-action", title: "Immediate action", tone: "action" },
    { id: "investigations", title: "Investigations", tone: "test" },
    { id: "mimics-overlap", title: "Mimics / overlap", tone: "overlap" },
  ],
  candidates: [
    {
      slug: "delirium",
      selected: true,
      comparison: {
        "why-it-fits": "Acute onset (hours-days). Fluctuating attention, disinhibition, altered awareness.",
        "what-argues-against": "Sustained attention intact; no fluctuation; lucid intervals.",
        "must-not-miss": "Sepsis, hypoxia, intracranial bleed, severe dehydration.",
        "bedside-question": "Does attention fluctuate, for example months or days backwards? Any new illness?",
        "immediate-action": "Stabilise ABCs, check BGL, sats, review meds.",
        investigations: "BGL, U&E, FBC, CRP, LFTs, ABG, urinalysis, CXR, ECG.",
        "mimics-overlap": "Dementia, depression, intoxication, post-ictal, metabolic causes.",
      },
    },
    {
      slug: "substance-intoxication",
      selected: true,
      comparison: {
        "why-it-fits": "Recent use, altered consciousness, ataxia, slurred speech, pupils abnormal.",
        "what-argues-against": "No access to substance; normal pupils; no toxidrome.",
        "must-not-miss": "Opioid toxicity, severe stimulant toxicity, serotonin syndrome.",
        "bedside-question": "Any recent use of alcohol, medicines, or other substances?",
        "immediate-action": "Support airway and breathing; decontaminate if indicated.",
        investigations: "Toxicology screen, VBG/ABG, U&E, LFTs, ECG.",
        "mimics-overlap": "Stroke, hypoglycaemia, sepsis, psychiatric causes.",
      },
    },
    {
      slug: "substance-withdrawal",
      selected: true,
      comparison: {
        "why-it-fits": "Recent cessation or reduction in use. Autonomic symptoms, cravings, agitation.",
        "what-argues-against": "No recent use or cessation; no autonomic features.",
        "must-not-miss": "Alcohol or benzodiazepine withdrawal, seizures.",
        "bedside-question": "When was last use? Any withdrawal symptoms?",
        "immediate-action": "Thiamine before glucose if risk; symptom-triggered treatment.",
        investigations: "BGL, U&E, LFTs, Mg, PO4, thiamine, consider tox screen.",
        "mimics-overlap": "Anxiety disorder, sepsis, pain, thyrotoxicosis.",
      },
    },
    {
      slug: "post-ictal-confusion",
      selected: true,
      comparison: {
        "why-it-fits": "After witnessed or suspected seizure. Confusion, amnesia, fatigue.",
        "what-argues-against": "No seizure history; rapid onset without post-ictal features.",
        "must-not-miss": "Non-convulsive status, metabolic injury, head injury.",
        "bedside-question": "Was there a seizure? Any witness?",
        "immediate-action": "Ensure safety, check glucose, treat seizures if present.",
        investigations: "BGL, U&E, EEG if persistent, CT/MRI if focal.",
        "mimics-overlap": "Syncope, TIA, stroke, intoxication, metabolic encephalopathy.",
      },
    },
    {
      slug: "wernicke-encephalopathy",
      selected: true,
      comparison: {
        "why-it-fits": "Alcohol use or poor nutrition. Confusion, ataxia, eye signs, ophthalmoplegia.",
        "what-argues-against": "No alcohol use or risk factors; no eye signs.",
        "must-not-miss": "Korsakoff syndrome, reversible with thiamine.",
        "bedside-question": "Alcohol use? Poor nutrition? Any eye signs?",
        "immediate-action": "Give IV thiamine before glucose. Correct electrolytes.",
        investigations: "BGL, U&E, Mg, PO4, LFTs, consider EEG, MRI if atypical.",
        "mimics-overlap": "Labyrinthitis, stroke, intoxication, migraine.",
      },
    },
    {
      slug: "hepatic-encephalopathy",
      selected: true,
      comparison: {
        "why-it-fits": "Liver disease context, asterixis, sleep reversal, attention, personality change.",
        "what-argues-against": "No liver disease or stigmata; normal ammonia.",
        "must-not-miss": "GI bleed, sepsis, precipitating factors.",
        "bedside-question": "Known liver disease? Any GI bleed or constipation?",
        "immediate-action": "Treat precipitants. Lactulose and rifaximin where indicated.",
        investigations: "LFTs, ammonia, U&E, coagulation, liver ultrasound.",
        "mimics-overlap": "Delirium, sepsis, intoxication effect, uraemia.",
      },
    },
    {
      slug: "meningitis-encephalitis",
      selected: false,
      comparison: {
        "why-it-fits": "Fever, headache, meningism, seizure, rash, focal signs, immunosuppression.",
        "what-argues-against": "No fever, headache, meningism, focal signs, or infection risk.",
        "must-not-miss": "Bacterial meningitis, HSV encephalitis, sepsis.",
        "bedside-question": "Any fever, rash, neck stiffness, photophobia, seizure, or immunosuppression?",
        "immediate-action": "Treat sepsis and start antimicrobials when suspected.",
        investigations: "FBC, CRP, U&E, blood cultures, CT if indicated, LP when safe.",
        "mimics-overlap": "Delirium, migraine, post-ictal state, intoxication, stroke.",
      },
    },
    {
      slug: "thyroid-disease",
      selected: false,
      comparison: {
        "why-it-fits": "Autonomic symptoms, tremor, temperature disturbance, or known thyroid disease.",
        "what-argues-against": "No thyroid history, no autonomic features, normal thyroid testing.",
        "must-not-miss": "Thyroid storm, myxoedema coma, arrhythmia.",
        "bedside-question": "Any thyroid history, medicines, weight change, temperature intolerance, or tremor?",
        "immediate-action": "Correct dehydration, treat temperature disturbance, seek endocrine advice.",
        investigations: "BGL, U&E, TSH, free T4, ECG, FBC, CRP.",
        "mimics-overlap": "Sepsis, anxiety disorder, medication toxicity, withdrawal, metabolic causes.",
      },
    },
  ],
  reviewChecklist: [
    "Stabilise and rule out immediate threats",
    "Assess for reversible causes",
    "Investigate and treat precipitants",
    "Reassess and refine differential",
    "Document and handoff",
  ],
  highestUrgencyNote: "Safety first. Act early.",
  sourceStatus: {
    label: "Source pending review",
    version: "v1.0 | Local content only",
    lastUpdated: "Today",
  },
};

export const differentialPresentationsCards: DifferentialStreamCard[] = [
  {
    id: "presentation-acute-confusion",
    title: "Acute confusion / encephalopathy",
    description: "Start with delirium, sepsis, hypoxia, intoxication, seizure, and metabolic causes.",
    examples: ["Acute confusion", "Fluctuating attention", "Post-operative disorientation"],
    href: "/differentials/presentations",
  },
  {
    id: "presentation-respiratory-infection",
    title: "Cough, fever, or dyspnoea",
    description: "Sort pneumonia from COPD/asthma, heart failure, pulmonary embolism, aspiration, and viral illness.",
    examples: ["Productive cough", "Hypoxia", "Pleuritic chest pain"],
    href: "/differentials/diagnoses/pneumonia",
  },
  {
    id: "presentation-acute-deterioration",
    title: "Acute medical deterioration",
    description: "Risk-order sepsis, respiratory failure, medication toxicity, and metabolic disturbance.",
    examples: ["New delirium", "Low saturations", "Rapid functional decline"],
    href: "/differentials/diagnoses/delirium",
  },
];

export const differentialDiagnosesCards: DifferentialStreamCard[] = differentialRecords.map((record) => ({
  id: `diagnosis-${record.slug}`,
  title: record.title,
  description: record.clinicalHinge,
  examples: record.related.slice(0, 3).map((node) => node.label),
  href: `/differentials/diagnoses/${record.slug}`,
}));

export function getDifferentialRecord(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return null;
  return differentialRecords.find((record) => record.slug === normalizedSlug) ?? null;
}

export function differentialStaticParams() {
  return differentialRecords.map((record) => ({ slug: record.slug }));
}

export function searchDifferentialRecords(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return differentialRecords;

  return differentialRecords.filter((record) => {
    const text = [
      record.title,
      record.subtitle,
      record.clinicalHinge,
      record.safetySnapshot.summary,
      ...record.sections.flatMap((section) => [section.title, section.summary, ...section.items]),
      ...record.related.flatMap((node) => [node.label, node.note]),
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(normalizedQuery);
  });
}
