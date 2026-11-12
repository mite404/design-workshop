---
linear: ETH-133
---
# Keep typing in the compose box from relaying out the thread

## Status

- **Goal**: Each keystroke in the compose box costs one paint, not a thread-wide relayout.
- **Initial priority**: P3
- **Effort**: Small
- **Category**: bug
- **Planned at**: commit `6a99306`, 2026-11-12
- **Plan**: `docs/research/project-portability-plan.md`, work order phase 9

## Why this matters

PRD section 15 records input rendering under CPU slowdown as the cost behind two Storybook
timeouts. Phase 9 takes commits from measurement only.

## Current state

* `typing-measure.mjs`, Weekly brief, 4x CPU slowdown, 3 runs: every one of 39 keystrokes over
  16 ms, median 416 ms (keys 120 ms apart, so they queue).
* A CPU profile of 10 keystrokes puts `resize` in `ComposeBox.tsx` first among app functions:
  789 ms self time.
* The textarea's `ref` is an inline function, so React re-attaches it on every render. Each
  keystroke collapses the box to 0px, reads `scrollHeight` and builds a new ResizeObserver, whose
  first callback does it again.

## Approach

* Size the box with CSS `field-sizing: content`, inside the existing 44px floor and six-line cap.
* Where the browser lacks it, keep the JavaScript sizing, run on draft changes and width changes
  from a stable ref instead of on every render.
* Rejected: `React.memo` around the turns. Typing would stay a forced relayout; memo would only
  hide part of its cost, and adds a rule every turn prop must follow.

## Scope

* In: compose box sizing; a typing measure.
* Out: React re-render cost of the thread while typing; chart libraries (ETH-130).

## Steps

* Typing measure with before and after numbers.
* CSS sizing with a guarded fallback.

## Test plan

* `ComposeBox.browser.test.tsx` passes unchanged: grows, caps at six lines, shrinks, reflows.
* Before and after typing measures in one run, alternating, with run counts and spread.

## Done when

* The typing measure improves beyond run-to-run spread, and the growth test passes.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser
  checks pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Numbers are dev-server timings at 4x CPU slowdown, not production.

## Drift log

- 2026-11-12: The planned fix (CSS `field-sizing` plus a stable ref) measured no change:
  medians 424 and 464 ms before, 432 and 464 after (`verify-eth-133-ab-20261112-115948`). Per
  keystroke, layout was 2.2 of 67 ms of main-thread work; script took 40 and style 21.5, with 22
  style recalcs: the whole thread re-rendering. Reverted.
- 2026-11-12: Shipped instead: the draft moved out of the panel's state, so typing re-renders
  only the compose box. Five runs of 39 keystrokes each, 4x CPU slowdown, dev server:
  - Before, four rounds: medians 448, 448, 424, 464 ms.
  - After, alternating run `verify-eth-133-ab2-20261112-122230`: 160 ms, then 448 ms. The second
    followed a file swap and may have served the old module; not proven.
  - After, two runs without swapping (`verify-eth-133-after-20261112-124012`): 176 and 160 ms.
  - Worst keystroke per run stays near 500 ms: the first key turns the draft non-empty, which
    re-renders the panel for the recap fold.
