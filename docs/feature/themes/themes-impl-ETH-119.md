---
linear: ETH-119
---
# Save the current colours as a palette

## Status

- **Goal**: PRD R16. A tuned palette lives only in the override file today, so the next project
  redoes it.
- **Initial priority**: P2
- **Effort**: Medium
- **Category**: feature
- **Planned at**: branch `factory/inspector-loop`, 2026-11-12
- **Story**: [themes-story.md](themes-story.md), feature 1

## Why this matters

PRD R16. A tuned palette lives only in the override file today, so the next project redoes it.
Story: `docs/feature/themes/themes-story.md`, feature 1. Plan:
`docs/research/project-portability-plan.md`.

## Current state

* Colours edit through the inspector's Colours section into the override file (ETH-113), per
  `:root[data-theme="light"]` and `[data-theme="dark"]`.
* The plugin refuses every write but the override file (ADR-002, R10).

## Approach

* A palette is a `.workbench/themes/<name>.theme.json` file of colour roles, light and dark,
  with a role map from roles to this Template's colour names (PRD section 16).
* The plugin allows exactly that directory for a new, non-existing file. Rejected: CSS theme
  files, which tie a theme to one app's variables, and localStorage, which is not in git.

## Scope

* In: Save as palette in the Colours section, the plugin write, its tests.
* Out: loading a palette (next ticket), type pairings.

## Steps

* Amend ADR-002 for `.workbench/themes/`.
* Plugin endpoint writes a new palette file; refuses an existing name and any other path.
* Save control with a name field in Colours.

## Test plan

* Plugin unit test: writes the file, refuses an existing name and a path outside.
* Browser: change a colour, save as `test`, read the file back, override file unchanged.

## Done when

* The story's criteria for this feature pass in the browser, shown by screenshots.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser checks
  pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on the local experimental branch; no push, PR or merge without
  Ethan's go-ahead.

## Drift log
