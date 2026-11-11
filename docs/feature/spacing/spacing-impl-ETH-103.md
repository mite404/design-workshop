---
linear: ETH-103
---
# Nudge an element inside its parent

## Status

- **Goal**: drag an element's body to move it in 2px steps without moving its siblings, and
  save the offset to the override file.
- **Initial priority**: P2
- **Effort**: Small
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `9044003`, 2026-11-11
- **Story**: [spacing-story.md](spacing-story.md). Needs ETH-102.

## Why this matters

Gap and padding move everything in a card together. Sometimes one label or heading needs to
sit a few pixels over, and the only way to say that today is in words. "AC 6" below means
criterion 6 in `spacing-story.md`. This ticket covers AC 6 and 7 and the nudge parts of AC 11
and 12.

## Current state

* After ETH-102, any element can be selected, has a selector, and can have
  whole-pixel values saved for five properties.
* Dragging the body of a selected element does nothing.

## Approach

A nudge is the CSS `translate` property on the element. It moves the element visually and
leaves its place in the layout, so siblings do not move, and removing it puts the element back
exactly where the layout had it. Rejected: `position: absolute`, which is what Figma's "ignore
auto layout" does. It takes the element out of the layout, the siblings close up, and putting
it back means choosing a new place for it. Rejected: negative margins. They move the siblings
too.

The offset is limited so the element's box stays inside its parent's padding edge, measured
from the browser at the start of the drag. See ADR-013.

## Scope

* In: `packages/workbench`: the body drag, the limit maths, two inspector fields, one more
  property on the endpoint, and their tests.
* Out: a warning when a nudged element overlaps a sibling. The story excludes it.
* Out: turning an offset into padding, gap or alignment. That is the fold-in step.

## Steps

* Add `translate` to the endpoint's properties. Accept only two whole pixel lengths, which may
  be negative.
* Dragging the body of the selected element changes its offset in steps of 2px, or 10px with
  Shift (AC 6, 8). The readout pill shows X and Y.
* Limit the offset so the element stays inside its parent's padding edge (AC 6). The limit
  maths is a pure function.
* With the element selected and no handle focused, arrow keys nudge by 2, and by 10 with Shift
  (AC 11).
* Escape during a drag restores the earlier offset. Release saves.
* The inspector shows X and Y fields. Setting both to 0 removes the value from the override
  file (AC 7, 12).
* If the element already has a transform or translate of its own, show the fields as read-only
  with a short reason.

## Test plan

* One browser test: select a heading in a card, drag it right by an uneven amount, assert its
  box moved by an even amount and its siblings' boxes did not move; drag it far past the card's
  edge and assert it stopped at the padding edge; set X and Y to 0 and assert the override file
  no longer mentions it.
* A unit test covers the limit maths, including an element already touching one edge.
* Take a screenshot mid-drag and look at it.

## Done when

* The browser test and the unit test pass.
* The screenshot shows nothing misaligned.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The PR title starts with this ticket's bracketed Linear identifier.

## Notes

Risk: LOW. One property and one drag on top of machinery the previous ticket builds. A nudged
element can cover a sibling; that is judged by eye for now.

## Drift log

Record here anything built differently from this plan, and why.
