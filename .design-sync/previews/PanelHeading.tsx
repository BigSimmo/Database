import { PanelHeading } from "prompt-for-codex-medical-knowledge-base";
import { FileText, ShieldCheck } from "lucide-react";

export const WithDescription = () => (
  <PanelHeading
    icon={FileText}
    title="Document library"
    description="Guidelines, protocols and local policies indexed for search."
  />
);

export const TitleOnly = () => <PanelHeading icon={ShieldCheck} title="Source governance" />;

export const NoIcon = () => <PanelHeading title="Recent searches" description="Last 7 days across the workspace." />;
