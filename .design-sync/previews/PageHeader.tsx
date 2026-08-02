import { PageHeader, Button, Chip } from "prompt-for-codex-medical-knowledge-base";
import { FileText, Plus } from "lucide-react";

export const Full = () => (
  <div className="w-[44rem]">
    <PageHeader
      icon={FileText}
      eyebrow="Documents"
      title="Clozapine monitoring protocol"
      description="Local haematological monitoring schedule, titration limits and rechallenge criteria."
      breadcrumb={[{ label: "Documents", href: "/documents" }, { label: "Clozapine monitoring protocol" }]}
      actions={
        <Button variant="primary" icon={Plus}>
          Add note
        </Button>
      }
      meta={
        <>
          <Chip tone="success">Current</Chip>
          <Chip tone="info">WA</Chip>
        </>
      }
    />
  </div>
);

export const TitleOnly = () => (
  <div className="w-[44rem]">
    <PageHeader title="Favourites" />
  </div>
);
