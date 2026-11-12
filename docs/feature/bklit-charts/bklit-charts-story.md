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

## 2. The bar chart on bklit

**As** a designer reading a card,
**I want** the bar chart to look like the rest of the Workbench's charts and stay quick,
**so that** cards feel native and the thread does not stall while they draw.

1. `bar-chart` is installed from bklit's registry into the catalog with its dependencies.
2. Bar cards keep their data, labels, tooltip, data table and design-value colours, light and
   dark, and still pass their stories and browser checks.
3. The measures from feature 1 are no worse, and the result is reported with them.

## 3. The line chart on bklit, and Recharts removed

**As** the next engineer,
**I want** one chart library,
**so that** there is one way to draw a chart.

1. Line cards move to bklit's `line-chart` with the same checks as feature 2.
2. `recharts` leaves every `package.json` and the lockfile.
3. The bundle no longer contains Recharts, measured.
