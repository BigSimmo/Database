const clinicalPopulationSignalPattern =
  /\b(?:adolescents?|children|child|paediatric|pediatric|adult|older adults?|elderly|geriatric|pregnan\w*|perinatal|renal|hepatic|over \d+ years|under \d+ years)\b/i;

const clinicalActionSignalPattern =
  /\b(?:withhold|cease|stop|discontinue|hold|monitor|check|repeat|review|refer|arrange|contact|escalate|seek|avoid|continue|commence|start|initiate|titrate|prescribe|administer|give|reduce|increase|document|consider|recheck|admit|transfer|use)\b/i;

/** Canonical population-language signal shared by planning, extraction and context packing. */
export function hasClinicalPopulationSignal(text: string) {
  return clinicalPopulationSignalPattern.test(text);
}

/** Canonical clinical-action signal shared by extraction and context packing. */
export function hasClinicalActionSignal(text: string) {
  return clinicalActionSignalPattern.test(text);
}
