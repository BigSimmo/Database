import { DoseLine } from "prompt-for-codex-medical-knowledge-base";

// Numerals stack because the dose column is right-aligned and fixed; the unit is
// sans at the label step and never uppercased (g is not G, mg is not MG).
export const Ledger = () => (
  <div className="w-[30rem]">
    <DoseLine
      caption="Starting doses"
      rows={[
        { drug: "Clozapine", qualifier: "oral, adult inpatient", value: "12.5", unit: "mg" },
        { drug: "Lithium carbonate", qualifier: "oral, adult", value: "250", unit: "mg" },
        { drug: "Sodium valproate", qualifier: "oral, adult", value: "500", unit: "mg" },
      ]}
    />
  </div>
);

export const WithOverdueSource = () => (
  <div className="w-[30rem]">
    <DoseLine
      caption="Maximum doses"
      rows={[
        { drug: "Quetiapine", qualifier: "oral, adult", value: "800", unit: "mg/day" },
        { drug: "Olanzapine", qualifier: "oral, adult", value: "20", unit: "mg/day", overdue: true },
        { drug: "Aripiprazole", qualifier: "oral, adult", value: "30", unit: "mg/day" },
      ]}
    />
  </div>
);

export const Ranges = () => (
  <div className="w-[30rem]">
    <DoseLine
      rows={[
        { drug: "Lithium", qualifier: "serum level, maintenance", value: "0.6-0.8", unit: "mmol/L" },
        { drug: "Clozapine", qualifier: "plasma level", value: "350-600", unit: "ng/mL" },
      ]}
    />
  </div>
);
