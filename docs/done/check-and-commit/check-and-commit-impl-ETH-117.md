---
linear: ETH-117
---
# Make Check and commit one press

## Status

- **Goal**: pressing Check and commit starts the checks at once, with no value diff, no commit
  message and no second press.
- **Initial priority**: P2
- **Effort**: Small
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `1fec9bc`, 2026-11-11
- **Story**: [check-and-commit-story.md](check-and-commit-story.md).

## Why this matters

PRD R9 and ADR-026. ETH-112 opens a "Review your look" dialog with the value diff and the
generated message, and waits for a second press. Ethan's feedback after using it: a designer
needs neither, because the press is the decision and it accepts everything on the canvas.
"AC 2" below means criterion 2 in `check-and-commit-story.md`.

## Current state

* `reviewCommit` in `packages/workbench/src/page.ts` opens the dialog, posts to
  `/__workbench/commit/preview`, and renders the changes and the message. `runCommit` posts
  the reviewed `head` and `source` to `/__workbench/commit` when **Run checks and commit** is
  pressed, and reads the progress stream.
* `previewCommit` in `packages/workbench/src/commit.ts` builds the value diff and returns the
  current text as `source`.
* `apps/web/scripts/commit-check.mjs` and `colour-check.mjs` press **Run checks and commit**
  and read the diff rows and the message from the dialog.

## Approach

Keep the dialog as the place for progress, a failed check's output, cancel and the hooks note.
Remove the diff, the message and the second button, and start the run when the dialog opens.
Preview is still called first, because the run needs its `head` and `source` to refuse a file
that changed under it. Rejected: moving progress into the toolbar, which rebuilds cancel and
the failure display for nothing the designer gains.

## Scope

* In: `packages/workbench`: the dialog in `page.ts`.
* In: the two browser checks that read the dialog.
* Out: any list of what changed, edited or not (ADR-026).
* Out: what is committed, the git steps, hooks and cancellation. ETH-112 settled them.

## Steps

* Start the run from the press: call preview, then the commit route, with no button between
  (AC 2).
* Remove the diff rows, the message, its heading and the second button. Keep the hooks note,
  the status line and cancel (AC 3, 4, 7, 9).
* Change `commit-check.mjs` and `colour-check.mjs` to assert saved values from the override
  file and the commit instead of from the dialog.

## Test plan

* Assert in `commit-check.mjs` that one press reaches the commit.
* Assert a failed check still shows its output, and cancel still commits nothing.
* Take screenshots of the dialog while running, failed and done, in light and dark, and look
  at them.

## Done when

* The browser checks pass.
* One press commits, and `git show --stat` on that commit lists the override file only.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: LOW. It removes interface and keeps every git step.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.

- Removed the review-only rules in `page.css` as well as their elements in `page.ts`, so the
  deleted interface leaves no unused styling behind.
- Disabled Close and Escape only while preview reads the snapshot. Otherwise the dialog could
  close during that request and start checks invisibly when it returns. Cancel checks and the
  server's cancellation behavior are unchanged once the run starts.
- Kept the colour script's existing on-disk light/dark assertions. The real commit check reads
  its saved radius from Git instead of reading a value diff or generated message in the dialog.
- Light/dark captures show both canvas modes. The Workbench dialog itself has no dark theme;
  its existing styling stays unchanged.
- Implementation and review stayed in this thread, as requested. No implementation or review
  work was delegated. The specified design was already settled, so no competing prototypes
  were needed.
- Removed `tools` from the commit check's dependency-copy list. It is no longer a workspace
  directory, and a clean snapshot has no such directory. The first real-commit check failed
  with `ENOENT` before opening its browser; the list now matches `pnpm-workspace.yaml`.
- Follow-up: reproduced focus staying on the dialog after its button became enabled. Opening
  with Enter also showed the browser's heavy container ring. The dialog now has no outline,
  and Cancel checks or Close receives focus when enabled. Enter cancels and Space closes;
  Tab wraps inside. Close and Escape remain blocked while preview reads the snapshot.
- Follow-up direction from Ethan: matched the catalog Modal's default paper, border, 16px
  corners, shadow, blurred scrim, compact actions, muted focus cue and entrance. Kept the native
  Workbench dialog in the top layer, with commit-only CSS and reduced-motion support. Reusing
  React Modal would add React to the Workbench and couple its dialog to editable Template
  classes and tokens. No catalog classes or `data-wb` markers were added, so the dialog stays
  outside Template selection and style editing. Screenshots finish animations before capture.
- Follow-up: reproduced red commit and discard notices. All toolbar message callers now use
  one setter that resets the error state: success and progress inherit normal ink, while save,
  validation, font and discard failures stay red. Browser checks cover running focus, keyboard
  cancellation, success colours and the existing save-failure colour.
