# Story: check and commit a look

Status: draft, Nov 11 2026. Not yet confirmed by Ethan. Ticket:
[ETH-112](check-and-commit-impl-ETH-112.md).

**As** a designer who has finished tuning,
**I want** one button that checks the look and commits it,
**so that** a design session ends in a clean commit without my leaving the Workbench.

## Where the rules come from

PRD section 8: "Saving is automatic. Committing is a button." Section 6: the Workbench may
commit the override file only, and refuses if anything else is staged.

## Acceptance criteria

1. A **Check and commit** button is enabled when the override file differs from the last
   commit, and disabled when it does not.
2. Pressing it shows the value diff: each changed value with its element or token, its value
   in the last commit and its value now. Added and removed values are marked as such.
3. It then runs the type check and the tests, and shows which one is running.
4. If a check fails, nothing is committed. The Workbench names the check that failed and shows
   the end of its output.
5. If any file other than the override file is staged, it refuses before running anything and
   lists those files.
6. The commit holds the override file and nothing else. Unstaged changes to other files are
   left exactly as they were.
7. The commit message is written from the change list and follows the repo's commit rules. It
   is shown before the commit is made.
8. After the commit, the Workbench shows the commit's short hash, the button is disabled, and
   the undo history is cleared.
9. A run can be cancelled while the checks are running. Nothing is committed.
10. None of this exists in a production build.

## Not in this story

- Pushing. A commit made here stays local until Ethan or an agent pushes it.
- Editing the commit message in the Workbench.
- Screenshots in the commit. The canvas already shows the state.
- Committing `fonts.css` (ADR-021). The font picker ticket, ETH-106, adds it to what may be
  committed.
