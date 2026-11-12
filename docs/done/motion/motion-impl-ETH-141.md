---
linear: ETH-141
---
# Scrub the shared hover transition on the canvas

## Status

- **Goal**: Ethan judges the hover's motion frame by frame on the real controls.
- **Initial priority**: P3
- **Effort**: Small
- **Category**: feature
- **Planned at**: commit `89fcb0d`, 2026-11-12
- **Plan**: PRD R17, last block; ADR-038, ADR-039

## Why this matters

A 150ms hover is over before the eye can judge it. R17 asks to scrub a running transition.

## Approach

* A "Scrub hover" slider in the Motion section. Moving it puts every control in the canvas
  that has the catalog's hover preview state (`.btn`, `.field`, `[data-preview="hover"]`) into
  hover, pauses the transitions that start, and sets them to the slider's place along the
  shared duration and easing (ADR-040).
* Releasing it (pointer up, blur or Escape) restores each control's own preview state, so they
  return to rest through their own transition, and the slider to 0.

## Scope

* In: the shared hover transition on controls with a preview state.
* Out: other transitions (panels, drawers), and a timeline across several.

## Done when

* `scale-check.mjs` scrubs to 50% and reads a button's background part way into hover, to
  100% and reads it fully in hover, then releases and sees it back at rest.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log

* The native range slider was heavy beside the inspector; it is a 2px track with a small
  accent thumb (PRD section 12: sleek and minimal).
