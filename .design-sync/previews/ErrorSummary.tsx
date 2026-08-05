import { ErrorSummary } from "prompt-for-codex-medical-knowledge-base";

export const InvalidForm = () => (
  <ErrorSummary
    errors={[
      { fieldId: "medicine", label: "Medicine", message: "Choose a medicine." },
      { fieldId: "dose", label: "Dose", message: "Enter a dose." },
    ]}
  />
);
