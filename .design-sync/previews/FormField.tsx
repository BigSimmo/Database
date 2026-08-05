import { FormField } from "prompt-for-codex-medical-knowledge-base";

export const WithHintAndError = () => (
  <FormField label="Dose" hint="Include the unit." error="Enter a dose." required>
    {(field) => (
      <input
        id={field.id}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid}
        required={field.required}
        className="min-h-tap w-full rounded-lg border px-3"
      />
    )}
  </FormField>
);
