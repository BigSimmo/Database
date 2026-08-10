import { ErrorState } from "prompt-for-codex-medical-knowledge-base";

// A failed request has no count to report, so none of these render a number.
// "0 matches" on a failed services search asserts there are no crisis services
// when the search never ran — see SPEC §10 and COMPONENTS §0.3.
export const Reasons = () => (
  <div className="flex flex-col gap-3">
    <ErrorState reason="request_failed" subject="Services" onRetry={() => {}} />
    <ErrorState reason="unauthorized" subject="Favourites" />
    <ErrorState reason="timeout" subject="DSM diagnoses" onRetry={() => {}} />
  </div>
);

// `inline` drops the panel chrome for a surface that already owns a border,
// exactly as the search band's fault panel sits inside the results ribbon.
export const Inline = () => <ErrorState reason="request_failed" subject="Referral services" density="inline" />;
