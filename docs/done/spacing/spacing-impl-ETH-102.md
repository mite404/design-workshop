---
linear: ETH-102
---
# Select an element and drag its gap and padding

## Status

- **Goal**: click any element in the app, drag the space between its children and inside its
  edges, and have the values saved to the override file.
- **Initial priority**: P1
- **Effort**: Large
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `9044003`, 2026-11-11
- **Story**: [spacing-story.md](spacing-story.md). Needs ETH-100 and ETH-101. The nudge part of
  the story is a separate ticket.

## Why this matters

Spacing is what Ethan adjusts most after an agent builds a mockup, and today each adjustment is a
sentence to an agent. This ticket also adds the two things every later feature needs: selecting
any element, and saving a value against that element. "AC 3" below means criterion 3 in
`spacing-story.md`. This ticket covers AC 1 to 5 and 8 to 18, leaving out the nudge parts of AC
11 and 12.

## Current state

* After ETH-101, the Workbench page frames the app on the same origin, with an inspector, an
  overlay, a readout pill, and a dev-only endpoint at `/__workbench/values`.
* That endpoint accepts one name, `--window-radius`, and writes it to the `:root` block.
* After ETH-100 as amended, `setOverride` takes a selector, and `overrides.css` loads last and
  outside any layer, so a saved rule beats the app's `components` and `utilities` layers.
* Only the window can be selected.

## Approach

Selection, identity, then handles, each checked before the next.

Identity is a pure function from an element to a selector. If the element has a `data-wb`
attribute, the selector is that attribute. Otherwise it is a path of tag names and
`:nth-child()` steps from the nearest ancestor that has a `data-wb` or an `id`, or from `body`.
Rejected: class names in the path. Tailwind utility classes change whenever styling changes, so
they make the least stable identity. Rejected: the Workbench writing `data-wb` into source. The
Workbench never writes source.

Handles are drawn in the existing overlay from the browser's own measurements: the selected
element's box, its computed padding and gap, and its children's boxes. Nothing is added to the
app's markup. During a drag the value is set inline on the element; on release it is saved and
the inline value is dropped once the hot reload lands, as in ETH-101.

The endpoint grows from a list of names to a list of properties. It stays a trust boundary: a
selector is now part of a request that ends up in a CSS file, so it is checked against a strict
grammar, not escaped.

Behaviour follows Figma's auto layout, with the 2px step from ADR-010. Rejected: a drag library
(react-moveable). Gap and padding handles move along one axis, which plain pointer events
already do in ETH-101.

## Scope

* In: `packages/workbench`: the selector function, the handle maths, the overlay handles, the
  inspector fields, the endpoint change, and their tests.
* Out: nudge (AC 6, 7). It is the next ticket.
* Out: Storybook stories as the canvas. The canvas is the framed app, as in ETH-101.
* Out: reordering, resizing, alignment, "auto" gap, margins, undo. The story excludes them.
* Out: folding saved values into source.

## Steps

Part 1, selection:

* Clicking any element in the frame selects it and outlines it. Clicking again selects the
  element under the pointer one level deeper. Escape selects the parent. Clicking empty space
  deselects (AC 1). The window stays selectable, and its radius handles still work.
* While the Workbench has a selection tool active, clicks do not reach the app.

Part 2, identity:

* Write the selector function described in Approach. It is pure, given a small description of
  the element's ancestors.
* Check: the selector matches exactly one element, the one it was made from.

Part 3, the endpoint:

* `POST /__workbench/values` takes a selector, a property, a value and `was`. `:root` with
  `--window-radius` keeps working.
* Accept only these properties for an element: `gap`, `padding-top`, `padding-right`,
  `padding-bottom`, `padding-left`. Accept only whole pixel lengths of 0 or more.
* Accept a selector only if it matches the grammar the selector function produces. Refuse
  anything containing braces, semicolons, commas, `@`, backslashes or comment markers.
* `GET` returns saved values by selector, so the client can find ones that match no element.

Part 4, handles:

* Handles appear when the pointer is over the selected element (AC 2).
* Gap: only if the element's computed `display` is flex or grid. One handle in each space
  between two children, dragged along the layout direction. All gaps change together (AC 3).
* Padding: one handle inside each edge (AC 4). Alt changes the opposite side too. Alt and Shift
  change all four (AC 5).
* Hovering or dragging a handle highlights the space it controls (AC 2).
* Steps of 2px, or 10px with Shift, never below 0 (AC 8). The readout pill shows the value
  (AC 9).
* A click without a drag opens a number field in place. Enter commits, Escape cancels (AC 10).
* Tab reaches every handle. Arrow keys change the value by 2, and by 10 with Shift (AC 11).
* Escape during a drag restores the earlier value (AC 14). Release saves (AC 13).
* The handle maths (pointer movement to a value, with the step and the floor) is a pure
  function.

Part 5, inspector and leftovers:

* The inspector shows gap and four padding fields for the selection, each with a reset (AC 12,
  16).
* If the element sets the property in an inline `style`, a stylesheet cannot override it. Show
  the field as read-only with a short reason.
* List saved values whose selector matches no element, each with a delete button (AC 17).

## Test plan

* One browser test walks the story on a card in the scripted demo: select it, drag a gap handle
  by an uneven amount, drag a padding handle with Alt, type an odd value, press Escape mid-drag,
  reset. At each step it asserts the computed style, the field's value and the override file.
* Unit tests cover the selector function (tagged, untagged, anchored at an `id`), the handle
  maths, and each refusal of the endpoint, including a selector that tries to close the block.
* Search the `pnpm build` output for `__workbench` (AC 18).
* `git status` after the browser test shows only `overrides.css` (AC 15).
* Take screenshots with a card selected, a gap handle hovered and a padding drag in progress,
  and look at them.

## Done when

* The browser test and the unit tests pass.
* The build output contains no `__workbench` string.
* The three screenshots show nothing misaligned.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: MEDIUM. The selector is written into a CSS file from a browser request, so its grammar
check is tested, not assumed. Selection by click has to stop the app's own click handlers
without breaking the window's radius handles from ETH-101. An untagged element's saved values
stop matching if the page is restructured; that is the accepted ceiling in ADR-012, and part 5
lists them.

## Drift log

Record here anything built differently from this plan, and why.

* The browser check uses the scripted demo's Catalog limit card, which has multiple flex-column
  children and exposes both gap and padding handles. Its screenshots show the selected card,
  hovered gap, and live Alt-padding drag.
* Saved writes stay sequential, but inline-style cleanup no longer blocks the write queue. Vite
  can coalesce adjacent CSS updates, so waiting for each intermediate stylesheet state kept later
  values from being written. Each inline value is removed when the framed stylesheet catches up.
* Spacing readouts sit beside the selected card instead of over its content, and Alt highlights
  both affected padding bands. The existing radius browser check selects the window's Reset
  button by its accessible name because the inspector now contains additional spacing Reset buttons.
