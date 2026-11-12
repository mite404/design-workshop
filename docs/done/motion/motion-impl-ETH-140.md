---
linear: ETH-140
---
# Shape the controls' hover easing on a curve editor

## Status

- **Goal**: Ethan shapes how every control eases into its hover by dragging a curve.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: commit `89e968b`, 2026-11-12
- **Plan**: PRD R17, second block; PRD section 9 (the easing editor's look); ADR-038

## Why this matters

ETH-139 made the hover duration one shared token. Its easing was still CSS's `ease` keyword in
five rules, and PRD section 9 asks for the easing editor in bklit's look.

## Approach

* One `:root` token, `--motion-hover-ease`, a `cubic-bezier()`, beside `--motion-hover`. Its
  baseline is CSS's `ease` written as a curve, so the editor has points to drag (ADR-039).
* The Motion section's curve editor: a dark plot of time against progress, a soft grid, a
  crosshair whose blurred readout gives the progress at that time, and two control points.
  Drag a point (live, saved on release), or focus it and use the arrows (0.01, 0.1 with Shift;
  Enter or blur saves, Escape drops). The field below takes four numbers or a `cubic-bezier()`.
* `motion.ts` holds the curve's maths: parse, format and the progress at a time.

## Scope

* In: the hover easing, its editor, its field and Reset.
* Out: named presets; other motion tokens; scrubbing a running transition.

## Done when

* `scale-check.mjs` steps a point with the arrows, drops a nudge with Escape, drags the second
  point and reads the saved curve, sees the readout follow a typed curve without a pointer
  move, types a curve both ways, and resets, each against a button's rendered timing.
* `motion.test.ts` checks the parse, the clamp and the progress maths.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log

* The typed field was 66px beside its label and clipped the curve; it has its own line and
  shows just the four numbers.
* A curve overshooting past 1.3 drew its point outside the plot. The plot shows -0.6 to 1.6 and
  the endpoint takes exactly that range.
* The crosshair readout kept the old curve's value when the curve changed under a resting
  pointer; it now follows the curve shown. A run with the fix removed fails that check.
