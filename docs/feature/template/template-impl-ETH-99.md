---
linear: ETH-99
github: 1
filed: 2026-11-11
---
# Bring the Template into this repo

## Status

- **Goal**: this repo runs the yaklabs app shell, component library and Storybook on the scripted
  agent, with no sign-in.
- **Initial priority**: P1
- **Effort**: Medium
- **Risk**: MEDIUM
- **Category**: infra
- **Planned at**: commit `94a319b`, 2026-11-11
- **Kind**: setup task, no user story. Blocks ETH-100 and ETH-101.

## Why this matters

The Workbench edits the look of a real running app. Until that app is in this repo there is nothing
to design against, and no later ticket can be checked. See `docs/prd.md`, section 10, block 1.

## Current state

* This branch (`design-workbench`) holds the Interface Atlas workbook: one Vite app on Bun, in
  `src/` and `tests/`. The same code is kept on the `design-tutorial-workshop` branch.
* yaklabs (`github.com/mite404/yaklabs`, commit `104a052`) is a pnpm 10.33.0 and turbo monorepo:
  `apps/web`, `apps/storybook`, `apps/gateway`, `packages/catalog`, `packages/ui`,
  `packages/runtime`, `packages/config`, `tools/verify-ui-drift`. About 44,000 lines of TypeScript.
* The shell cannot be copied by folder. `apps/web/src/shell` imports `@yaklabs/runtime`,
  `src/world`, `src/demo` and the session and runtime providers, and `packages/runtime` takes types
  from `apps/gateway`.
* The mocked agent loop already exists. With no env file the app defaults to `VITE_AGENT=lab`
  (scripted replies), `VITE_AUTH=none` and `VITE_DEMO=on`, and `?scenario=demo` opens a
  deterministic shell.

## Approach

Copy the yaklabs monorepo whole, as it is at commit `104a052`, and prune later. Copying whole gives
a running app at once, and pruning becomes a series of small deletions that can each be checked.

Rejected: hand-picking the shell, thread, message and composer. That means untangling most of the
repo before anything runs. Rejected: renaming the `@yaklabs/*` packages now. It touches hundreds of
imports for no gain yet. Rejected: keeping the workbook beside the Template on this branch. Two apps
and two package managers in one tree, and the workbook is already safe on its own branch.

## Scope

* In: the whole tree of this branch, except `docs/feature/`, `docs/prd.md` and `docs/research/`,
  which stay.
* In: `.agents/setup`, `.amp/services.yaml`, `README.md`.
* Out: pruning yaklabs features the Template does not need (gateway, sharing, snooze, the canvas).
  One later ticket per removal.
* Out: an adjustable streaming speed for the scripted agent. It is a feature, not setup.
* Out: any Workbench code. That starts in ETH-100.

## Steps

* Remove the workbook from this branch: `src/`, `tests/`, `index.html`, the Vite, Playwright,
  TypeScript and oxlint configs, `components.json`, `bun.lock`, `.bun-version`, `package.json`, and
  the workbook's own files under `docs/`.
* Copy from yaklabs: `apps/`, `packages/`, `tools/`, `scripts/`, `package.json`,
  `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `lefthook.yml`, `bts.jsonc`,
  `THIRD_PARTY_NOTICES.md`, `AGENTS.md`, the lint and format configs, `.gitignore`. Copy `docs/adr/`
  too, because code comments cite ADR numbers. Leave the other yaklabs docs.
* Keep the `@yaklabs/*` package names.
* Switch the orb setup in `.agents/setup` from Bun to pnpm 10.33.0, and install the Playwright
  browsers the story tests need.
* Add `.amp/services.yaml` declaring two services: `web` (`pnpm dev:web`) and `storybook` (`pnpm
  storybook`).
* Rewrite `README.md`: what this repo is, how to run the app and Storybook, where the tickets live.

## Test plan

* Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`.
* Run `amp orb services ensure` and open both portals.
* Open the app at `/?scenario=demo` in light and in dark. Take a screenshot of each and look at
  them.
* Open Storybook and render one catalog story and one ui story.

## Done when

* All five pnpm commands pass.
* `amp orb services ensure` serves the app and Storybook.
* The app at `/?scenario=demo` shows the full shell with a scripted conversation, in light and dark,
  with nothing looking broken.
* Storybook lists the catalog and ui stories and renders them.
* No file from the old workbook remains outside git history.
* The PR title starts with this ticket's bracketed Linear identifier.

## Notes

Risk: MEDIUM. The copy is large, and yaklabs may expect env values or services this repo's orb does
not have. That is a suspicion, not a finding. Anything that has to change to make it run goes in the
drift log. ETH-100 and ETH-101 both build on this.

## Drift log

Record here anything built differently from this plan, and why.
