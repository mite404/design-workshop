# Story: open a Storybook story in Component mode

Status: draft, Nov 11 2026. Not yet confirmed by Ethan. Ticket:
[ETH-115](component-stories-impl-ETH-115.md).

**As** a designer tuning one component,
**I want** to pick any story from a list and edit it in Component mode,
**so that** I can work on a component alone and see the same change in the shell.

## Where the rules come from

PRD section 4: in Component mode "the target is one Storybook story, framed at its own URL
instead of a second renderer. The story list comes from Storybook's index." The section
"Chat-history panel in Component mode" asks for the panel to list the stories. Ethan added
that the panel's look must not change.

## Acceptance criteria

### The list

1. In Component mode, the panel that shows chat history in Live mode lists the stories. It
   keeps Storybook's group, component and story hierarchy, with Storybook's labels and order.
2. The panel looks as it does today. Only what it lists changes.
3. Live mode still lists thread history.
4. Documentation pages in Storybook's index are not listed.

### The preview

5. Selecting a story shows that story in the component preview, served by Storybook.
6. Until a story is selected, the preview shows the shared chat it shows today.
7. The selected story survives a reload and a switch to Live mode and back.
8. If Storybook is not running, the panel says so and names the command that starts it.

### Editing

9. A story can be edited like the app: select an element, drag its gap and padding, nudge it,
   and every other editor that exists by then.
10. A saved value hot reloads in the story.
11. A value changed on a story shows in the Live shell, and a value changed in the shell shows
    in the story.
12. The story follows the Workbench's Light and Dark switch.

### Everywhere

13. None of this exists in a production build.

## Not in this story

- Storybook's controls, its addon panels and its search.
- Dragging a component from the list into the shell (PRD R15).
- Writing or changing stories. The Workbench never writes them (PRD section 6).
