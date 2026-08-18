# Caring Contact interaction matrix

The source of truth is `completionOverlayDefinitions` in `src/components/caring-contacts/mockups/overlay-specimens.tsx`. Each surface is deep-linkable through `?overlay=<id>` and is also reachable from the system-state lab. Mutation-bearing actions recheck connectivity, permission, authentication and version state at commit time.

| ID                         | Product context                    | Phone             | Desktop           | Mutation       | Dismissal               |
| -------------------------- | ---------------------------------- | ----------------- | ----------------- | -------------- | ----------------------- |
| `verify-identity`          | Agreement gate                     | Full-screen stage | Dialog            | Yes            | Escape, backdrop, close |
| `change-patient`           | Agreement gate                     | Full-screen stage | Dialog            | Yes            | Escape, backdrop, close |
| `pathway-preview`          | Pathway selection                  | Full-screen stage | Inspection drawer | Yes            | Escape, backdrop, close |
| `message-preview`          | Personalisation, review, templates | Full-screen stage | Inspection drawer | No             | Escape, backdrop, close |
| `communication-preference` | Personalisation                    | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `adjust-date-time`         | Personalisation/schedule exception | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `outside-window-warning`   | Schedule validation                | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `save-draft`               | Personalisation                    | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `discard-changes`          | Personalisation                    | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `final-activation`         | Review and activation              | Full-screen stage | Dialog            | Yes            | Escape, backdrop, close |
| `activation-success`       | Patient overview outcome           | Bottom sheet      | Dialog            | No             | Escape, backdrop, close |
| `pause`                    | Plan actions                       | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `withdrawal`               | Plan actions                       | Full-screen stage | Dialog            | Yes; two-stage | Escape, backdrop, close |
| `reassignment`             | Plan/team actions                  | Bottom sheet      | Dialog            | Yes; two-stage | Escape, backdrop, close |
| `delivery-detail`          | Plan/contact inspection            | Full-screen stage | Inspection drawer | No             | Escape, backdrop, close |
| `resolve-failed-delivery`  | Delivery exception                 | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `contact-changed-block`    | Contact destination review         | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `template-changed-retired` | Template lifecycle/workflow        | Full-screen stage | Dialog            | Yes            | Escape, backdrop, close |
| `session-expiry`           | Protected action guard             | Session gate      | Session gate      | No             | Recovery action only    |
| `offline-banner`           | Global connectivity guard          | Status banner     | Status banner     | No             | Recovery action only    |
| `recoverable-error`        | Read recovery                      | Bottom sheet      | Dialog            | No             | Escape, backdrop, close |
| `permission-unavailable`   | Role guard                         | Bottom sheet      | Dialog            | No             | Escape, backdrop, close |
| `team-switcher`            | Header active-team context         | Bottom sheet      | Dialog            | Yes            | Escape, backdrop, close |
| `draft-version-conflict`   | Draft/version guard                | Full-screen stage | Dialog            | No             | Escape, backdrop, close |

## Feedback contract

- Success: announce the synthetic in-memory outcome and update the visible plan/audit summary.
- No change: state explicitly that no external or production action occurred.
- Guard rejection: retain the surface, keep the action focusable with `aria-disabled`, provide the named reason, and do not mutate state.
- Recovery: clear the scenario only after its recovery action succeeds.
- Modal close: restore focus to the originating action; overlay-only navigation must not move focus to the page heading.
- Navigation: move natural focus to the new page heading and announce the destination.
