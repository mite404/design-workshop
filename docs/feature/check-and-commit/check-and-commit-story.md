# Story: check and commit a look

Status: draft 3, Nov 11 2026, confirmed by Ethan. Criteria 1 to 10 are built (ETH-112). Ethan
changed criteria 2 and 7 on Nov 11 (ADR-026) and the build has not caught up. Tickets:
[ETH-112](check-and-commit-impl-ETH-112.md), built, and
[ETH-117](check-and-commit-impl-ETH-117.md), planned.

**As** a designer who has finished tuning,
**I want** one button that checks the look and commits it,
**so that** a design session ends in a clean commit without my leaving the Workbench or reading
values.

## Where the rules come from

PRD section 8: "Saving is automatic. Committing is a button." Section 6: the Workbench may
commit the override file only, and refuses if anything else is staged. ADR-026: the press is
the decision, and it accepts everything on the canvas. ADR-020: no stored baseline of the look.

## Acceptance criteria

1. A **Check and commit** button is enabled when the override file differs from the last
   commit, and disabled when it does not.
2. Pressing it is the decision. The checks start at once. No value diff and no list of
   changes is shown, and no second press is asked for. (Changed Nov 11, ADR-026. As built,
   a dialog shows the diff and waits for a second press.)
3. It runs the type check and the tests, and shows which one is running.
4. If a check fails, nothing is committed. The Workbench names the check that failed and shows
   the end of its output.
5. If any file other than the override file is staged, it refuses before running anything and
   lists those files.
6. The commit holds the override file and nothing else. Unstaged changes to other files are
   left exactly as they were.
7. The commit message is written from the change list and follows the repo's commit rules. It
   is not shown in the Workbench. (Changed Nov 11, ADR-026. As built, it is shown before the
   commit.)
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
- A list of what changed, edited or not. The press accepts everything on the canvas (ADR-026).
- Checking screens, states and stories that are not on the canvas. That is an open question in
  PRD section 14.

## Tickets

1. [ETH-112](check-and-commit-impl-ETH-112.md) - built. Criteria 1 to 10 as first written.
2. [ETH-117](check-and-commit-impl-ETH-117.md) - planned. The single press.
   Criteria 2 and 7 as changed.
