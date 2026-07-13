import { ToggleSwitch } from "prompt-for-codex-medical-knowledge-base";

export const On = () => <ToggleSwitch enabled onToggle={() => {}} aria-label="Include archived documents" />;

export const Off = () => <ToggleSwitch enabled={false} onToggle={() => {}} aria-label="Include archived documents" />;

export const Disabled = () => <ToggleSwitch enabled disabled onToggle={() => {}} aria-label="Managed by policy" />;

export const ReadOnlyIndicator = () => <ToggleSwitch enabled aria-label="Source approved" />;
