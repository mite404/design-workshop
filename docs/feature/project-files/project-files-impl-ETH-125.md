---
linear: ETH-125
---
# Export a project file

## Status

- **Goal**: PRD section 11: start the next project from a previous look in minutes.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [project-files-story.md](project-files-story.md), feature 1

## Why this matters

PRD section 11: start the next project from a previous look in minutes. Story:
`docs/feature/project-files/project-files-story.md`, feature 1. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* The manifest and validator exist; the override file is the look.

## Approach

* One JSON file: format, format version, manifest, override values. Workbench download plus
  `workbench export`. Writes nothing in the repo.

## Scope

* In: export.
* Out: loading.

## Steps

* Assemble and validate before writing.
* Workbench control and CLI verb.

## Test plan

* Exported file validates to []; repo `git status` unchanged.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
