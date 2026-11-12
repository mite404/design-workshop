---
linear: ETH-137
---
# Set an element's width and height in Live mode

## Status

- **Goal**: Ethan sizes one element without writing CSS.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: commit `aadded0`, 2026-11-12
- **Plan**: PRD R13; Ethan's decision in PRD section 13 ("live mode")

## Why this matters

R13 asks for handles on the canvas for sizes. Size values have to exist before a handle can edit
them, so this ticket adds the values and the next one adds the handles.

## Approach

* Width and height are rows in the Selection panel, above gap, saved per element like padding.
* They are a Live-mode edit, so the rows are hidden in Component mode.
* They are disabled on inline elements, where width and height do nothing.
* A reference's current values include them, because the Live-mode inspector now renders them.

## Scope

* In: width and height fields, saving, Reset, undo.
* Out: canvas size handles and their readouts (next ticket); min and max sizes.

## Done when

* `spacing-check.mjs` types a width, sees the element and the override file change, and Reset
  restores the element's own width.
* `component-check.mjs` sees no width row in Component mode.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log

* The "Read-only fields" note always showed, because `.note { display: flex }` beat `[hidden]`.
  The same rule hid nothing on the new rows, so one `[hidden]` rule now covers both, and
  `spacing-check.mjs` asserts the note hides once nothing is locked.
