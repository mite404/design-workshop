---
linear: ETH-130
---
# Draw the line chart with bklit and remove Recharts

## Status

- **Goal**: One chart library, one way to draw a chart.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [bklit-charts-story.md](bklit-charts-story.md), feature 3

## Why this matters

One chart library, one way to draw a chart. Story:
`docs/done/bklit-charts/bklit-charts-story.md`, feature 3. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* Bar cards on bklit after the previous ticket.

## Approach

* Install `line-chart` (adds `d3-shape`), swap the line branch and `interactiveParts.tsx`, then
  delete `recharts`.

## Scope

* In: line cards, dependency removal.
* Out: new chart kinds.

## Steps

* Install.
* Swap.
* Remove the dependency.
* Re-measure.

## Test plan

* `rg recharts` finds nothing outside history; stories and browser checks pass; bundle measured
  without it.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log

* bklit's line chart is time-only, so line rows gained a `date` (Ethan chose this, option 2,
  with a fork as fallback). Gaps needed a two-line patch (ADR-035).
* The slider card needed a fixed value axis bklit lacks: a marked `valueDomainMax` patch, and a
  CSS ease in place of Recharts' animation (ADR-036).
