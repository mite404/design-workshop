# Story: check and commit a look

Status: draft 2, Nov 11 2026. Criteria 1 to 10 are built (ETH-112). Ethan changed criteria 2
and 7 on Nov 11 (ADR-026) and the build has not caught up. Criteria 11 to 19 are a draft, not
yet confirmed by Ethan. Tickets: [ETH-112](check-and-commit-impl-ETH-112.md), built, and
[what else changed](check-and-commit-impl-what-else-changed.md), planned.

**As** a designer who has finished tuning,
**I want** one button that checks the look and commits it, and tells me what my changes did to
the things I did not edit,
**so that** a design session ends in a clean commit without my leaving the Workbench or reading
values.

## Where the rules come from

PRD section 8: "Saving is automatic. Committing is a button." Section 6: the Workbench may
commit the override file only, and refuses if anything else is staged. ADR-026: the press is
the decision, and the review is what else changed. ADR-020: no stored baseline of the look.

## Acceptance criteria

### Committing

1. A **Check and commit** button is enabled when the override file differs from the last
   commit, and disabled when it does not.
2. Pressing it is the decision. The checks start at once. No value diff is shown, and no
   second press is asked for unless criterion 16 applies. (Changed Nov 11, ADR-026. As built,
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

### What else changed (draft)

11. Before the type check and the tests, the Workbench lays out the screen in the canvas
    twice: with the last commit's values and with the values now. The page, its state, its
    theme and its width are the same both times.
12. An element counts as edited when a changed value is saved for it. Every other element that
    moved or changed size is listed under its component, named as in the component tree
    (ETH-114). An element in no component is listed under the page. A changed token edits no
    element, so everything it moves is listed.
13. Each row says what changed in pixels: how far the component moved and which way, or how
    much wider, narrower, taller or shorter it is. A difference under half a pixel is not a
    change.
14. Choosing a row scrolls its component into view and outlines it on the canvas, beside an
    outline of where it was.
15. If nothing else changed, the checks run and the commit is made with no further press.
16. If something else changed, the Workbench shows the list and waits. **Commit** goes on to
    the checks. **Back** returns to editing with nothing committed.
17. The list says what was compared: the one screen in the canvas. It does not speak for the
    rest of the app.
18. The comparison is not seen on the canvas: no flash, no moved scroll position, no
    animation.
19. Nothing is stored and nothing fails. There are no baseline files and no screenshots
    (ADR-020, ADR-026).

## Not in this story

- Pushing. A commit made here stays local until Ethan or an agent pushes it.
- Editing the commit message in the Workbench.
- Screenshots in the commit. The canvas already shows the state.
- Committing `fonts.css` (ADR-021). The font picker ticket, ETH-106, adds it to what may be
  committed.
- Other screens, other states and stories. Only the screen in the canvas is compared. A story
  can be compared the same way once the Workbench can load one (ETH-115 part B).
- Judging a change. The list does not say whether a move is a breakage. Overflow, overlap and
  clipped text are not detected.
- Changes that move nothing, such as colour, shadow and corner radius.
- A readout after each edit. The comparison runs once, when the button is pressed.

## Tickets

1. [ETH-112](check-and-commit-impl-ETH-112.md) - built. Criteria 1 to 10 as first written.
2. [What else changed](check-and-commit-impl-what-else-changed.md) - planned, no Linear ticket
   yet. Part A is criteria 2 and 7 as changed. Part B is criteria 11 to 19 and needs ETH-114
   for the component names.
