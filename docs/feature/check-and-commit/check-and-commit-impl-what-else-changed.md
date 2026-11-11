# Make Check and commit one press, then list what else changed

## Status

- **Goal**: pressing Check and commit starts the checks at once, and before them the Workbench
  lists what moved or changed size on the screen besides the elements that were edited.
- **Initial priority**: P2
- **Effort**: Small for part A, Medium for part B
- **Risk**: LOW for part A, HIGH for part B
- **Category**: feature
- **Planned at**: commit `1fec9bc`, 2026-11-11
- **Linear**: no ticket yet. When one is made, rename this file to end in its identifier and
  add the `linear:` front matter the other tickets have.
- **Story**: [check-and-commit-story.md](check-and-commit-story.md). Part B needs ETH-114.

## Why this matters

PRD R9 and ADR-026. ETH-112 opens a "Review your look" dialog with the value diff and the
generated message, and waits for a second press. Ethan's feedback after using it: a designer
needs neither, and the review that matters is whether the change moved or broke something
else. "AC 12" below means criterion 12 in `check-and-commit-story.md`.

The work is in two parts. Part A is the single press (AC 2 and 7). Part B is the list of what
else changed (AC 11 to 19). Part A does not depend on part B and can land first. Part B's
criteria are a draft: do not build it until the story says Ethan confirmed them.

## Current state

* `reviewCommit` in `packages/workbench/src/page.ts` opens the dialog, posts to
  `/__workbench/commit/preview`, and renders the changes and the message. `runCommit` posts
  the reviewed `head` and `source` to `/__workbench/commit` when **Run checks and commit** is
  pressed, and reads the progress stream.
* `previewCommit` in `packages/workbench/src/commit.ts` reads the last commit's override file
  with `git show` to build the value diff. It returns the current text as `source`, and does
  not return the last commit's text.
* The app loads the override file as one Vite style element. `overrideSheet` in
  `packages/workbench/src/dom.ts` finds it, and `hasNativeTransform` already turns it off,
  reads a value and turns it back on in one step.
* No component carries `data-wb` until ETH-114 lands.
* The catalog's and the app's CSS declare transitions, so a value changed in the page animates
  unless that is stopped.
* `apps/web/scripts/commit-check.mjs` and `colour-check.mjs` press **Run checks and commit**
  and read the diff rows and the message from the dialog.

## Approach

Part A. Keep the dialog as the place for progress, a failed check's output, cancel and the
hooks note. Remove the diff, the message and the second button, and start the run when the
dialog opens. Preview is still called first, because the run needs its `head` and `source` to
refuse a file that changed under it. Rejected: moving progress into the toolbar, which
rebuilds cancel and the failure display for nothing the designer gains.

Part B. Compare inside the page that is already open. Preview also returns the last commit's
override text. Then, in one step with no paint between: stop transitions, record every
element's box, put the last commit's text in the override style element, record every box
again, and put the current text back. The DOM and the app's state do not change, so the
override file is the only difference between the two layouts.

Two pure functions do the rest. One takes two lists of boxes and returns what moved and what
changed size. The other drops the elements a changed selector matches and groups the rest by
their nearest `data-wb` ancestor.

Rejected: a hidden second frame running the last commit's file, which is another page load in
another state. Rejected: recording the boxes when the session starts, which is stale as soon
as the app navigates. Rejected: screenshots (ADR-026).

Known limit: a size the app sets from script, in a `ResizeObserver` for example, is not
recomputed inside one step, so it compares as unchanged.

## Scope

* In: `packages/workbench`: the dialog in `page.ts`, the preview in `commit.ts`, the two
  functions and their tests, the list and the two outlines on the canvas.
* In: the two browser checks that read the dialog.
* Out: other screens, other states and stories. The story excludes them.
* Out: what is committed, the git steps, hooks and cancellation. ETH-112 settled them.
* Out: detecting overflow, overlap or clipped text.

## Steps

Part A:

* Start the run from the press: call preview, then the commit route, with no button between
  (AC 2).
* Remove the diff rows, the message, its heading and the second button. Keep the hooks note,
  the status line and cancel (AC 3, 4, 7, 9).
* Change `commit-check.mjs` and `colour-check.mjs` to assert saved values from the override
  file and the commit instead of from the dialog.

Part B:

* Prove the swap first. In the browser, swap the text, measure and restore, then record a run
  on a scrolled thread and look at it: nothing may flash, scroll or animate (AC 18). If it
  cannot be made invisible, stop and say so.
* Return the last commit's override text from preview.
* Add the box diff with its half pixel threshold (AC 13).
* Add the grouping: edited elements dropped, the rest under their component or the page
  (AC 12).
* Run the comparison before the checks. With no rows, go straight on (AC 15). With rows, show
  them with **Commit** and **Back** and the line saying which screen was compared (AC 16, 17).
* Wire a row to scroll its component into view and draw both outlines (AC 14).

## Test plan

* Unit tests cover the box diff: moved only, resized only, and a difference under the
  threshold.
* Unit tests cover the grouping: an edited element is dropped, its unedited sibling is kept,
  an element in no component is under the page, and a token change drops nothing.
* One browser check. Add padding to a component so the one below it moves, press the button,
  and assert the list names the lower component with its distance and not the edited one.
  Press **Back** and assert nothing was committed. Then make an edit that moves nothing else
  and assert the checks start with no list.
* For part A, assert in `commit-check.mjs` that one press reaches the commit.
* Take screenshots of the list and the outlines in light and dark and look at them.

## Done when

* The unit tests and the browser checks pass.
* A press with nothing else changed commits with no further press, and `git show --stat` on
  that commit lists the override file only.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: LOW for part A, which removes interface and keeps every git step. HIGH for part B: the
swap has to be invisible and has to measure the same page twice, and transitions, scroll
positions and hot reload can each spoil it. That is why its first step is a proof.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
