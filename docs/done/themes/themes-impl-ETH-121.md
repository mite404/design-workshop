---
linear: ETH-121
---
# Save, load and unload a type pairing

## Status

- **Goal**: PRD R16 names "font pairing 2" as the example of a preset.
- **Initial priority**: P2
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [themes-story.md](themes-story.md), feature 3

## Why this matters

PRD R16 names "font pairing 2" as the example of a preset. Story:
`docs/done/themes/themes-story.md`, feature 3. Plan: `docs/research/project-portability-plan.md`.

## Current state

* The Type section edits `--font-text`, `--font-display`, `--type-base`, `--type-ratio`,
  `--type-leading` on `:root` (ETH-105, ETH-109).

## Approach

* Reuse the palette save, load and unload with type roles in the same theme format. No
  second mechanism.

## Scope

* In: the Type section's controls for the five names.
* Out: element-level type values, which stay put.

## Steps

* Generalise the palette code over a name list.
* Add the Type section control.

## Test plan

* Browser: pairing load changes both fonts and the scale; a heading's own saved size stays; missing
  font shows the existing warning.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
