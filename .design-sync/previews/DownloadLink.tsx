import { DownloadLink } from "prompt-for-codex-medical-knowledge-base";

export const Download = () => (
  <DownloadLink href="/example-guideline.pdf" format="PDF" size="1.8 MB">
    Download guideline
  </DownloadLink>
);
