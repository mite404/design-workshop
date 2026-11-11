# Story: undo, redo and discard

Status: draft, Nov 11 2026. Not yet confirmed by Ethan. Ticket:
[ETH-111](edit-history-impl-ETH-111.md).

**As** a designer tuning a look by eye,
**I want** to step back and forward through my changes and throw a session away,
**so that** I can try a value without worrying about how to get the old one back.

## Where the rules come from

PRD section 8: "Undo and redo step through edits since the last commit. Discard restores the
override file from git." Shortcuts follow Figma (ADR-009).

## Acceptance criteria

### Undo and redo

1. Cmd+Z (Ctrl+Z on other systems) undoes the last saved change. Shift+Cmd+Z, and Ctrl+Y, redo
   it. Undo and Redo buttons in the Workbench do the same, and each is disabled when it has
   nothing to step.
2. One step is one release. A drag, a typed value, a reset, and an Alt-drag that changed
   several sides are each a single step, however many values they wrote.
3. An undo or redo is written to the override file, the app hot reloads, and the inspector,
   handles and outline show the restored value.
4. Undoing the first change to a value removes it from the override file. After undoing every
   step, the file is byte for byte what it was before the first one.
5. A new change after an undo clears the redo steps.
6. While a text field has focus the shortcuts act on the field's own text, not on the history.
7. If the override file no longer holds the value the step expects, the step is refused with a
   message and the history is left as it was. Nothing is overwritten.
8. The history survives a page reload. It is cleared by a commit and by a discard.

### Discard

9. Discard asks once, then restores the override file to what the last commit holds. The app
   hot reloads and the history is cleared.
10. Discard is disabled when the override file already matches the last commit.

### Everywhere

11. After any of these, `git status` shows at most the override file as modified.
12. None of this exists in a production build.

## Not in this story

- A visible list of history steps to jump between.
- Undo across commits. A commit is undone with git.
- Undo of anything but saved values: selection, panel state, the tool in use.
