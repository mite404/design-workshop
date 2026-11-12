---
linear: ETH-127
---
# Load a checked project file

## Status

- **Goal**: Loading is the last step of starting a project from an old look.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [project-files-story.md](project-files-story.md), feature 3

## Why this matters

Loading is the last step of starting a project from an old look. Story:
`docs/feature/project-files/project-files-story.md`, feature 3. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* A checked file is shown with its checklist.

## Approach

* Load is enabled only when the checklist is empty. It replaces the override values through the save
  path as one history step. Unmatched selectors are listed (ADR-012).

## Scope

* In: load.
* Out: merging two looks.

## Steps

* Enable on pass.
* Write as one step.
* Report unmatched.

## Test plan

* Browser: load a valid file, canvas shows it, undo restores; an invalid file cannot be loaded.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
