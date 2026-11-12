---
linear: ETH-132
---
# Name a selection's surface and its role colour

## Status

- **Goal**: The inspector says which semantic surface a selection belongs to.
- **Initial priority**: P3
- **Effort**: Small
- **Category**: feature
- **Planned at**: commit `8203709`, 2026-11-12
- **Plan**: `docs/research/project-portability-plan.md`, work order phase 7

## Why this matters

Themes name roles, not host variables (decision 7 of the plan). A designer selecting the compose
box should see that it draws the compose surface and which colour role paints it, so a theme edit
lands on the right role.

## Current state

* `contract.json` maps surfaces to components and colours: compose to `ComposeBox` and
  `--compose-bg`, thread to `ChatThreadPanel` and `--paper`, page to `--bg`.
* The Selection panel shows only the selector and its reach.

## Approach

* The surface is the nearest `data-wb` ancestor (or self) whose component a contract surface
  names; otherwise the page surface. Read from `contract.json`, so the contract stays the one
  definition.
* Show "Compose surface" with its colour role and current value in the Selection panel.
* Rejected: recognising the same primitive under another name; the plan defers it.

## Scope

* In: Selection panel surface line; contract lookup.
* Out: editing the colour from the line; renamed primitives.

## Steps

* Surface lookup from the contract.
* Surface line in the Selection panel.

## Test plan

* Browser: selecting the compose box shows the compose surface and `--compose-bg`; selecting
  inside the thread shows the thread surface.

## Done when

* Selecting the compose box shows it as the compose surface and its role colour, by screenshot.
* `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm fallow` and the affected browser
  checks pass.
* Commit bodies name this ticket's Linear identifier.

## Notes

* Built one ticket at a time on `factory/inspector-loop`.
