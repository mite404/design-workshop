---
linear: ETH-122
---
# Define the project contract and its validator

## Status

- **Goal**: Project files cannot be accepted or refused consistently without one definition of a
  valid project.
- **Initial priority**: P2
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [project-contract-story.md](project-contract-story.md), feature 1

## Why this matters

Project files cannot be accepted or refused consistently without one definition of a valid project.
Story: `docs/feature/project-contract/project-contract-story.md`, feature 1. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* Storybook 10.6.0 is locked; index format 5; 93 stories (plan's audit).
* Shell slots `window`, `title-bar`, `sidebar` exist in `apps/web/src/shell`.

## Approach

* `packages/workbench/src/contract.json` holds the requirements; `contract.ts` exports a pure
  `validate(project, contract)` returning sorted `{ code, path, message }` failures.
* JSON, not YAML: native parser, no dependency (plan decision 2).
* Storybook version is matched by exact string equality against `10.6.0`.
* No agent, LLM or network call takes part in checking or accepting a project; the decision is the
  validator's output alone.

## Scope

* In: contract data, validator, unit tests.
* Out: generating a manifest, files, UI.

## Steps

* Write the contract data.
* Write the validator with one code per failure kind.
* Pin the catalog's Storybook packages to exactly 10.6.0.

## Test plan

* Unit: a valid manifest gives []; each of malformed JSON, version 10.6.7, missing slot, missing
  component, component without story and unknown surface gives its own code; output is identical
  across two runs.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
