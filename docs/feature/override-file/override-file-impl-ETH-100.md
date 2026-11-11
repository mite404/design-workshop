---
linear: ETH-100
github: 2
filed: 2026-11-11
---
# Add the override file, its reader and its writer

## Status

- **Goal**: one stylesheet holds every value Ethan has changed, and two pure functions read it and
  change one value in it.
- **Initial priority**: P1
- **Effort**: Small
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `94a319b`, 2026-11-11
- **Kind**: foundation, no user story. Needs ETH-99. Blocks ETH-101.

## Why this matters

The Workbench edits values, never code. The override file is the only file it ever writes, so every
later feature saves through these two functions. If reading and writing it loses or reorders
anything, every design session produces a noisy diff. See `docs/prd.md`, sections 5 and 6.

## Current state

* After ETH-99, the baseline tokens live in `packages/catalog/src/tokens.css`.
* `apps/web/src/index.css` imports the catalog CSS into its own `catalog` layer.
* Storybook has two cascades in `apps/storybook/.storybook/preview.ts`: `catalogCss` and
  `app-cascade.css`.
* No override file exists. There is no `packages/workbench`.

## Approach

One stylesheet at `packages/catalog/src/overrides.css`, loaded after the baseline tokens by the app
and by both Storybook cascades. The Workbench is its only writer, so the format is fixed: a
`:root` block first, then one block per element selector in the order they were first set. Each
block has its selector and `{` on one line, one `name: value;` per line with a two-space indent in
the order first set, and `}` on its own line. A file in any other shape is refused, not repaired.

Amended 2026-11-11, before work started: the
[spacing story](../spacing/spacing-story.md) saves values per element, so the file holds a block
per selector and both functions take a selector. The first version had one `:root` block only.

Because the tool writes the format itself, a line-based parser is enough. Rejected: a CSS parser
dependency. It solves a general problem this file does not have. Rejected: a JSON file of values. It
would need a build step to become CSS, and the dev server would not hot reload it for free.
Rejected: adding the dark block now. It arrives with the first colour story.

## Scope

* In: `packages/catalog/src/overrides.css` (new).
* In: `packages/workbench` (new private package, no runtime dependencies) with `src/overrides.ts`
  and its test.
* In: `apps/web/src/index.css` and the Storybook cascades, to load the file.
* Out: the dev server endpoint. It is part of ETH-101.
* Out: any interface, dark values, themes.

## Steps

* Create `overrides.css` with a comment line and an empty `:root` block.
* Write `parseOverrides` and `setOverride` as pure functions. Signatures are in Reference below.
* Import the file last in `apps/web/src/index.css`, outside any layer. The app declares
  `@layer theme, base, catalog, components, utilities`, and a value saved for an element (a gap
  or a padding) has to beat the `components` and `utilities` layers. Unlayered rules beat every
  layer. Amended 2026-11-11; the first version put the file in the `catalog` layer.
* Include it last and unlayered in both Storybook cascades.

## Test plan

* One Vitest file covers: read then write with no change returns the same bytes; set a new value;
  replace a value; remove a value; removing the last value leaves the empty `:root` block; set a
  value under a new selector; removing the last value under a selector removes its block; a
  malformed file throws.
* Type `--window-radius: 20px` into the file by hand. A throwaway element using
  `var(--window-radius)` shows 20px in the app and in a story. Remove the line and the element
  afterwards.

## Done when

* The Vitest file passes and each case above is in it.
* A hand-typed value reaches both the app and a story.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The PR title starts with this ticket's bracketed Linear identifier.

## Notes

Risk: LOW. Pure functions and two import lines. The one place to be careful is the Storybook cascade
order, since the two cascades are deliberately different.

## Reference

The empty file:

```css
/* Written by the Workbench. One design value per line. Do not edit by hand. */
:root {
}
```

After a change:

```css
:root {
  --window-radius: 20px;
}
main > section:nth-child(2) > div {
  gap: 12px;
  padding-top: 16px;
}
```

The functions, in `packages/workbench/src/overrides.ts`:

```ts
/** The values in an override file, by selector then property name. @throws on any other shape. */
export function parseOverrides(text: string): Map<string, Map<string, string>>;

/** `text` with one value set, or removed when `value` is null. Every other byte is kept. */
export function setOverride(
  text: string,
  selector: string,
  name: string,
  value: string | null,
): string;
```

## Drift log

Record here anything built differently from this plan, and why.
