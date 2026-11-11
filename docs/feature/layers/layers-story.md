# Story: find and select components in the drawer's component tree

Status: draft 2, Nov 11 2026. The decisions are Ethan's (ADR-023, ADR-025). The criteria are
not yet confirmed by him. Ticket: [ETH-114](layers-impl-ETH-114.md).

**As** a designer working on a dense screen,
**I want** a list of the components on the canvas, named as they are in code, in the app's own
side drawer,
**so that** I can see how the screen is put together and pick a component to work on.

## Where the rules come from

PRD section 4, "Component tree in the side drawer", and R4. ADR-023: a component's root
carries its name as it is in code. ADR-025: one tree, in the Template's side drawer, in place
of the left Layers panel earlier drafts had.

## Acceptance criteria

### Names

1. Every component in the catalog carries its name on its root element, spelled as it is in
   code.
2. The name is in source, so it is in a production build too. It changes nothing a user sees.

### The tree

3. While the app runs inside the Workbench, the side drawer lists what is on the canvas as a
   tree, in place of the thread list. Rows are nested as the elements are in the page and
   labelled by name. A named element is a component's root or a named part of a component.
4. The drawer looks as it does today. Only what it lists changes.
5. The tree lists only what is rendered. It updates when the app navigates, when the mode
   changes, and when a hot reload changes the page.
6. Each instance of a repeated component is its own row.
7. The tree does not list the drawer or itself.
8. An element with no name stays selectable on the canvas. It is not listed.
9. Outside the Workbench the drawer lists threads, as today.

### Selecting

10. Clicking a row selects its element exactly as clicking it on the canvas does: the
    outline, the handles and the inspector follow.
11. Selecting on the canvas marks the selected element's row, or its nearest named
    ancestor's, and scrolls it into view. A closed drawer stays closed.
12. Hovering a row outlines its element on the canvas.
13. The tree works from the keyboard: Up and Down move, Right and Left open and close, Enter
    selects.

### Everywhere

14. The tree does not exist in a production build. The names do (criterion 2).

## Differences from Figma

- Figma lists every layer. This tree lists named elements only.
- Figma's layers panel belongs to the editor. This tree is drawn by the app being designed,
  in its own drawer.

## Not in this story

- Opening a component in Component mode from its row. That is the
  [component-stories story](../component-stories/component-stories-story.md), which adds it
  to the click in criterion 10.
- A Layers panel in the Workbench beside the canvas (ADR-025).
- The Assets list: components, colours, type styles, looks (PRD R15, R16).
- Renaming, reordering, hiding or locking a row. Those change source (ADR-001).
