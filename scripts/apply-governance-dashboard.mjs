import fs from "node:fs";

const path = "src/components/ClinicalDashboard.tsx";
let s = fs.readFileSync(path, "utf8");

if (!s.includes("SourceReviewQueuePanel")) {
  s = s.replace(
    'import { DocumentSearchResultsPanel, type SearchFacets } from "@/components/clinical-dashboard/document-search-results";',
    'import { DocumentSearchResultsPanel, type SearchFacets } from "@/components/clinical-dashboard/document-search-results";\nimport { SourceReviewQueuePanel } from "@/components/clinical-dashboard/source-review-queue-panel";',
  );
}

if (!s.includes("search-request-token")) {
  s = s.replace(
    `import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  type SourceGovernanceWarning,
} from "@/lib/source-governance";`,
    `import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  serializeSourceGovernanceWarning,
  type SourceGovernanceWarning,
} from "@/lib/source-governance";
import {
  invalidateSearchRequests,
  isLatestSearchRequest,
  type SearchRequestToken,
} from "@/lib/search-request-token";`,
  );
}

s = s.replace(
  "const searchRequestSeqRef = useRef(0);",
  `const searchRequestSeqRef = useRef<SearchRequestToken>(0);

  function invalidateInFlightSearchRequests() {
    searchRequestSeqRef.current = invalidateSearchRequests(searchRequestSeqRef.current);
  }`,
);

s = s.replace(
  "const requestId = ++searchRequestSeqRef.current;",
  `const requestId = invalidateSearchRequests(searchRequestSeqRef.current);
    searchRequestSeqRef.current = requestId;`,
);

s = s.replace(
  /if \(requestId === searchRequestSeqRef\.current\) setAnswerProgress\(message\);/g,
  "if (isLatestSearchRequest(requestId, searchRequestSeqRef.current)) setAnswerProgress(message);",
);

s = s.replace(
  /if \(requestId === searchRequestSeqRef\.current\) \{/g,
  "if (isLatestSearchRequest(requestId, searchRequestSeqRef.current)) {",
);

s = s.replace(
  "function crossModeSearch(mode: AppModeId, crossQuery: string) {\n    modeChangeFromUiRef.current = true;",
  "function crossModeSearch(mode: AppModeId, crossQuery: string) {\n    invalidateInFlightSearchRequests();\n    modeChangeFromUiRef.current = true;",
);

s = s.replace(
  "function selectSearchMode(mode: AppModeId) {\n    modeChangeFromUiRef.current = true;",
  "function selectSearchMode(mode: AppModeId) {\n    invalidateInFlightSearchRequests();\n    modeChangeFromUiRef.current = true;",
);

s = s.replace(
  "function startNewChat() {\n    modeChangeFromUiRef.current = true;",
  "function startNewChat() {\n    invalidateInFlightSearchRequests();\n    modeChangeFromUiRef.current = true;",
);

s = s.replace(
  "sourceGovernanceWarnings: sourceGovernanceWarnings.map((warning) => warning.message),",
  "sourceGovernanceWarnings: sourceGovernanceWarnings.map(serializeSourceGovernanceWarning),",
);

s = s.replace(
  `<DocumentSearchResultsPanel
                        matches={documentMatches}
                        recordMatches={recordSearchMatches}`,
  `<DocumentSearchResultsPanel
                        matches={documentMatches}
                        sources={sources}
                        recordMatches={recordSearchMatches}`,
);

if (!s.includes("<SourceReviewQueuePanel sources={sources} />")) {
  s = s.replace(
    `                          />
                        </div>
                      </div>
                    </UtilityDrawer>`,
    `                          />
                          <SourceReviewQueuePanel sources={sources} />
                        </div>
                      </div>
                    </UtilityDrawer>`,
  );
}

const shortcutIdx = s.indexOf("async function runDocumentSearchShortcut");
if (shortcutIdx !== -1) {
  const canRunIdx = s.indexOf("    if (!canRunSearch) {", shortcutIdx);
  const fnEnd = s.indexOf("\n  function handleTagSearch", canRunIdx);
  const block = s.slice(canRunIdx, fnEnd);
  if (!block.includes("invalidateInFlightSearchRequests()")) {
    const newBlock = block
      .replace(
        "    setQuery(trimmedSearchText);",
        "    invalidateInFlightSearchRequests();\n    setQuery(trimmedSearchText);",
      )
      .replace(
        "    if (updateUrl) updateDocumentSearchUrl(trimmedSearchText, targetMode);\n\n    try {",
        "    if (updateUrl) updateDocumentSearchUrl(trimmedSearchText, targetMode);\n\n    const requestId = invalidateSearchRequests(searchRequestSeqRef.current);\n    searchRequestSeqRef.current = requestId;\n\n    try {",
      )
      .replace(
        "      applySearchResult(payload);",
        "      if (isLatestSearchRequest(requestId, searchRequestSeqRef.current)) {\n        applySearchResult(payload);\n      }",
      )
      .replace(
        '      setError(requestError instanceof Error ? requestError.message : "Document search failed");',
        '      if (isLatestSearchRequest(requestId, searchRequestSeqRef.current)) {\n        setError(requestError instanceof Error ? requestError.message : "Document search failed");\n      }',
      )
      .replace(
        "      setLoading(false);\n      setAnswerProgress(null);",
        "      if (isLatestSearchRequest(requestId, searchRequestSeqRef.current)) {\n        setLoading(false);\n        setAnswerProgress(null);\n      }",
      );
    s = s.slice(0, canRunIdx) + newBlock + s.slice(fnEnd);
  }
}

fs.writeFileSync(path, s);
console.log("ClinicalDashboard governance edits applied");
