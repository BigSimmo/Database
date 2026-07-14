import { InlineNotice } from "prompt-for-codex-medical-knowledge-base";

export const Success = () => (
  <InlineNotice tone="success">Document indexed — 42 chunks embedded and searchable.</InlineNotice>
);

export const Info = () => (
  <InlineNotice tone="info">A newer edition of this guideline is available from the publisher.</InlineNotice>
);

export const Warning = () => (
  <InlineNotice tone="warning">
    This source is past its scheduled review date — verify before relying on doses.
  </InlineNotice>
);

export const DangerDismissable = () => (
  <InlineNotice tone="danger" onDismiss={() => {}}>
    Upload failed: the PDF could not be parsed. Try re-exporting the document.
  </InlineNotice>
);

export const Neutral = () => (
  <InlineNotice tone="neutral">Sign in to keep your uploads private to your workspace.</InlineNotice>
);
