---
linear: ETH-126
---
# Check a project file before loading it

## Status

- **Goal**: A file that does not fit this Template must be refused with reasons, before any change.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [project-files-story.md](project-files-story.md), feature 2

## Why this matters

A file that does not fit this Template must be refused with reasons, before any change. Story:
`docs/feature/project-files/project-files-story.md`, feature 2. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* The validator returns coded failures.

## Approach

* Choosing a file shows the validator's checklist and writes nothing. `workbench check-project`
  prints the same list.
* No agent, LLM or network call takes part in checking or accepting a project; the decision is the
  validator's output alone.

## Scope

* In: checklist UI and CLI.
* Out: applying values.

## Steps

* File input and checklist view.
* CLI verb.

## Test plan

* Fixtures: valid, wrong Storybook version, missing slot, missing story; UI and CLI give identical
  lists; override file unchanged.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
