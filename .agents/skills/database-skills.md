# Database skills catalog

Run `npm run skills` to render the current categories from `catalog.json` and explanations from each canonical skill's frontmatter.
Run `npm run check:skills` to prove that every canonical skill and compatibility alias has valid local metadata.

The `skills` skill uses this generated view, explains each unique skill in the chat, and recommends the smallest useful set for the current request. Compatibility aliases remain callable but are not counted or displayed as separate skills.
