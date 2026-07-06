# Phase 3 Design Decision Log

## Decision: Rebuild Mobile Command Surface

Changed: The dashboard command header is being reworked around a full-width mobile question input, larger mode controls, and sheet-like scope controls while preserving answer and document search modes.
Why: The Phase 1 audit found the primary search field cramped on mobile and the mode controls below the 44px touch target standard. The new structure makes the clinical question the dominant first action and improves thumb ergonomics.
Rejected: Keeping the existing desktop-derived three-column mobile search row was rejected because it preserved visual compactness at the expense of readability and tap accuracy.
Verified: `npx tsc --noEmit --pretty false` passed. Browser mobile portrait check at 390x820 showed a 366px-wide question input, 44px mode controls, 48px Ask/Scope controls, no console errors, and no horizontal overflow.

## Decision: Upgrade Mobile Overlays To Sheets

Changed: Guide and management overlays are being restyled so mobile uses bottom-sheet geometry while desktop keeps centered modal behavior.
Why: Centered desktop modals work functionally but place primary actions away from thumb reach on mobile. Bottom sheets make the spatial relationship clearer and keep close/submit actions easier to reach.
Rejected: Replacing overlays with inline disclosure rows was rejected because guide and destructive document actions still need modal focus isolation.
Verified: Browser mobile portrait check confirmed the scope sheet opens at the bottom, focuses the document filter input, stays within the viewport, and has no horizontal overflow. Guide sheet check confirmed focus remains inside the dialog and no horizontal overflow.

## Decision: Defer Full Dashboard Component Split

Changed: The rebuild remains in-place for this pass instead of extracting `ClinicalDashboard` into multiple new modules.
Why: The current branch already contains extensive non-design changes in the same files. A broad move would create avoidable merge and review noise while the visual system is still being stabilized.
Rejected: A large immediate file move was rejected for this phase start because it would obscure product-design changes in a dirty worktree.
Verified: `npx tsc --noEmit --pretty false` passed after the in-place changes. Full component extraction remains a follow-up because it is intentionally not part of this first Phase 3 patch.
