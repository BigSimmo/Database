import { notFound } from "next/navigation";

import { FormulationMechanismPage } from "@/components/formulation/formulation-mechanism-page";
import { findFormulationMechanism, formulationMechanisms } from "@/lib/formulation";

export function generateStaticParams() {
  return formulationMechanisms.map((mechanism) => ({ slug: mechanism.id }));
}

export default async function FormulationMechanismRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mechanism = findFormulationMechanism(slug);
  if (!mechanism) notFound();
  return <FormulationMechanismPage mechanism={mechanism} />;
}
