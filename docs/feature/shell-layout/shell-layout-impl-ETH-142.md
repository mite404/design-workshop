---
linear: ETH-142
---
# Put the rail and its drawer on the left or the right

## Status

- **Goal**: Ethan moves the shell's navigation to the other side without writing code.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: commit `9b0912a`, 2026-11-12
- **Plan**: PRD R14, first block; Ethan's decision in PRD section 13

## Why this matters

Ethan (Nov 12): a rail for navigation can only sit on the left or the right of an app shell, and
a drawer slides in from the left or the right, for now. Layouts stay a short templated list.

## Approach

* One `:root` layout value, `--shell-side: left | right`, in the catalog's `tokens.css`.
* The app reads it into `data-shell-side` on the root (`shell-side.ts`), passes the side to the
  desktop panel, and `index.css` mirrors the rest: the rail's hairline, the workspace's inset
  corner and border, the peek's slide, edge and shadow, its hover strip and the resize handle,
  whose drag and arrow keys flip too (ADR-041).
* The Workbench's Layout section sets it with a Left/Right choice and a Reset.

## Scope

* In: rail and drawer together on either side, on a desktop.
* Out: the drawer on the opposite side from the rail; the phone's drawer, which stays left; a
  drag to swap sides.

## Done when

* `layout-check.mjs` picks Right and reads the file, the rail right of the docked panel and the
  panel right of the workspace, the inset corner at the top right, a 40px drag left widening the
  panel and ArrowRight narrowing it, a peek ending at the rail's edge, and Reset back to the left.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log

* The Left/Right buttons used the type panel's icon sizing and ran together; they take padding,
  and the label is "Rail side" so it fits on one line.
