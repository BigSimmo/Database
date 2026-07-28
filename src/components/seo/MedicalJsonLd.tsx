import React from "react";

export type MedicalJsonLdType = "MedicalCondition" | "Drug" | "MedicalWebPage";

interface MedicalJsonLdProps {
  type: MedicalJsonLdType;
  name: string;
  description?: string;
  url?: string;
  [key: string]: any;
}

export function MedicalJsonLd({ type, name, description, url, ...rest }: MedicalJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url,
    ...rest,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
