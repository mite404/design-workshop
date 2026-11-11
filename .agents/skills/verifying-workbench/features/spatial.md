# Selection and spatial edits

Select real elements, reference them in chat, and edit radius, gap, padding or position.

## Sub-features

- Canvas and component-tree selection, keyboard navigation and element references.
- Radius typing, scrubbing, corner handles, cancel and reset.
- Gap and padding controls, snapping, modifiers and unmatched values.
- Keyboard nudging.

## How to get to it (user POV)

Open `/__workbench/`, select the window or a completed-brief card in the preview, then use its
inspector, labels or handles. Open the preview's side drawer to select a named component from
the Components tree. Use the chat's arrow tool to add an element reference.

## Driving it with the browser scripts

Preconditions: empty override fixture in the isolated snapshot; dev server healthy.

```sh
node apps/web/scripts/layers-check.mjs --base http://localhost:5173 --out "$OUT/layers"
node apps/web/scripts/corner-radius-check.mjs --base http://localhost:5173 --out "$OUT/radius"
node apps/web/scripts/spacing-check.mjs --base http://localhost:5173 --out "$OUT/spacing"
node scripts/nudge-check.js --base http://localhost:5173 --out "$OUT/nudge"
node apps/web/scripts/reference-check.mjs --base http://localhost:5173 --out "$OUT/reference"
```

Require computed styles, inspector values and saved CSS to agree. Radius covers seven steps,
including Escape, stale refusal and reset. The layers check verifies row/canvas selection,
keyboard navigation and standalone thread navigation outside the editor. References must retain
the selected element without activating it. For interaction evidence, spacing accepts
`--video "$OUT/spacing"`; reference accepts `--video "$OUT/reference"` and `--theme dark` for
the dark variant.

## Gotchas

Scripts depend on specific fixture elements. A moved fixture is not automatically a broken editor.
Check the user path before updating selectors. Radius and spacing can leave saved overrides after
a failed run; recreate the disposable fixture before another script. Never clean the source file.
