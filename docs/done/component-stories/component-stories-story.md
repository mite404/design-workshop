# Story: work on one component in Component mode

Status: confirmed by Ethan, Nov 11 2026 (draft 2). The decisions are his (ADR-023, ADR-024,
ADR-025). Tickets: [ETH-115](component-stories-impl-ETH-115.md) for criteria 1 to 12, and
[ETH-118](component-stories-impl-ETH-118.md) for the stories in criteria 13 to 19.

**As** a designer tuning one component,
**I want** to open it from the component tree and edit it where it sits in the app,
**so that** I can work on the component itself, see where it lives, and have every instance
follow.

## Where the rules come from

PRD section 4. ADR-023: an edit in Component mode is saved under the component's name and
reaches every instance. ADR-024: Component mode is a view into the running app, and a
Storybook story is the target only for what the app is not showing. ADR-025: the tree is in
the app's side drawer. Ethan added that the drawer's look must not change.

## Acceptance criteria

### Opening a component that is on screen

1. Clicking a row in the component tree selects its element and opens the component it
   belongs to in Component mode. A row that belongs to no component only selects.
2. The running app stays in the preview. Nothing reloads, and scroll position, open panels
   and the mock conversation are kept.
3. The component is brought into view. What surrounds it fades to nothing over a short
   distance, so a little of its neighbours still shows. The drawer stays fully visible.
4. Only the component and what is inside it can be selected.
5. Switching to Live mode removes the fade and the limit on selection. Nothing else changes.
6. The open component survives a reload and a switch to Live mode and back. If it is no
   longer on the page, Component mode says so.
7. Until a component is opened, Component mode shows the shared chat it shows today.

### How far an edit reaches

8. An edit made in Component mode is saved under the name of the nearest component around
   the selection and the path inside it. Every instance of that component changes at once,
   on the canvas, elsewhere in the shell, and in stories.
9. Everything inside the component's border can be edited, its own padding included. The
   component itself cannot be nudged, and the space around it cannot be changed.
10. An edit made in Live mode changes the one element selected, as today, and wins over the
    component's value for that element.
11. The inspector says how far the edit reaches: every instance of the named component, or
    this one element.
12. A saved value whose path matches nothing in some state of a component is listed, not
    dropped (ADR-012).

### Stories, for what the app is not showing

13. In Component mode the drawer also lists Storybook's stories, below the components on the
    canvas. It keeps Storybook's group, component and story hierarchy, labels and order.
    Documentation pages are not listed.
14. Selecting a story shows it in the preview, served by Storybook, with the drawer still in
    place. A story has no surroundings, so nothing fades.
15. In a story, only named components and what is inside them can be selected. An edit is
    saved as in criterion 8, so it reaches the shell.
16. A saved value hot reloads in the story.
17. The story follows the Workbench's Light and Dark switch.
18. The selected story survives a reload and a switch to Live mode and back.
19. If Storybook is not running, the drawer says so and names the command that starts it.
    Opening a component that is on screen still works.

### Everywhere

20. The drawer looks as it does today. Only what it lists changes.
21. Every handle and every row works from the keyboard (PRD R11).
22. None of this exists in a production build.

## Differences from Figma

- Figma opens a main component on its own page. Here the component stays where it is in the
  app, with its surroundings faded.
- Figma keeps an instance's overrides per property. Here an instance's value is a more
  specific CSS rule than the component's, so it wins.

## Not in this story

- A "Push to live" button. Both modes save under the same name, so there is nothing to push
  (ADR-023).
- Changing one instance from inside Component mode. That is a Live mode edit.
- A shape creator, or any way to draw a new component (ADR-008).
- Storybook's controls, its addon panels and its search.
- Dragging a component from the list into the shell (PRD R15).
- Writing or changing stories. The Workbench never writes them (PRD section 6).
