---
linear: ETH-135
---
# Name a reference's component file and line

## Status

- **Goal**: A chat reference says where its element lives in code, so an agent can act on it.
- **Initial priority**: P3
- **Effort**: Small
- **Category**: feature
- **Planned at**: commit `0a3af0d`, 2026-11-12
- **Plan**: `docs/research/project-portability-plan.md`, work order phase 10; PRD R12

## Why this matters

R12 asks for an exact request: element, file and line, current value. ETH-110's references
carry the element and its preview only.

## Approach

* The dev server reads each `data-wb` name's file and line with the scan the manifest already
  runs (`readSources` in `project.ts`), at `GET /__workbench/sources`.
* A reference names the nearest named component around the element, path first:
  `packages/catalog/src/QuietProse.tsx:193 · Prose`. The line is the one naming the component,
  not the element's own JSX line, which React 19 no longer exposes.
* An element outside every named component says so; a missing name says "source not found".

## Scope

* In: file and line on draft (tooltip) and sent (text) chips.
* Out: the current value. Which property a request is about is not specified by the PRD.

## Done when

* `reference-check.mjs` reads the sent chip's path and line and finds the button's component
  declared on that line.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Notes
