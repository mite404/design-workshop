# Story: draw the catalog's charts with bklit instead of Recharts

Status: drafted Nov 12 2026 from PRD section 12 (charts come from bklit) and the
[portability plan](../../research/project-portability-plan.md), phase 4.

## What bklit is, checked Nov 12 2026

- A shadcn registry, not an npm package: `npm view @bklit/ui` is a 404. The PRD's
  `https://ui.bklit.com/r/{name}.json` now redirects (301) to `https://bklit.com/r/{name}.json`.
- `bar-chart` needs `motion`. `line-chart` and `area-chart` need `d3-shape` and `motion`, plus
  bklit registry parts such as `@bklit/chart-context`, `@bklit/grid` and `@bklit/x-axis`.
- Recharts today: `recharts@3.10.1`, in `CatalogCard.tsx` (a line chart and a bar chart) and
  `interactiveParts.tsx`. PRD section 15 records Recharts as part of the render cost behind two
  Storybook timeouts under CPU slowdown.

## 1. Measure the charts as they are

**As** the engineer replacing Recharts,
**I want** numbers for what the charts cost now,
**so that** the migration is judged by measurement, not taste.

1. Record the production bundle bytes the charts add (gzip), the time to render the Weekly
   brief's two cards, and the `Interactive Profit` story's render time under 4x CPU slowdown.
2. Each number has its command, run count and spread, saved with the plan.

### Baseline, Nov 12 2026 (Recharts 3.10.1, ETH-128)

Command: `node apps/web/scripts/chart-measure.mjs` with the dev server and Storybook running,
twice in run `verify-eth-128-base-20261112-102348`. Times are under 4x CPU slowdown, five runs
after one warm-up, as median (min to max).

| Measure | Run 1 | Run 2 |
| --- | --- | --- |
| Chart code the catalog imports, minified | 528,708 B | 528,708 B |
| Same, gzip | 124,543 B | 124,543 B |
| Weekly brief click to both charts drawn | 4013 ms (3642 to 4458) | 4124 ms (3815 to 4339) |
| Interactive Profit story to chart drawn | 3330 ms (3225 to 3622) | 3319 ms (3291 to 3524) |

Each run's median sits inside the other's range. The bytes bundle only the names the catalog
imports, React external, in production mode.

## 2. The bar chart on bklit

**As** a designer reading a card,
**I want** the bar chart to look like the rest of the Workbench's charts and stay quick,
**so that** cards feel native and the thread does not stall while they draw.

1. `bar-chart` is installed from bklit's registry into the catalog with its dependencies.
2. Bar cards keep their data, labels, tooltip, data table and design-value colours, light and
   dark, and still pass their stories and browser checks.
3. The measures from feature 1 are no worse, and the result is reported with them.

### Bar cards on bklit, Nov 12 2026 (ETH-129)

Same script, with "drawn" now meaning each `.chart` holds its SVG, so either library counts. One
run (`verify-eth-129-ab-20261112-111353`) on one dev server, alternating Recharts (HEAD's
`CatalogCard.tsx`) and bklit, two rounds of five runs each at 4x CPU slowdown.

| Measure | Recharts 1 | Recharts 2 | bklit 1 | bklit 2 |
| --- | --- | --- | --- | --- |
| Chart code, gzip | 125,149 B | 125,149 B | 212,447 B | 212,447 B |
| Weekly brief, median (range) | 4152 (3943-5065) | 4216 (3972-4287) | 3741 (3378-4207) | 4472 (3906-4618) |
| Interactive Profit, median (range) | 2963 (2939-3140) | 3059 (2894-3349) | 3381 (3205-4968) | 3204 (2867-3593) |

Bytes rise 70% while both libraries ship; bklit's bar parts are 93,197 B gzip alone, 73% of it
`motion`. Render times overlap run to run, so no change is measured. These are dev-server
timings and an isolated import bundle, not production numbers. Feature 2's "no worse" holds for
render time; bytes are judged once Recharts leaves (feature 3).

## 3. The line chart on bklit, and Recharts removed

**As** the next engineer,
**I want** one chart library,
**so that** there is one way to draw a chart.

1. Line cards move to bklit's `line-chart` with the same checks as feature 2.
2. `recharts` leaves every `package.json` and the lockfile.
3. The bundle no longer contains Recharts, measured.

### Line cards on bklit, Nov 12 2026 (ETH-130, first commit)

Criterion 1 done: line cards draw with bklit's `line-chart` (ADR-035). Rows carry their calendar
day; a missing value leaves a gap (checked: the missing-Wednesday story's line is two subpaths,
with no marker at Wednesday). Recharts remains for the slider card's `StopChart`, so criteria 2
and 3 wait for its move.

### Slider card on bklit and Recharts removed, Nov 12 2026 (ETH-130, second commit)

Criteria 2 and 3 done (ADR-036): `recharts` is gone from every `package.json` and the lockfile.
One `chart-measure.mjs` run (`verify-eth-130-measure-20261112-150838`, 5 runs at 4x CPU):

| Measure | Recharts only (ETH-129 run, round 1) | Both (ETH-129 run, round 1) | bklit only |
| --- | --- | --- | --- |
| Chart code, gzip | 125,149 B | 212,447 B | 121,472 B |
| Weekly brief, median (range) | 4152 (3943-5065) | 3741 (3378-4207) | 3096 (2916-3490) |
| Interactive Profit, median (range) | 2963 (2939-3140) | 3381 (3205-4968) | 3208 (2775-3265) |

Bytes are deterministic. The render times come from separate runs on separate dev servers, not
an alternating comparison (the earlier state needs `recharts` installed), so they show no
regression rather than a speedup. None of these are production numbers.
