# The canvas splash and Vitruvian welcome

Ethan supplied every picture here. Their origin and licence are still to be confirmed.

- `atlas.webp` (635x1081, about 73 KB, lossless) is Ethan's Atlas figure holding the globe, cut
  to a stencil: black strokes on alpha, with his fade towards the feet baked into the alpha. It
  is a CSS mask filled with `--splash-figure` on the empty canvas, so only the strokes show and
  they theme with the ink. The welcome's Vitruvian look draws the same sheet behind its words.
- `atlas-lines.svg` is an original construction drawn by `apps/web/scripts/draw-atlas-lines.mjs`
  after Ethan's composed canvas surface: circles concentric with the globe and spokes through
  its centre. A CSS mask filled with `--splash-line`. No licence is needed.
