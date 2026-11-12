---
linear: ETH-120
---
# Load and unload a palette

## Status

- **Goal**: PRD R16: swap a palette without losing other changes.
- **Initial priority**: P2
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [themes-story.md](themes-story.md), feature 2

## Why this matters

PRD R16: swap a palette without losing other changes. Story: `docs/feature/themes/themes-story.md`,
feature 2. Plan: `docs/research/project-portability-plan.md`.

## Current state

* Saved palettes exist after the previous ticket.
* Undo steps are per change list (ETH-111).

## Approach

* Loading writes each colour value into the override file through the existing save path, as one
  history step, so undo, Discard and Check and commit work as they do.
* Unloading removes the palette's names from the override file. Rejected: importing the palette
  stylesheet live, which would make a look that is not in the override file (PRD section 8).

## Scope

* In: palette list, load, unload, one undo step.
* Out: type pairings.

## Steps

* List palettes from the plugin.
* Load and unload as one history step.
* Keyboard access for both.

## Test plan

* Browser: load changes `--paper`, leaves `--window-radius`; undo restores both; unload returns the
  baseline.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
