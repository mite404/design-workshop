---
linear: ETH-129
---
# Draw the bar chart with bklit

## Status

- **Goal**: PRD section 12: charts come from bklit.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [bklit-charts-story.md](bklit-charts-story.md), feature 2

## Why this matters

PRD section 12: charts come from bklit. Story: `docs/feature/bklit-charts/bklit-charts-story.md`,
feature 2. Plan: `docs/research/project-portability-plan.md`.

## Current state

* bklit is a shadcn registry at `https://bklit.com/r/{name}.json`; `bar-chart` needs `motion`.

## Approach

* Install `bar-chart` through the registry into the catalog. Keep the card's data, tooltip, data
  table and colour design values.

## Scope

* In: bar cards.
* Out: line cards.

## Steps

* Install.
* Swap the bar branch.
* Re-measure.

## Test plan

* Bar card stories and browser checks pass, light and dark; measures no worse.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
