// Server component: loads the content once per request and hands the view-model to the page views.
import { BedsideHomeView, type Training } from "@/components/first-nations/bedside-home";
import { InnerPageView } from "@/components/first-nations/inner-page";
import { loadModelInputs } from "@/lib/first-nations/content";
import type { FirstNationsPageId } from "@/lib/first-nations/content-schema";
import {
  buildBedsideModel,
  buildInnerPageModel,
  type ModelInputs,
  type SourceView,
} from "@/lib/first-nations/view-model";

function extras(inputs: ModelInputs): { training: Training; mapSource: SourceView | null } {
  const training = inputs.content.training;
  const source = inputs.sources[inputs.map.sourceId];
  return {
    training: training ? { label: training.label, href: training.href } : null,
    mapSource: source ? { title: source.title, url: source.url } : null,
  };
}

export function FirstNationsPageRenderer({ pageId }: { pageId: FirstNationsPageId }) {
  const inputs = loadModelInputs();
  return pageId === "bedside" ? (
    <BedsideHomeView model={buildBedsideModel(inputs)} {...extras(inputs)} />
  ) : (
    <InnerPageView model={buildInnerPageModel(inputs, pageId)} {...extras(inputs)} />
  );
}
