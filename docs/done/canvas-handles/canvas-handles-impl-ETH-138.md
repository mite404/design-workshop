---
linear: ETH-138
---
# Drag an element's edge to resize it in Live mode

## Status

- **Goal**: Ethan sizes an element by dragging on the canvas, with a readout.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: commit `809ea5c`, 2026-11-12
- **Plan**: PRD R13; Ethan's decision in PRD section 13 ("live mode")

## Why this matters

R13 is the last canvas handle set: radius, gap and padding have handles; size had values only
(ETH-137).

## Approach

* A width handle sits just outside the right edge, a height handle just outside the bottom
  (ADR-037). They reuse the spacing handles: drag, click to type, arrow keys, Escape, readout.
* They follow the size rows: Live mode only, hidden on inline elements and locked values.

## Scope

* In: width and height handles with readouts.
* Out: min and max sizes; proportional resize.

## Done when

* `spacing-check.mjs` hovers the width handle outside the edge, reads `Width N`, drags it 50px
  in and sees the snapped width saved, then resets it.
* `component-check.mjs` sees no width handle in Component mode.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log

* None.
