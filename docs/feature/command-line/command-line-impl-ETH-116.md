---
linear: ETH-116
---
# Add the Workbench command line

## Status

- **Goal**: `list`, `set`, `unset` and `check` commands that go through the same rules as the
  Workbench's write route.
- **Initial priority**: P3
- **Effort**: Small
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `04cb7ad`, 2026-11-11
- **Story**: [command-line-story.md](command-line-story.md).

## Why this matters

PRD section 7 and building block 3. The structure lane is an agent's, and an agent has no
browser handle to drag. Without commands it edits the override file by hand, which skips the
rules about what may be written. "AC 3" below means criterion 3 in `command-line-story.md`.

## Current state

* `packages/workbench/src/plugin.ts` exports `readValues` and `writeValue`. `writeValue`
  checks the request's origin, validates the selector, name and value, checks the value last
  read, and writes through a temp file and a rename.
* The validation sits inside the HTTP handling, so nothing else can call it.
* There is no command, and the package has no `bin`.

## Approach

Move the validation and the write out from under the origin check into one function that both
the route and the commands call. Then the two cannot drift: a new editable name is added in
one place. The commands read and write the file directly.

Rejected: commands that call the dev server over HTTP. They would fail when no server is
running, which is when an agent most often works. Rejected: an argument-parsing dependency for
four verbs. `check` here means the override file is valid; running the type check and tests
belongs to Check and commit.

## Scope

* In: `packages/workbench`: the shared write function, a command file, a `workbench` script in
  the root `package.json`, and their tests.
* Out: a `commit` command, unmatched-value reporting, and the agent skill file. The story
  excludes them.

## Steps

* Split `writeValue` so the origin check stays in the route and the rest is callable (AC 3).
  The route's behaviour and tests do not change.
* Add `list`, with `--json` (AC 1).
* Add `set` and `unset`. They read the current value themselves and pass it as the value last
  read (AC 2, 3).
* Add `check`: parse the file and validate every block and value against the same rules
  (AC 4).
* Add the root script so `pnpm workbench <verb>` runs it.

## Test plan

* A test runs each verb against a temporary override file: `set` then `list --json` shows the
  value; `unset` returns the file byte for byte; a name that is not editable and a value that
  is not allowed each exit non-zero and leave the file untouched; `check` fails on a file with
  a hand-edited line and names the line.
* With the dev server running, set the corner radius from the command line and confirm in a
  browser that the app shows it (AC 6).
* With the Workbench open, set a value from the command line, then change the same value in
  the Workbench, and confirm the stale message (AC 7).

## Done when

* The test passes and the two manual checks are reported.
* The route's existing tests pass unchanged.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: LOW. It is a refactor of one function plus a thin shell over it. Assumption to confirm
with Ethan: the PRD's "check" is read here as checking the override file, not as running the
type check and tests.

Build it in its own thread with poteto-mode. Linear owns status; no GitHub issue or PR under repo
policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
