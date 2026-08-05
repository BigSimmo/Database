import { Quantity } from "prompt-for-codex-medical-knowledge-base";

export const Doses = () => (
  <div className="flex items-baseline gap-5">
    <Quantity value="12.5" unit="mg" />
    <Quantity value="0.6–0.8" unit="mmol/L" demoted />
  </div>
);
