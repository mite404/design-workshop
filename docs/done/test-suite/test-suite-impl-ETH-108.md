---
linear: ETH-108
---
# Let saved design values pass the tests

## Status

- **Goal**: remove fixed-look assertions and the live override-file fixture without weakening
  shell behavior checks.
- **Initial priority**: P1
- **Effort**: Small
- **Risk**: LOW
- **Category**: bug
- **Planned at**: commit `39323ce`, 2026-11-11, after ETH-101 and approved test pruning.
- **Story**: [test-suite-story.md](test-suite-story.md). ETH-108 blocks ETH-104.

## Why this matters

A saved look must not break Check and commit just because its numbers differ from the baseline.
The override parser's tests currently read the designer's working file as an empty fixture.

## Current state

* `packages/workbench/src/overrides.test.ts` reads `catalog/src/overrides.css` as `EMPTY`.
* `packages/catalog/src/tokens.test.ts` pins the shared button radius to 4px.
* `packages/catalog/src/WorkDetails.browser.test.tsx` pins 13px text, 20px leading and a 15px
  outcome. Recheck these locations after intervening builds.

## Approach

Keep the existing tests and replace their fixed design assumptions with their actual contracts.
Use owned fixture text for parser tests, shared-token checks for buttons, and readable hierarchy
for work details. Do not disable story tests or stop loading saved values into Storybook: those
tests must still catch unreadable text and broken controls in the saved look.

## Scope

* In: the three test files above and only the minimal test helpers they need.
* Out: production styling, new test infrastructure, and more test deletion.
* Out: gateway, sign-in and live-model architecture, retained for later sharing work.

## Steps

* Reproduce the parser-test failure with a saved override through the real Workbench, preserving
  the exact original file for restoration after the check.
* Replace the live-file read with a local empty-file string in the existing test.
* Keep the shared button-token assertion, but remove the required 4px value.
* Keep list semantics and text hierarchy in WorkDetails without pinning their design numbers.
* Restore the override file byte-for-byte after verification; never commit the test look.

## Test plan

* Show the old parser test fail with a saved value and the updated test pass unchanged with it.
* Try a non-default button radius and type sizes. The tests must accept the changed look.
* Temporarily disconnect a button from its shared token and reverse the WorkDetails hierarchy.
  Each corresponding test must fail; revert these mutations after checking.
* Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and `pnpm test`.

## Done when

* Tests accept saved looks and still detect the named regressions.
* The original override file is restored and all checks pass.
* The change lands directly on `main`; its commit body names this ticket and the checks run.

## Notes

Risk: LOW. Do not turn a meaningful assertion into a check that merely confirms a value exists.
No GitHub issue or pull request is needed under this project's workflow.

## Drift log

* The button test's stylesheet scan also read `overrides.css` indirectly. Excluded it so both
  test readers leave the designer's working file alone. Stories still load saved overrides.
* Added an explicit `UL` assertion alongside the existing list items and disc marker checks,
  so dropping list semantics fails even if the text and styling stay unchanged.
* The first full-suite run timed out connecting to Chromium before any Storybook tests ran.
  Stopped the dev servers and finished competing checks, then reran the unchanged suite
  successfully with the saved override still present. No timeout or infrastructure changes.
