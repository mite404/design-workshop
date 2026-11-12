---
linear: ETH-124
---
# Describe this repo as a project manifest

## Status

- **Goal**: A manifest written by hand would drift from the Template it describes.
- **Initial priority**: P2
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [project-contract-story.md](project-contract-story.md), feature 3

## Why this matters

A manifest written by hand would drift from the Template it describes. Story:
`docs/done/project-contract/project-contract-story.md`, feature 3. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* The validator exists; the facts are in Storybook's index, the installed version, and the rendered
  page.

## Approach

* A `workbench manifest` command reads the installed Storybook version and `storybook index`, and
  the Workbench reads slots and `data-wb` names from the page. Both produce the same shape.

## Scope

* In: the command, its test.
* Out: export.

## Steps

* Read version and index.
* Read slots and names.
* Validate the result.

## Test plan

* This repo's manifest validates to []. In a scratch copy, deleting `ComposeBox.stories.tsx` gives
  the missing-story code.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
