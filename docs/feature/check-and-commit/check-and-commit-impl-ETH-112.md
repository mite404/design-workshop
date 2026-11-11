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

- Rebased the implementation on `45c22d6`. ETH-104 through ETH-111 already landed.
  The plugin now serves fonts, batched saves, discard, and HEAD-aware history as well as values.
  It already runs Git to read HEAD and restore the override file for discard; this ticket adds
  its first Git write.
  Commit success broadcasts the existing values event and refreshes HEAD, which clears ETH-111's
  undo and redo history in session storage. No second history-clearing mechanism was added.
- ETH-108 already lets saved design values pass tests. The button runs the current root
  `pnpm typecheck` and `pnpm test` commands, including their existing concurrency limit.
- ETH-106 installs fonts and writes `fonts.css` and font assets, but did not add a commit route.
  This ticket remains override-only. Staged font files are refused like any other staged file;
  unstaged font files are left alone. Extending the commit allowlist needs a separate decision.
- Review is a native dialog with an explicit **Run checks and commit** action. The value diff
  and generated message appear before checks run. Preview, streamed run, and cancellation use
  three same-origin POST endpoints rather than one endpoint.
  Canvas keyboard shortcuts are suspended while the dialog is open so Escape belongs to the dialog.
- The run keeps a write lock, rejects concurrent runs, and verifies HEAD, the override snapshot,
  and the staged-file allowlist again after checks. Other Workbench writes are refused until the
  run finishes. Cancellation kills the check's process group and waits for its exit. The browser
  waits for the server's cancellation result instead of assuming an aborted request did not commit.
- The ordinary browser lever never creates commits. It checks the real preview and HTTP refusals
  and uses a synthetic failed-check response to verify output display. The explicit `--commit`
  mode creates a disposable clone containing the current source, copied dependencies, and existing
  Turbo cache, removes its origin remote, and starts its own server on a free port. Only that clone
  can make the test commit. The clone is removed afterward; the working repository is never reset.
  Cancellation uses a held typecheck in the clone. The success pass restores the real scripts and
  waits up to 15 minutes for the terminal result, not transient check labels. Failure screenshots
  have their own bounded try/catch so they cannot replace the original error.
  The initial radius comes from the values endpoint instead of assuming a committed value of 12.
  Temporary-repository integration tests exercise real Git and failed child processes.
- The user confirmed that repository hooks must remain enabled, with post-commit verification
  and a visible dialog warning. Hooks may amend the message or take other actions, including
  pushing. Property-first message bullets survive `git interpret-trailers`
  without being mistaken for trailers; hooks may still append deliberate co-author trailers.
- The user confirmed that the Workbench commits locally and never pushes. Editing is independent
  of the remote's state, like working on a local branch. Live edits belong to the local checkout
  running in dev mode. This is a confirmed product decision, not an open assumption.
- Git commit runs asynchronously with a two-minute timeout for signing and hooks. A timeout or
  failure after Git starts tells the designer to inspect Git state rather than claiming cancel.
  After hooks finish, HEAD must have the reviewed parent, exactly the override file changed, and
  the reviewed override bytes. A mismatch is a loud error, even if a commit already exists.
  It is not rolled back automatically, and hook side effects cannot be undone by verification.
- Active process groups are killed on cancellation and catchable server exit. A regression test
  terminates a server process and checks that its check process is no longer running.
  POSIX group cleanup cannot contain descendants that start new sessions or survive an uncatchable
  SIGKILL of the server. Stronger isolation would require a process supervisor or cgroup.
- Cancellation's HTTP response acknowledges a request, not completion. The stream remains the
  source of truth. Same-origin tabs intentionally share the server's one active run and can cancel
  it; per-tab ownership was left out because this is a local development tool.
