# Typography

Edit an element's font and formatting or change the shared type scale.

## Sub-features

- Size, weight, style, alignment, spacing and Basics controls.
- Font picker search, cancellation, local fonts and missing-font feedback.
- Shared base size, ratio, leading, persistence and reset.

## How to get to it (user POV)

Select a heading or paragraph in `/__workbench/` for element controls. Open the Type panel for
shared scale controls.

## Driving it with the browser scripts

Preconditions: empty override fixture in the isolated snapshot; dev server healthy.

```sh
node apps/web/scripts/type-check.mjs --base http://localhost:5173 --out "$OUT/type"
node apps/web/scripts/scale-check.mjs --base http://localhost:5173 --out "$OUT/scale"
```

Require the rendered styles, inspector values and saved declarations to agree, including odd typed
sizes, invalid values, reset and reload. Inspect text wrapping and affected surrounding components
with the candidate design restored, not only the baseline fixture.

## Gotchas

The font-picker checks use offline fonts and do not establish downloaded-font behavior. Chromium
does not verify Safari's font rendering. Record Safari as unverified unless it was actually tested.
