---
linear: ETH-136
---
# Give a reference its current values

## Status

- **Goal**: A request tells an agent what its element renders today.
- **Initial priority**: P3
- **Effort**: Small
- **Category**: feature
- **Planned at**: commit `ff820be`, 2026-11-12
- **Plan**: `docs/research/project-portability-plan.md`, work order phase 10; PRD R12

## Why this matters

R12's request names the element, its file and line, and its current value. Ethan (PRD
section 13): "the property currently being rendered in live mode".

## Approach

* When chosen, a reference records the computed value of each property the Live-mode inspector
  renders for an element: gap, padding and the type properties.
* A sent message shows them under a folded "Current values" disclosure; the draft chip's tooltip
  lists them.

## Scope

* In: the values on references.
* Out: properties the inspector does not render, such as size and colour.

## Done when

* `reference-check.mjs` opens the sent reference's values and each line equals the button's
  computed style.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log
