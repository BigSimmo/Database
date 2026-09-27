import type { ServiceContent } from "@/lib/on-call/service-model";

/** Show the exact authored fields being reviewed or confirmed, without dialling a draft number. */
export function ServiceStructuredPreview({ content }: { content: ServiceContent }) {
  if (!content.steps && !content.cover) return null;
  return (
    <div className="grid gap-2 text-sm font-normal" data-testid="service-structured-preview">
      {content.phone ? <p className="nums font-normal">Phone or extension: {content.phone}</p> : null}
      {content.cover ? (
        <p>
          Role: {content.cover.grade}
          {content.cover.team ? ` · ${content.cover.team}` : ""}
          <br />
          <span className="nums font-normal">
            Cover: {content.cover.window.start}–{content.cover.window.end} (Perth)
          </span>
        </p>
      ) : null}
      {content.steps ? (
        <ol className="grid gap-2">
          {[...content.steps]
            .sort((a, b) => a.order - b.order)
            .map((step) => (
              <li key={step.order}>
                <p>
                  {step.order}. {step.whoToCall} · {step.when}
                </p>
                <p className="nums font-normal">
                  {step.phone ? `Phone or extension: ${step.phone}` : "No number recorded"} · {step.hours ?? "any"}
                  {step.waitMinutes ? ` · Hospital-set wait: ${step.waitMinutes} min` : " · No wait specified"}
                </p>
              </li>
            ))}
        </ol>
      ) : null}
    </div>
  );
}
