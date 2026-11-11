---
linear: ETH-111
---
# Undo, redo and discard saved values

## Status

- **Goal**: every saved change can be stepped back and forward, and a session can be thrown
  away, through the one write path that already exists.
- **Initial priority**: P1
- **Effort**: Medium
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `04cb7ad`, 2026-11-11
- **Story**: [edit-history-story.md](edit-history-story.md). Follows ETH-104 through ETH-110,
  which have already landed. History covers their save paths too.

## Why this matters

PRD R8. Today a change can only be taken back by remembering the old number. Radius, spacing
and nudge each save on their own, and type and colour are next. A shared history added after
those would mean reopening each of them. "AC 4" below means criterion 4 in
`edit-history-story.md`.

## Current state

* `packages/workbench/src/page.ts` saves through one function, `write(selector, name, value)`,
  which posts to `/__workbench/values` with the value last read as `was`. `record` keeps the
  page's copy of the file in step.
* `packages/workbench/src/plugin.ts` refuses a write whose `was` is not on disk (409).
* There is no history, no discard, and no shortcut for either.

## Approach

The history is a list of steps kept by the page. A step is the values one release wrote, each
with its value before and after. Undo replays the "before" values through `write`, with the
"after" value as `was`; redo is the reverse. So an undo is an ordinary write: the endpoint's
validation and its stale check apply unchanged, and there is still one way a value reaches
disk. The list operations are pure functions in their own module.

Rejected: snapshots of the whole file per step. Restoring one would overwrite a value an agent
or the command line changed in between, which the stale check exists to prevent. Rejected: a
history on the server or in `git stash`. That is a second record of the look beside the
override file.

Discard is one more dev-only route. It writes the file as the last commit has it, through the
same temp file and rename, behind the same origin check. Rejected: `git checkout`, which also
touches the index.

## Scope

* In: `packages/workbench`: a history module and its test, the shortcuts and two buttons in
  `page.ts`, the discard route in `plugin.ts`, and their tests.
* Out: a visible list of steps. The story excludes it.
* Out: Check and commit. Its ticket clears the history when it commits.

## Steps

* Add the history module: push a step, undo, redo, clear. Pure functions over plain data.
* Record a step where each editor saves. Group the values of one release into one step (AC 2).
* Undo and redo replay a step through `write`. On a refusal, show the message and leave the
  history as it was (AC 7).
* Bind the shortcuts on the Workbench page and inside the canvas frame, skipping text fields
  (AC 1, 6). Add Undo, Redo and Discard buttons with disabled states.
* Keep the history in `sessionStorage` so it survives a reload (AC 8).
* Add the discard route and its confirmation (AC 9, 10).

## Test plan

* A unit test covers the history functions: a new step after an undo clears redo, and undoing
  every step returns the starting values.
* One browser test: drag the corner radius, Alt-drag a padding, nudge an element, then undo
  three times and assert the override file is byte for byte the starting file; redo three times
  and assert it matches the file after the nudge.
* The same test changes the file on disk between a change and its undo and asserts the refusal.
* Press Discard after two changes and assert `git status` is clean.
* Take a screenshot of the buttons in their enabled and disabled states and look at it.

## Done when

* The unit test and the browser test pass.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: LOW. No new write path, and the file format does not change. The one judgement call is
grouping: a release that writes several values must be one step, or a single Alt-drag takes
four undos.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Implementation started from `d8de2c1` on `origin/main`, not the planned `04cb7ad`.

* ETH-104 already landed. The dependency order above now reflects Ethan's revised order.
* Typography, Basics, element and root font picks, type-scale base, ratio and leading, resets,
  and unmatched-value deletion now save values too. History records at the shared write boundary,
  rather than adding recording to each editor. Element references do not save design values and
  remain outside history.
* One release can write several properties. The values endpoint now accepts an atomic batch using
  the same validation, stale checks, temporary file and rename as single-value writes. A late
  conflict refuses the whole release instead of leaving earlier properties partially undone.
* History keeps the deleted declaration's block and property positions. Replaying a reset restores
  file order as well as values, including a removed selector block. No file snapshot is restored.
* The values endpoint reports the current Git HEAD and whether the override file differs from HEAD.
  Session history is scoped to that commit, and writes refuse an outdated HEAD. Discard restores
  HEAD with `git show`, without touching the index. Copied font assets remain installed, as the
  story limits discard to saved values in the override file.
* Vite suppresses rapid file-change events. A directory watcher keeps Discard's status current
  after external edits and atomic replacements without depending on that throttle. Conflict
  messages now appear beside the history controls rather than below the inspector's fold.
* The browser lever extends the original radius, Alt-padding and nudge scenario with typography,
  grouped style changes and resets, fonts, scale settings, reload, shortcuts and text-field focus,
  redo branching, external conflicts, and confirmed or cancelled discard.
