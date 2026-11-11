---
linear: ETH-105
---
# Set the type of one element in a Typography section

## Status

- **Goal**: select a piece of text and set its weight, size, line height, letter spacing and
  alignment in the inspector, with each value saved to the override file.
- **Initial priority**: P2
- **Effort**: Large
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `6132eaa`, 2026-11-11
- **Story**: [type-inspector-story.md](type-inspector-story.md). Needs ETH-102 and ETH-104. The
  font picker (ETH-106) and the Basics popover (ETH-107) follow.

## Why this matters

After spacing, type is what Ethan corrects most in a mockup an agent built, and today each
correction is a sentence to an agent. This ticket builds the Typography section that Figma has,
without the font list. "AC 4" below means criterion 4 in `type-inspector-story.md`. This ticket
covers AC 1 to 7, and AC 16 to 19 for its own controls.

## Current state

* After ETH-102, any element in the framed app can be selected, a selector identifies it, and
  the inspector shows gap and padding fields for it.
* After ETH-102, `POST /__workbench/values` takes a selector, a property, a value and `was`. It
  accepts five properties (gap and the four paddings) and only whole pixel values.
* After ETH-104, every font size in the Template is one of nine steps, `--text-2xs` to
  `--text-4xl`, valued in `packages/catalog/src/tokens.css`.
* The Template's two fonts are Inter Variable (`--font-text`) and Newsreader Variable
  (`--font-display`). Both are variable fonts, so they hold every weight from 100 to 900, and
  the Template uses weights between the hundreds, such as 550 and 650.
* `tokens.css` sets `font-synthesis: none`, so the browser does not fake a weight or an italic
  that a font lacks.
* The inspector has no type control.

## Approach

The section reads the selected element's computed style from the frame and writes one CSS
property per control, through the endpoint and the saving flow ETH-102 built. Nothing new is
invented for saving.

| Control | Property | What is saved |
| --- | --- | --- |
| Style | `font-weight`, `font-style` | A whole number from 1 to 1000; `normal` or `italic` |
| Size | `font-size` | `var(--text-…)` for one of the nine steps, or whole pixels from 1 |
| Line height | `line-height` | Whole pixels from 1 |
| Letter spacing | `letter-spacing` | `em`, which is the percentage divided by 100 |
| Horizontal alignment | `text-align` | `left`, `center` or `right` |
| Vertical alignment | `align-content` | `start`, `center` or `end` |

Size saves a step by name, so the element keeps following the type dial. Rejected: Figma's
free number as the first choice, because every sized element would then leave the scale.

Letter spacing is shown as a percentage, as in Figma, and saved in `em`: 5% is `0.05em`. `em`
means the same thing in every browser, and it keeps its proportion when the size changes.

Vertical alignment uses `align-content`, which works on an ordinary block without changing its
`display`. Rejected: turning the element into a flex container, which would change the layout
of anything else inside it.

The Style list comes from the fonts the frame has loaded (`document.fonts`). Rejected: a fixed
list of nine weights, because Figma lists only what the family has.

## Scope

* In: `packages/workbench`: the Typography section, the endpoint's new properties and their
  value checks, and their tests.
* Out: choosing a family. The family row shows the current family's name, read-only. The font
  picker is the next ticket.
* Out: the Basics popover (justify, decoration, case, vertical trim, list style, paragraph
  spacing). Its ticket follows.
* Out: text colour, text styles, several elements selected at once, and different type on part
  of one element's text. The story excludes them.
* Out: the mockup's source. Only the override file changes.

## Steps

Part 1, the endpoint:

* Add the seven properties in the Approach table to the list `POST /__workbench/values`
  accepts for an element. Each property gets its own value check.
* `font-size` accepts `var(--text-NAME)` only when NAME is one of the nine steps, or whole
  pixels of 1 or more.
* `letter-spacing` accepts a number with at most three decimals, from -1 to 2, followed by
  `em`.
* Refuse everything else. A value never reaches the file unless it matches its property's
  check in full.
* Check: `curl` saves and resets each property. A step that does not exist, a value with a
  second declaration after it, and a property not on the list are each refused.

Part 2, the section:

* Show the section when the selected element has text of its own: at least one direct child
  that is a text node and is not only white space (AC 1). Otherwise hide it.
* Lay it out as in Figma: family, then style and size, then line height and letter spacing,
  then alignment (AC 1).
* Fill every control from the element's computed style (AC 2). The family row shows the first
  family in the computed list.

Part 3, the controls:

* Style lists the weights and italics of the current family (AC 3). Read them from the frame's
  `document.fonts`: a variable font gives every hundred inside its weight range, and italics
  if it has an italic face. Name them as Figma does: Thin, ExtraLight, Light, Regular, Medium,
  SemiBold, Bold, ExtraBold, Black, each with Italic.
* If the family has no loaded face, because it is a system font, list Regular and Bold.
* A current weight that is not a hundred, such as 550, shows as its number at the top of the
  list.
* Size is a field with a list of the nine steps, each with its pixel size (AC 4). Up and Down
  move one step.
* Size shows a step when the saved value is a step, or when nothing is saved and the computed
  size equals a step's size. Otherwise it shows the number with an "off the scale" mark.
* A typed whole number saves as pixels (AC 4). Picking a step again puts the element back on
  the scale.
* Line height is in pixels (AC 5). It shows "Auto" when the computed value is `normal`. Arrow
  keys move it 4px, never below 4. From Auto, the first arrow key starts at the height the
  browser is using for a line, rounded up to a multiple of 4.
* Letter spacing is a percentage (AC 6). Arrow keys move it 1%, or 10% with Shift. A typed
  decimal such as -0.5 is accepted.
* Horizontal alignment is three buttons: left, centre, right (AC 7).
* Vertical alignment is three buttons: top, middle, bottom. Show them only when the element's
  computed `display` is a block kind (`block`, `inline-block`, `flow-root` or `list-item`) and
  it is taller than its text (AC 7).
* The value maths (percentage to `em` and back, matching a size to a step, the style list from
  a set of font faces) is pure functions.

Part 4, saving:

* During a change, set the value inline on the element. On release, Enter or blur, save it and
  drop the inline value once the hot reload lands, as ETH-102 does (AC 16).
* Each control has a reset that removes its value from the override file (AC 18). Style resets
  weight and italic together.
* If the element sets the property in an inline `style`, show the control read-only with the
  reason ETH-102 uses.

## Test plan

* Check font rendering in Helium, Chrome and Safari. Inspect actual Safari when available;
  label Linux WebKit as an approximation and report any browser not exercised.
* One browser test walks the story on a heading in the scripted demo: select it, pick a larger
  step, type 15, pick Bold Italic, set letter spacing to -0.5, press Up twice in line height,
  align centre, then reset each. At each step it asserts the computed style, the control's
  value and the override file.
* Unit tests cover each value check with one accepted and one refused value, the three pure
  functions, and a system font's style list.
* Search the `pnpm build` output for `__workbench` (AC 19).
* `git status` after the browser test shows only `overrides.css` (AC 17).
* Take screenshots of the section with a heading selected, with the Size list open, and with an
  off-the-scale size, and look at them beside Figma's panel in the story's source screenshot.

## Done when

* The browser test and the unit tests pass.
* The build output contains no `__workbench` string.
* The three screenshots show nothing misaligned, and the build thread's report includes them.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: MEDIUM. The endpoint now accepts values that are not plain pixel numbers, so each new
value check is tested with a refusal. The step sizes are read from the frame as plain pixel
lengths; the dial ticket may turn them into worked-out values, and it then owns that change.
Vertical alignment is hidden on flex and grid elements, where `align-content` means something
else; add it there when a mockup needs it. A weight the family lacks cannot be picked, because
the list holds only what the family has.

## Drift log

Record here anything built differently from this plan, and why.
