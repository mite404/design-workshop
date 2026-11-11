# Story: change the window's corner radius

Status: confirmed by Ethan, Nov 11 2026. Ticket:
[ETH-101](corner-radius-impl-ETH-101.md).

**As** a designer working on the Template,
**I want** to change the window's corner radius directly, the way I would in Figma,
**so that** I can judge the corner by eye instead of describing it to an agent.

## Acceptance criteria

### One value, three inputs

1. The radius can be changed by typing in the inspector field, by dragging the "Corner radius"
   label, or by dragging a handle inside the window's corner.
2. All three change the same value. Whichever one is used, the other two and the window's
   corners show the new value at once.
3. The value stays between 0 and half the window's shorter side.

### Inspector field (right-hand panel)

4. Arrow keys change the value by 1, and by 10 with Shift.
5. Input that is not a number in range is rejected and the last good value stays.

### Label scrub

6. Hovering the label shows a horizontal resize cursor. Dragging right raises the value, left
   lowers it.

### Canvas handle

7. When the window is selected, a round handle appears inside each corner. Dragging towards the
   centre raises the radius; all four corners move together.
8. A label by the pointer shows the value during the drag.

### Saving, for every input

9. The corners update live during a change. On release, Enter, or blur, the value is written to
   the override file and the app hot reloads.
10. Escape during a drag restores the value from before the drag.
11. After a change, `git status` shows only the override file as modified.
12. Reset removes the value from the override file and the baseline radius returns.
13. If the override file changed on disk since it was last read, the write is refused with a
    message.
14. None of this exists in a production build.

## Not in this story

Per-corner radii, handles or inspector fields for any other value, selecting other regions, undo,
Check and commit.
