# Ward Flow constellation design QA

## Comparison setup

- Visual target: `C:\Users\joshs\.codex\generated_images\01a00060-be1a-7252-922f-b9dfc7a496b3\exec-c93f388a-175c-463d-89bd-db70dadc014f.png`
- Implementation: `artifacts/ward-management/ward-constellation-final-1440x1024.png`
- Combined source-and-implementation view: `artifacts/ward-management/design-qa-constellation-comparison.png`
- Source dimensions: 1487 x 1058 pixels, normalized to 1440 x 1024 for comparison.
- Implementation viewport: 1440 x 1024 CSS pixels at density 1.
- Compared state: Flow coordinator, WF-204 selected, Fiona Stanley proposed, placement awaiting authorised confirmation.

## Fidelity review

| Surface            | Result | Evidence                                                                                                                                                                                                                                                      |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography         | Passed | The graphite hierarchy, tabular operational figures, compact labels, and restrained microcopy preserve the reference's clinical command-centre character with stronger scanning contrast.                                                                     |
| Spacing and layout | Passed | The slim independent priority queue, central statewide network, and right-hand decision rail keep the reference's three-zone structure. The added local mode strip and role-focus band make the broader system legible without crowding the decision surface. |
| Colour and state   | Passed | Clinical blue remains the only structural accent. Green, amber, and red are reserved for capacity and exception meaning and are always reinforced by text, rank, or iconography.                                                                              |
| Assets and icons   | Passed | Existing Clinical KB branding and product iconography are used consistently. The constellation remains a schematic operational view rather than implying geographic precision.                                                                                |
| Copy and data      | Passed | Synthetic identifiers, WA service names, catchment, legal status, setting, wait, transport readiness, and capacity evidence are clear. AI is labelled as a best-fit proposal and requires an authorised human confirmation.                                   |

## Intentional improvements from the source

1. Replaced literal route-line density with four stable service clusters around a statewide coordination hub.
2. Added eight persistent Ward Flow modes so every major operational task is reachable from the same local navigation.
3. Made the priority queue independently scrollable and kept role-based ordering visible rather than hiding it behind controls.
4. Turned the shortlist into an explainable, ranked proposal with catchment, setting, availability, transport, and wait-time evidence.
5. Added a plain-language no-automatic-allocation boundary directly beside the confirmation action.
6. Kept the full constellation as a dedicated wide command view while preserving the denser command home for routine work.

## Functional and responsive evidence

- All eight Ward Flow routes were opened and checked at 1440 x 1024 with no page-level horizontal overflow.
- Flow coordinator, ED clinician, and ward coordinator role changes alter the operational focus and queue order.
- Queue selection, ranked fit review, and authorised confirmation were exercised in the browser.
- The 390 x 844 phone fallback was checked across every mode with no page-level horizontal overflow.
- Fresh browser console on the final constellation route contained no warnings or errors.
- Focused Chromium coverage includes role switching, queue collapse, all mode links, confirmation, phone layout, dark mode, forced colours, and print.

## Final review

The implementation retains the reference's visual intent and decision hierarchy while improving system navigation, privacy signalling, role clarity, and AI governance. No P0, P1, or actionable P2 fidelity issue remains.

final result: passed
