# Workbench verification map

Run commands from the disposable snapshot described in [the skill](../SKILL.md). `$OUT` is an
absolute evidence directory outside that snapshot. The scripts are the executable source of truth
for their selectors and assertions. Read the relevant story and script before changing either.

## Features

- [Template and editor entry](shell.md): welcome, threads, layouts, persistence and mode entry.
- [Selection and spatial edits](spatial.md): tree, references, radius, spacing and nudging.
- [Typography](typography.md): fonts, text formatting and the type scale.
- [Values and colours](values.md): offline CLI operations and light/dark colour editing.
- [History and commits](history.md): undo, redo, discard, stale edits and Check and commit.

## Coverage and preconditions

`pnpm test:browser` runs these script groups sequentially. It is the broad existing regression
command, not an exhaustive sweep of every Template screen or Storybook state. Stories, component
focus and tree navigation evolve independently; check their current implementation and feature
tickets rather than assuming planned PRD paths already exist.

Radius, spacing, type and scale scripts require an empty override fixture. Others may restore the
starting file, but a failed process can leave state behind. Never run two scripts against the same
copy at once. All file and Git mutations belong in the disposable copy. The commit script creates
additional isolated repositories and its own server.

For each affected journey, report passed, failed or not exercised, the command, observed result and
evidence location. Missing prerequisites are not passes. Layout, theme, viewport and non-default
states affected by a change need their own inspection beyond the scripts' fixed cases.
