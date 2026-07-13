import { SafeBoldText } from "prompt-for-codex-medical-knowledge-base";

export const WithBoldSegments = () => (
  <p style={{ maxWidth: "60ch" }}>
    <SafeBoldText text="Give **ceftriaxone 2 g IV daily** for 7 days. Review at **48 hours** and step down to oral therapy once afebrile." />
  </p>
);

export const PlainText = () => (
  <p style={{ maxWidth: "60ch" }}>
    <SafeBoldText text="No dose adjustment is required for mild hepatic impairment." />
  </p>
);
