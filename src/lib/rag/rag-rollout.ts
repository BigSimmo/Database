import "server-only";
import { createHash, createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { retrievalAccessScopeForArgs } from "@/lib/owner-scope";
import { withRagRequestContext } from "@/lib/rag/rag-context-snapshot";
import type { RagObservationContext, SearchChunksArgs } from "@/lib/rag/rag-contracts";
import type { RagProgrammeMode } from "@/lib/rag/rag-programme-eval";
import { ragQueryPlanVersion, resolveAnswerSourcePolicy } from "@/lib/rag/rag-query-plan";
import {
  ragAnswerPromptVersion,
  ragAnswerSchemaVersion,
  ragAdaptiveAnswerPromptVersion,
  ragAdaptiveAnswerSchemaVersion,
  ragAdaptiveAnswerProducerAvailable,
  ragAdaptiveAnswerRenderAvailable,
  legacyAnswerGenerationContract,
  adaptiveAnswerGenerationContract,
  ragAnswerQualityEvaluationVersion,
} from "@/lib/rag/rag-versioning";
import type { SiteContentPartitionState } from "@/lib/types";

/** Actual producer and renderer versions used to isolate candidate cache identity. */
export const ragProgrammeVersions = Object.freeze({
  rollout: "rag-programme-rollout-v1",
  prompt: ragAnswerPromptVersion,
  schema: ragAnswerSchemaVersion,
  evaluation: "rag-programme-gate-v1",
  render: "adaptive-answer-surface-v1",
  adaptiveAnswerContract: ragAdaptiveAnswerPromptVersion,
  adaptiveSchema: ragAdaptiveAnswerSchemaVersion,
  adaptiveEvaluation: ragAnswerQualityEvaluationVersion,
  adaptiveProducerAvailable: ragAdaptiveAnswerProducerAvailable,
  adaptiveRendererAvailable: ragAdaptiveAnswerRenderAvailable,
});

export type RagProgrammeRolloutInput = {
  configuredMode: RagProgrammeMode;
  ownerId: string | null;
  canaryBasisPoints: number;
  serverSalt: string | undefined;
  queryPlanVersion: string;
  sourcePolicyVersion: string;
  indexGeneration: string;
  publicSiteContentReleaseId: string | null;
  publicSiteContentStaticManifestDigest: string | null;
  publicSiteContentReleaseDigest: string | null;
  publicSiteContentChangeEpoch: string | null;
  publicSiteContentState: SiteContentPartitionState;
  siteContentEnabled: boolean;
  australianAugmentationEnabled: boolean;
  adaptiveAnswerEnabled: boolean;
  adaptiveRenderEnabled: boolean;
};
export type RagProgrammeRolloutDecision = Readonly<{
  configuredMode: RagProgrammeMode;
  servedMode: "legacy" | "candidate";
  runShadowRetrieval: boolean;
  components: Readonly<{
    siteContent: boolean;
    australianAugmentation: boolean;
    adaptiveAnswer: boolean;
    adaptiveRender: boolean;
  }>;
  cohortBucket: number | null;
  cacheNamespace: string;
}>;

export function decideRagProgrammeRollout(
  args: RagProgrammeRolloutInput,
  producerAvailable: boolean = ragProgrammeVersions.adaptiveProducerAvailable,
  rendererAvailable: boolean = ragAdaptiveAnswerRenderAvailable,
): RagProgrammeRolloutDecision {
  const configuredMode = ["legacy", "shadow", "canary"].includes(args.configuredMode) ? args.configuredMode : "legacy";
  const valid =
    Number.isInteger(args.canaryBasisPoints) &&
    args.canaryBasisPoints >= 0 &&
    args.canaryBasisPoints <= 10000 &&
    [
      args.siteContentEnabled,
      args.australianAugmentationEnabled,
      args.adaptiveAnswerEnabled,
      args.adaptiveRenderEnabled,
    ].every((flag) => typeof flag === "boolean") &&
    [args.queryPlanVersion, args.sourcePolicyVersion, args.indexGeneration].every(
      (version) => typeof version === "string" && version.trim().length > 0,
    );
  const cohortBucket =
    valid &&
    configuredMode === "canary" &&
    args.ownerId?.trim() &&
    args.serverSalt?.trim() &&
    args.serverSalt.length >= 32
      ? createHmac("sha256", args.serverSalt).update(args.ownerId).digest().readUInt32BE(0) % 10000
      : null;
  const servedMode = cohortBucket !== null && cohortBucket < args.canaryBasisPoints ? "candidate" : "legacy";
  const runShadowRetrieval = valid && configuredMode === "shadow";
  const enabled = servedMode === "candidate" || runShadowRetrieval;
  const siteValid =
    ["current", "updating"].includes(args.publicSiteContentState) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      args.publicSiteContentReleaseId ?? "",
    ) &&
    /^[0-9a-f]{64}$/.test(args.publicSiteContentStaticManifestDigest ?? "") &&
    /^[0-9a-f]{64}$/.test(args.publicSiteContentReleaseDigest ?? "") &&
    /^(0|[1-9][0-9]*)$/.test(args.publicSiteContentChangeEpoch ?? "");
  const components = Object.freeze({
    siteContent: enabled && args.siteContentEnabled && siteValid,
    australianAugmentation: enabled && args.australianAugmentationEnabled,
    adaptiveAnswer: servedMode === "candidate" && producerAvailable === true && args.adaptiveAnswerEnabled,
    adaptiveRender:
      servedMode === "candidate" &&
      producerAvailable === true &&
      rendererAvailable === true &&
      args.adaptiveAnswerEnabled &&
      args.adaptiveRenderEnabled,
  });
  const cacheNamespace =
    servedMode === "legacy"
      ? "legacy"
      : "rag-candidate:" +
        createHash("sha256")
          .update(
            JSON.stringify([
              ragProgrammeVersions,
              servedMode,
              components,
              args.queryPlanVersion,
              args.sourcePolicyVersion,
              args.indexGeneration,
              args.siteContentEnabled,
              args.australianAugmentationEnabled,
              args.adaptiveAnswerEnabled,
              args.adaptiveRenderEnabled,
              ...(args.siteContentEnabled
                ? [
                    args.publicSiteContentReleaseId,
                    args.publicSiteContentStaticManifestDigest,
                    args.publicSiteContentReleaseDigest,
                    args.publicSiteContentChangeEpoch,
                    args.publicSiteContentState,
                  ]
                : []),
            ]),
          )
          .digest("hex");
  return Object.freeze({ configuredMode, servedMode, runShadowRetrieval, components, cohortBucket, cacheNamespace });
}

export function adaptiveAnswerRenderAllowed(
  decision: RagProgrammeRolloutDecision,
  finalContractVersion: string | undefined,
): boolean {
  return (
    decision.servedMode === "candidate" &&
    decision.components.adaptiveAnswer &&
    decision.components.adaptiveRender &&
    finalContractVersion === ragProgrammeVersions.adaptiveAnswerContract
  );
}

const issuedRequests = new WeakMap<
  RagProgrammeRolloutDecision,
  { context: object; requestIdentity: string; australianCurrent: boolean }
>();
function requestIdentity(args: SearchChunksArgs) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        args.query,
        args.queryMode ?? "auto",
        args.ownerId ?? null,
        retrievalAccessScopeForArgs(args),
        args.documentId ?? null,
        args.documentIds ?? null,
        args.answerSourcePolicy ?? resolveAnswerSourcePolicy(args.query),
      ]),
    )
    .digest("hex");
}

/** Only the issued request's served control may share legacy caches during shadow evaluation. */
export function isIssuedRagShadowControl(args: SearchChunksArgs): boolean {
  const decision = args.ragProgrammeRollout;
  const issued = decision && issuedRequests.get(decision);
  if (
    !issued ||
    args.ragQueryPlanMode !== "shadow" ||
    decision?.configuredMode !== "shadow" ||
    decision.servedMode !== "legacy" ||
    !decision.runShadowRetrieval ||
    decision.cacheNamespace !== "legacy" ||
    issued.context !== args.ragRequestContext ||
    args.ragQueryPlanVersion !== ragQueryPlanVersion ||
    args.governedCorpusComponents?.siteContent !== decision.components.siteContent ||
    args.governedCorpusComponents?.australianAugmentation !== decision.components.australianAugmentation ||
    args.governedCorpusComponents?.australianCurrent !== issued.australianCurrent
  )
    return false;
  try {
    return issued.requestIdentity === requestIdentity(args);
  } catch {
    return false;
  }
}
/** Resolve once at either exported boundary; nested calls reuse the exact immutable snapshot/decision. */
export function withRagProgrammeRollout<T extends SearchChunksArgs & { observationContext?: RagObservationContext }>(
  input: T,
): T & { ragProgrammeRollout: RagProgrammeRolloutDecision } {
  const args = withRagRequestContext(input);
  const issued = args.ragProgrammeRollout && issuedRequests.get(args.ragProgrammeRollout);
  const reusable =
    issued && issued.context === args.ragRequestContext && issued.requestIdentity === requestIdentity(args);
  const snapshot = args.ragRequestContext.snapshot;
  const site = snapshot.publicSiteContent;
  const decision = reusable
    ? args.ragProgrammeRollout!
    : decideRagProgrammeRollout({
        configuredMode: env.RAG_PROGRAMME_MODE ?? "legacy",
        ownerId: args.ownerId ?? null,
        canaryBasisPoints: env.RAG_PROGRAMME_CANARY_BASIS_POINTS ?? 0,
        serverSalt: env.RAG_PROGRAMME_ROLLOUT_SALT,
        queryPlanVersion: ragQueryPlanVersion,
        sourcePolicyVersion: snapshot.sourcePolicyVersion,
        indexGeneration: snapshot.documentIndexGeneration,
        publicSiteContentReleaseId: site.releaseId,
        publicSiteContentStaticManifestDigest: site.staticManifestDigest,
        publicSiteContentReleaseDigest: site.releaseDigest,
        publicSiteContentChangeEpoch: site.changeEpoch,
        publicSiteContentState: site.state,
        siteContentEnabled: env.RAG_SITE_CONTENT_ENABLED ?? false,
        australianAugmentationEnabled: env.RAG_AUSTRALIAN_AUGMENTATION_ENABLED ?? false,
        adaptiveAnswerEnabled: env.RAG_ADAPTIVE_ANSWER_ENABLED ?? false,
        adaptiveRenderEnabled: env.RAG_ADAPTIVE_ANSWER_RENDER_ENABLED ?? false,
      });
  const australianCurrent = reusable
    ? issued.australianCurrent
    : args.governedCorpusComponents?.australianCurrent === true;
  if (!reusable)
    issuedRequests.set(decision, {
      context: args.ragRequestContext,
      requestIdentity: requestIdentity(args),
      australianCurrent,
    });
  const mode = decision.runShadowRetrieval ? "shadow" : decision.servedMode === "candidate" ? "canary" : "legacy";
  return {
    ...args,
    ragProgrammeRollout: decision,
    ragQueryPlanVersion,
    answerSourcePolicy: args.answerSourcePolicy ?? resolveAnswerSourcePolicy(args.query),
    ...(args.observationContext ? { observationContext: { ...args.observationContext, rolloutMode: mode } } : {}),
    ragQueryPlanMode: mode,
    governedCorpusComponents:
      decision.servedMode === "candidate" || decision.runShadowRetrieval
        ? Object.freeze({
            siteContent: decision.components.siteContent,
            australianAugmentation: decision.components.australianAugmentation,
            australianCurrent,
          })
        : undefined,
  };
}

/** Content-free operator projection; no cohort inputs or bucket. */
export function ragProgrammeHealth() {
  return {
    configuredMode: env.RAG_PROGRAMME_MODE ?? "legacy",
    candidatePercentage: (env.RAG_PROGRAMME_CANARY_BASIS_POINTS ?? 0) / 100,
    components: {
      siteContent: env.RAG_SITE_CONTENT_ENABLED ?? false,
      australianAugmentation: env.RAG_AUSTRALIAN_AUGMENTATION_ENABLED ?? false,
      adaptiveAnswer: env.RAG_ADAPTIVE_ANSWER_ENABLED ?? false,
      adaptiveRender: env.RAG_ADAPTIVE_ANSWER_RENDER_ENABLED ?? false,
    },
    augmentationHealth: env.RAG_AUSTRALIAN_AUGMENTATION_ENABLED ? "unavailable" : "disabled",
    versions: ragProgrammeVersions,
  };
}

/** One contract selector shared by actual generation and its cache fingerprint. */
export function answerContractForRollout(decision?: RagProgrammeRolloutDecision) {
  const adaptive =
    decision?.servedMode === "candidate" &&
    decision.components.adaptiveAnswer &&
    ragProgrammeVersions.adaptiveProducerAvailable;
  return adaptive
    ? { adaptive: true as const, ...adaptiveAnswerGenerationContract }
    : { adaptive: false as const, ...legacyAnswerGenerationContract };
}
