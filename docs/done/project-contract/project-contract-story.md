# Story: one deterministic contract for a valid project

Status: drafted Nov 12 2026 from the
[portability plan](../../research/project-portability-plan.md). Decisions 2 to 7 there apply.
Decision 5 (the exact Storybook version) is proposed.

**Boundary.** Whether a project is valid is decided by code alone: a JSON contract and a pure
validator. No agent, LLM or network call takes part in checking or accepting a project. Agents
may help write the contract and validator while the repo is developed.

## 1. The contract and its validator

**As** the Workbench loading a project,
**I want** a machine-readable list of what a project must contain and a function that checks it,
**so that** acceptance is the same every time and every refusal says exactly what is missing.

1. `contract.json` records the Storybook version (exactly `10.6.0`), the index format (`5`),
   the shell kinds and, per kind, the required slots, components and surfaces.
2. An `app-shell` project needs the `window`, `title-bar` and `sidebar` slots and the
   components `ChatThreadPanel`, `UserTurn`, `AgentTurn` and `ComposeBox`.
3. Surfaces map a role to its component and colour values: `page` to `--bg`, `thread` to
   `ChatThreadPanel` and `--paper`, `compose` to `ComposeBox` and `--compose-bg`.
4. The validator returns every failure, each with a stable code and the path it concerns,
   sorted. A valid project returns an empty list.
5. Malformed JSON, a wrong Storybook version, a missing slot, a missing component, a required
   component with no story and an unknown surface each fail with their own code.
6. The validator imports nothing that reaches the network or a model.

## 2. Every required component has a story

**As** a designer loading a project,
**I want** every required component to have a story in Storybook,
**so that** Component mode can open it even when the app is not showing it.

1. `ComposeBox`, `UserTurn` and `AgentTurn` each have a story whose index entry's
   `componentPath` is their source file.
2. The existing stories, tests and browser suites still pass.

## 3. Describe this repo as a project manifest

**As** a designer about to export,
**I want** the Workbench to describe the running Template in the contract's terms,
**so that** the manifest comes from what is really there, not from a hand-written list.

1. A command writes the manifest from the installed Storybook version, Storybook's index, the
   rendered page's slots and its `data-wb` names.
2. This repo's manifest passes the validator.
3. Removing a required story or slot in a scratch copy makes the validator fail with that
   item's code.

## Not in this story

- Recognising a primitive under a different name.
- Support for any Storybook version but the pinned one.
