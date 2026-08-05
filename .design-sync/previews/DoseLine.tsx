import { DoseLine } from "prompt-for-codex-medical-knowledge-base";

const openSource = (_sourceId: string, _locator?: string) => {};

// Numerals stack because the dose column is right-aligned and fixed; the unit is
// sans at the label step and never uppercased (g is not G, mg is not MG).
export const Ledger = () => (
  <div className="w-[30rem]">
    <DoseLine
      caption="Starting doses"
      onOpenSource={openSource}
      rows={[
        {
          id: "clozapine-start",
          drug: "Clozapine",
          qualifier: "oral, adult inpatient",
          dose: { value: "12.5", unit: "mg" },
          status: "current",
        },
        {
          id: "lithium-start",
          drug: "Lithium carbonate",
          qualifier: "oral, adult",
          dose: { value: "250", unit: "mg" },
          status: "current",
        },
        {
          id: "valproate-start",
          drug: "Sodium valproate",
          qualifier: "oral, adult",
          dose: { value: "500", unit: "mg" },
          status: "current",
        },
      ]}
    />
  </div>
);

export const WithOverdueSource = () => (
  <div className="w-[30rem]">
    <DoseLine
      caption="Maximum doses"
      onOpenSource={openSource}
      rows={[
        {
          id: "quetiapine-max",
          drug: "Quetiapine",
          qualifier: "oral, adult",
          dose: { value: "800", unit: "mg/day" },
          status: "current",
        },
        {
          id: "olanzapine-max",
          drug: "Olanzapine",
          qualifier: "oral, adult",
          dose: { value: "20", unit: "mg/day" },
          status: "review_due",
          source: { sourceId: "wa-antipsychotic-guideline", title: "WA Antipsychotic Guideline", locator: "p. 22" },
        },
        {
          id: "aripiprazole-max",
          drug: "Aripiprazole",
          qualifier: "oral, adult",
          dose: { value: "30", unit: "mg/day" },
          status: "current",
        },
      ]}
    />
  </div>
);

export const Ranges = () => (
  <div className="w-[30rem]">
    <DoseLine
      onOpenSource={openSource}
      rows={[
        {
          id: "lithium-range",
          drug: "Lithium",
          qualifier: "serum level, maintenance",
          dose: { value: "0.6–0.8", unit: "mmol/L" },
          status: "current",
        },
        {
          id: "clozapine-range",
          drug: "Clozapine",
          qualifier: "plasma level",
          dose: { value: "350–600", unit: "ng/mL" },
          status: "current",
        },
      ]}
    />
  </div>
);
