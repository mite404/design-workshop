---
linear: ETH-128
---
# Measure the charts as they are

## Status

- **Goal**: The migration must be judged by numbers (PRD section 15 names Recharts in a render
  slowdown).
- **Initial priority**: P3
- **Effort**: Small
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [bklit-charts-story.md](bklit-charts-story.md), feature 1

## Why this matters

The migration must be judged by numbers (PRD section 15 names Recharts in a render slowdown). Story:
`docs/done/bklit-charts/bklit-charts-story.md`, feature 1. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* `recharts@3.10.1` in `CatalogCard.tsx` and `interactiveParts.tsx`.

## Approach

* Measure gzip bytes of the chart code in a production build, the two Weekly brief cards' render
  time, and the Interactive Profit story under 4x CPU slowdown, five runs each, with spread.

## Scope

* In: a repeatable measuring script and the baseline.
* Out: any migration.

## Steps

* Write the script.
* Record the baseline in the story.

## Test plan

* The script's two runs agree within the recorded spread.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
