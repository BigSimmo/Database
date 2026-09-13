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
  governedRetrievalEnabled: boolean;
  siteContentEnabled: boolean;
  australianAugmentationEnabled: boolean;
  adaptiveAnswerEnabled: boolean;
  adaptiveRenderEnabled: boolean;
};
export type RagProgrammeRolloutDecision = Readonly<{
  configuredMode: RagProgrammeMode;
  servedMode: "legacy" | "candidate";
  retrievalMode: RagProgrammeMode;
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

function fullRolloutAvailability(
  args: Pick<
    RagProgrammeRolloutInput,
    "configuredMode" | "canaryBasisPoints" | "adaptiveAnswerEnabled" | "adaptiveRenderEnabled"
  >,
  producerAvailable: boolean,
  rendererAvailable: boolean,
  generationProviderAvailable: boolean,
  coverageContractAvailable: boolean,
) {
  const eligible = args.configuredMode === "canary" && args.canaryBasisPoints === 10000;
  const adaptiveAnswer =
    eligible &&
    args.adaptiveAnswerEnabled === true &&
    producerAvailable === true &&
    generationProviderAvailable &&
    coverageContractAvailable;
  const adaptiveRender = adaptiveAnswer && args.adaptiveRenderEnabled === true && rendererAvailable === true;
  const reason =
    args.configuredMode !== "canary"
      ? "programme_not_canary"
      : args.canaryBasisPoints !== 10000
        ? "full_rollout_not_enabled"
        : args.adaptiveAnswerEnabled !== true
          ? "adaptive_answer_disabled"
          : args.adaptiveRenderEnabled !== true
            ? "adaptive_render_disabled"
            : producerAvailable !== true
              ? "adaptive_producer_unavailable"
              : rendererAvailable !== true
                ? "adaptive_renderer_unavailable"
                : !generationProviderAvailable
                  ? "generation_provider_unavailable"
                  : !coverageContractAvailable
                    ? "governed_coverage_contract_unavailable"
                    : "enabled";
  return { eligible, adaptiveAnswer, adaptiveRender, generationProviderAvailable, coverageContractAvailable, reason };
}

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
    (args.serverSalt === undefined ||
      (typeof args.serverSalt === "string" && (!args.serverSalt.trim() || args.serverSalt.trim().length >= 32))) &&
    [
      args.governedRetrievalEnabled,
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
  // Full releases apply to every reader. Partial releases retain owner HMAC cohorts;
  // an anonymous request has no invented owner or tracking identity.
  const fullRollout = valid && configuredMode === "canary" && args.canaryBasisPoints === 10000;
  const servedMode =
    fullRollout || (cohortBucket !== null && cohortBucket < args.canaryBasisPoints) ? "candidate" : "legacy";
  const runShadowRetrieval = valid && args.governedRetrievalEnabled && configuredMode === "shadow";
  const retrievalMode = runShadowRetrieval
    ? "shadow"
    : servedMode === "candidate" && args.governedRetrievalEnabled
      ? "canary"
      : "legacy";
  const enabled = retrievalMode !== "legacy";
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
              retrievalMode,
              components,
              args.queryPlanVersion,
              args.sourcePolicyVersion,
              args.indexGeneration,
              args.governedRetrievalEnabled,
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
  return Object.freeze({
    configuredMode,
    servedMode,
    retrievalMode,
    runShadowRetrieval,
    components,
    cohortBucket,
    cacheNamespace,
  });
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
        governedRetrievalEnabled: env.RAG_GOVERNED_RETRIEVAL_ENABLED ?? false,
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
  const mode = decision.retrievalMode;
  const observationMode = decision.servedMode === "candidate" ? "canary" : mode;
  return {
    ...args,
    ragProgrammeRollout: decision,
    ragQueryPlanVersion,
    answerSourcePolicy: args.answerSourcePolicy ?? resolveAnswerSourcePolicy(args.query),
    ...(args.observationContext
      ? { observationContext: { ...args.observationContext, rolloutMode: observationMode } }
      : {}),
    ragQueryPlanMode: mode,
    governedCorpusComponents:
      mode !== "legacy"
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
  const configuredMode = env.RAG_PROGRAMME_MODE ?? "legacy";
  const governedRetrievalEnabled = env.RAG_GOVERNED_RETRIEVAL_ENABLED ?? false;
  const retrievalMode =
    governedRetrievalEnabled &&
    (configuredMode === "shadow" || (configuredMode === "canary" && (env.RAG_PROGRAMME_CANARY_BASIS_POINTS ?? 0) > 0))
      ? configuredMode
      : "legacy";
  return {
    configuredMode,
    retrieval: { governedRetrievalEnabled, mode: retrievalMode },
    candidatePercentage: (env.RAG_PROGRAMME_CANARY_BASIS_POINTS ?? 0) / 100,
    audiences: { guests: "full-rollout", authenticated: "owner-cohort-or-full-rollout" },
    fullRollout: fullRolloutAvailability(
      {
        configuredMode: env.RAG_PROGRAMME_MODE ?? "legacy",
        canaryBasisPoints: env.RAG_PROGRAMME_CANARY_BASIS_POINTS ?? 0,
        adaptiveAnswerEnabled: env.RAG_ADAPTIVE_ANSWER_ENABLED ?? false,
        adaptiveRenderEnabled: env.RAG_ADAPTIVE_ANSWER_RENDER_ENABLED ?? false,
      },
      ragAdaptiveAnswerProducerAvailable,
      ragAdaptiveAnswerRenderAvailable,
      env.RAG_PROVIDER_MODE !== "offline" && Boolean(env.OPENAI_API_KEY),
      retrievalMode === "canary",
    ),
    components: {
      siteContent: retrievalMode !== "legacy" && (env.RAG_SITE_CONTENT_ENABLED ?? false),
      australianAugmentation: retrievalMode !== "legacy" && (env.RAG_AUSTRALIAN_AUGMENTATION_ENABLED ?? false),
      adaptiveAnswer: env.RAG_ADAPTIVE_ANSWER_ENABLED ?? false,
      adaptiveRender: env.RAG_ADAPTIVE_ANSWER_RENDER_ENABLED ?? false,
    },
    augmentationHealth:
      retrievalMode !== "legacy" && env.RAG_AUSTRALIAN_AUGMENTATION_ENABLED ? "unavailable" : "disabled",
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
