# History and commits

Undo and redo edit saved values, Discard restores committed values, and Check and commit checks
and saves a design in Git.

## Sub-features

- Undo, redo, redo truncation and grouped edits.
- Reload persistence, stale changes and Discard.
- Check failure, cancellation and an override-only commit.

## How to get to it (user POV)

Edit a value at `/__workbench/`, then use Undo, Redo, Discard or Check and commit in its toolbar.
Use the history script's keyboard cases as well as buttons when changing shortcuts.

## Driving it with the browser scripts

Preconditions: isolated snapshot with Git history and healthy dev server. Start with empty
overrides.

```sh
node apps/web/scripts/history-check.mjs --base http://localhost:5173 --out "$OUT/history"
node apps/web/scripts/commit-check.mjs --out "$OUT/commit"
```

Require the rendered value, saved file and enabled toolbar actions to agree after each history
transition. The commit script creates its own disposable repositories and server to check real Git
effects. Read its current assertions before making claims about check failures or hook behavior.

## Gotchas

Check and commit behavior is changing under ADR-026. Compare the script with the current approved
story; the PRD explicitly distinguishes planned single-press behavior from the existing build.
Never exercise commits in the user's working repository. No script result authorizes a push.
