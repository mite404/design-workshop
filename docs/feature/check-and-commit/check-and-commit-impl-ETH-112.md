---
linear: ETH-112
---
# Check and commit the override file

## Status

- **Goal**: one button shows the value diff, runs the type check and tests, and commits the
  override file alone.
- **Initial priority**: P1
- **Effort**: Medium
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `04cb7ad`, 2026-11-11
- **Story**: [check-and-commit-story.md](check-and-commit-story.md). Needs ETH-108 and ETH-111.

## Why this matters

PRD R9 and building block 5. A session today ends in a terminal: the designer has to know
which file changed and commit it by hand. The PRD's second success measure, that every commit
the Workbench makes touches the override file only, has nothing enforcing it. "AC 5" below
means criterion 5 in `check-and-commit-story.md`.

## Current state

* `packages/workbench/src/plugin.ts` serves the page and one read and write route. It never
  runs git.
* `packages/workbench/src/overrides.ts` parses the override file into values by selector.
* `pnpm typecheck` and `pnpm test` are the repo's checks. Until ETH-108 lands, some tests fail
  on any saved look, so this button would never pass.

## Approach

One more dev-only route, behind the same origin check as the write route. In order: refuse if
`git diff --cached --name-only` lists anything but the override file; compute the value diff;
run `pnpm typecheck`, then `pnpm test`; commit with `git commit --only` on the override file.

The value diff is a pure function over two parsed files, the last commit's and the one on
disk. It feeds both the diff the designer sees and the commit message, so the two cannot
disagree. Rejected: showing `git diff` text, which is in CSS terms and is not what the
inspector calls things.

Lint, format and Fallow are left to CI on push (ADR-022). The Workbench writes only values in
a fixed shape, which none of those three can fail on. Rejected: running every check here, which
makes the button slower for no finding it could produce.

## Scope

* In: `packages/workbench`: the diff function, the message function, the commit route, the
  button with its progress and result, and their tests.
* Out: pushing. The story excludes it. ADR-017 is about what an agent ships, and a push from a
  design tool is a separate decision for Ethan.
* Out: `fonts.css`. ETH-106 extends the list of files that may be committed.
* Out: a `commit` verb on the command line.

## Steps

* Add the value diff: two override file texts in, a list of added, changed and removed values
  out.
* Add the message function: a `style:` subject within 50 characters and one bullet per value,
  wrapped at 72.
* Add the route. Refuse on other staged files and name them (AC 5). Stream which check is
  running. Stop at the first failure and return the end of its output (AC 4).
* Commit with `--only` so staged and unstaged work elsewhere is untouched (AC 6).
* Add the button, the diff view, the progress line, cancel, and the result with the short hash
  (AC 1 to 3, 7 to 9). Clear the undo history on success.

## Test plan

* Unit tests cover the diff and the message, including a value removed and a subject that has
  to be shortened.
* An integration test runs the route's git steps in a temporary repository: a clean run
  commits only the override file; another staged file is refused and stays staged; an unstaged
  edit to another file survives; a failing check commits nothing. The checks are stubbed here.
* One browser run against the real repo: change the corner radius, press the button, and read
  the resulting commit with `git show --stat`. Reset that commit afterwards.
* Take a screenshot of the diff view and of a failed check and look at them.

## Done when

* The unit, integration and browser checks pass.
* `git show --stat` on a Workbench commit lists the override file only.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: MEDIUM. This is the first place the Workbench runs git, and a mistake stages or commits
someone else's work. The full test run is slow and memory-hungry on a small machine
(ADR-022), so the progress line and cancel are part of the feature, not polish.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
