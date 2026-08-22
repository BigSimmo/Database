import type { Metadata } from "next";

import { FormulationHomePage } from "@/components/formulation/formulation-home-page";

export const metadata: Metadata = {
  title: "Clinical Formulation home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Clinical Formulation home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function FormulationDetailedHomeMockupPage() {
  return <FormulationHomePage />;
}
