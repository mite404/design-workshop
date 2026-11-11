---
linear: ETH-104
---
# Name the nine type sizes

## Status

- **Goal**: every font size in the Template comes from one of nine named steps, so a later dial
  has something to turn.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: MEDIUM
- **Category**: refactor
- **Planned at**: commit `a9f6718`, 2026-11-11. Recounted at `cf734ed`, after the drift tool and
  the first-visit guide were deleted.
- **Story**: [type-scale-story.md](type-scale-story.md). Needs ETH-99 only. The dial is a later
  ticket.

## Why this matters

The story wants one dial that resizes all the type together. Today each size is a number typed
where it is used, so there is nothing to turn. This ticket gives the sizes names. It is also the
moment the odd sizes (11, 13, 15px) become even ones (ADR-015), which changes how the app looks,
so it ends in before and after screenshots for Ethan to judge. "AC 2" below means criterion 2 in
`type-scale-story.md`. This ticket covers AC 1 to 4.

## Current state

Measured at `cf734ed`, in `apps/web/src`, `packages/catalog/src` and `packages/ui/src`:

* 103 `font-size` declarations with a pixel number, in 7 CSS files: `thread.css` 40, `tokens.css`
  40, `dictation.css` 9, `interactive.css` 6, `primitives.css` 6, `apps/web/src/index.css` 1,
  `App.css` 1. No `font:` shorthand carries a pixel size.
* 16 different sizes: 12px (25), 13px (23), 11px (15), 15px (12), 10px (6), 14px (5), 9px (4),
  18px (3), 17 and 34px (2 each), and 20, 21, 22, 24, 30 and 44px (1 each).
* Tailwind size classes in TSX: `text-xs` 44, `text-sm` 19, `text-[13px]` 9, `text-3xl` 4,
  `text-xl` 2, `text-2xl` 2, `text-[11px]` 2, `text-lg` 1, `text-[10px]` 1.
* Sizes typed in TSX: `fontSize: 12`, `13` or `15` in five story files (9 places), and
  `fontSize: 12` on chart ticks in `CatalogCard.tsx` and `interactiveParts.tsx` (4 places).
* No named sizes anywhere. Tailwind is 4.3.3. Its size classes already read a variable
  (`text-xs` is `font-size: var(--text-xs)`), and the app's layer order
  (`theme, base, catalog, components, utilities`) puts `tokens.css` above Tailwind's theme.
* `WorkDetails.browser.test.tsx` asserts 13px and 15px. The test suite story
  (`docs/feature/test-suite/test-suite-story.md`) plans to make it compare the two sizes instead.

## Approach

Use Tailwind's own size names for the nine steps (ADR-019) and give them their values once, in
the `:root` block of `packages/catalog/src/tokens.css`:

| Name | Size | Tailwind's default |
| --- | --- | --- |
| `--text-2xs` | 10px | none |
| `--text-xs` | 12px | 12px |
| `--text-sm` | 14px | 14px |
| `--text-base` | 16px | 16px |
| `--text-lg` | 20px | 18px |
| `--text-xl` | 24px | 20px |
| `--text-2xl` | 28px | 24px |
| `--text-3xl` | 34px | 30px |
| `--text-4xl` | 42px | 36px |

Because the catalog layer sits above Tailwind's theme layer, a value in `tokens.css` replaces
Tailwind's default with no mapping. I checked this by compiling a sample with Tailwind 4.3.3.
One name then serves plain CSS (`font-size: var(--text-xs)`) and Tailwind classes (`text-xs`),
and a shadcn component that says `text-sm` follows the scale without being touched (PRD
principle 5). Rejected: our own names such as `--type-3`. They would need a mapping to Tailwind
for every step, and imported components would not follow.

Each existing size moves down to the nearest step. 9px is the one exception: it is below the
smallest step, so it moves up to 10px.

| Today | Becomes | Uses in CSS |
| --- | --- | --- |
| 9, 10, 11px | `--text-2xs` (10px) | 25 |
| 12, 13px | `--text-xs` (12px) | 48 |
| 14, 15px | `--text-sm` (14px) | 17 |
| 17, 18px | `--text-base` (16px) | 5 |
| 20, 21, 22px | `--text-lg` (20px) | 3 |
| 24px | `--text-xl` (24px) | 1 |
| 30px | `--text-2xl` (28px) | 1 |
| 34px | `--text-3xl` (34px) | 2 |
| 44px | `--text-4xl` (42px) | 1 |

The step values are plain pixel numbers in this ticket. Rejected for now: working them out in
CSS with `pow()` and `round()` from a base and a ratio. The result is the same nine numbers, so
it would add nothing Ethan can see, and it has an edge to test (12 divided by 1.2 can land a
hair under 10 and round down to 8). That belongs with the dial, where it can be tried live.

## Scope

* In: `packages/catalog/src/tokens.css`: the nine steps, and its own 40 declarations.
* In: the other six CSS files listed in Current state.
* In: `packages/ui/src/styles/globals.css`: one line so the `text-2xs` class exists.
* In: Tailwind size classes and typed `fontSize` values in TSX under the three folders.
* In: the two expected sizes in `WorkDetails.browser.test.tsx`, and one new test.
* Out: `packages/workbench`. Its `page.css` styles the Workbench's own page, not the Template.
* Out: `line-height` declarations, weights, families and letter spacing.
* Out: the base and ratio maths, the Type panel and the override file. They are the dial ticket.

## Steps

Part 1, before screenshots:

* Before any edit, start the app and Storybook (`amp orb services ensure`) and capture: the app
  shell at 1440 by 900 with the scripted conversation played to its end, in light and in dark;
  the same at 390 wide in light; and up to six Storybook stories that carry the most type. Name
  the stories in the drift log so the after set matches.

Part 2, the names:

* Add the nine steps to `:root` in `tokens.css`, with one comment saying they are a 12px base
  times 1.2, rounded down to even.
* In `globals.css`, add `--text-2xs` to the theme so Tailwind makes a `text-2xs` class. The
  value stays written once, in `tokens.css`.
* Check: an element with `text-2xs` computes to 10px, and one with `text-lg` to 20px.

Part 3, CSS:

* Replace each pixel `font-size` in the seven files with the step from the table.

Part 4, TSX:

* Rename classes, in this order so no rename catches an earlier one: `text-lg` to `text-base`,
  `text-xl` to `text-lg`, `text-2xl` to `text-xl`, `text-3xl` to `text-2xl`. Then
  `text-[13px]` to `text-xs`, and `text-[11px]` and `text-[10px]` to `text-2xs`. `text-xs` and
  `text-sm` stay.
* `text-[13px]` sets no line height and `text-xs` sets one. Where a renamed element's computed
  line height changes, put it back with a `leading-*` class, so the screenshots show the size
  change alone.
* Typed sizes in stories become the step: `fontSize: "var(--text-xs)"` for 12 and 13,
  `"var(--text-sm)"` for 15.
* Chart ticks: an SVG attribute cannot read a CSS variable. Remove `fontSize` from the tick and
  set the size in CSS on the chart's container, which the tick text inherits.

Part 5, tests and after screenshots:

* If `WorkDetails.browser.test.tsx` still expects 13px and 15px, change them to 12px and 14px.
  If the test suite ticket has landed and the test compares the sizes, leave it.
* Add one test in `packages/catalog` that reads the CSS files of the three folders and fails if
  a pixel `font-size` is written anywhere but the nine steps in `tokens.css`.
* Capture the same views as part 1.

## Test plan

* Check font rendering in Helium, Chrome and Safari. Inspect actual Safari when available;
  label Linux WebKit as an approximation and report any browser not exercised.
* The new test passes, and fails when a `font-size: 13px` is added to any of the seven files.
* These searches return nothing under the three folders: `text-\[[0-9.]+px\]`, and `fontSize`
  followed by a number.
* `pnpm typecheck`, `pnpm lint` and `pnpm test`.
* Look at each before and after pair. Text may be up to 2px smaller and lines may wrap
  differently. Nothing may be clipped, overlap, or fall out of its container.

## Done when

* The searches in the test plan return nothing and the new test passes.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The build thread's final reply shows the before and after screenshots side by side, before on
  the left, and names any place where the rounding looks wrong.
* The change is on `main` in one commit whose body names this ticket's Linear identifier and
  the checks that were run (ADR-017).

## Notes

Risk: MEDIUM. This changes how the app looks on purpose: 59 of the 103 CSS sizes get smaller,
most by 1px (13 to 12, 11 to 10, 15 to 14), 4 grow by 1px (9 to 10) and 40 stay. Ethan's view
is "probably rounded down, but we'll just have to wait until things are live to see". If down
looks wrong, the fix is the mapping table above, not the names, and it is one commit to revert.
Screenshots are shown in the thread, not committed. Other tests that assert pixel values of
layout may fail if text reflows; fix the cause if it is a real overflow, and otherwise note the
test in the drift log for the test suite rewrite.

## Drift log

Record here anything built differently from this plan, and why.
