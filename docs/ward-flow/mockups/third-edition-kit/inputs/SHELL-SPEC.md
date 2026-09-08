# Ward Flow shell specification, extracted from the build sheet

This document is a line by line extraction of `inputs/buildsheet.html` (title "Ward Flow Build Sheet", first edition, frozen 8 September 2026, version 1.0). The sheet's document body runs from line 3841 to the script at line 4422. Every rule below is numbered so a builder can cite it, and every rule carries the line of the sheet it came from. Where the sheet states a rule in words, the words are the sheet's own. Where the sheet uses a table, the rows are rewritten as plain sentences. Contract markup and code are copied verbatim into fenced blocks.

The sheet's own header describes it as "The settled bar, the settled rail, every pop-out and all twelve screens, written as instructions a builder can follow, with the mockups they were proved in. Sits under the design system and above the mockups." (line 3898). The rail note on the sheet says "Every figure quoted from the mockups is invented. The hospital sites, health services and ward names are real WA names." (line 3888).

A final section, "Conflicts with the third edition", lists every place where the sheet disagrees with `merged/MERGE-BRIEF.md`.

---

## Section 1. What this is, and what wins (lines 3908 to 3921)

**1.1 Three documents.** "Three documents describe Ward Flow. The design system holds the rules, the tokens and the components. The mockups are the proofs, each one a live page cut from the system's own stylesheet. This sheet sits between them. It says what every part of the shell is, what it holds, how it behaves, and how a builder cuts it from the system, so that the twelve screens come out as one product and not twelve." (line 3911)

### Precedence (lines 3912 to 3917)

**1.2** "The design system wins on colour, type, material, wording and the ten rules. Nothing here restates them and nothing here may loosen them." (line 3914)

**1.3** "This sheet wins on the shell: what the bar, the rail, the pop-outs and the screens contain and do." (line 3915)

**1.4** "The mockups are the proof. Where a mockup and this sheet disagree, the sheet is out of date and is corrected. A mockup is never edited to match a sentence." (line 3916)

### How to use it (lines 3918 to 3919)

**1.5** "Build the shell once from sections 3 to 12, then build each screen from its entry in section 13 by filling the body and the live tally. Section 14 is the data and wording contract every screen keeps. Section 15 is the build order and the checks that must pass before a screen is called done. Section 16 lists what is still open, so that nobody builds an answer to a question that has not been decided." (line 3919)

---

## Section 2. The mockups (lines 3924 to 3958)

**2.1 What a mockup is.** "Each mockup is a complete page: the system's stylesheet block verbatim, the page's own rules under a comment naming the screen, the markup, and a script that derives every figure from the page's data on every render. The repository file is the same page after formatting." (line 3927)

**2.2 The four mockups** (table, lines 3929 to 3937). Four live pages are listed.

- 2.2.1 Design system, second edition. It proves the tokens, the seven step scale, every component drawn from the same stylesheet, the 35 contrast pairs recomputed on load, the wording rules and the adoption plan. Repository file `docs/ward-flow/mockups/design-standard.html`. Status: header section to update. Live page https://claude.ai/code/artifact/352faeba-eb50-4cb1-934b-a0dd7b36d642 (line 3932).
- 2.2.2 Command, live edition. It proves the whole Command screen: the earlier masthead, the priority queue, the exceptions, the statewide flow diagram, the bed map, in light and dark. Repository file `docs/ward-flow/mockups/command-premium.html`. Status: re-cut with the bar and rail. Live page https://claude.ai/code/artifact/60c8bd59-7392-499d-bfe5-eee90131e1da (line 3933).
- 2.2.3 Header, the quiet bar. It proves one row over a live Command body: search, the Service selector, Activity, Tasks and Tools as drawers, New referral. Every control works and every figure is derived. Repository file `docs/ward-flow/mockups/header.html`. Status: settled. Live page https://claude.ai/code/artifact/1546fe15-1152-4c5f-b88a-dff692f0a650 (line 3934).
- 2.2.4 Rail, open and closed. It proves the rail in both states over the bar, the map of all twelve screens with their layouts drawn, and the notes on what was added, and what was considered and left out. Repository file `docs/ward-flow/mockups/rail.html`. Status: settled. Live page https://claude.ai/code/artifact/ac61a6dc-f85e-40ed-b62c-947fd097e114 (line 3935).

**2.3 Version history.** "Every version of every mockup stays in its page's version history, including the three-row header, the three header options and the three rail options that were reviewed and set aside." (line 3939)

### Earlier pages, to re-cut (lines 3940 to 3956)

**2.4** "These screens were drawn before the second edition of the design system and before the bar and the rail were settled. Each is a starting point for its screen's body in section 13 and is re-cut to this sheet, not extended." (line 3941)

**2.5 The earlier pages** (table, lines 3943 to 3955). Each earlier page maps to one screen in section 13.

- 2.5.1 Ward Flow Command, earlier cut, is the start for screen 1, Command. https://claude.ai/code/artifact/4da67918-0587-4d27-b478-daf112d5ce02 (line 3946)
- 2.5.2 Patient Record, vertical tab rail, is the start for screen 2, Movement. https://claude.ai/code/artifact/b4a939ea-c18e-44e9-9119-947121913d50 (line 3947)
- 2.5.3 Bed Board, perfected, is the start for screen 3, Capacity. https://claude.ai/code/artifact/1edc9909-1088-412c-8f4a-46b50ab3d40f (line 3948)
- 2.5.4 Ward Home Board, final, is the start for screen 4, Wards. https://claude.ai/code/artifact/1927f79b-6cae-4b25-93cb-721065a0c199 (line 3949)
- 2.5.5 ED Hub is the start for screen 5, Emergency departments. https://claude.ai/code/artifact/bf480324-ba86-48e4-b762-8c09658bb31b (line 3950)
- 2.5.6 CMHT team hub, v2, and CMHT gateway, v1, are the start for screen 6, Community teams. Hub https://claude.ai/code/artifact/b1eadb0f-9c92-48f7-a383-39c71eaa3c15 and Gateway https://claude.ai/code/artifact/b7bd9b0b-ae56-43d8-9ce9-3cabc7a70ce7 (line 3951)
- 2.5.7 Patient Search Console, and the Master Search Hub, are the start for screen 7, Patient search. Console https://claude.ai/code/artifact/651148e2-7157-4229-9fd1-8e2e567f7f8e and Hub https://claude.ai/code/artifact/499827aa-9ba4-4180-9001-325a1b094b4c (line 3952)
- 2.5.8 Raise a referral, locked design v6, is the start for screen 12, Raise a referral. https://claude.ai/code/artifact/ee958fc4-2ee1-48c2-b7df-9f014381e43a (line 3953)

Screens 8 (Referrals), 9 (Handover), 10 (Statistics) and 11 (Governance) have no earlier page listed.

---

## Section 3. The shell every screen sits in (lines 3961 to 4038)

**3.1 The shape.** "A screen is a two-column grid: the rail on the left, and a frame on the right that holds the live region, the bar, and the screen's own panels. The rail is sticky and as tall as the window. The bar is one row. The body scrolls." (line 3964)

**3.2 Grid.** `grid-template-columns: var(--railw) minmax(0, 1fr)`. "The rail width is 236px open and 76px closed, and the column animates in 0.18s, or not at all when motion is reduced. Below 1000px the grid is one column, the rail stacks above the bar, and the bar wraps its search onto its own row." (line 3966)

**3.3 Rail.** `nav.rail`, "sticky at the top, `height: 100vh`. Open, it hides its own overflow and scrolls its middle inside `.railScroll` so the foot stays pinned. Closed, its overflow is visible so the hover cards can leave it. It sits at z-index 20, and rises to 32 only while the closed strip is hovered or holds focus, so a card can pass over the bar." (line 3967)

**3.4 Bar.** `header.hdr1`, "56px tall, z-index 31, with its dropdowns at 22 and its drawers at 40 over a backdrop at 39. Section 4." (line 3968)

**3.5 Body.** `.hScroll`, "padding 14px 24px 24px, a grid of `.panel` with the 14px gap. The panels and their weights per screen are in section 13. Every panel opens with `.ph`: the heading, a note in one sentence, and a mono count at the right." (line 3969)

**3.6 Live region.** `p#live.srOnly` with `aria-live="polite"`, "first in the frame. Every change of subject is written to it as a sentence. A repeated sentence gets a zero-width space so it is read again." (line 3970)

**3.7 Skip link.** "The first focusable thing on the page is a skip link to the screen's main list." (line 3971)

### Layers (table, lines 3973 to 3986)

**3.8** Body and panels sit at z-index 0. Nothing in a panel is raised again. (line 3978)

**3.9** The rail sits at z-index 20. It rises to 32 only while the closed strip is hovered or holds focus, so a hover card can pass over the bar. (line 3979)

**3.10** The bar sits at z-index 31. Its dropdowns sit at 20 and the search results at 22, inside the bar's own stacking context. (line 3980) Note: line 3968 says the dropdowns are at 22 and line 3980 says the dropdowns are at 20 and the search results at 22. Both are inside the bar's own stacking context, so the bar's 31 is what matters against the rail and the drawers. A builder should read line 3980 as the finer statement: dropdowns 20, search results 22.

**3.11** The hover card sits at z-index 35. It is inside the rail. Pointer events are off, so it never traps the cursor. (line 3981)

**3.12** The drawer backdrop sits at z-index 39. It is the edge shade at 0.6 over the whole window, rail included. (line 3982)

**3.13** The drawer sits at z-index 40. It is fixed to the right edge, with the head sticky inside it. (line 3983)

### Keys (table, lines 3987 to 4000)

**3.14** `/` focuses the search and selects its text. Not when a field has focus. (line 3992)

**3.15** `[` flips the rail between open and closed, and remembers. Not when a field has focus, or a modifier is held. (line 3993)

**3.16** `Enter` in search picks the first result. With no result, it speaks the refusal or what is shown. (line 3994)

**3.17** `Down` in search moves focus into the results. Not when there are none. (line 3995)

**3.18** `Escape`, in order: a pop-out, the search results, the search text, the selected row, the task filter, the service. One step per press, each spoken. (line 3996)

**3.19** `1 2 3` are the review views, in the mockups only. Not a product key. Not when a field has focus. (line 3997)

### What the page says (table, lines 4001 to 4027)

**3.20** "Every change of subject is written to the live region as a sentence. These are the sentences, with the mockup's figures in them. A builder keeps the shape and lets the figures derive." (line 4002)

- 3.20.1 On opening Activity: "Activity opened, in two parts: what is going on, and the live tally for the Command page." (line 4007)
- 3.20.2 On switching to the tally: "Live tally for the Command page." (line 4008)
- 3.20.3 On opening Tasks: "Tasks opened. 19 outstanding, notices first." (line 4009)
- 3.20.4 On opening Tools: "Tools opened. Every extension and address in the contact tables is a placeholder." (line 4010)
- 3.20.5 On closing anything: "Closed." (line 4011)
- 3.20.6 On choosing a service: "Service set to South Metropolitan. Showing 7 of 23." (line 4012)
- 3.20.7 On clearing the service: "Service set to all. Showing 23 of 23." (line 4013)
- 3.20.8 On pressing a task row: "Showing 3 due within 2 hours in the queue." (line 4014)
- 3.20.9 On pressing it again: "Task filter cleared. Showing 23 of 23." (line 4015)
- 3.20.10 On marking a notice seen: "Notice marked seen." (line 4016)
- 3.20.11 On a refused search: "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner." (line 4017)
- 3.20.12 On picking a person: "Kestrel, Wenna, WF-007, selected in the queue. Legal deadline passed 25m ago." (line 4018)
- 3.20.13 On clearing the search: "Search cleared. Showing 23 of 23." (line 4019)
- 3.20.14 On changing screen: "Capacity. The live tally now carries its figures." (line 4020)
- 3.20.15 On pressing a pinned row: "WF-007 selected in the queue." (line 4021)
- 3.20.16 On flipping the rail: "The rail, closed." (line 4022)
- 3.20.17 On changing appearance: "Appearance set to dark." (line 4023)
- 3.20.18 On Raise a referral, from the menu: "Raise a referral would open, prefilled from a community team. Not wired in this prototype." (line 4024)

### The contract, as markup (lines 4028 to 4036)

**3.21** Copied verbatim from the sheet's `pre.g-code` block (lines 4029 to 4036):

```
div.hApp                          grid: rail | frame
  a.skip                          first Tab stop
  nav.rail.open                   section 11
  nav.rail.closed                 section 12, one of the two is shown
  div.hFrame
    p#live.srOnly                 aria-live polite
    header.hdr1                   section 4
    div.hScroll                   the screen's panels, section 13
```

Note on names: the sheet's prose in section 3 calls the grid container `div.hApp`, the rail `nav.rail`, the frame `div.hFrame`, the bar `header.hdr1` and the body `div.hScroll`. The sheet's own document chrome (lines 3841 to 3906) uses `div.g-app`, `nav.g-rail`, `div.g-frame`, `header.topbar` and `main.g-main`, which are the sheet's own classes and not the product contract.

---

## Section 4. The bar (lines 4041 to 4090)

**4.1 One row.** "One clean row on every screen. The title and the mark, universal search, the Service selector, then Activity, Tasks and Tools as three matching side drawers, and New referral, the one primary action. Nothing else. The figures and the tasks live behind the controls, never on the row." (line 4044)

### The eight controls, in order (table `#barTable`, lines 4046 to 4058)

**4.2 Title.** Markup `h1`. Holds the screen's name, Newsreader at t-6, the only display type below the wordmark. Behaviour: follows the rail. Never a sentence. Collapse: never. (line 4049)

**4.3 Mark.** Markup `.chip.mark`. Holds "Synthetic prototype" in a neutral chip, with the full disclaimer as its tooltip. Behaviour: static. The rail foot and the page footer say the disclaimer in full. Collapse: reads "Prototype" at or below 1500px. Hidden at or below 1240px. (line 4050)

**4.4 Search.** Markup `.searchWrap > label.search > input#q`. Holds the field, the slash hint, a Clear control, and the results popover `.qPop` beneath. Behaviour: section 5. Collapse: grows from 14rem to 30rem with the room, never below 10rem. Takes its own row below 1000px. (line 4051)

**4.5 Service.** Markup `details.menu.svcMenu`. Holds a dot in the service hue, the service name, the waiting count. Behaviour: section 6. Collapse: never. (line 4052)

**4.6 Activity.** Markup `details.menu.drawerMenu.wide`. Holds a glyph, the word, and a breathing green dot while the last event is within five minutes. Behaviour: section 7. Collapse: the word goes at or below 1240px. The glyph and the dot stay. (line 4053)

**4.7 Tasks.** Markup `details.menu.drawerMenu`. Holds a glyph, the word, the outstanding count as a badge, and a dot: accent while a notice is new, red while a new notice is a breach, gone when none is new. Behaviour: section 8. Collapse: the word goes at or below 1240px. The glyph, the badge and the dot stay. (line 4054)

**4.8 Tools.** Markup `details.menu.drawerMenu.wide`. Holds a glyph and the word. Behaviour: section 9. Collapse: the word goes at or below 1240px. (line 4055)

**4.9 New referral.** Markup `details.menu > summary.primary`. Holds the one accent-filled control on the screen. Behaviour: section 10. Collapse: never. (line 4056)

### Measures (lines 4060 to 4065)

**4.10 Row.** "56px tall, padding 8px 20px 8px 24px, a 10px gap between things. The right-hand group has an 8px gap and takes `margin-left: auto`." (line 4062)

**4.11 Controls.** "Every summary is 34px tall, t-2 semibold, with the hairline border, the 6px radius, and the chevron drawn in CSS. Hover sinks the fill. Open takes the accent-soft fill, the accent border and the accent-ink text. The tap floor is 3rem at a coarse pointer." (line 4063)

**4.12 Widths proved.** "No overflow at 1920, 1600, 1440, 1280 and 1100 wide, with the search at 480, 386, 300, 160 and 195px. At 820 wide the bar is two rows." (line 4064)

**4.13 The collapse ladder, gathered from 4.2 to 4.12.** At or below 1500px the mark reads "Prototype". At or below 1240px the mark is hidden and the words on Activity, Tasks and Tools go, leaving the glyph, the badge and the dot. Below 1000px the grid is one column, the rail stacks above the bar and the search takes its own row. At 820 wide the bar is two rows. The search grows from 14rem to 30rem with the room and never falls below 10rem.

### Every pop-out, in one table (lines 4066 to 4081)

**4.14** Search results is a popover, `min(92vw, 36rem)` wide, anchored under the field and left aligned, with group heads only. Section 5. (line 4071)

**4.15** Service is a dropdown, 17rem at least, anchored under the control and right aligned, headed "Service, filters this page". Section 6. (line 4072)

**4.16** Activity is a drawer, `min(94vw, 36rem)` wide, anchored at the right edge at full height, headed with the title, the service, Close and the freshness line. Section 7. (line 4073)

**4.17** Tasks is a drawer, `min(94vw, 28rem)` wide, anchored at the right edge at full height, headed with the title, the count and Close. Section 8. (line 4074)

**4.18** Tools is a drawer, `min(94vw, 36rem)` wide, anchored at the right edge at full height, headed with the title, the service and Close. Section 9. (line 4075)

**4.19** New referral is a dropdown, 17rem at least, anchored under the control and right aligned, headed "Raise a referral". Section 10. (line 4076)

**4.20** Pinned, closed rail, is a fly-out, 19rem at least, anchored right of the strip and bottom aligned, headed "Pinned, watching". Section 12. (line 4077)

**4.21** Hover card, closed rail, is a card, 15.5rem wide, anchored right of the item and top aligned, headed with the screen's name and count. Section 12. (line 4078)

### Behaviour (lines 4082 to 4088)

**4.22** "Every pop-out is a `details.menu`. One is open at a time. Opening one closes the others and the search results. A click outside closes it, and so does a click on a drawer's backdrop. Escape closes it and returns focus to its summary. Opening it is announced as a sentence." (line 4084)

**4.23** "The slash key focuses the search from anywhere that is not a field. The bracket key flips the rail, section 12." (line 4085)

**4.24** "Escape, from the top: a pop-out, then the search results, then the search text, then the selected row, then the task filter, then the service. Each step is announced." (line 4086)

**4.25** "In print the bar's controls go and the title stays as the heading of the record." (line 4087)

---

## Section 5. Universal search (lines 4093 to 4106)

**5.1 What it does.** "The field filters the screen's list as the reader types and offers results beneath it. It finds patients by name, in either order, or by identifier. It also finds emergency departments, wards, owners, and the tools and views of the bar. It refuses three things and says so." (line 4096)

**5.2 Filters.** "Identifier, either form of the name, the department code and name, the destination ward, the owner and the tier. The filter bar above the list states what is shown: 'Showing 1 of 23, matching 'lark'.'" (line 4098)

**5.3 Results.** "`.qPop`, 36rem wide under the field, one open at a time with the pop-outs. Groups in order: Patients, up to six; Emergency departments; Wards, up to five; Owners; Tools and views. Each result is a `.qHit` with the name in semibold, a mono detail at the right, and for a person an under-line with the department and the deadline state, red when passed, and 'Outside South Metropolitan' when the person is outside the chosen service." (line 4099)

**5.4 Picking.** "A person selects their row, scrolls to it, clears the search and, if they are outside the chosen service, sets the service back to all, and says all of that in one sentence. A department, ward or owner becomes the search text. A tool or view opens it. Enter picks the first result. Down arrow moves into the list." (line 4100)

**5.5 Refusals.** "Risk, acuity, score, scores and best match: 'Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.' Closed, arrived and discharged: 'Closed and arrived movements are not searchable here. They are in the Movement screen's register.' The sentence is shown in the popover and in the filter bar, and nothing is returned." (line 4101)

**5.6 Empty.** "Nothing matches 'x'. Search finds patients by name or identifier, movements, departments, wards, owners and tools." (line 4102)

**5.7 Footer.** Always: "Names are invented. Search never returns a risk score, an acuity score or a best match." (line 4103)

---

## Section 6. The Service selector (lines 4109 to 4122)

**6.1 The choice.** "All services by default, or North Metropolitan, East Metropolitan, South Metropolitan or WA Country. The choice scopes everything the screen derives, and follows the coordinator to every screen that has a service in it." (line 4112)

**6.2 Summary.** "A 7px dot in the service hue, hidden for all services. The short name: All services, North Metro, East Metro, South Metro, WA Country. The waiting count in mono." (line 4114)

**6.3 Panel.** "The head 'Service, filters this page'. Five `.menuItem` rows, each with the dot, the full name and 'n waiting' or 'none waiting'. The chosen row carries the gilt bar. A note: one service, or all four, and that the choice follows you." (line 4115)

**6.4 Scopes.** "The queue, the exceptions, the referrals, the tasks and the notices, the activity feed and the sentence, the live tally, every count and line in the rail, the contact tables in Tools, and the reconciliation line. The filter bar says 'in South Metropolitan'. The rail shows a hairline in the service hue under its brand." (line 4116)

**6.5 Absence.** "WA Country has no department with a movement open and no site drawn, and every list says so in a sentence that says what the absence means. Nothing is ever blank." (line 4117)

**6.6 Escape.** "Clears the service last, after everything else." (line 4118)

**6.7 Later.** "Narrowing to one department inside the same control is designed for and not built. It must not become a second control." (line 4119)

---

## Section 7. The Activity drawer (lines 4125 to 4139)

**7.1 What it is.** "A drawer from the right edge, 36rem wide, in two parts switched at the top: what is going on, and the live tally for this screen. The figures that used to crowd a statistics strip live here, behind one word." (line 4128)

**7.2 Shape.** "`.drawerMenu.wide .menuPanel`: fixed, top to bottom at the right edge, `min(94vw, 36rem)` wide, a hairline on its left, the page dimmed behind it with the edge shade at 0.6. The head is sticky." (line 4130)

**7.3 Head.** "'Activity', the service name in mono, a Close control, and the freshness line on its own row: a breathing green dot, then 'Live, reconciled 10:42, last event 10:40, 2 minutes ago', or 'no event today'." (line 4131)

**7.4 Switch.** "A two-part segment: 'Activity' with the event count, and 'Live tally' with the screen's name. The chosen part carries the gilt underline. The choice is kept while the page lives." (line 4132)

**7.5 Part one.** "'What is going on': one paragraph derived from the data, figures in mono, the breach count in red. It says how many people wait in how many departments, how many have passed a legal deadline and at which sites, how many fall due within two hours, how many have no owner, how many beds are free at how many of the sites drawn and where there are none, how many referrals wait, and when handover is due. Every zero is a word. Then 'Last events': up to fourteen of today's events, newest first, each with a mono time, a tone dot and a sentence. Events are derived where they can be: a movement opened, from its wait; a deadline passed, from its deadline; a referral received, from its time. Recorded events are added: a bed pulled, an override recorded, a decline, an acceptance. Red is a deadline passed, amber a decline, green a bed pulled or an acceptance, neutral everything else." (line 4133)

**7.6 Part two.** "'Command now' with the service name. Four tiles: the screen's core figures from section 13, mono at t-5, red only on a breach above zero, amber on at most two. Then the groups, stacked in one column with a hairline between: for Command, the facts now, by emergency department, by health service, by tier, beds by site; for Capacity, the facts, by site, by service; for Referrals, the facts, by source, by request, waiting. Then the foot: the reconciliation line, 'Reconciled at 10:42', 'Every figure is invented'." (line 4134)

**7.7 Empty.** "'No event today in WA Country.' and, for the sentence, 'Nothing is open in WA Country. No department there has a movement open and no site there is drawn in this prototype. Absence here means none, not that nothing exists.'" (line 4135)

**7.8 Foot.** "Events are invented and listed newest first. The live product would stream them from the pathway record and say when the stream last spoke." (line 4136)

---

## Section 8. The Tasks drawer (lines 4142 to 4155)

**8.1 What it is.** "A drawer from the right edge, 28rem wide. The notices first, each with a Seen control, then every piece of open work worst first, each one a filter on the queue." (line 4145)

**8.2 Head.** "'Tasks', then '19 outstanding, 8 kinds' in mono, and Close." (line 4147)

**8.3 Notices.** "Something that changed: a bed pulled, an override recorded, a legal deadline passed within the last hour. Each row: the time in mono, the sentence with the identifier in mono, and a Seen control while it is new. New rows carry the accent-soft fill. The head counts '3 new' or says 'none new'. A note under the list says what a notice is and that the dot on the button goes when none is new. Marking one seen re-renders the drawer and the dot." (line 4148)

**8.4 Work open.** "Rows in this order and no other, each with the count in mono and a tone dot, the words, and a hint at the right: legal deadlines passed, red; due within 2 hours, amber; with no owner, amber; declines to answer; accepted, no bed pulled; referrals to triage, which opens Referrals; overrides to review, which names Governance; handover sheet due 14:00, which names Tools. A row whose count is none is not shown. A filter row carries `aria-pressed`, filters the queue, closes the drawer, scrolls the queue to its top and announces 'Showing 3 due within 2 hours in the queue.' Pressing it again clears the filter. The filter bar above the queue states the filter in words." (line 4149)

The eight work rows, in the only order allowed:

1. legal deadlines passed, red
2. due within 2 hours, amber
3. with no owner, amber
4. declines to answer
5. accepted, no bed pulled
6. referrals to triage, which opens Referrals
7. overrides to review, which names Governance
8. handover sheet due 14:00, which names Tools

**8.5 Show in queue.** "A link under the rows. Closes the drawer, returns to Command and focuses the queue." (line 4150)

**8.6 Foot.** "Counts are derived from the open movements in all services on every render. A task with a count of none is not shown." (line 4151)

**8.7 Button.** "The badge is the outstanding count. The dot is accent while any notice is new and red while a new notice is a breach." (line 4152)

---

## Section 9. The Tools drawer (lines 4158 to 4172)

**9.1 What it is.** "A drawer from the right edge, 36rem wide, that replaces the More menu. Everything a coordinator reaches for that is not the queue." (line 4161)

**9.2 Who.** "'Bed coordinator' and the shift line: 'Day shift, handover 14:00, Sat 15 Aug AWST'. A role, never a name." (line 4163)

**9.3 Do.** "Three `.toolItem` rows with a glyph, the action, a sentence under it, and a mono hint: Print handover sheet, which prints; Export the queue, not wired, and it says so; Raise a referral, which opens the New referral menu." (line 4164)

**9.4 Ward contacts.** "A table of the wards drawn in the chosen service: the ward with its site under it, the extension, the address. A note above the table and the foot below both say the extensions and addresses are placeholders in the shape the live product would show, that none is real, and that the live product reads the site directory and says when it last did. The placeholders are 'ext 01' and addresses ending in example.invalid, and never a real-looking number." (line 4165)

**9.5 Emergency department contacts.** "The same table for the departments in the chosen service, 'ext 11' onward." (line 4166)

**9.6 Appearance.** "Light, dark, automatic. Remembered for this browser only. The whole page follows at once." (line 4167)

**9.7 Design system.** "A link to the standard, opening in a new tab." (line 4168)

**9.8 Sign out.** "Disabled, with the reason in its tooltip, and it does not light on hover." (line 4169)

---

## Section 10. New referral (lines 4175 to 4185)

**10.1 What it is.** "The one accent-filled control on every screen. It opens a small menu, not a drawer, because the first decision is the source." (line 4178)

**10.2 Panel.** "The head 'Raise a referral', then three rows with a mono code: from an emergency department, ED; from a community team, CMHT; from a GP or private practice, GP. A note: opens the Raise a referral screen with the source prefilled." (line 4180)

**10.3 Screen.** "The flow behind it is screen 12 in section 13. It is reached only from this control and from Tools, and is not a rail item." (line 4181)

**10.4 Rule.** "One primary action per screen. When a screen's own primary action is not New referral, section 13 says what it is, and New referral stays in the bar as a secondary control on that screen." (line 4182)

---

## Section 11. The rail, open (lines 4188 to 4234). 236 pixels.

**11.1 What it is.** "Every screen in three groups, with its state in one line of text beneath its name where it has one, the shift, the pinned movements, and the foot. Read top to bottom it is an instrument, not a list." (line 4191)

### Contents, in order (lines 4192 to 4201)

**11.2** "The brand: 'Ward Flow' in Newsreader at 22px and 'WA' in gilt." (line 4194)

**11.3** "The service stripe: a 3px hairline in the service hue under the brand, only while one service is chosen." (line 4195)

**11.4** "The shift block: a small ring filled to the shift's progress with the percent inside, the eyebrow 'Day shift' with the clock at the right, the time to handover in mono at t-4, 'to handover at 14:00' under it, and a meter." (line 4196)

**11.5** "Operations: Command, Movement, Capacity. Network: Wards, Emergency departments, Community teams. Records: Patient search, Referrals, Handover, Statistics, Governance. Each an eyebrow and its items." (line 4197)

**11.6** "Pinned: up to three movements the coordinator is watching, each a row with the identifier in mono, the name, the wait in mono, and the tone bar of its queue row at the left. Pressing one selects it in the queue and scrolls to it. Pressing it again clears the selection." (line 4198)

**11.7** "The foot: 'Signed in as' and the role, the reconciliation line with its dot, and 'Every figure and name here is invented.'" (line 4199)

**11.8** "Close the rail, with the bracket key shown as a keycap." (line 4200)

### An item (lines 4202 to 4209)

**11.9 Markup.** "`button.railLink[data-page]` holding `.railLabel` with the glyph and `.railText`, then an optional `.tag` and an optional `.toneDot`. The purpose of the screen is the tooltip." (line 4204)

**11.10 Current.** "`aria-current="page"`: the accent-soft fill, accent-ink text, the gilt bar at the left, the glyph in the accent." (line 4205)

**11.11 Count.** "A mono tag at the right, always neutral. A count of none reads 'none'." (line 4206)

**11.12 Line.** "One line at t-0 under the name, muted, never wrapping and never truncated at 236px. Its own figures may carry red for a breach or amber for look here." (line 4207)

**11.13 Dot.** "A 7px dot at the glyph's top left with a 2px ring of the surface: red when a legal deadline has passed behind that screen, amber when something there wants looking at. The tone lives on the dot, never on the count, so a red 23 can never be read as 23 breaches." (line 4208)

### What each item carries (table, lines 4210 to 4228)

**11.14** Command carries the count of open movements, the line "2 breached, 3 due soon" or "no breach, none due soon" with the breach figure in red, and a red dot when any legal deadline has passed. (line 4215)

**11.15** Movement carries no count, no line and no dot. (line 4216)

**11.16** Capacity carries the count of beds free, the line "16 free, none at SJGM" or "16 free of 196" when every site has one, and no dot. (line 4217)

**11.17** Wards carries no count, no line and no dot. (line 4218)

**11.18** Emergency departments carries no count, the line "longest 25h 10m at RPH", and no dot. (line 4219)

**11.19** Community teams carries no count, no line and no dot. (line 4220)

**11.20** Patient search carries no count, no line and no dot. (line 4221)

**11.21** Referrals carries the count waiting, the line "oldest 2h 30m" in amber when over two hours, and an amber dot when the oldest is over two hours. (line 4222)

**11.22** Handover carries the time as its count, "14:00", the line "in 3h 18m", and no dot. (line 4223)

**11.23** Statistics carries no count, no line and no dot. (line 4224)

**11.24** Governance carries the count of overrides to review, no line and no dot. (line 4225)

**11.25** "Every count and line follows the Service selector. Nothing in the rail is typed: each is derived from the page's data on every render, and the reconciliation line in the foot says whether the sums agree." (line 4229)

### The glyphs (lines 4230 to 4232)

**11.26** "Every glyph is a stroke on an 18 by 18 grid, 1.5 wide with round caps and joins, and takes the current text colour, so it is muted at rest, accent on the current item, and CanvasText under forced colours. The bar's four are the same stroke on a 16 by 16 grid. These are drawn here from the same paths the mockups use." (line 4231)

**11.27 The glyph paths**, copied verbatim from line 4232. Each is an `svg.railGlyph` with `aria-hidden="true"`.

Rail glyphs, `viewBox="0 0 18 18"`:

```
Command                <path d="M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z" />
Movement               <path d="M2 9h11M9 5l4 4-4 4" />
Capacity               <path d="M2 6v7M2 9h11a3 3 0 0 1 3 3v1M6 9V7h4v2" />
Wards                  <path d="M9 2l6 3v5c0 3-2.6 5.3-6 6-3.4-.7-6-3-6-6V5z" />
Emergency departments  <path d="M9 3v12M3 9h12" />
Community teams        <path d="M6 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12.5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM1.5 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 11.5c2 .3 3.5 1.6 3.5 3.5" />
Patient search         <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM12.5 12.5L16 16" />
Referrals              <path d="M4 2h6l4 4v10H4zM10 2v4h4" />
Handover               <path d="M3 9h12M3 5h12M3 13h8" />
Statistics             <path d="M3 15V8M8 15V3M13 15v-5" />
Governance             <path d="M9 2l6 3v4c0 4-2.7 6.3-6 7-3.3-.7-6-3-6-7V5z" />
Pinned                 <path d="M9 2l3 3-2 1v4l2 2H6l2-2V6L6 5z" />
Close the rail         <path d="M11 3L6 9l5 6" />
Open the rail          <path d="M7 3l5 6-5 6" />
```

Bar glyphs, `viewBox="0 0 16 16"`:

```
Search                 <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
Activity               <path d="M1.5 8.5h3l2-5 3 9 2-4h3" />
Tasks                  <path d="M2.5 4.5l1.5 1.5 3-3M2.5 9.5l1.5 1.5 3-3M9 4h5M9 9h5M9 13h3" />
Tools                  <path d="M9.5 2.5a3 3 0 0 0-3.6 3.9L2 10.3V14h3.7l3.9-3.9a3 3 0 0 0 3.9-3.6l-2 2-2-.5-.5-2z" />
```

---

## Section 12. The rail, closed (lines 4237 to 4262). 76 pixels.

**12.1 What it is.** "A strip: a glyph and one word per screen, the counts as small tags, the same tone dot, the shift as a ring around the coordinator's initials, and the pinned movements as a fly-out. Rest the pointer on any glyph and a card says what the screen is and how it stands, so the strip can be used all shift without opening it." (line 4240)

### Contents, in order (lines 4241 to 4247)

**12.2** "'WF' at 19px, and the service stripe beneath it." (line 4243)

**12.3** "The three groups separated by hairlines, eyebrows hidden. Each item: the glyph at 17px, one word at 9.5px under it, a mono tag at the top right, the tone dot at the glyph's left. The words are Command, Movement, Capacity, Wards, EDs, Teams, Search, Referrals, Handover, Statistics, Governance. Handover's tag is hidden here because the time is in its card." (line 4244)

**12.4** "The foot: the pinned fly-out with its count, the ring at 44px with 'BC' inside and the role, handover and time left as its tooltip, and the reconciliation dot with the sentence as its tooltip." (line 4245)

**12.5** "Open the rail." (line 4246)

### The hover card (lines 4248 to 4253)

**12.6 Markup.** "`.flyCard` inside the item, hidden until the item is hovered or holds a visible focus. 15.5rem wide, beside the item with a small arrow, aligned to the item's top." (line 4250)

**12.7 Holds.** "The screen's name with its count, the purpose in one sentence, and the same state line the open rail shows, with the same tones." (line 4251)

**12.8 Layering.** "The closed rail rises above the bar only while it is hovered or holds focus, so a card can pass over the bar without the drawers ever sitting under the rail." (line 4252)

### Behaviour (lines 4254 to 4260)

**12.9** "The bracket key toggles open and closed from anywhere that is not a field. The two controls at the foot of each state do the same. The view is remembered for this browser." (line 4256)

**12.10** "The grid column animates over 0.18s and the contents re-render at once. Under reduced motion there is no animation." (line 4257)

**12.11** "The pinned fly-out is a `details.menu.flyMenu` whose panel opens to the right, bottom aligned, and holds the same pinned rows as the open rail with the same note." (line 4258)

**12.12** "The Both view in the mockup shows the two states side by side for review. It is not a product state." (line 4259)

---

## Section 13. All twelve screens (lines 4265 to 4306). Three groups and one flow.

**13.1 What every screen is.** "Every screen is the shell of section 3 with its own panels in the body and its own four core figures in the live tally. The table is the overview. The cards under it are the build entries: the columns and their weights, each panel with the sentence that says what it holds, the tally, and what the rail carries for it." (line 4268)

### The overview (table `#screenTable`, lines 4270 to 4286)

**13.2** Screen 1, Command, group Operations. For every open movement across the network, worst first, with what is wrong beside it. Primary action New referral. Used by the bed coordinator and the coordinator on call. (line 4273)

**13.3** Screen 2, Movement, group Operations. For one person's movement from referral to bed, with every event, decline and decision on it. Primary action Record a decision. Used by the bed coordinator, the ED liaison and the ward. (line 4274)

**13.4** Screen 3, Capacity, group Operations. For beds by site and by ward, what is held, and where the pressure is. Primary action Hold a bed. Used by the bed coordinator and the ward. (line 4275)

**13.5** Screen 4, Wards, group Network. For every ward in the network, what it takes, and how it has answered. Primary action Ask a ward. Used by the bed coordinator and the ward. (line 4276)

**13.6** Screen 5, Emergency departments, group Network. For each department's waiting, longest and breached, and the liaison it works through. Primary action Open the department. Used by the bed coordinator and the ED liaison. (line 4277)

**13.7** Screen 6, Community teams, group Network. For the community teams by service, their catchments, and the referrals they send. Primary action Contact a team. Used by the bed coordinator and triage. (line 4278)

**13.8** Screen 7, Patient search, group Records. To find a person by name or identifier and open their movement, with the refusals stated. Primary action Open the movement. Used by everyone signed in. (line 4279)

**13.9** Screen 8, Referrals, group Records. For every referral awaiting triage, oldest first, and the decision on each. Primary action Triage. Used by the duty consultant and triage. (line 4280)

**13.10** Screen 9, Handover, group Records. For the state of the network as a record for the incoming coordinator, and the sign off. Primary action Sign off the handover. Used by the bed coordinator and the incoming coordinator. (line 4281)

**13.11** Screen 10, Statistics, group Records. For waits, breaches and flows over a period, with stated scales and nothing extrapolated. Primary action Export. Used by service leads and governance. (line 4282)

**13.12** Screen 11, Governance, group Records. For every override recorded, oldest first, and the review of each. Primary action Record a review. Used by the governance lead and the service lead. (line 4283)

**13.13** Screen 12, Raise a referral, group Flow. The flow behind the primary action: who, from where, what is asked, and what happens next. Primary action Submit the referral. Used by the ED liaison, a community team and a GP. (line 4284)

### Build entries (lines 4288 to 4302)

Each entry gives the column weights (the left column first, the right column second, as `grid-template-columns: minmax(0, Afr) minmax(0, Bfr)`), the panel count, the primary action, the four live tally figures, what the rail carries, and each panel with the sentence that says what it holds. Panels are listed left column first, then right column.

**13.14 Screen 1, Command (Operations).** (line 4290) Columns weights 1.25, 1. Three panels. Primary: New referral. Live tally: Waiting in ED, Breached, Due within 2 hours, Longest wait. Rail: open movements, the breached and due soon line, the red dot on a breach.

- Left: Priority queue. "Deadlines passed, then the nearest deadline, then the longest wait. Each row is a movement."
- Right: Exceptions. "Breaches, acceptances with no bed, movements with no owner."
- Right: Referrals awaiting triage. "Oldest first, with the source and the request."

**13.15 Screen 2, Movement (Operations).** (line 4291) Columns weights 1.4, 1. Six panels. Primary: Record a decision. Live tally: Open movements, Breached, Declines to answer, Accepted, no bed. Rail: nothing.

- Left: Identity and clocks. "Identifier, tier, the wait, the legal deadline, the owner."
- Left: Timeline. "Every event with its time: referral, assessment, asks, declines, acceptance, bed pulled, arrival."
- Left: Referral and assessment record. "What was asked, by whom, and what was found."
- Right: Destination and bed. "Suggested, asked, accepted, pulled. One state at a time."
- Right: Declines and reasons. "Each ward asked, and the reason it gave."
- Right: Escalation. "Who owns it, who is next, and the override if one was recorded."

**13.16 Screen 3, Capacity (Operations).** (line 4292) Columns weights 1, 1. Four panels. Primary: Hold a bed. Live tally: Beds free of total, Sites with none, Held, Sites drawn. Rail: beds free, and the free and none line.

- Left: Beds by site. "Beds, free, held, for every site drawn."
- Left: Holds and pulls. "Named holds with the movement they are for, and pulls in the last shift."
- Right: Pressure by service. "Free beds against beds, per health service."
- Right: Beds by ward. "Open, secure, older adult, and what each will take."

**13.17 Screen 4, Wards (Network).** (line 4293) Columns weights 1, 1.2. Three panels. Primary: Ask a ward. Live tally: Wards drawn, Beds free, Sites with none, Declines today. Rail: nothing.

- Left: Wards by site. "Grouped by site, with beds free and the last answer."
- Right: Ward detail. "Beds, holds, restrictions, and what the ward will and will not take."
- Right: Recent answers. "Acceptances and declines in the last week, with reasons."

**13.18 Screen 5, Emergency departments (Network).** (line 4294) Columns weights 1.2, 1. Three panels. Primary: Open the department. Live tally: Departments, Waiting, Breached, Longest wait. Rail: the longest wait line.

- Left: Departments. "Waiting, longest wait, breached, per department, worst first."
- Right: Department detail. "The movements there now, and the clocks on each."
- Right: Liaison and contacts. "Roles and the placeholder contacts, never a person's number."

**13.19 Screen 6, Community teams (Network).** (line 4295) Columns weights 1, 1.2. Three panels. Primary: Contact a team. Live tally: Teams drawn, Referrals waiting, From community teams, From GPs. Rail: nothing.

- Left: Teams by service. "Every team, grouped by health service."
- Right: Team detail. "Catchment, hours, and the referrals it has sent this month."
- Right: Contacts. "Roles and placeholder contacts."

**13.20 Screen 7, Patient search (Records).** (line 4296) Columns weights 1, 0.9. Four panels. Primary: Open the movement. Live tally: Open movements, Searchable, open only, Refusals, three kinds, Searches recorded, every one. Rail: nothing.

- Left: Search. "Name or identifier. Refuses a risk score, a best match, and closed movements, and says so."
- Left: Results. "Name, identifier, department, the open movement and its clock."
- Right: Selected person. "The open movement, or a stated absence."
- Right: Access record. "Who looked, and when. Every search is recorded."

**13.21 Screen 8, Referrals (Records).** (line 4297) Columns weights 1.2, 1. Three panels. Primary: Triage. Live tally: Awaiting triage, Oldest, Older adult, For admission. Rail: waiting, the oldest line, the amber dot over two hours.

- Left: Triage list. "Oldest first, with source, request and age group."
- Right: Referral detail. "What was asked, by whom, and when."
- Right: Decision and reasons. "Accept to the pathway, redirect, or decline, with the reason recorded."

**13.22 Screen 9, Handover (Records).** (line 4298) Columns weights 1, 0.8. Four panels. Primary: Sign off the handover. Live tally: Handover at, Time left, To hand over, Exceptions. Rail: the time as its tag, the time left line.

- Left: Handover sheet. "The queue, the exceptions and the beds as they stand, as a record."
- Left: Notes for the incoming coordinator. "What to watch, in the outgoing coordinator's words."
- Right: Shift and sign off. "Who hands over to whom, and when."
- Right: Print. "The same sheet on paper."

**13.23 Screen 10, Statistics (Records).** (line 4299) Columns weights 1, 0.8. Four panels. Primary: Export. Live tally: Waiting now, Breached now, Beds free, Period. Rail: nothing.

- Left: Figures by period. "Waits, breaches, flows, by week and by month."
- Left: Charts. "Every scale stated, every zero drawn, every gap in the data said out loud."
- Right: Filters. "Period, service, tier, department."
- Right: Export. "The figures as a sheet, with the reconciliation line."

**13.24 Screen 11, Governance (Records).** (line 4300) Columns weights 1.2, 1. Three panels. Primary: Record a review. Live tally: Overrides to review, Reviewed this month, Oldest, Reviewers. Rail: overrides to review.

- Left: Overrides for review. "Oldest first, with who overrode, what, and the reason given."
- Right: Override detail. "The movement, the rule set aside, and the reason."
- Right: Decision and record. "Upheld, not upheld, or referred on, with the reviewer's reason."

**13.25 Screen 12, Raise a referral (Flow).** (line 4301) Columns weights 1, 0.8. Six panels. Primary: Submit the referral. Live tally: Referrals waiting, Sources, Duplicate checks, every time, Clocks started, on submit. Rail: not a rail item, reached from New referral and from Tools.

- Left: Source. "Emergency department, community team, or GP, chosen first."
- Left: Person and identifiers. "Name and identifier, with a duplicate check against open movements."
- Left: Request. "Admission or assessment, adult or older adult, and the urgency stated."
- Left: Submit. "One action, and what was submitted read back."
- Right: What happens next. "Triage by the duty consultant, and the clocks that start."
- Right: Duplicate check. "An open movement for the same person is shown before anything is created."

**13.26 The rule under every entry.** "In every entry the bar is the bar of section 4 and the rail is the rail of sections 11 and 12. Each panel opens with its heading, one sentence and a count. An empty panel says why it is empty and what the emptiness means. The four core figures are the tiles in the live tally, and the groups under them are the screen's own tables where it has them, else the network's." (line 4303)

---

## Section 14. Data and wording (lines 4309 to 4351). The contract every screen keeps.

**14.1 Derived, never typed.** "Every count, tile, line, tag, sentence and reconciliation line is computed from the page's data on every render. Changing one movement changes everything that mentions it." (line 4313)

**14.2 Reconciled, out loud.** "The sums by department, by service and by tier are checked against the total on every render. The rail's dot is green with the sentence when they agree and red with the count of disagreements when they do not. The live tally prints the same line." (line 4314)

**14.3 Zero reads "none".** "In a tile, a table cell, a tag, a line and a sentence. A nought is a measurement and none is a state." (line 4315)

**14.4 Absence is a sentence.** "An empty list says why it is empty and what the emptiness means: 'No department in WA Country has a movement open. Absence here means none is waiting, not that none exists.'" (line 4316)

**14.5 Invented, and said twice.** "The mark in the bar carries the disclaimer as its tooltip, and the rail foot and the page footer say it in words. Every figure, clock, name and event is invented." (line 4317)

**14.6 Names.** "An uncommon given name and a word for a plant, a bird or a stone, so that none matches a real person. Lists show family name first. Search matches either order." (line 4318)

**14.7 No real numbers.** "Never a phone number, an address, a record number or a real-seeming name. Contact tables show placeholders in the shape of the real thing and say so twice." (line 4319)

**14.8 Real names that are allowed.** "The eight emergency departments, the hospital sites, the four health services and the ward names, from the repository's own tables." (line 4320)

**14.9 Identifiers and time.** "Movements are WF-0xx, referrals RF-0xx. Times are 24-hour AWST. Waits read '25h 10m'. A deadline reads 'Legal deadline passed 1h 10m ago' or 'Deadline in 1h 35m' or 'No deadline recorded'." (line 4321)

**14.10 Colour keeps its four jobs.** "The accent is brand and interactive. Gilt is you are here. Red is a legal deadline passed and nothing else. Amber is look here, on at most two things at once. The service hues name services and nothing else." (line 4322)

**14.11 The service scope applies to everything derived.** "A screen never shows a figure from outside the chosen service without saying so." (line 4323)

**14.12 Prose.** "Australian spelling. Sentences, not fragments. No dashes, semicolons, arrows or symbols in anything a screen says, so it survives a medical record." (line 4324)

### Every empty state, in one place (table, lines 4326 to 4350)

**14.13** The queue, when no movement is in the service: "No department in WA Country has a movement open. Absence here means none is waiting, not that none exists." (line 4332)

**14.14** The queue, when a filter excludes everything: "No open movement matches this filter. Absence here means the filter excludes every movement, not that the queue is empty." (line 4333)

**14.15** Exceptions: "No exceptions in South Metropolitan. Every open movement has an owner, a deadline that has not passed, and a bed where it has been accepted." (line 4334)

**14.16** Referrals: "No referral awaits triage in WA Country. Absence here means none is waiting." (line 4335)

**14.17** Notices: "No notices since handover in WA Country." (line 4336)

**14.18** Events: "No event today in WA Country." (line 4337)

**14.19** What is going on: "Nothing is open in WA Country. No department there has a movement open and no site there is drawn in this prototype. Absence here means none, not that nothing exists." (line 4338)

**14.20** A table in the tally: "none in WA Country", as the one cell of the table. (line 4339)

**14.21** Contacts: "No ward in WA Country is drawn in this prototype." (line 4340)

**14.22** Pinned: "No pinned movement in WA Country." (line 4341)

**14.23** Search: "Nothing matches 'x'. Search finds patients by name or identifier, movements, departments, wards, owners and tools." (line 4342)

**14.24** A count: "none", in italics where the figure would be. (line 4343)

---

## Section 15. Build order and checks (lines 4354 to 4400). How a screen is cut.

### Order (lines 4356 to 4365)

**15.1** "Copy the design system's stylesheet block verbatim. Never edit it inside a screen. A rule that a screen needs and the block lacks is proposed to the system first." (line 4358)

**15.2** "Add the screen's own rules under one comment naming the screen, using the tokens only. No hex, no size off the scale, no second shadow." (line 4359)

**15.3** "Write the shell from section 3, the bar from section 4, and the rail from sections 11 and 12, with the class names given there." (line 4360)

**15.4** "Write the screen's data and the script that derives everything from it on every render, with the reconciliation check and the live region." (line 4361)

**15.5** "Fill the body from the screen's entry in section 13, and the four core figures for its live tally." (line 4362)

**15.6** "Render once in light and dark at 1600, 1440 and 1280 wide and measure. Fix what the measurement shows, render once more, and stop." (line 4363)

**15.7** "Format with the repository's Prettier, run the PR-local gate, commit with the gate's decisive line, push." (line 4364)

### Checks before a screen is called done (list `#checkList`, lines 4366 to 4383)

**15.8** "The bar has no overflow at 1920, 1600, 1440, 1280 and 1100 wide, and the search never falls below 10rem." (line 4368)

**15.9** "The rail has no sideways overflow in either state, and no state line is truncated at 236px." (line 4369)

**15.10** "The document never scrolls sideways." (line 4370)

**15.11** "Every pop-out opens one at a time, closes on a click outside, on its backdrop and on Escape, and returns focus to its summary." (line 4371)

**15.12** "Escape clears in the stated order and each step is announced." (line 4372)

**15.13** "The slash key reaches the search and the bracket key flips the rail, and neither fires inside a field." (line 4373)

**15.14** "Search refuses a score, a best match and a closed movement with the stated sentences." (line 4374)

**15.15** "A notice marked seen updates the drawer and the dot at once." (line 4375)

**15.16** "Choosing a service re-derives every count, line, tile, sentence, table and the reconciliation line, and WA Country states its absences." (line 4376)

**15.17** "The 35 contrast pairs recompute above 4.5:1 in both themes from the page's live tokens." (line 4377)

**15.18** "Every tap target is at least 3rem at a coarse pointer." (line 4378)

**15.19** "Reduced motion removes every transition and the breathing dot." (line 4379)

**15.20** "Forced colours give every panel, control, card and dot a CanvasText edge or fill." (line 4380)

**15.21** "Print hides the bar's controls, the drawers and the rail's controls, and keeps the title, the lists and the figures as a record." (line 4381)

**15.22** "The console is clean in both themes." (line 4382)

### Proved so far (table, lines 4384 to 4397)

**15.23** Measured at 1920, 1600, 1440, 1280 and 1100 wide, in that order:

- Bar overflow in px: 0, 0, 0, 0, 0. (line 4390)
- Search width in px: 480, 386, 300, 160, 195. (line 4391)
- Rail open, hidden scroll at 1000 tall, in px: 34, 34, 34, 34, 34. (line 4392)
- Rail closed, overflow in px: 0, 0, 0, 0, 0. (line 4393)

**15.24** "Every figure in that table was printed by the render script from the mockups, not typed. At 820 wide the bar takes two rows and the rail stacks above it, by design." (line 4397)

---

## Section 16. Decisions pending (lines 4403 to 4418). Do not build an answer to an open question.

**16.1 The design system's header section.** "Section 6.2 of the standard still describes the three-row header. It is to be replaced by the bar of section 4, with a new section for the rail of sections 11 and 12, once both are approved." (line 4409)

**16.2 Command re-cut.** "The Command live edition carries the earlier masthead. It is re-cut with the bar and the rail as the first screen built to this sheet." (line 4410)

**16.3 Narrowing to a department.** "Designed to live inside the Service selector and not built." (line 4411)

**16.4 Pinning from a row.** "The pinned rows are shown. Pinning a movement from its queue row is not wired." (line 4412)

**16.5 Export the queue and sign out.** "Shown in Tools, not wired, and each says so." (line 4413)

**16.6 Which events are notices.** "A bed pulled, an override recorded, and a deadline passed within the hour are the three kinds shown. The set is to be confirmed." (line 4414)

**16.7 The on call roster.** "Considered for the rail and left out. Its place is Tools, as roles only, with the time it was read." (line 4415)

**16.8 Eleven screens are drawn, not built.** "Command is the only body built. Each of the others has its panels drawn to scale and its tally figures derived, and waits for its own data." (line 4416)

---

## The sheet's footer (lines 4421 to 4425)

**F.1** "Every figure quoted here is invented: the 23 movements, the four referrals, the bed counts, the four overrides, the clock, the shift, the notices and the events. They are the figures of the mockups, and the mockups derive them on every load." (line 4422)

**F.2** "What is real: the eight emergency departments, the hospital sites, the four health services and the ward names, from the repository's own tables." (line 4423)

**F.3** "First edition, frozen 8 September 2026. Supersedes nothing. Sits under the design system, second edition, and above the four mockups in section 2." (line 4424)

---

## The sheet's own script (lines 4422 to 4550)

The script is the sheet's own document behaviour and not a product rule, but two parts of it are the model the sheet's prose points at. They are copied verbatim.

**S.1 The announce helper**, which is the zero-width space rule of 3.6 in code (lines 4427 to 4432):

```js
var root = document.documentElement;
var live = document.getElementById("live");
function announce(text) {
  if (!live) return;
  live.textContent = live.textContent === text ? text + "\u200b" : text;
}
```

**S.2 The appearance control**, three states remembered for this browser only, which is 9.6 in code (lines 4434 to 4470):

```js
/* ─── appearance: three states, remembered for this browser only ─── */
var group = document.getElementById("appearance");
var KEY = "ward-flow-build-sheet-appearance";
function remember(v) {
  try {
    if (v === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch (e) {}
}
function restore() {
  try {
    var v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") root.setAttribute("data-theme", v);
  } catch (e) {}
}
function reflect() {
  if (!group) return;
  var cur = root.getAttribute("data-theme") || "auto";
  var btns = group.querySelectorAll("[data-set-theme]");
  for (var i = 0; i < btns.length; i++) {
    btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-set-theme") === cur ? "true" : "false");
  }
}
if (group) {
  group.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-set-theme]") : null;
    if (!b) return;
    var v = b.getAttribute("data-set-theme");
    if (v === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", v);
    remember(v);
    reflect();
    announce("Appearance set to " + (v === "auto" ? "automatic" : v) + ".");
  });
}
restore();
reflect();
```

The rest of the script counts the masthead figures from the document (mockups from `#mockupTable`, bar controls from `#barTable`, pop-outs from `section[data-popout]`, screens from `#screenTable`, checks from `#checkList > li`), marks the current rail link from the scroll position, announces a section when its rail link is pressed, and opens every closed `details` for print and closes it again after.

---

## Conflicts with the third edition

`merged/MERGE-BRIEF.md` is the brief for the third edition. Its principle is that "everything a coordinator reads or does comes from the branch build; everything the eye sees as colour, type, light and surface comes from ours. Where the two disagree on a rule, the stricter rule wins and is written down." The sheet's own precedence (rule 1.2) says the design system wins on colour, type, material and wording, and the sheet wins only on the shell (rule 1.3). So on every conflict below about a face, a token, a size or a material, the brief wins, and the sheet's sentence is out of date and is corrected. The one conflict that is about the shell itself is listed last, because there the sheet claims precedence and the brief is silent by date.

**C.1 The faces.** The sheet names Newsreader for the title (line 4049) and for the brand (line 4194), and its stylesheet loads Newsreader, IBM Plex Sans and IBM Plex Mono (lines 7 and 171 to 173). The brief replaces the font link with Source Serif 4, Source Sans 3 and JetBrains Mono, and sets `--display`, `--body` and `--mono` to them (brief lines 69 to 71 and 92 to 98). The brief wins. Read every "Newsreader" in the sheet as the display serif token `var(--display)`, which the third edition resolves to Source Serif 4. Read every "mono" as JetBrains Mono.

**C.2 The brand at 22px is off the scale and at a weight the third edition does not load.** Rule 11.2 (line 4194) sets "Ward Flow" in Newsreader at 22px, and the stylesheet (lines 474 to 481) sets `.brand b` at `font-size: 22px; font-weight: 500`. The brief's scale is 10.5, 11.5, 12.5, 13.5, 16, 20 and 26 with "nothing between steps" (brief line 128), and only serif weights 600 and 700 are loaded, with "Replace any font-weight: 800 or 500 on the serif with the nearest loaded weight" (brief lines 100 to 101). The brief wins, being the stricter rule. The wordmark goes to `--t-5` (20px) or `--t-6` (26px) at weight 600. The brief's own type rules put the page title at `--t-6`, so `--t-5` keeps the wordmark under the title in size. Whichever step is chosen, the sheet's sentence at line 4194 is corrected to name the token.

**C.3 "WF" at 19px in the closed rail is off the scale.** Rule 12.2 (line 4243). Under the brief's "nothing between steps", 19px becomes `--t-5` (20px) or `--t-4` (16px), at serif weight 600. The brief wins.

**C.4 The closed rail's word at 9.5px is below the floor.** Rule 12.3 (line 4244) sets "one word at 9.5px under it". The brief's floor is 10.5px (brief line 128), and the second edition block the sheet carries states the same floor in its rule 4 ("Nothing is set below 10.5px"). The sheet is in conflict with its own design system here. The floor wins. The word is set at `--t-0` (10.5px), and the closed strip is re-measured at 76px to prove the eleven words (Command, Movement, Capacity, Wards, EDs, Teams, Search, Referrals, Handover, Statistics, Governance) still fit without truncation. If Governance or Referrals overflows at 10.5px the strip widens, the words do not shrink.

**C.5 The glyph at 17px in the closed rail.** Rule 12.3 (line 4244). A glyph is a stroke, not type, so the type scale does not bind it, and the brief has no icon scale. Not a conflict of rule, but recorded so a builder does not read 17px as a type size. The open rail's 18 by 18 grid (rule 11.26) is the natural size.

**C.6 "The only display type below the wordmark" contradicts the brief's panel titles.** Rule 4.2 (line 4049) says the title is "the only display type below the wordmark". The brief's type rules put the display serif on "the wordmark, page title, panel titles, site codes and diagram headings" (brief line 125), and material rule 11 sets "Panel titles in `var(--accent-ink)`, display serif" (brief line 118). The brief wins on type. Panel headings in `.ph` are serif 600 at `--t-3` in accent-ink, and the sheet's sentence is corrected to "the display serif at t-6".

**C.7 The tokens.** The sheet's stylesheet carries the second edition palette: `--accent: #1b4f82` (Prussian blue), `--gilt: #7f6129`, `--gilt-soft: #f6f0e3`, `--ground: #f3f5f8`, `--surface: #ffffff`, and the dark and print sets (lines 112 to 243 and 2113 to 2139). The brief replaces the whole token block with the third edition's cool platinum set (brief lines 52 to 90) and adds `--ground-hi`, `--ground-2`, `--stripe`, `--hl-on-accent` and `--r1i`. The brief wins. The sheet's body never names a hex, so no sentence in the body needs rewording, but any mockup cut from the sheet's stylesheet block is re-cut from the third edition block. The second edition comment's phrase "The accent (Prussian blue)" (line 45 of the stylesheet comment) is corrected to "the accent (deep slate)".

**C.8 Solid hairlines.** The sheet's stylesheet sets `--line: #e1e7ee` and `--line-strong: #c7d1dd` in light, `#243040` and `#364554` in dark (lines 121, 122, 189, 190, 224, 225). The brief's material rule 5 says "Hairlines are the alpha tokens above. Remove any solid grey used as a line" and sets `--line: rgba(22,30,40,.11)` and `--line-strong: rgba(22,30,40,.26)` (brief lines 58 and 112). The brief wins. Every "hairline" in the sheet's prose (rules 4.11, 6.4, 7.2, 7.6, 11.3, 12.3) is read as the alpha token. The second edition rule 5 in the sheet's stylesheet comment says "Hairlines are solid, never dashed", which is about dashes and not about alpha, and stands.

**C.9 The service stripe and the brand stripe are two 3px stripes.** Rule 11.3 (line 4195) puts "a 3px hairline in the service hue under the brand, only while one service is chosen", and rule 12.2 puts the same stripe beneath "WF". The brief's material rule 2 adds a fixed 3px brand stripe across the top of the window in `var(--stripe)` at z-index 20 (brief line 109). These are different elements in different places, so they do not contradict, but the brief's stripe is fixed at the top of the window at z-index 20 while the sheet puts the bar at z-index 31 and the rail at 20 rising to 32 (rules 3.3, 3.4, 3.8 to 3.13), both sticky at the top. As written, the bar would paint over the brand stripe. The stricter reading keeps both: the brand stripe takes a z-index above the bar and the drawers (41 or higher, with pointer events off as the brief already has), or the shell reserves its top 3px for it. This must be decided before the shell is cut, and the sheet's layer table (rules 3.8 to 3.13) gains a row for the brand stripe.

**C.10 Gilt fills.** The brief's material rule 6 says "Brass is a bar, never a fill" and changes any `--gilt-soft` wash behind text to a bar or an outline plus text in `--gilt` (brief line 113). The sheet's body uses gilt only as a bar or an underline: the chosen service row's gilt bar (rule 6.3, line 4115), the chosen segment's gilt underline (rule 7.4, line 4132), the current rail item's gilt bar at the left (rule 11.10, line 4205), and the two letters "WA" in gilt (rule 11.2, line 4194), which the brief allows ("The two letters beside the wordmark stay brass"). The sheet's stylesheet uses `--gilt` as a background on `.railLink[aria-current="page"]::before` (line 544, a bar), on `.step[data-s="now"]` (line 1355, the current stage, which the brief keeps), and as an inset underline (line 2036). `--gilt-soft` is defined but never used. No gilt fill conflict was found. Recorded so a builder knows it was checked.

**C.11 Accent-soft fills on selected and new things.** Rule 4.11 (open summary takes the accent-soft fill and the accent border), rule 8.3 (new notice rows carry the accent-soft fill, line 4148) and rule 11.10 (the current rail item takes the accent-soft fill). The brief's material rule 7 uses `var(--accent-soft)` with a slate ring `inset 0 0 0 1px var(--accent)` for a pressed card, and rule 9 uses accent-soft with a slate ring for a selected count pill (brief lines 114 and 116). These agree on the fill. The stricter reading adds the slate ring wherever accent-soft marks selection, so the open summary and the current rail item carry the ring as well as the fill. A new notice row is not a selection, so it keeps the fill alone. Not a contradiction, but a tightening the builder applies.

**C.12 The count tag reading "none".** Rule 11.11 (line 4206) says the rail count is "a mono tag at the right, always neutral. A count of none reads 'none'", and rule 14.24 (line 4343) says a count reads "none, in italics where the figure would be". The brief's material rule 9 says "Count pills on the rail and tabs: mono on `var(--sunk)` with a hairline ring; selected on `var(--accent-soft)` with a slate ring. A zero is italic with no pill" (brief line 116). The two agree on the word and the italics. The stricter rule is the brief's: a count of none is the italic word with no pill behind it, and the pill is drawn only for a figure. Rule 11.11 is read that way.

**C.13 The drawer backdrop at 0.6 of the edge shade.** Rules 3.12 and 7.2 (lines 3982 and 4130) dim the page "with the edge shade at 0.6". The sheet's second edition `--edge-shade` is a dark shade. The brief re-tints `--edge-shade` to `rgba(30,48,66,.16)` in light and `rgba(0,0,0,.55)` in dark (brief lines 66 and 89) and material rule 12 says to "re-tint `--edge-shade` as above" for the scroll fades. At 0.6 opacity of a .16 alpha the light backdrop would be almost invisible. Not a contradiction of a stated rule, but the number 0.6 was set against a different token. The builder measures the backdrop in light and, if a drawer no longer reads as over the page, raises the backdrop's own opacity rather than the token, and records the figure in the sheet.

**C.14 Pop-outs and the one elevation step.** The brief's material rule 3 says "One elevation step and only one. Nothing inside a panel carries a shadow" (brief line 110), and the sheet's rule 15.2 says "no second shadow". The sheet's `.menuPanel` (stylesheet lines 2610 to 2626) carries `var(--lift), inset 0 1px 0 var(--hl)`, the same single step a panel carries, and the drawers and hover card sit outside any panel. No second elevation was found. Recorded so a builder does not add a heavier shadow to a drawer or a hover card because it floats: it takes `var(--lift)` and nothing more.

**C.15 The masthead figures strip and the tasks bar, which the brief keeps and the sheet removes.** This is the one conflict about the shell. The brief's material rule 12 says "Keep Source L's ... masthead figures" (brief line 119), its description of Source L values "a masthead figures strip counted from the data", and its silence rule says "Where it is silent, keep the branch build's behaviour" (brief line 5), which is the three-row header of the Command live edition. The sheet's rule 4.1 (line 4044) says "The figures and the tasks live behind the controls, never on the row", rule 7.1 (line 4128) says "The figures that used to crowd a statistics strip live here, behind one word", and rule 16.1 and 16.2 (lines 4409 and 4410) say the three-row header in section 6.2 of the standard is to be replaced by the bar and the rail, and the Command live edition is to be re-cut with them "as the first screen built to this sheet". The sheet's rule 1.3 gives the sheet precedence on the shell. Under the brief's own principle, the stricter rule is the sheet's: one row, one primary action, every figure derived and still shown but behind the Activity control, with the masthead figures becoming the four tiles of the live tally (rule 7.6) and the tasks bar becoming the Tasks drawer (section 8). Nothing the coordinator reads is lost, so the brief's "content and behaviour from the branch build" is kept. The recommendation is that the sheet wins on the shell and the third edition Command is re-cut with the bar and the rail, but rule 16.1 says the replacement of the standard's header section happens "once both are approved", so the owner should confirm this in words before the merged Command's masthead strip is removed.

**C.16 The sheet's own document chrome.** The sheet's page (lines 3841 to 3906) uses its own classes (`g-app`, `g-rail`, `topbar`, `g-main`) and a "First edition" chip, and the second edition stylesheet with the three-row header rules from line 2424. None of this is a product rule. If the sheet itself is re-cut to the third edition, it takes the third edition's block and faces like any other carrier, and its 22px brand and 500 weight (C.2) are corrected there too.

No other disagreement with the brief's tokens, faces, material rules or type rules was found in the sheet's body. The sheet's measures in px (56px bar, 34px summary, 236px and 76px rail, 7px dots, 3px stripe, 2px ring, 44px ring, 6px radius, 14px gap, 10px and 8px gaps) are layout measures, not type sizes, and the brief sets no rule against them. The 6px control radius matches the brief's `--r2: 6px`, and the 14px gap matches `--gap: 14px`.
