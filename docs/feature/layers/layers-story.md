# Story: find and select regions in a Layers panel

Status: draft, Nov 11 2026. Not yet confirmed by Ethan. Ticket:
[ETH-114](layers-impl-ETH-114.md).

**As** a designer working on a dense screen,
**I want** a list of the named regions on the canvas, laid out like Figma's layers,
**so that** I can see the structure and select something that is awkward to click.

## Where the rules come from

PRD section 4: Layers on the left, the canvas in the centre, the inspector on the right. PRD
R4: the Layers panel lists the named regions on the canvas; click a layer or the canvas to
select.

## Acceptance criteria

1. The Workbench has three panels: Layers on the left, the canvas in the centre, the inspector
   on the right.
2. Layers lists the named regions of what is on the canvas as a tree, nested as they are in
   the page and labelled by name. A named region is an element an agent tagged for the
   Workbench or a named part of a component.
3. Clicking a layer selects its element exactly as clicking it on the canvas does: the
   outline, the handles and the inspector follow.
4. Selecting on the canvas marks the selected element's layer, or its nearest named ancestor's,
   and scrolls it into view.
5. Hovering a layer outlines its element on the canvas.
6. The tree works from the keyboard: Up and Down move, Right and Left open and close, Enter
   selects.
7. The list follows the canvas. It updates when the app navigates, when the mode changes, and
   when a hot reload changes the page.
8. An element with no name stays selectable on the canvas. It is not listed.
9. None of this exists in a production build.

## Not in this story

- The Assets tab: components, colours, type styles, looks (PRD R15, R16).
- Renaming, reordering, hiding or locking a layer. Those change source (ADR-001).
- Resizing or collapsing the panels.
