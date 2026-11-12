---
linear: ETH-123
---
# Give every required component a story

## Status

- **Goal**: The contract requires a story per required component; the audit found ComposeBox,
  UserTurn and AgentTurn have none.
- **Initial priority**: P2
- **Effort**: Small
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [project-contract-story.md](project-contract-story.md), feature 2

## Why this matters

The contract requires a story per required component; the audit found ComposeBox, UserTurn and
AgentTurn have none. Story: `docs/feature/project-contract/project-contract-story.md`, feature 2.
Plan: `docs/research/project-portability-plan.md`.

## Current state

* Their only stories are inside ChatThreadPanel's, whose `componentPath` is `ChatThreadPanel.tsx`.

## Approach

* Add `ComposeBox.stories.tsx` and `Turns.stories.tsx` with `component` set, so Storybook's index
  gives the right `componentPath`.

## Scope

* In: two story files.
* Out: stories for non-required components.

## Steps

* Write the stories from existing fixtures.
* Regenerate the index and check it.

## Test plan

* `storybook index` lists entries whose `componentPath` ends in each file; `pnpm --filter storybook
  test` passes.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
