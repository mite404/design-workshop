---
linear: ETH-107
---
# Add the Basics popover to the Typography section

## Status

- **Goal**: a settings button in the Typography section opens a popover for justify,
  decoration, case, vertical trim, list style and paragraph spacing.
- **Initial priority**: P3
- **Effort**: Medium
- **Risk**: LOW
- **Category**: feature
- **Planned at**: commit `6132eaa`, 2026-11-11
- **Story**: [type-inspector-story.md](type-inspector-story.md). Needs ETH-105 (the Typography
  section).

## Why this matters

These are the type settings used less often, which Figma keeps one click away. Ethan asked for
three of them by name: vertical trim, list style and paragraph spacing. "AC 14" below means
criterion 14 in `type-inspector-story.md`. This ticket covers AC 14 and 15, and AC 16 to 19 for
its own controls.

## Current state

* After the Typography section ticket, the inspector shows style, size, line height, letter
  spacing and two alignments for a selected piece of text, and the values endpoint checks each
  property's value on its own.
* Horizontal alignment offers left, centre and right.
* `text-box` (vertical trim) works in current Chrome, Edge, Safari and Firefox (MDN, checked
  Nov 11 2026).
* `tokens.css` sets `font-synthesis: none`, so the browser does not fake small capitals for a
  font that has none.

## Approach

Each control writes plain CSS through the saving flow that already exists.

| Control | Property | What is saved |
| --- | --- | --- |
| Alignment | `text-align` | Adds `justify` to the three values |
| Decoration | `text-decoration-line` | `none`, `underline` or `line-through` |
| Case | `text-transform` and `font-variant-caps` | See below |
| Vertical trim | `text-box` | `normal`, or `trim-both cap alphabetic` |
| List style | `list-style-type`, and for a plain block two more | See below |
| Paragraph spacing | `margin-bottom` | Whole pixels from 0 |

Case is one choice over two properties, because small capitals are not a `text-transform`.
Upper, lower and title save `uppercase`, `lowercase` or `capitalize` with
`font-variant-caps: normal`. Small caps saves `text-transform: none` with
`font-variant-caps: small-caps`. As typed saves `none` and `normal`.

List style depends on what is selected. On a `ul`, `ol` or `li` it only changes the markers:
`list-style-type` is `none`, `disc` or `decimal`. On any other element whose `display` is
`block`, bulleted or numbered also saves `display: list-item` and
`list-style-position: inside`, and none removes all three. On anything else the control is
off, with a short reason. Rejected: wrapping the element in a list, because the Workbench never
changes the mockup's markup.

Paragraph spacing is the space below the selected element, because on the web each paragraph
is its own element.

The popover uses whatever floating panel the inspector already has by then. If it has none, use
the browser's own `popover` attribute. No new dependency.

## Scope

* In: `packages/workbench`: the settings button, the popover, the endpoint's new properties and
  values, and their tests.
* Out: truncate, wrap style, the Details tab, and decoration's line style, thickness and
  offset. The story excludes them.
* Out: turning typed `- ` or `1. ` into a list. The Workbench does not edit text (ADR-001).
* Out: indenting a list item's wrapped lines. A marker placed inside lets them run under it.

## Steps

Part 1, the endpoint:

* Add to the element properties: `text-decoration-line`, `text-transform`,
  `font-variant-caps`, `text-box`, `list-style-type`, `list-style-position`, `display` and
  `margin-bottom`. Add `justify` to `text-align`.
* Each accepts only the values in the Approach section. `display` accepts `list-item` and
  nothing else. `margin-bottom` accepts whole pixels of 0 or more.
* Check: `curl` saves and resets each. `display: none` and `margin-bottom: -4px` are refused.

Part 2, the popover:

* Add the settings button at the top right of the Typography section, as in Figma. It opens
  the popover; Escape or a click outside closes it, and focus returns to the button.
* Lay the controls out in Figma's order: alignment, decoration, case, vertical trim, list
  style, paragraph spacing (AC 14).
* Fill each from the element's computed style. Alignment here and in the section stay in step.

Part 3, the controls:

* Alignment, decoration, case, vertical trim and list style are button groups with a pressed
  state. Each button has a name a screen reader can read.
* Case and list style save their properties together, one request after another.
* Paragraph spacing is a number field. Arrow keys move it 2px, or 10px with Shift, never below
  0 (AC 15).
* Saving, reset and the read-only state for inline styles work as in the Typography section
  ticket (AC 16, 18). Reset on case and on list style removes every property the control wrote.

## Test plan

* One browser test on a paragraph in the scripted demo: open the popover, set justify,
  underline, upper case, cap-height trim, bulleted, and paragraph spacing by pressing Up three
  times, then reset each. At each step it asserts the computed style and the override file.
* The same test selects a `ul` and asserts that numbered saves `list-style-type` alone.
* Unit tests cover each new value check with one accepted and one refused value.
* Search the `pnpm build` output for `__workbench` (AC 19).
* `git status` after the browser test shows only `overrides.css` (AC 17).
* Take screenshots of the open popover and of a paragraph with every setting applied, and look
  at them beside Figma's popover in the story's source screenshot.

## Done when

* The browser test and the unit tests pass.
* The build output contains no `__workbench` string.
* The two screenshots show nothing misaligned, and the build thread's report includes them.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: LOW. Every control is a fixed set of values or a whole number. Two things may look like
bugs and are not. Small caps changes nothing when the font has no small capitals, because the
Template stops the browser faking them; Figma behaves the same way. Paragraph spacing adds to
a parent's `gap`, and two margins that meet can merge into one, as CSS defines.

## Drift log

Record here anything built differently from this plan, and why.
