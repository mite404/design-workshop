# Story: scale all the type in a mockup together

Status: confirmed by Ethan, Nov 11 2026. Tickets: [ETH-104](type-scale-impl-ETH-104.md)
(preparation: name the sizes). The dial ticket is not written yet.

**As** a designer tuning a mockup an agent has already built,
**I want** to change the size of all the type at once while every size keeps its relationship
to the others, and have line spacing follow,
**so that** I can try a tighter or roomier type system by eye without doing maths in CSS.

## Where the rules come from

The pattern is a modular scale: one base size and one ratio, and every other size is the base
multiplied by the ratio some number of times. It is the model behind
[type-scale.com](https://typescale.com/) and behind fluid type tools such as Utopia. Figma has no
equivalent: its text styles are independent, so changing one does not move the others. This is
one place the Workbench goes past Figma, so ADR-009 ("do what Figma does") has nothing to copy.

Rules that are Ethan's own:

- Sizes stay even (ADR-015). A computed size is rounded down to a multiple of 2px. So 13px
  becomes 12px. Ethan: "probably rounded down, but we'll just have to wait until things are live
  to see". The rounding direction is therefore one value in one place.
- Line height sits on a 4px grid: the size times a leading value, rounded up to a multiple of
  4px.

The maths lives in CSS, not in the Workbench, so the running app is the design (ADR-014). CSS
`pow()` has been in all three browser engines since December 2023 and `round()` since May 2024
([MDN pow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/pow),
[MDN round](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/round)).

## What the app looks like today

Measured on the Template at PR #4:

- About 170 `font-size` declarations with a pixel number written in place, in 27 different
  values. The most used are 12px (60), 13px (25), 11px (16), 15px (13) and 14px (11).
- 79 Tailwind size classes on top: `text-xs` (44), `text-sm` (19), `text-[13px]` (9) and a few
  larger ones.
- No named sizes at all, so there is nothing for a dial to turn. That is what the preparation
  ticket fixes.
- In the three folders the preparation ticket covers: 107 declarations in 16 values.

## Acceptance criteria

Preparation (ETH-104):

1. Every font size in the app shell, the catalog and the shared components comes from one of
   nine named steps. No pixel font size is written in place in those folders.
2. The nine steps are a modular scale with a 12px base and a ratio of 1.2, rounded down to even:
   10, 12, 14, 16, 20, 24, 28, 34 and 42px. They carry Tailwind's size names, `--text-2xs` to
   `--text-4xl` (ADR-019).
3. A size worked out from another value stays as it is, and the ticket lists it. There is one:
   a guide title sized from the spacing unit. (Corrected Nov 11 2026: the three `clamp()`
   headlines and the 96px numeral first listed here were in the drift tool's stylesheet, which
   is deleted, ADR-020.)
4. Ethan can compare before and after screenshots of the shell and judge the rounding.

The dial (ticket to follow, once this story is confirmed):

5. The inspector has a Type panel with three fields: base size, ratio and leading. Below them
   it lists the nine steps with the size and line height each one works out to.
6. Changing a field changes every piece of text in the view live. Relationships hold: a heading
   two steps above the body text is still two steps above it.
7. Base size moves in steps of 2px. Ratio is picked from the named ratios (1.125, 1.2, 1.25,
   1.333, 1.5) or typed. Leading moves in steps of 0.05.
8. Line height follows the size: size times leading, rounded up to a multiple of 4px.
9. Arrow keys work in every field, as in the other stories.
10. On release, Enter, or blur, the three values are saved to the `:root` block of the override
    file. `git status` shows only the override file as modified.
11. Reset on a field removes it from the override file and the app's own value returns.
12. None of this exists in a production build.

## Not in this story

- The type of one element: its size, font, weight, line height and letter spacing. That is the
  [type inspector story](../type-inspector/type-inspector-story.md).
- Colour.
- A different ratio for headings than for body text. One ratio first; add a second if large
  sizes look wrong live.

## Effect on other tickets

- ETH-104 needs ETH-99 only. It does not need the override file.
- The dial ticket needs ETH-100 and ETH-101, and reuses the inspector and the `:root` saving
  that ETH-101 builds.
