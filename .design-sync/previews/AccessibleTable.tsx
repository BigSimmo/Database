import { AccessibleTable } from "prompt-for-codex-medical-knowledge-base";

export const ClinicalDoseTable = () => (
  <AccessibleTable
    caption="Community-acquired pneumonia — empirical therapy (adult)"
    rows={[
      ["Amoxicillin", "500 mg", "8-hourly", "Oral", "5 days"],
      ["Doxycycline", "100 mg", "12-hourly", "Oral", "7 days"],
      ["Benzylpenicillin", "1.2 g", "6-hourly", "IV", "Until stable"],
    ]}
    columns={["Antibiotic", "Dose", "Frequency", "Route", "Duration"]}
  />
);

export const CompactPreview = () => (
  <AccessibleTable
    caption="Severity assessment (CORB)"
    compact
    densePreview
    previewRows={2}
    rows={[
      ["Confusion", "New onset", "1"],
      ["Oxygen saturation", "≤ 90%", "1"],
      ["Respiratory rate", "≥ 30/min", "1"],
      ["Blood pressure", "Systolic < 90 mmHg", "1"],
    ]}
    columns={["Criterion", "Threshold", "Points"]}
  />
);

export const FromMarkdown = () => (
  <AccessibleTable
    caption="Renal dose adjustment"
    markdown={`| eGFR (mL/min) | Adjustment |\n| --- | --- |\n| > 60 | No change |\n| 30–60 | Reduce dose 50% |\n| < 30 | Avoid |`}
  />
);
