"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  ArrowLeft,
  ChevronDown,
  Download,
  ExternalLink,
  FileImage,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { useHideOnScroll } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { AnswerProgressStepper } from "@/components/clinical-dashboard/answer-status";
import type { TimedAnswerProgressUpdate } from "@/components/clinical-dashboard/answer-progress";
import { readAnswerStream } from "@/components/clinical-dashboard/search-utils";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import {
  appBackdrop,
  clinicalDivider,
  cn,
  codeText,
  eyebrowText,
  floatingControl,
  glassOverlaySurface,
  InlineNotice,
  LoadingPanel,
  panel,
  PanelHeading,
  proseMeasure,
  sourceCard,
  textMuted,
} from "@/components/ui-primitives";
import { BadgeCluster } from "@/components/clinical-dashboard/clinical-badge";
import { NonPdfSourcePreview } from "@/components/document-viewer/non-pdf-source-preview";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { resolveScrollBehavior } from "@/lib/scroll-behavior";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import {
  documentLoadKey,
  documentPageHref,
  isFullDocumentReload,
  nextLoadedDocumentKey,
} from "@/lib/document-viewer-navigation";
import { partitionViewerImages } from "@/lib/image-filtering";
import { isLocalNoAuthMode } from "@/lib/client-env";
import { isAdministratorUser } from "@/lib/authorization";
import { useAuthSession } from "@/lib/supabase/client";
import { SafeBoldText } from "@/components/SafeBoldText";
import { DocumentManagementActions } from "@/components/DocumentManagementActions";
import { Sheet } from "@/components/ui/sheet";
import type { ClinicalDocument, DocumentLabel, RagAnswer } from "@/lib/types";
import { cleanClinicalSummaryText } from "@/lib/source-text-sanitizer";
import { formatDocumentSummary } from "@/lib/document-summary-formatting";
import { buildDocumentSummaryBadges } from "@/lib/document-summary-badges";
import { documentSummaryQuestion } from "@/lib/answer-contract";
import type { DocumentDetailPayload } from "@/lib/document-detail-contract";
import type {
  ChunkRow,
  DocumentIndexHealth,
  DocumentSearchResult,
  ImageRow,
  PageRow,
  TableFactRow,
} from "@/components/document-viewer/types";
import {
  ClinicalSummaryProfile,
  DocumentImage,
  DocumentSectionSummary,
  DocumentViewerAnchors,
  FormattedHighYieldSummary,
  IndexedTextPanel,
  PinnedSourceEvidence,
  TableReviewPanel,
} from "@/components/document-viewer/source-panels";
import { DocumentManualTagEditor } from "@/components/document-viewer/manual-tag-editor";
import { DocumentOverviewLanding } from "@/components/document-viewer/document-overview-landing";

// pdf-canvas-viewer is only needed after a source document has loaded and the
// user is viewing a PDF. Keeping it out of the document route's initial client
// chunk avoids parsing its reader controls for image, text, and download-only
// documents. pdf.js itself remains loaded on demand by that component.
const PdfCanvasViewer = dynamic(
  () => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.PdfCanvasViewer),
  {
    ssr: false,
    loading: () => <PdfPreviewLoading />,
  },
);
const NativePdfEmbed = dynamic(
  () => import("@/components/document-viewer/pdf-canvas-viewer").then((module) => module.NativePdfEmbed),
  { ssr: false, loading: () => <PdfPreviewLoading /> },
);

function PdfPreviewLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="grid min-h-64 place-items-center bg-[color:var(--surface-inset)] p-5 text-center text-sm text-[color:var(--text-muted)] sm:min-h-72"
    >
      Loading PDF reader…
    </div>
  );
}

const secondaryButton = floatingControl;
const pdfViewerModeStorageKey = "clinical-kb:pdf-viewer-mode";
const pdfViewerNativeModeBreakpoint = 820;
const pdfViewerModeValue = {
  native: "native",
  canvas: "canvas",
} as const;
const pdfViewerModeNativeValue = pdfViewerModeValue.native;

function getDefaultPdfViewerMode(): boolean {
  return false;
}

type SignedUrlResponsePayload = {
  url?: string;
  caption?: string;
  mimeType?: string;
  fileType?: string;
  expiresAt?: string;
  error?: string;
};

// Single signed-URL GET: parse JSON, mark the session expired on 401, and throw
// a message on failure. Shared by the initial load and the expiry refresh so the
// fetch/auth handling lives in exactly one place.
async function requestSignedUrlPayload(
  endpoint: string,
  options: {
    signal: AbortSignal;
    headers: HeadersInit | undefined;
    onUnauthorized: () => void;
    errorMessage: string;
  },
): Promise<SignedUrlResponsePayload> {
  const response = await fetch(endpoint, { signal: options.signal, headers: options.headers });
  const payload: SignedUrlResponsePayload = await response.json();
  if (response.status === 401) options.onUnauthorized();
  if (!response.ok) throw new Error(payload?.error || options.errorMessage);
  return payload;
}

function getInitialPdfViewerMode() {
  if (typeof window === "undefined") {
    return {
      useNativePdfViewer: getDefaultPdfViewerMode(),
      hasExplicitPdfViewerMode: false,
    };
  }

  try {
    const savedMode = window.localStorage.getItem(pdfViewerModeStorageKey);
    if (savedMode === pdfViewerModeNativeValue) {
      return { useNativePdfViewer: true, hasExplicitPdfViewerMode: true };
    }

    if (savedMode === pdfViewerModeValue.canvas) {
      return { useNativePdfViewer: false, hasExplicitPdfViewerMode: true };
    }
  } catch {
    // window.localStorage may be unavailable in strict or private-browser contexts.
  }

  return {
    useNativePdfViewer: getDefaultPdfViewerMode(),
    hasExplicitPdfViewerMode: false,
  };
}

function rowsById<T extends { id: string }>(incoming: T[]) {
  const rows = new Map<string, T>();
  for (const row of incoming) rows.set(row.id, row);
  return Array.from(rows.values());
}

/**
 * Renders the clinical document viewer with source previews, extracted content, summaries, and document tools.
 *
 * @param documentId - The identifier of the document to load.
 * @param initialPage - The page to display initially in the source preview.
 * @param chunkId - An optional indexed passage to pin and scroll into view.
 * @returns The document viewer interface.
 */
export function DocumentViewer({
  documentId,
  initialPage,
  chunkId,
  initialDetail,
  initialError,
}: {
  documentId: string;
  initialPage: number;
  chunkId?: string;
  initialDetail?: DocumentDetailPayload;
  initialError?: string;
}) {
  const router = useRouter();
  const [activeRoute, setActiveRoute] = useState(() => ({ page: initialPage, chunkId }));
  const activePage = activeRoute.page;
  const activeChunkId = activeRoute.chunkId;

  useEffect(() => {
    const syncFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const parsedPage = Number.parseInt(params.get("page") ?? "", 10);
      setActiveRoute({
        page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
        chunkId: params.get("chunk") ?? undefined,
      });
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  const navigateToPage = useCallback(
    (page: number) => {
      const nextPage = Math.max(1, Math.trunc(page));
      if (nextPage === activePage) return;
      window.history.pushState(null, "", documentPageHref(documentId, nextPage));
      setActiveRoute({ page: nextPage, chunkId: undefined });
    },
    [activePage, documentId],
  );
  useEffect(() => {
    const previousOpenStates = new Map<HTMLDetailsElement, boolean>();
    const expandPrintableDisclosures = () => {
      if (previousOpenStates.size) return;
      previousOpenStates.clear();
      const printable = window.document.querySelectorAll<HTMLDetailsElement>("details.source-print");
      window.document
        .querySelectorAll<HTMLDetailsElement>('details.source-print, details[name="document-viewer-section"]')
        .forEach((disclosure) => {
          previousOpenStates.set(disclosure, disclosure.open);
        });
      printable.forEach((disclosure) => {
        disclosure.open = true;
      });
    };
    const restorePrintableDisclosures = () => {
      const connected = [...previousOpenStates].filter(([disclosure]) => disclosure.isConnected);
      connected.forEach(([disclosure]) => {
        disclosure.open = false;
      });
      connected.forEach(([disclosure, wasOpen]) => {
        if (wasOpen) disclosure.open = true;
      });
      previousOpenStates.clear();
    };
    window.addEventListener("beforeprint", expandPrintableDisclosures);
    window.addEventListener("afterprint", restorePrintableDisclosures);
    return () => {
      restorePrintableDisclosures();
      window.removeEventListener("beforeprint", expandPrintableDisclosures);
      window.removeEventListener("afterprint", restorePrintableDisclosures);
    };
  }, []);
  const [document, setDocument] = useState<ClinicalDocument | null>(() => initialDetail?.document ?? null);
  const [pages, setPages] = useState<PageRow[]>(() => initialDetail?.pages ?? []);
  const [images, setImages] = useState<ImageRow[]>(() => initialDetail?.images ?? []);
  const [tableFacts, setTableFacts] = useState<TableFactRow[]>(() => initialDetail?.tableFacts ?? []);
  const [chunks, setChunks] = useState<ChunkRow[]>(() => initialDetail?.chunks ?? []);
  const [indexHealth, setIndexHealth] = useState<DocumentIndexHealth | null>(() => initialDetail?.indexHealth ?? null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloadSignedUrl, setDownloadSignedUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<RagAnswer | null>(null);
  const [summaryQuery, setSummaryQuery] = useState(documentSummaryQuestion);
  const [summaryProgressEvents, setSummaryProgressEvents] = useState<TimedAnswerProgressUpdate[]>([]);
  const [summaryProgressStartedAt, setSummaryProgressStartedAt] = useState<number | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(() => !initialDetail && !initialError);
  const [viewerError, setViewerError] = useState<string | null>(() => initialError ?? null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingSource, setDownloadingSource] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  // Bounds *consecutive* auto-refreshes of an expired PDF signed URL so a
  // persistently failing URL can't loop. Reset on document change and on a
  // successful reload, so a long session that legitimately expires many times
  // over is never dead-ended — only an unrecoverable URL exhausts the budget.
  const signedUrlRefreshCountRef = useRef(0);
  const [sourceSearch, setSourceSearch] = useState("");
  const [documentSearchResults, setDocumentSearchResults] = useState<DocumentSearchResult[]>([]);
  const [searchingDocument, setSearchingDocument] = useState(false);
  const [documentSearchError, setDocumentSearchError] = useState<string | null>(null);
  const [reviewingTableFactId, setReviewingTableFactId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [localProjectReady, setLocalProjectReady] = useState(true);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  // Phone-only hide-on-scroll for the bottom composer: never hide while the
  // mobile actions sheet is open or while focus sits inside the composer
  // (keyboard users must not tab into invisible controls).
  const [composerChromeFocused, setComposerChromeFocused] = useState(false);
  const [shellScrollContainer, setShellScrollContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    // #main-content does NOT reliably mount once: the shell can remount it,
    // and a one-shot lookup then holds a detached node whose scroll events
    // never fire (the phone composer never hides). Observe for the viewer's
    // lifetime — childList mutations are infrequent and the setState dedups.
    const sync = () => {
      if (cancelled) return;
      // Track absence too: mid-remount, null falls back to window until the
      // replacement mounts (a stale detached node would never fire again).
      const main = window.document.getElementById("main-content");
      setShellScrollContainer((current) => (current === main ? current : main));
    };
    const observer = new MutationObserver(sync);
    observer.observe(window.document.body, { childList: true, subtree: true });
    sync();
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);
  const scrollHidden = useHideOnScroll({
    ...(shellScrollContainer ? { scrollContainer: shellScrollContainer } : {}),
    resetKey: `${documentId}:${activePage}:${activeChunkId ?? ""}`,
  });
  const composerScrollHidden = scrollHidden && !mobileActionsOpen && !composerChromeFocused;
  // Read localStorage after mount to prevent hydration mismatch.
  const [useNativePdfViewer, setUseNativePdfViewer] = useState(getDefaultPdfViewerMode);
  const [hasExplicitPdfViewerMode, setHasExplicitPdfViewerMode] = useState(false);
  const [viewerModeInitialized, setViewerModeInitialized] = useState(false);

  useEffect(() => {
    const initialMode = getInitialPdfViewerMode();
    if (initialMode.hasExplicitPdfViewerMode) {
      setUseNativePdfViewer(initialMode.useNativePdfViewer);
      setHasExplicitPdfViewerMode(true);
    }
    setViewerModeInitialized(true);
  }, []);
  const generatedSummaryRef = useRef<HTMLElement | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      summaryAbortRef.current?.abort();
    },
    [],
  );
  const {
    status: authStatus,
    session,
    isConfigured,
    authorizationHeader,
    registerAuthRequest,
    isAuthEpochCurrent,
    markSessionExpired,
  } = useAuthSession();
  const [authLoadingTimedOut, setAuthLoadingTimedOut] = useState(false);
  const [serverDemoMode, setServerDemoMode] = useState(
    () => initialDetail?.demoMode ?? process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  );
  const localNoAuthMode = isLocalNoAuthMode();
  const clientDemoMode = localNoAuthMode || serverDemoMode;
  const canViewSourceDocuments = localProjectReady;
  const canUsePrivateApis = localProjectReady && (clientDemoMode || authStatus === "authenticated");
  const canUseAdministrativeApis =
    localProjectReady && (serverDemoMode || (authStatus === "authenticated" && isAdministratorUser(session?.user)));

  useEffect(() => {
    if (authStatus !== "loading") {
      const resetId = window.setTimeout(() => setAuthLoadingTimedOut(false), 0);
      return () => window.clearTimeout(resetId);
    }
    const timeoutId = window.setTimeout(() => setAuthLoadingTimedOut(true), 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [authStatus]);

  useEffect(() => {
    if (typeof window === "undefined" || !viewerModeInitialized || hasExplicitPdfViewerMode) return;

    const syncDefaultViewerMode = () => {
      setUseNativePdfViewer(getDefaultPdfViewerMode());
    };

    const smallScreen = window.matchMedia(`(max-width: ${pdfViewerNativeModeBreakpoint}px)`);

    const syncFrame = window.requestAnimationFrame(syncDefaultViewerMode);
    smallScreen.addEventListener("change", syncDefaultViewerMode);

    return () => {
      window.cancelAnimationFrame(syncFrame);
      smallScreen.removeEventListener("change", syncDefaultViewerMode);
    };
  }, [viewerModeInitialized, hasExplicitPdfViewerMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== pdfViewerModeStorageKey || !event.newValue) return;
      if (event.newValue === pdfViewerModeValue.native) {
        setHasExplicitPdfViewerMode(true);
        setUseNativePdfViewer(true);
      } else if (event.newValue === pdfViewerModeValue.canvas) {
        setHasExplicitPdfViewerMode(true);
        setUseNativePdfViewer(false);
      }
    };

    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, []);

  useEffect(() => {
    if (!viewerModeInitialized || !hasExplicitPdfViewerMode) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        pdfViewerModeStorageKey,
        useNativePdfViewer ? pdfViewerModeNativeValue : pdfViewerModeValue.canvas,
      );
    } catch {
      // localStorage can be unavailable in hardened browsers/private mode.
    }
  }, [useNativePdfViewer, viewerModeInitialized, hasExplicitPdfViewerMode]);

  const applyPreviewSignedUrlResult = useCallback(
    (result: PromiseSettledResult<SignedUrlResponsePayload>, endpoint: string) => {
      if (result.status === "fulfilled") {
        const payload = result.value;
        if (payload.url) setCachedSignedUrl(endpoint, { ...payload, url: payload.url });
        setSignedUrl(payload.url ?? null);
        setPreviewError(null);
        return;
      }
      setSignedUrl(null);
      setPreviewError(result.reason instanceof Error ? result.reason.message : "Source preview could not be loaded.");
    },
    [],
  );

  const openSourcePreview = useCallback(
    (options: { signal: AbortSignal; useCache: boolean }): Promise<SignedUrlResponsePayload> => {
      const endpoint = `/api/documents/${documentId}/signed-url`;
      const cached = options.useCache ? getCachedSignedUrl(endpoint) : null;
      return cached
        ? Promise.resolve(cached)
        : requestSignedUrlPayload(endpoint, {
            signal: options.signal,
            headers: clientDemoMode ? undefined : authorizationHeader,
            onUnauthorized: markSessionExpired,
            errorMessage: "Source preview could not be loaded.",
          });
    },
    [authorizationHeader, clientDemoMode, documentId, markSessionExpired],
  );

  // Re-issue only the preview URL (no document-detail or download request) when a PDF's URL
  // expires mid-session, so the viewer refreshes in place without the full
  // reload/flicker. Its AbortController is cancelled on the next refresh and on unmount.
  const refreshControllerRef = useRef<AbortController | null>(null);
  const refreshSignedUrls = useCallback(() => {
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;

    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    const authRequest = registerAuthRequest(controller);

    readLocalProjectIdentity()
      .then((identity) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) {
          throw new DOMException("Stale authentication epoch", "AbortError");
        }
        if (!identity?.localServer?.safeLocalOrigin) {
          throw new Error(unsafeLocalProjectMessage(identity));
        }
        // handleSignedUrlExpired already cleared the cache, so always mint fresh.
        return openSourcePreview({ signal: controller.signal, useCache: false });
      })
      .then((payload) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        applyPreviewSignedUrlResult({ status: "fulfilled", value: payload }, signedUrlEndpoint);
      })
      .catch((error) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        setPreviewError(error instanceof Error ? error.message : "Source preview could not be loaded.");
      })
      .finally(() => {
        authRequest.release();
        if (refreshControllerRef.current === controller) refreshControllerRef.current = null;
      });
  }, [documentId, registerAuthRequest, isAuthEpochCurrent, openSourcePreview, applyPreviewSignedUrlResult]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  const downloadActionRef = useRef<Promise<void> | null>(null);
  const downloadControllerRef = useRef<AbortController | null>(null);
  const currentDocumentFileName = document?.file_name;
  const openSourceDownload = useCallback(() => {
    if (downloadActionRef.current) return downloadActionRef.current;

    const endpoint = `/api/documents/${documentId}/signed-url?download=true`;
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    const authRequest = registerAuthRequest(controller);
    const action = (async () => {
      setDownloadingSource(true);
      setDownloadError(null);
      try {
        const identity = await readLocalProjectIdentity();
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        if (!identity?.localServer?.safeLocalOrigin) throw new Error(unsafeLocalProjectMessage(identity));

        const cached = getCachedSignedUrl(endpoint);
        const payload =
          cached ??
          (await requestSignedUrlPayload(endpoint, {
            signal: controller.signal,
            headers: clientDemoMode ? undefined : authorizationHeader,
            onUnauthorized: markSessionExpired,
            errorMessage: "Download URL could not be loaded.",
          }));
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch) || !payload.url) return;

        setCachedSignedUrl(endpoint, { ...payload, url: payload.url });
        setDownloadSignedUrl(payload.url);
        const anchor = window.document.createElement("a");
        anchor.href = payload.url;
        anchor.rel = "noreferrer";
        anchor.download = currentDocumentFileName || "clinical-source";
        anchor.click();
      } catch (error) {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        setDownloadError(error instanceof Error ? error.message : "Download URL could not be loaded.");
      } finally {
        authRequest.release();
        if (downloadControllerRef.current === controller) {
          downloadControllerRef.current = null;
          setDownloadingSource(false);
        }
      }
    })();
    downloadActionRef.current = action;
    void action.finally(() => {
      if (downloadActionRef.current === action) downloadActionRef.current = null;
    });
    return action;
  }, [
    authorizationHeader,
    clientDemoMode,
    currentDocumentFileName,
    documentId,
    isAuthEpochCurrent,
    markSessionExpired,
    registerAuthRequest,
  ]);

  useEffect(
    () => () => {
      downloadControllerRef.current?.abort();
      downloadControllerRef.current = null;
      downloadActionRef.current = null;
    },
    [documentId],
  );

  // Distinguishes a full document (re)load — a new documentId or an explicit
  // retry (previewAttempt) — from page/chunk navigation on the already-loaded
  // document. Navigation only re-windows the detail; a full load also resets the
  // preview and re-issues only its signed URL.
  const loadedKeyRef = useRef<string | null>(null);
  const detailControllerRef = useRef<AbortController | null>(null);
  const detailRequestSequenceRef = useRef(0);
  const localProjectIdentityPromiseRef = useRef<ReturnType<typeof readLocalProjectIdentity> | null>(null);
  const initialRouteRef = useRef({ documentId, initialPage, chunkId });
  const navigatedFromInitialRouteRef = useRef(false);

  useEffect(() => {
    if (!canViewSourceDocuments && authStatus === "loading") {
      return () => undefined;
    }
    if (!canViewSourceDocuments) {
      return () => undefined;
    }

    const matchesInitialRoute =
      initialRouteRef.current.documentId === documentId &&
      initialRouteRef.current.initialPage === activePage &&
      initialRouteRef.current.chunkId === activeChunkId;
    if (!matchesInitialRoute) navigatedFromInitialRouteRef.current = true;
    const useInitialResult =
      previewAttempt === 0 &&
      matchesInitialRoute &&
      !navigatedFromInitialRouteRef.current &&
      Boolean(initialDetail || initialError);

    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    const requestSequence = ++detailRequestSequenceRef.current;
    const authRequest = registerAuthRequest(controller);
    const loadKey = documentLoadKey(documentId, previewAttempt);
    const isFullReload = isFullDocumentReload(loadedKeyRef.current, loadKey);
    const reset = window.setTimeout(() => {
      // Skip the reset on navigation so the mounted PDF and current content stay
      // visible (no loading flash) while the new page window loads in the background.
      if (!controller.signal.aborted && isFullReload && !useInitialResult) {
        setLoadingDocument(true);
        setViewerError(null);
        setPreviewError(null);
        setDownloadError(null);
        setDownloadingSource(false);
        setSignedUrl(null);
        setDownloadSignedUrl(null);
      }
    }, 0);
    const detailParams = new URLSearchParams({
      page: String(Math.max(1, activePage || 1)),
      pageLimit: "9",
      chunkLimit: "16",
      assetScope: "window",
    });
    if (activeChunkId) detailParams.set("chunk", activeChunkId);
    const detailUrl = `/api/documents/${documentId}?${detailParams.toString()}`;
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;
    if (!localProjectIdentityPromiseRef.current) {
      const pendingIdentity = readLocalProjectIdentity();
      localProjectIdentityPromiseRef.current = pendingIdentity;
      void pendingIdentity.then(
        (identity) => {
          if (!identity?.localServer?.safeLocalOrigin && localProjectIdentityPromiseRef.current === pendingIdentity) {
            localProjectIdentityPromiseRef.current = null;
          }
        },
        () => {
          if (localProjectIdentityPromiseRef.current === pendingIdentity) {
            localProjectIdentityPromiseRef.current = null;
          }
        },
      );
    }
    const identityRequest = localProjectIdentityPromiseRef.current!;
    identityRequest
      .then((identity) => {
        if (
          controller.signal.aborted ||
          requestSequence !== detailRequestSequenceRef.current ||
          !isAuthEpochCurrent(authRequest.epoch)
        ) {
          throw new DOMException("Stale authentication epoch", "AbortError");
        }
        if (!identity?.localServer?.safeLocalOrigin) {
          setLocalProjectReady(false);
          throw new Error(unsafeLocalProjectMessage(identity));
        }
        setLocalProjectReady(true);

        const detailRequest: Promise<DocumentDetailPayload> = useInitialResult
          ? initialDetail
            ? Promise.resolve(initialDetail)
            : Promise.reject(new Error(initialError || "Document could not be loaded."))
          : fetch(detailUrl, {
              signal: controller.signal,
              headers: clientDemoMode ? undefined : authorizationHeader,
            }).then(async (response) => {
              const payload = await response.json();
              if (response.status === 401) markSessionExpired();
              if (!response.ok) throw new Error(payload.error || "Document details could not be loaded.");
              return payload as DocumentDetailPayload;
            });
        // Navigation keeps the current preview; a full load re-issues only the preview URL.
        const previewRequest = isFullReload
          ? Promise.allSettled([openSourcePreview({ signal: controller.signal, useCache: true })])
          : Promise.resolve(null);

        return Promise.all([Promise.allSettled([detailRequest]), previewRequest]);
      })
      .then(([[detailResult], previewResults]) => {
        if (
          controller.signal.aborted ||
          requestSequence !== detailRequestSequenceRef.current ||
          !isAuthEpochCurrent(authRequest.epoch)
        )
          return;
        const detailLoaded = detailResult.status === "fulfilled";
        // The server-rendered initial result (including a sanitized failure) is
        // already authoritative for this attempt. Mark it handled so an auth
        // state refresh cannot duplicate the initial detail/preview requests;
        // an explicit retry increments previewAttempt and gets a fresh key.
        loadedKeyRef.current = useInitialResult
          ? loadKey
          : nextLoadedDocumentKey(loadedKeyRef.current, loadKey, detailLoaded);

        if (detailLoaded) {
          const detail = detailResult.value;
          setDocument(detail.document ?? null);
          // Keep the previous window visible while loading, then atomically
          // replace it so client memory and mounted DOM stay bounded.
          setPages(rowsById(detail.pages));
          setImages(rowsById(detail.images));
          setTableFacts(rowsById(detail.tableFacts));
          setChunks(rowsById(detail.chunks));
          setIndexHealth(detail.indexHealth ?? null);
          setServerDemoMode(detail.demoMode);
          setViewerError(null);
        } else {
          // Never retain evidence from the previous page under a newly selected
          // route. A navigation failure becomes an explicit retryable error.
          setDocument(null);
          setPages([]);
          setImages([]);
          setTableFacts([]);
          setChunks([]);
          setIndexHealth(null);
          const message =
            detailResult.reason instanceof Error ? detailResult.reason.message : "Document could not be loaded.";
          if (!canUsePrivateApis && !clientDemoMode && message === "Document not found.") {
            setViewerError(
              isConfigured
                ? "Sign in to open private source documents."
                : "Supabase browser authentication is not configured for private source documents.",
            );
          } else {
            setViewerError(message);
          }
        }

        if (previewResults) {
          const previewResult = previewResults[0];
          if (previewResult) applyPreviewSignedUrlResult(previewResult, signedUrlEndpoint);
        }
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          requestSequence !== detailRequestSequenceRef.current ||
          !isAuthEpochCurrent(authRequest.epoch)
        )
          return;
        setDocument(null);
        setPages([]);
        setImages([]);
        setTableFacts([]);
        setChunks([]);
        setIndexHealth(null);
        setViewerError(error instanceof Error ? error.message : "Document could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted && requestSequence === detailRequestSequenceRef.current) {
          setLoadingDocument(false);
          if (detailControllerRef.current === controller) detailControllerRef.current = null;
        }
      });

    return () => {
      window.clearTimeout(reset);
      controller.abort();
      authRequest.release();
      if (detailControllerRef.current === controller) detailControllerRef.current = null;
    };
  }, [
    authStatus,
    authorizationHeader,
    canUsePrivateApis,
    canViewSourceDocuments,
    clientDemoMode,
    documentId,
    activeChunkId,
    activePage,
    isConfigured,
    markSessionExpired,
    registerAuthRequest,
    isAuthEpochCurrent,
    previewAttempt,
    initialDetail,
    initialError,
    openSourcePreview,
    applyPreviewSignedUrlResult,
  ]);

  useEffect(() => {
    const query = sourceSearch.trim();
    if (!canViewSourceDocuments || query.length < 2) {
      const reset = window.setTimeout(() => {
        setDocumentSearchResults([]);
        setSearchingDocument(false);
        setDocumentSearchError(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const authRequest = registerAuthRequest(controller);
    const timeout = window.setTimeout(() => {
      setSearchingDocument(true);
      setDocumentSearchError(null);
      fetch(`/api/documents/${documentId}/search?q=${encodeURIComponent(query)}&limit=30`, {
        signal: controller.signal,
        headers: clientDemoMode ? undefined : authorizationHeader,
      })
        .then(async (response) => {
          const payload = await response.json();
          if (response.status === 401) markSessionExpired();
          if (!response.ok) throw new Error(payload.error || "Document search could not be loaded.");
          return payload;
        })
        .then((payload) => {
          if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
          setDocumentSearchResults(payload.results ?? []);
          setDocumentSearchError(null);
        })
        .catch((error) => {
          if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
          setDocumentSearchResults([]);
          setDocumentSearchError(error instanceof Error ? error.message : "Document search could not be loaded.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchingDocument(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      authRequest.release();
    };
  }, [
    authorizationHeader,
    canViewSourceDocuments,
    clientDemoMode,
    documentId,
    isAuthEpochCurrent,
    markSessionExpired,
    registerAuthRequest,
    sourceSearch,
  ]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  async function summarize() {
    if (!canUsePrivateApis) {
      setSummaryError("Sign in before summarising private documents.");
      return;
    }
    if (viewerState !== "ready" || loadingSummary) {
      setSummaryError("Load a source document before summarising.");
      return;
    }
    const summaryMode = sourceSearch.trim().length === 0;
    const query = summaryMode ? documentSummaryQuestion : sourceSearch.trim();
    const controller = new AbortController();
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = controller;
    const authRequest = registerAuthRequest(controller);
    const startedAt = Date.now();
    setLoadingSummary(true);
    setSummary(null);
    setSummaryQuery(query);
    setSummaryError(null);
    setSummaryProgressStartedAt(startedAt);
    setSummaryProgressEvents([
      {
        stage: "scoping",
        message: "Preparing the clinical search scope.",
        receivedAt: startedAt,
      },
    ]);
    try {
      if (!isAuthEpochCurrent(authRequest.epoch)) {
        throw new DOMException("Stale authentication epoch", "AbortError");
      }
      const response = await fetch("/api/answer/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({ query, documentId, ...(summaryMode ? { summaryMode: true } : {}) }),
        signal: controller.signal,
      });
      if (response.status === 401) markSessionExpired();
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Answer could not be generated from this document.",
        );
      }
      const payload = await readAnswerStream(response, (progress) => {
        if (
          controller.signal.aborted ||
          summaryAbortRef.current !== controller ||
          !isAuthEpochCurrent(authRequest.epoch)
        )
          return;
        setSummaryProgressEvents((events) => [...events, { ...progress, receivedAt: Date.now() }].slice(-20));
      });
      if (controller.signal.aborted || summaryAbortRef.current !== controller || !isAuthEpochCurrent(authRequest.epoch))
        return;
      setSummary(payload);
      window.requestAnimationFrame(() => {
        generatedSummaryRef.current?.scrollIntoView({ block: "start", behavior: resolveScrollBehavior() });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (controller.signal.aborted || summaryAbortRef.current !== controller || !isAuthEpochCurrent(authRequest.epoch))
        return;
      setSummaryProgressEvents([]);
      setSummaryProgressStartedAt(null);
      setSummaryError(error instanceof Error ? error.message : "Answer could not be generated from this document.");
    } finally {
      authRequest.release();
      if (summaryAbortRef.current === controller) {
        summaryAbortRef.current = null;
        setLoadingSummary(false);
      }
    }
  }

  function stopSummary() {
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = null;
    setLoadingSummary(false);
    setSummaryProgressEvents([]);
    setSummaryProgressStartedAt(null);
  }

  const authViewerError =
    !canUsePrivateApis &&
    !clientDemoMode &&
    !loadingDocument &&
    !document &&
    (authStatus !== "loading" || authLoadingTimedOut) &&
    (viewerError === "Sign in to open private source documents." ||
      viewerError === "Supabase browser authentication is not configured for private source documents.")
      ? viewerError
      : null;
  const effectiveLoadingDocument =
    !canUsePrivateApis && authStatus === "loading" && !authLoadingTimedOut && loadingDocument ? true : loadingDocument;
  const effectiveViewerError = authViewerError ?? viewerError;
  const viewerState = effectiveLoadingDocument
    ? "loading"
    : document
      ? "ready"
      : authViewerError
        ? "auth-required"
        : "error";
  const readyDocument = viewerState === "ready" ? document : null;
  const headerTitle = readyDocument
    ? documentDisplayTitle(readyDocument)
    : viewerState === "auth-required"
      ? "Sign in required"
      : viewerState === "loading"
        ? "Document"
        : "Source unavailable";
  const headerSubtitle = readyDocument
    ? `page ${activePage} · ${readyDocument.file_name}`
    : viewerState === "loading"
      ? `page ${activePage} · loading source`
      : (effectiveViewerError ?? "Source unavailable");
  const documentHomeHref = "/?mode=documents";
  const scopedDocumentHref = readyDocument
    ? `/?mode=documents&q=${encodeURIComponent(documentDisplayTitle(readyDocument))}&documentId=${encodeURIComponent(documentId)}`
    : documentHomeHref;
  const usefulPageHref = (page: number) => documentPageHref(documentId, page);
  const canSummarizeDocument = viewerState === "ready" && !loadingSummary && canUsePrivateApis;
  const summarizeTitle = !canUsePrivateApis
    ? "Sign in before answering from this document"
    : viewerState !== "ready" || loadingSummary
      ? "Load a source document before answering"
      : "Answer from this document";
  const pageByNumber = useMemo(() => new Map(pages.map((page) => [page.page_number, page])), [pages]);
  const chunkById = useMemo(() => new Map(chunks.map((chunk) => [chunk.id, chunk])), [chunks]);
  const selectedPage = pageByNumber.get(activePage) ?? pages[0];
  const selectedChunk = activeChunkId ? chunkById.get(activeChunkId) : undefined;
  const { clinicalImages, auditImages } = partitionViewerImages(images);
  const generatedSummaryText = summary ? cleanClinicalSummaryText(summary.answer) : "";
  const generatedAnswerIsSummary = summaryQuery === documentSummaryQuestion;
  const storedSummaryText = document?.summary?.summary ?? null;
  const documentLabels = document?.labels;
  const formattedStoredSummary = useMemo(() => formatDocumentSummary(storedSummaryText), [storedSummaryText]);
  const summaryBadges = useMemo(
    () => buildDocumentSummaryBadges({ labels: documentLabels, summaryText: storedSummaryText }),
    [documentLabels, storedSummaryText],
  );
  const indexWarnings = Array.isArray(indexHealth?.warnings)
    ? indexHealth.warnings.map((warning) => String(warning)).filter(Boolean)
    : typeof indexHealth?.warnings === "string" && indexHealth.warnings
      ? [indexHealth.warnings]
      : [];
  useEffect(() => {
    if (!activeChunkId || loadingDocument) return;
    window.document
      .querySelector<HTMLElement>(`[data-source-chunk-id="${CSS.escape(activeChunkId)}"]`)
      ?.scrollIntoView({ block: "center", behavior: resolveScrollBehavior() });
  }, [activeChunkId, loadingDocument, chunks.length]);
  const retryPreview = () => {
    setViewerError(null);
    setPreviewError(null);
    setDownloadError(null);
    // Re-open the guarded load path after a transient identity failure; the
    // cleared identity promise is still revalidated before any API request.
    setLocalProjectReady(true);
    setLoadingDocument(true);
    setPreviewAttempt((current) => current + 1);
  };
  useEffect(() => {
    signedUrlRefreshCountRef.current = 0;
  }, [documentId]);
  // The PDF signed URL has a 10-min TTL and pdf.js holds a dead reference once it
  // expires. When the canvas reports an expiry, drop cached URLs and mint a fresh
  // preview only (bounded so a broken URL can't loop). Download remains click-gated.
  // Stable identity (useCallback) so the memoised PdfCanvasViewer isn't re-rendered
  // — and its page re-rastered — every time an unrelated parent state (source-search
  // keystroke, composer focus, online/offline) changes.
  const handleSignedUrlExpired = useCallback(() => {
    if (signedUrlRefreshCountRef.current >= 2) return;
    signedUrlRefreshCountRef.current += 1;
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;
    clearCachedSignedUrl(signedUrlEndpoint);
    clearCachedSignedUrl(`${signedUrlEndpoint}?download=true`);
    setDownloadSignedUrl(null);
    refreshSignedUrls();
  }, [documentId, refreshSignedUrls]);
  // A successful reload means the refreshed URL was accepted, so the recovery
  // worked — restore the budget for the next (unrelated) TTL expiry. A broken
  // URL never loads, so it never resets, and the cap still stops its loop.
  const handlePdfLoadSuccess = useCallback(() => {
    signedUrlRefreshCountRef.current = 0;
  }, []);
  const handleDocumentRenamed = (updatedDocument: ClinicalDocument) => {
    setDocument((current) => (current?.id === updatedDocument.id ? { ...current, ...updatedDocument } : current));
  };
  const handleDocumentDeleted = () => {
    router.push("/?mode=documents");
  };
  const handleDocumentLabelsUpdated = (labels: DocumentLabel[]) => {
    setDocument((current) => (current ? { ...current, labels } : current));
  };
  const searchByTag = (tag: { searchText: string; label: string }) => {
    const params = new URLSearchParams({ mode: "documents", q: tag.searchText || tag.label });
    router.push(`/?${params.toString()}`);
  };
  async function reviewTableFact(fact: TableFactRow, reviewClass: string) {
    setReviewingTableFactId(fact.id);
    try {
      const response = await fetch(`/api/documents/${documentId}/table-facts`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({ factId: fact.id, reviewClass }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) markSessionExpired();
      if (!response.ok) throw new Error(payload.error || "Table review update failed.");
      setTableFacts((current) =>
        current.map((candidate) => (candidate.id === fact.id ? (payload.tableFact as TableFactRow) : candidate)),
      );
      setImages((current) =>
        current.map((image) =>
          image.id === fact.source_image_id
            ? {
                ...image,
                clinicalUseClass: reviewClass === "clinical_useful" ? "clinical_evidence" : reviewClass,
                tableRole: reviewClass === "clinical_useful" ? "clinical" : reviewClass,
                searchable: reviewClass === "clinical_useful" || reviewClass === "reference",
              }
            : image,
        ),
      );
    } catch (error) {
      setViewerError(error instanceof Error ? error.message : "Table review update failed.");
    } finally {
      setReviewingTableFactId(null);
    }
  }

  return (
    <main
      id="document-viewer-main"
      tabIndex={-1}
      className={cn(appBackdrop, "min-h-[100dvh] overflow-x-clip text-[color:var(--text)] focus:outline-none")}
    >
      <header className="edge-glass-header z-30 border-b border-[color:var(--border)] py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[var(--shadow-tight)] backdrop-blur-xl sm:sticky sm:top-0">
        <div className="mx-auto flex h-12 min-w-0 max-w-[1440px] items-center gap-2">
          <Link
            href={documentHomeHref}
            className="inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
            aria-label="Back to documents"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="hidden sm:inline">Documents</span>
          </Link>

          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text)] sm:text-base">
            {headerTitle}
          </h1>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              href={scopedDocumentHref}
              className="hidden h-tap w-tap place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] min-[380px]:grid"
              aria-label="Add this document to scope"
              title={headerSubtitle}
            >
              <Target aria-hidden="true" className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileActionsOpen(true)}
              className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              aria-label="Open document actions"
            >
              <Plus aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {readyDocument ? (
        <Sheet
          open={mobileActionsOpen}
          onClose={() => setMobileActionsOpen(false)}
          title="This document"
          description="Search, answer, open, or scope this document."
          closeLabel="Close document actions"
        >
          <div className="space-y-3 pb-2">
            <section className={cn(sourceCard, "p-3")}>
              <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text)]">
                {documentDisplayTitle(readyDocument)}
              </p>
              <p className={cn("mt-1 truncate text-xs", textMuted)}>{readyDocument.file_name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!isOnline ? <span className={cn("text-xs font-semibold", textMuted)}>Offline</span> : null}
              </div>
            </section>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  setSourceSearch(documentDisplayTitle(readyDocument));
                }}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                Search in document
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  void summarize();
                }}
                disabled={!canSummarizeDocument}
                title={summarizeTitle}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                {loadingSummary ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                )}
                Answer from this
              </button>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileActionsOpen(false)}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Open original PDF
                </a>
              ) : (
                <a
                  href="#pdf-preview-section"
                  onClick={() => setMobileActionsOpen(false)}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Open original PDF
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  void openSourceDownload();
                }}
                disabled={downloadingSource}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                {downloadingSource ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Download aria-hidden="true" className="h-4 w-4" />
                )}
                {downloadingSource ? "Preparing PDF" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  router.push(scopedDocumentHref);
                }}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                <Target aria-hidden="true" className="h-4 w-4" />
                Add to scope
              </button>
            </div>
            {canUseAdministrativeApis ? (
              <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                  Admin controls
                </summary>
                <DocumentManagementActions
                  document={readyDocument}
                  disabled={!canUseAdministrativeApis}
                  className="mt-3 justify-start gap-2"
                  onRenamed={handleDocumentRenamed}
                  onDeleted={handleDocumentDeleted}
                />
              </details>
            ) : null}
          </div>
        </Sheet>
      ) : null}

      <section
        data-testid="document-viewer-content"
        data-scroll-hidden={composerScrollHidden ? "true" : undefined}
        className={cn(
          "mx-auto grid max-w-[1440px] gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 sm:pb-40 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-start lg:px-8",
          // The visible fixed composer needs endpoint clearance. Once hidden,
          // keep only a small content pad so Safari can paint document content
          // beneath its translucent toolbar instead of showing a blank band.
          composerScrollHidden ? "max-sm:pb-3" : "max-sm:pb-[calc(9rem+var(--safe-area-bottom))]",
        )}
      >
        {downloadError ? (
          <InlineNotice tone="warning" className="lg:col-span-2">
            {downloadError}
          </InlineNotice>
        ) : null}
        {(loadingSummary || summary || summaryError) && (
          <div className="min-w-0 space-y-3 lg:col-span-2">
            {summaryProgressStartedAt && summaryProgressEvents.length > 0 ? (
              <AnswerProgressStepper
                events={summaryProgressEvents}
                startedAt={summaryProgressStartedAt}
                active={loadingSummary}
                onStop={stopSummary}
              />
            ) : null}
            {summary && (
              <section
                ref={generatedSummaryRef}
                data-testid="generated-clinical-summary"
                className={cn(panel, "p-4 source-print")}
              >
                <PanelHeading
                  icon={Sparkles}
                  title={generatedAnswerIsSummary ? "Clinical summary" : "Answer from this document"}
                  description={
                    generatedAnswerIsSummary
                      ? "From indexed passages, cleaned for practical use."
                      : "Grounded in indexed passages from this source."
                  }
                />
                <p className="mt-3 whitespace-pre-wrap text-base-minus leading-6 text-[color:var(--text-muted)]">
                  <SafeBoldText text={generatedSummaryText} />
                </p>
              </section>
            )}
            {summaryError && (
              <section className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-4 text-sm font-medium text-[color:var(--danger)]">
                <CircleAlert aria-hidden="true" className="mr-2 inline h-4 w-4" />
                {summaryError}
              </section>
            )}
          </div>
        )}

        {readyDocument ? (
          <div className="min-w-0 lg:col-span-2">
            <DocumentOverviewLanding
              document={readyDocument}
              initialPage={activePage}
              signedUrl={signedUrl}
              pages={pages}
              pageHref={usefulPageHref}
              onPageChange={navigateToPage}
              onAskFromDocument={() => void summarize()}
              onAddToScope={() => router.push(scopedDocumentHref)}
              onDownload={() => void openSourceDownload()}
              downloading={downloadingSource}
              canSummarizeDocument={canSummarizeDocument}
            />
          </div>
        ) : null}

        {!readyDocument && viewerState !== "loading" ? (
          <div className="min-w-0 lg:col-span-2">
            <section className={cn(panel, "p-4")}>
              <button type="button" disabled className={cn(secondaryButton, "min-h-tap text-xs")}>
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Answer from this
              </button>
            </section>
          </div>
        ) : null}

        <div className="min-w-0 space-y-4 sm:space-y-5 lg:mx-auto lg:w-full lg:max-w-4xl">
          <DocumentViewerAnchors evidenceHref="#source-evidence" textHref="#source-text" className="lg:hidden" />

          <div id="pdf-preview-section" className={cn(panel, "scroll-mt-24 overflow-hidden")}>
            <div data-testid="pdf-preview">
              {effectiveLoadingDocument ? (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--clinical-accent-soft)_55%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm font-semibold text-[color:var(--text-muted)] sm:min-h-72">
                  <div className="max-w-sm">
                    <Loader2
                      aria-hidden="true"
                      className="mx-auto mb-3 h-5 w-5 animate-spin text-[color:var(--clinical-accent)]"
                    />
                    <p>Preparing PDF preview</p>
                    <ul className="mt-3 space-y-1 text-left text-xs font-medium text-[color:var(--text-muted)]">
                      <li>Loading source metadata</li>
                      <li>Preparing PDF preview</li>
                      <li>Loading extracted tables</li>
                    </ul>
                    {signedUrl && (
                      <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "mt-3")}>
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                        Source PDF
                      </a>
                    )}
                    {downloadSignedUrl && (
                      <button
                        type="button"
                        onClick={() => void openSourceDownload()}
                        disabled={downloadingSource}
                        className={cn(secondaryButton, "mt-3")}
                      >
                        {downloadingSource ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download aria-hidden="true" className="h-4 w-4" />
                        )}
                        {downloadingSource ? "Preparing PDF" : "Download PDF"}
                      </button>
                    )}
                  </div>
                </div>
              ) : effectiveViewerError || previewError ? (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--danger-soft)_62%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm text-[color:var(--danger)] sm:min-h-72">
                  <div>
                    <CircleAlert aria-hidden="true" className="mx-auto mb-2 h-8 w-8" />
                    <p className="font-semibold">{effectiveViewerError ?? previewError}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={retryPreview} className={secondaryButton}>
                        <RefreshCw aria-hidden="true" className="h-4 w-4" />
                        Retry preview
                      </button>
                      {signedUrl && (
                        <a href={signedUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
                          <ExternalLink aria-hidden="true" className="h-4 w-4" />
                          Source PDF
                        </a>
                      )}
                      {downloadSignedUrl && (
                        <button
                          type="button"
                          onClick={() => void openSourceDownload()}
                          disabled={downloadingSource}
                          className={secondaryButton}
                        >
                          {downloadingSource ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download aria-hidden="true" className="h-4 w-4" />
                          )}
                          {downloadingSource ? "Preparing PDF" : "Download PDF"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : signedUrl && document?.file_type === "application/pdf" ? (
                <>
                  <div className="mb-2 flex items-center justify-end px-2 pt-2 sm:px-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHasExplicitPdfViewerMode(true);
                        setUseNativePdfViewer((current) => !current);
                      }}
                      aria-label={
                        useNativePdfViewer
                          ? "Switch to the standard viewer with fit and zoom controls"
                          : "Switch to sharper zoom using your browser's PDF viewer"
                      }
                      title={
                        useNativePdfViewer
                          ? "Standard viewer with built-in fit and zoom controls."
                          : "Sharper zoom — uses your browser's PDF engine to keep heavy-zoom pages crisp."
                      }
                      className={cn(secondaryButton, "min-h-tap w-full justify-center px-3 text-xs sm:w-auto")}
                    >
                      {useNativePdfViewer ? "Standard view" : "Sharper zoom"}
                    </button>
                  </div>
                  {useNativePdfViewer ? (
                    <NativePdfEmbed url={signedUrl} title={documentDisplayTitle(document)} initialPage={activePage} />
                  ) : (
                    <PdfCanvasViewer
                      key={`${documentId}-${useNativePdfViewer ? "native" : "canvas"}`}
                      url={signedUrl}
                      title={documentDisplayTitle(document)}
                      initialPage={activePage}
                      onUrlExpired={handleSignedUrlExpired}
                      onLoadSuccess={handlePdfLoadSuccess}
                      onPageChange={navigateToPage}
                    />
                  )}
                </>
              ) : (
                <NonPdfSourcePreview
                  fileType={document?.file_type}
                  title={document ? documentDisplayTitle(document) : "Source document"}
                  signedUrl={signedUrl}
                  downloadSignedUrl={downloadSignedUrl}
                />
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 md:items-start lg:block">
            <div className="lg:hidden">
              <PinnedSourceEvidence
                loading={effectiveLoadingDocument}
                chunk={selectedChunk}
                compact
                sectionId="source-evidence"
              />
            </div>
            <IndexedTextPanel
              loading={effectiveLoadingDocument}
              selectedPage={selectedPage}
              chunks={chunks}
              search={sourceSearch}
              documentSearchResults={documentSearchResults}
              searchingDocument={searchingDocument}
              documentSearchError={documentSearchError}
              idPrefix="source-chunk"
              sectionId="source-text"
              selectedChunkId={activeChunkId}
              onSearchChange={setSourceSearch}
            />
          </div>
        </div>

        <aside className="min-w-0 grid content-start gap-4 sm:gap-5 md:grid-cols-2 md:items-start lg:sticky lg:top-[69px] lg:grid-cols-1 lg:self-start lg:pr-1">
          {indexWarnings.length ? (
            <InlineNotice tone="warning" className="text-xs md:col-span-2 lg:col-span-1">
              <span className="font-bold">Extraction warnings</span>
              {indexWarnings.slice(0, 4).map((warning) => (
                <span key={warning} className="mt-1 block font-semibold">
                  {warning}
                </span>
              ))}
            </InlineNotice>
          ) : null}

          <div className="hidden lg:block">
            <DocumentViewerAnchors evidenceHref="#source-evidence-rail" textHref="#source-text" className="mb-3" />
            <PinnedSourceEvidence
              loading={effectiveLoadingDocument}
              chunk={selectedChunk}
              compact
              sectionId="source-evidence-rail"
            />
          </div>

          {document ? (
            <details
              id="source-summary"
              name="document-viewer-section"
              data-testid="high-yield-summary"
              className={cn(panel, "group scroll-mt-24 source-print md:col-span-2 lg:col-span-1")}
            >
              <DocumentSectionSummary
                icon={Sparkles}
                title={
                  document.summary?.clinical_specifics?.profile ? "Clinical document profile" : "High-yield summary"
                }
                description="What this document covers, from its indexed evidence."
              />
              <div className={cn(clinicalDivider, "p-4 pt-3")}>
                <BadgeCluster items={summaryBadges} limit={8} showOverflowCount />
                {document.summary?.clinical_specifics?.profile ? (
                  <ClinicalSummaryProfile profile={document.summary.clinical_specifics.profile} />
                ) : (
                  <FormattedHighYieldSummary
                    formatted={formattedStoredSummary}
                    showLead={formattedStoredSummary.sections.length === 0}
                  />
                )}
                {!document.summary?.clinical_specifics?.profile && document.summary?.clinical_specifics && (
                  <div className="mt-4 space-y-4">
                    {Object.entries(document.summary.clinical_specifics)
                      .filter(([key, items]) => key !== "profile" && Array.isArray(items) && items.length > 0)
                      .slice(0, 6)
                      .map(([key, items]) => (
                        <section key={key} className="border-t border-[color:var(--border)] pt-3">
                          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                            {key.replaceAll("_", " ")}
                          </h3>
                          <ul
                            className={cn(
                              proseMeasure,
                              "mt-2 space-y-1.5 text-base-minus leading-6 text-[color:var(--text-muted)]",
                            )}
                          >
                            {(items as string[]).slice(0, 5).map((item, index) => (
                              <li key={`${key}:${index}:${item}`} className="flex gap-2">
                                <span
                                  aria-hidden="true"
                                  className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]"
                                />
                                <span>
                                  <SafeBoldText text={item} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                  </div>
                )}
                {document.labels?.length ? (
                  <div className="mt-4 border-t border-[color:var(--border)] pt-3">
                    <p className={eyebrowText}>Browse by tag</p>
                    <DocumentTagCloud
                      labels={document.labels}
                      limit={18}
                      className="mt-2"
                      onTagClick={searchByTag}
                      grouped
                    />
                  </div>
                ) : null}
                {canUseAdministrativeApis ? (
                  <details className={cn(sourceCard, "mt-4 p-3")}>
                    <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
                      Document tools
                    </summary>
                    <DocumentManualTagEditor
                      document={document}
                      canManage={canUseAdministrativeApis}
                      clientDemoMode={clientDemoMode}
                      authorizationHeader={authorizationHeader}
                      onLabelsUpdated={handleDocumentLabelsUpdated}
                      onUnauthorized={markSessionExpired}
                    />
                  </details>
                ) : null}
              </div>
            </details>
          ) : null}

          <details
            id="source-images"
            name="document-viewer-section"
            className={cn(panel, "group scroll-mt-24 md:col-span-2 lg:col-span-1")}
          >
            <DocumentSectionSummary
              icon={FileImage}
              title="Tables and diagrams"
              description={
                effectiveLoadingDocument
                  ? "Indexed tables, diagrams, and image captions."
                  : clinicalImages.length === 1
                    ? "1 indexed table, diagram, or image caption."
                    : `${clinicalImages.length} indexed tables, diagrams, and image captions.`
              }
            />
            <div className={cn(clinicalDivider, "space-y-3 p-4 pt-3")}>
              {canUseAdministrativeApis && tableFacts.length ? (
                <details className={cn(sourceCard, "p-3")}>
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
                    Table tools
                  </summary>
                  <div className="mt-3">
                    <TableReviewPanel
                      tableFacts={tableFacts}
                      canReview={canUseAdministrativeApis}
                      busyFactId={reviewingTableFactId}
                      onReview={reviewTableFact}
                    />
                  </div>
                </details>
              ) : null}
              {effectiveLoadingDocument ? (
                <LoadingPanel label="Loading extracted tables" />
              ) : clinicalImages.length === 0 ? (
                <p className={cn("text-base-minus", textMuted)}>No indexed clinically useful tables or diagrams.</p>
              ) : (
                clinicalImages.map((image) => <DocumentImage key={image.id} image={image} />)
              )}
              {!effectiveLoadingDocument && auditImages.length > 0 ? (
                <details className={cn(sourceCard, "p-3")}>
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
                    Administrative/reference tables retained for audit ({auditImages.length})
                  </summary>
                  <div className="mt-3 grid gap-3">
                    {auditImages.map((image) => (
                      <DocumentImage key={image.id} image={image} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </details>

          {indexHealth ? (
            <details
              name="document-viewer-section"
              data-testid="indexing-details"
              className={cn(panel, "group md:col-span-2 lg:col-span-1")}
            >
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className={eyebrowText}>Indexing details</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180"
                />
              </summary>
              <dl
                className={cn(
                  clinicalDivider,
                  "grid gap-2 p-4 text-xs font-semibold text-[color:var(--text-muted)] sm:grid-cols-2",
                )}
              >
                <div>
                  <dt>Extraction</dt>
                  <dd className="mt-0.5 text-[color:var(--text)]">{indexHealth.extractionQuality ?? "unknown"}</dd>
                </div>
                <div>
                  <dt>Index version</dt>
                  <dd className={cn("mt-0.5 truncate text-[color:var(--text)]", codeText)}>
                    {indexHealth.indexVersion ?? "unknown"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt>Indexed</dt>
                  <dd className="mt-0.5 text-[color:var(--text)]">{indexHealth.indexedAt ?? "not recorded"}</dd>
                </div>
              </dl>
            </details>
          ) : null}
        </aside>
      </section>
      {readyDocument ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSummarizeDocument) void summarize();
          }}
          data-scroll-hidden={composerScrollHidden ? "true" : undefined}
          onFocusCapture={() => setComposerChromeFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerChromeFocused(false);
          }}
          className={cn(
            glassOverlaySurface,
            "document-viewer-composer floating-composer-edge dashboard-composer-edge fixed z-40 mx-auto flex min-h-[56px] max-w-3xl items-center gap-2 rounded-full bg-[color:var(--surface-lux)] px-2 shadow-[var(--shadow-lux)] max-sm:transition-transform motion-reduce:transition-none",
            composerScrollHidden
              ? "max-sm:duration-[240ms] max-sm:ease-[cubic-bezier(0.4,0,0.2,1)]"
              : "max-sm:duration-200 max-sm:ease-[cubic-bezier(0.22,1,0.36,1)]",
          )}
        >
          <button
            type="button"
            onClick={() => setMobileActionsOpen(true)}
            className="grid h-tap w-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
            aria-label="Open document actions"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
          </button>
          <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
            <span className="sr-only">Search or answer from this document</span>
            <input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder="Search or answer from this document..."
              className="min-h-tap min-w-0 flex-1 bg-transparent px-2 text-base font-medium text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
            />
          </label>
          <button
            type="submit"
            disabled={!canSummarizeDocument}
            className="grid h-tap w-tap shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-inset),var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Answer from this document"
          >
            {loadingSummary ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </form>
      ) : null}
    </main>
  );
}
