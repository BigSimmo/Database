# The PsychSift design canvas

`build-canvas.py` generates the six artboards behind the published design canvas:

| Artboard       | What it shows                                                                          |
| -------------- | -------------------------------------------------------------------------------------- |
| `Main`         | The symbol large, the name, the strapline                                              |
| `Construction` | Every arc with its radius and centre, and why the crescent never tapers                |
| `Sizes`        | The mark at 96/64/48/32/16 px, standard cut and small-size cut side by side            |
| `Colour`       | The in-app token set, light and dark, and the note that the standalone artwork differs |
| `Lockups`      | Horizontal, stacked, reverse, app icon, clear space, and the misuse rules              |
| `Typography`   | The wordmark and strapline as built, and the five-value tracking ladder                |

The published canvas is at <https://claude.ai/artifact/S2F3SYG5NrKFBHB7fhxYgP>. It is private to
the owner; anyone else needs access granted from the page's own Share menu.

## Why the generator is kept rather than the artboards

A published artifact can be edited in place by whoever opens it, and a lost or overwritten canvas
cannot be recovered from the repository unless its source survives. Keeping the generator — rather
than the generated HTML — also means the geometry appears once, as the same constants the
application uses, instead of being duplicated across six files that could drift apart.

## Regenerating

```bash
python3 docs/brand/canvas/build-canvas.py /tmp/psychsift-canvas
```

That writes `Main.dc.html`, `Construction.dc.html`, `Sizes.dc.html`, `Colour.dc.html`,
`Lockups.dc.html`, `Typography.dc.html` and `canvas.json` into the directory given. Do not write
them back into this directory: they are output, not source, and nothing in the repository consumes
them.

To republish the canvas from those files, use the Claude Code `design` skill, which seeds them into
a fresh copy of its canvas payload and publishes the result to the existing artifact URL. The skill
supplies the payload and the seeding helper; this repository holds only the design content.

## Keeping it truthful

The generator carries a **copy** of the geometry and colour values, because the canvas is published
outside the application and cannot import from it. Nothing fails if the copy goes stale, so when
`src/lib/brand-mark.ts` or the effective `.ckb-v2` tokens in `src/app/ckb-v2-tokens.css` change, update this file in
the same change and republish.

The values that must agree:

- every path, transform, radius and centre, against `src/lib/brand-mark.ts`
- `#1D6FB8` / `#74BDF0` and the rest of the swatches, against effective `.ckb-v2` values in `src/app/ckb-v2-tokens.css`
- the clear-space rule and the maskable 62%, against [`../psychsift-logo.md`](../psychsift-logo.md)
