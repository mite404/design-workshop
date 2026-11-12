---
linear: ETH-139
---
# Tune the controls' hover duration as one shared token

## Status

- **Goal**: Ethan tunes how fast every control answers a hover, by eye, in one place.
- **Initial priority**: P3
- **Effort**: Medium
- **Category**: feature
- **Planned at**: commit `75ae570`, 2026-11-12
- **Plan**: PRD R17, first block; Ethan's decision in PRD section 13 ("shared")

## Why this matters

PRD section 5 says durations are design values like any other custom property, and Ethan wants
motion values shared rather than set per element. The catalog hardcoded the controls' 150ms hover
in five rules, so changing it meant five edits.

## Approach

* One `:root` token, `--motion-hover: 150ms`, in the catalog's `tokens.css`. The button, icon
  button, field and awaiting-tile hover transitions read it (ADR-038).
* The Workbench edits it in a "Motion" section with the type scale's field: type, arrows, a
  scrub on the label, Escape and Reset. The endpoint takes whole milliseconds only.

## Scope

* In: the shared hover duration.
* Out: easing curves and their editor, other durations (panel and drawer motion), and
  scrubbing a running transition.

## Done when

* `scale-check.mjs` reads 150ms on a button and an icon button, types 300, sees the file and
  both controls at 300ms, then resets to an empty file.
* `plugin.test.ts` refuses a duration in px.
* The full verifying-workbench run passes.
* Commit bodies name this ticket's Linear identifier.

## Drift log

* "Hover duration" wrapped to two lines beside its field; the label is "Hover time".
* A duration of 0ms showed as blank, because the field read 0 as missing; it now shows 0.
