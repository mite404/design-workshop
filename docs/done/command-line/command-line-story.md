# Story: list, set and check values from the command line

Status: draft, Nov 11 2026. Not yet confirmed by Ethan. Ticket:
[ETH-116](command-line-impl-ETH-116.md).

**As** an agent working on the Template's structure, or Ethan in a terminal,
**I want** the Workbench's operations as commands,
**so that** a value changed outside the browser obeys the same rules as one changed in it.

## Where the rules come from

PRD section 7: "The Workbench's operations (list values, set a value, check) are also a small
command line tool." Building block 3 names the command line beside the dev server plugin.

## Acceptance criteria

1. `pnpm workbench list` prints every value the Workbench may change: its selector, its name,
   its baseline and its saved value. `--json` prints the same as JSON.
2. `pnpm workbench set <selector> <name> <value>` saves one value. `pnpm workbench unset
   <selector> <name>` removes one.
3. `set` and `unset` accept and refuse exactly what the Workbench's own write accepts and
   refuses, with the same reasons. A refusal writes nothing and exits with a non-zero status.
4. `pnpm workbench check` reads the override file and exits with a non-zero status, naming the
   line, if the file is not in the Workbench's shape or holds a value the Workbench could not
   have written.
5. The commands work without a dev server running.
6. With a dev server running, a value set from the command line hot reloads in the app.
7. With the Workbench open, its next write to a value the command line changed is refused as
   stale. It never overwrites the command line's value unseen.
8. After any command, `git status` shows at most the override file as modified.

## Not in this story

- A `commit` command. Check and commit is a button first.
- Reporting saved values that match no element. That needs a browser.
- The skill file that tells an agent the rules (PRD building block 6).
