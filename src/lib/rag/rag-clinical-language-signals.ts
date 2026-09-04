const clinicalPopulationSignalPattern =
  /\b(?:adolescents?|children|child|paediatric|pediatric|adults?|older adults?|elderly|geriatric|pregnan\w*|perinatal|neonat\w*|newborns?|nicu|youth|teens?|young (?:person|people)|aged care|(?:aged?\s*)?65[- ]year(?:-old)?s?|renal|hepatic|over \d+ years|under \d+ years)\b/i;

const clinicalActionSignalPattern =
  /\b(?:withhold|cease|stop|discontinue|hold|monitor|check|repeat|review|refer|arrange|contact|escalate|seek|avoid|continue|commence|start|initiate|titrate|prescribe|administer|give|reduce|increase|document|consider|recheck|admit|transfer|use|assess(?:es|ed|ing)?|complet(?:e|es|ed|ing)|ensur(?:e|es|ed|ing)|identif(?:y|ies|ied|ying)|includ(?:e|es|ed|ing)|involv(?:e|es|ed|ing)|manag(?:e|es|ed|ing)|provid(?:e|es|ed|ing)|record(?:s|ed|ing)?|report(?:s|ed|ing)?|notif(?:y|ies|ied|ying)|inform(?:s|ed|ing)?|consult(?:s|ed|ing)?|recommend(?:s|ed|ing)?|support(?:s|ed|ing)?|observ(?:e|es|ed|ing)|screen(?:s|ed|ing)?)\b/i;

/** Canonical population-language signal shared by planning, extraction and context packing. */
export function hasClinicalPopulationSignal(text: string) {
  return clinicalPopulationSignalPattern.test(text);
}

/** Canonical clinical-action signal shared by extraction and context packing. */
export function hasClinicalActionSignal(text: string) {
  return clinicalActionSignalPattern.test(text);
}
