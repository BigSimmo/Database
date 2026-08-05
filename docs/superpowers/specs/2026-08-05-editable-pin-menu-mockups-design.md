# Search + Editable Pins Menu — Final Mockup Direction

## Preferred artifact

Route: `/mockups/search-lens-menu`

The preferred visual direction is the original light clinical search-menu study, refined around the corrected pin model. It preserves its attached fold-out, deliberate page scrim, compact overlapping icons, and paired desktop/phone treatments.

## Product model

A **pin** is a user-named collection of useful destinations from anywhere in the app. It is not a search scope, filter, or saved query.

Example pins:

- Ward essentials: Documents, Medications, Forms.
- My quick tools: Clinical tools, Services, Differentials.

Users can create a pin, edit its name, add or remove destinations, and recognise its contents through the first three overlapping destination icons.

Search remains explicit and separate:

- Search Documents — current mode.
- Search all clinical areas — global search.
- Choose another search area — explicit alternate scope.

Opening or selecting a pin never silently changes the composer’s search scope.

## Direction 1 — Attached pin fold-out

Recommended.

- Opens from the composer `+` button.
- Shows `Your pins` first.
- Shows `Search in` as a separate section below.
- Includes useful actions without confusing them with either pins or search scope.
- Desktop/tablet use an attached panel with a subdued scrim.
- Phone uses a contained bottom sheet above the visible composer.

## Direction 2 — Pins and search command deck

- Presents pins and search commands in one power-user workspace.
- The navigation rail clearly labels both object types.
- Selecting a pin previews its app destinations.
- Selecting a search command runs the current query in that area.

## Direction 3 — Inline pin bar

- Pin destinations become removable chips directly above the composer.
- The Documents search scope remains visible and stable beneath the pin.
- Editing uses a compact destination picker on desktop and phone.

## Accessibility and responsive rules

- Minimum 48 px primary touch targets.
- Icon constellations expose full destination labels to assistive technology.
- Escape closes panels and restores focus to the composer trigger.
- Panels own internal scrolling and remain within device frames.
- Reduced-motion and forced-colors modes remain usable.
- Validate 320, 390, 639, 768, 1440, and 1920 px.

## Boundaries

This remains a local design-scratch artifact. It does not persist pins, call APIs or providers, alter production navigation/search, change retrieval ranking, or deploy anything.
