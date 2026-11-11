---
linear: ETH-114
---
# Add the Layers panel and the three-panel frame

## Status

- **Goal**: the Workbench is laid out as Layers, canvas and inspector, and a named region can
  be selected from the Layers tree.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `04cb7ad`, 2026-11-11. Refresh against the landed editor entry before
  starting.
- **Story**: [layers-story.md](layers-story.md).

## Why this matters

PRD R4 and building block 4. Selection is by clicking the canvas only, so a region under
another, or one a few pixels tall, is hard to reach, and nothing shows how a screen is put
together. "AC 3" below means criterion 3 in `layers-story.md`.

## Current state

* `packages/workbench/src/page.ts` builds the page: the canvas frame, the overlay of handles,
  and the inspector. There is no left panel.
* Selection goes through one function, `select(node)`. Elements are named by `data-wb`
  (ADR-012), and components carry `data-slot` on their parts.
* Work to open the editor from the app's Live and Component buttons is in progress in another
  thread and may change how the page is entered.

## Approach

The tree is read from the canvas's own page, the same document selection already reads. A
pure function takes a root element and returns the nested list of elements that have a
`data-wb` or `data-slot` name. A `MutationObserver` on the frame's document rebuilds it. A
click calls the existing `select`. There is no second record of the page's structure.

Rejected: a file that lists the regions. Someone would have to keep it in step with the
components, which is the translation step ADR-014 rules out. Rejected: listing every element,
which buries the few regions worth naming. Rejected: a tree component library; the tree is a
nested list with the standard tree roles.

## Scope

* In: `packages/workbench`: the tree function and its test, the left panel, the three-panel
  layout in `page.css`, and the wiring between the tree and `select`.
* Out: Assets, renaming, reordering, hiding, locking, resizing panels. The story excludes
  them.
* Out: how the editor is opened from the app. That is the in-progress entry work.

## Steps

* Add the tree function: a root element in, nested named regions out, in page order.
* Lay the page out as three panels and render the tree with tree roles and labels (AC 1, 2).
* Wire a click and Enter to `select`, and hover to the outline (AC 3, 5, 6).
* On any selection, mark the matching layer or the nearest named ancestor's and scroll to it
  (AC 4).
* Rebuild on changes to the frame's document and when the frame loads a new page (AC 7).

## Test plan

* A unit test covers the tree function: nesting, page order, and an unnamed element between
  two named ones being skipped without losing the nesting.
* One browser test: click a layer and assert the same selector is selected as clicking that
  element on the canvas; select an unnamed element on the canvas and assert its nearest named
  ancestor's layer is marked; navigate the app and assert the tree changed.
* Drive the tree with the keyboard only and assert Enter selects.
* Recheck spacing and nudge drags with the new layout, since the canvas moved.
* Take screenshots at a wide and a narrow window, in light and dark, and look at them.

## Done when

* The unit test and the browser test pass.
* The screenshots show nothing misaligned and the panels match the PRD's look references.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: LOW. It reads what selection already reads and writes nothing. The handles are placed
from the frame's position, so moving the canvas into a centre column is the part to recheck.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
