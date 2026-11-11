# Story: tune spacing in a mockup by dragging

Status: confirmed by Ethan, Nov 11 2026. Tickets:
[ETH-102](spacing-impl-ETH-102.md) (select, gap, padding) and
[ETH-103](spacing-impl-ETH-103.md) (nudge).

**As** a designer tuning a mockup an agent has already built,
**I want** to drag the space between and around elements, the way I would in Figma's auto layout,
**so that** I can fix spacing by eye instead of asking the agent to redo the layout.

## Where the rules come from

Ethan's standing rule: when a behaviour is undecided, do what Figma does. Sources:

- Figma's engineers describe auto layout as "a thoughtful subset of flexbox", and its designer
  prototyped it in HTML first
  ([Figma blog, Nov 2020](https://www.figma.com/blog/behind-the-feature-the-making-of-the-new-auto-layout/)).
  So Figma's gap and padding are CSS `gap` and `padding`, which is what the Workbench writes.
- Handle behaviour, modifier keys and "ignore auto layout" are from the
  [Guide to auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma).

Three places where this story differs from Figma, all on purpose:

- Dragging snaps to 2px (Ethan's choice). Figma's default step is 1.
- Figma gives every layer an ID behind the scenes. Here the designer never tags anything:
  every element is editable on click. Identity is handled out of sight. Agents that build
  mockups give elements a `data-wb="<name>"` attribute as a house rule, and the Workbench uses
  it when present. Where it is missing, the Workbench falls back to a CSS selector generated
  from the element's position in the page. Known ceiling of the fallback: if an agent
  restructures the mockup, saved values for moved elements no longer match. They are reported,
  not silently dropped.
- A nudged element keeps its place in the layout, so its siblings do not move. In Figma, an
  element that ignores auto layout gives up its place and the siblings close the space.

## Acceptance criteria

### Selecting

1. Clicking any element in the mockup selects it and outlines it. No tagging or setup is
   needed. Clicking again selects the element under the pointer one level deeper; Escape selects
   the parent. Clicking empty space deselects.
2. Handles appear when the pointer is over the selected element. Gap and padding handles look
   and behave as they do in Figma's auto layout. Hovering or dragging a handle highlights the
   space it controls.

### Gap handle

3. If the selected element lays out its children with flex or grid, one handle sits in each
   space between two children. Dragging it along the layout direction changes the gap; all gaps
   in that element change together.

### Padding handles

4. One handle sits inside each of the four edges. Dragging one changes the padding on that side.
5. Holding Alt changes the opposite side too. Holding Alt and Shift changes all four sides.

### Nudge

6. Dragging the body of the selected element moves it. Its siblings stay where they are, and
   it cannot be dragged outside its parent's padding edge.
7. The inspector shows the offset as X and Y. Setting both to 0 puts the element back exactly
   where the layout placed it.

### Every drag

8. A drag changes the value in steps of 2px, or 10px with Shift. Gap and padding never go
   below 0.
9. A label by the pointer shows the value during the drag.
10. Clicking a handle without dragging opens a number field in place. Any whole number is
    accepted there, so odd values are typed, not dragged. Enter commits, Escape cancels.
11. With a handle focused, arrow keys change the value by 2, and by 10 with Shift. With the
    element selected and no handle focused, arrow keys nudge it. Every handle can be reached
    with Tab.
12. The inspector shows gap, the four paddings and the offset of the selected element as fields
    that follow criteria 4 and 5 of the
    [corner radius story](../corner-radius/corner-radius-story.md).

### Saving

13. The mockup updates live during a change. On release, Enter, or blur, the value is written to
    the override file and the app hot reloads.
14. Escape during a drag restores the value from before the drag.
15. After a change, `git status` shows only the override file as modified. The mockup's source is
    never rewritten.
16. Reset on a field removes that value from the override file and the mockup's own value returns.
17. If a saved value no longer matches any element, the Workbench lists it so it can be
    deleted or re-applied.
18. None of this exists in a production build.

## Not in this story

- Putting a nudged element "back into the flow". A nudge is a visual offset; turning it into
  padding, gap or alignment is a source change, which belongs to the fold-in step where an
  agent gets the exact list of values.
- Warning when a nudged element overlaps a sibling.
- Reordering children, resizing, alignment, "auto" gap (space-between), margins, undo.

## Effect on other tickets

ETH-100 (override file) must hold values per element selector, not only one `:root` block.
Amend it before it starts.
